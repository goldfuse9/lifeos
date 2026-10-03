import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { SqlDriver, SqlValue } from '@/data/driver';
import { SCHEMA_VERSION } from '@/data/migrations';
import { KDF_DEFAULTS, deriveKey, type KdfParams, type RandomBytes } from './crypto';

/**
 * Šifrovaná záloha — jeden soubor .lifeos, který si člověk uloží kam chce
 * (Soubory, iCloud, e-mail sobě). Bez hesla je nečitelný.
 *
 * Formát:
 *   "LIFEOS-ZALOHA\n" + hlavička JSON + "\n" + nonce (12 B) + AES-256-GCM
 * Hlavička (nešifrovaná, ale chráněná jako AAD) obsahuje jen verzi, datum
 * a parametry scryptu — žádné jméno ani e-mail.
 * Obsah: [délka JSON, 4 B] + JSON (tabulky, seznam souborů) + bajty souborů.
 *
 * Klíč se odvozuje z hesla účtu v okamžiku zálohy (scrypt, nová sůl).
 */

const MAGIC = 'LIFEOS-ZALOHA\n';
const TABLES = ['persons', 'records', 'attachments', 'person_data', 'settings'] as const;
type Table = (typeof TABLES)[number];
/** Smazané řádky se nezálohují. */
const LIVE: Partial<Record<Table, string>> = { persons: 'deleted_at IS NULL', records: 'deleted_at IS NULL', attachments: 'deleted_at IS NULL' };

export interface BackupHeader {
  v: 1;
  createdAt: string;
  kdf: KdfParams;
}

export interface BackupContent {
  account: { name: string; email: string };
  createdAt: string;
  schema: number;
  tables: Record<Table, Record<string, SqlValue>[]>;
  files: Map<string, Uint8Array>;
}

export interface BackupFiles {
  read(fileName: string): Promise<Uint8Array>;
  write(fileName: string, bytes: Uint8Array): void;
  exists(fileName: string): boolean;
}

/** UTF-8 → text (TextDecoder nemusí být v každém Hermesu). */
function utf8(b: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(b);
  let out = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 0x1f) << 6) | (b[i++] & 0x3f);
    else if (c < 0xf0) cp = ((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
    else cp = ((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
    out += String.fromCodePoint(cp);
  }
  return out;
}

export class BackupError extends Error {
  constructor(
    readonly code: 'format' | 'password' | 'newer',
    message: string,
  ) {
    super(message);
  }
}

/** Posbírá všechno z databáze a souborů. */
export async function collectBackup(db: SqlDriver, files: BackupFiles, account: { name: string; email: string }, now: Date): Promise<BackupContent> {
  const tables = {} as BackupContent['tables'];
  for (const t of TABLES) {
    tables[t] = await db.all<Record<string, SqlValue>>(`SELECT * FROM ${t}${LIVE[t] ? ' WHERE ' + LIVE[t] : ''}`);
  }
  const out = new Map<string, Uint8Array>();
  for (const a of tables.attachments) {
    const name = String(a.file_name);
    // Chybějící soubor (smazaný mimo aplikaci) zálohu nezastaví.
    if (files.exists(name)) out.set(name, await files.read(name));
  }
  return { account, createdAt: now.toISOString(), schema: SCHEMA_VERSION, tables, files: out };
}

export async function sealBackup(c: BackupContent, password: string, random: RandomBytes): Promise<Uint8Array> {
  const header: BackupHeader = { v: 1, createdAt: c.createdAt, kdf: { alg: 'scrypt', ...KDF_DEFAULTS, salt: bytesToHex(random(16)) } };
  const headerJson = JSON.stringify(header);
  const list = [...c.files.entries()].map(([name, b]) => ({ name, length: b.length }));
  const json = utf8ToBytes(JSON.stringify({ account: c.account, createdAt: c.createdAt, schema: c.schema, tables: c.tables, files: list }));
  const total = 4 + json.length + list.reduce((s, f) => s + f.length, 0);
  const plain = new Uint8Array(total);
  new DataView(plain.buffer).setUint32(0, json.length);
  plain.set(json, 4);
  let off = 4 + json.length;
  for (const [, b] of c.files) {
    plain.set(b, off);
    off += b.length;
  }
  const key = await deriveKey(password, header.kdf);
  const nonce = random(12);
  const ct = gcm(key, nonce, utf8ToBytes(headerJson)).encrypt(plain);
  const head = utf8ToBytes(MAGIC + headerJson + '\n');
  const out = new Uint8Array(head.length + 12 + ct.length);
  out.set(head, 0);
  out.set(nonce, head.length);
  out.set(ct, head.length + 12);
  return out;
}

function split(bytes: Uint8Array): { header: BackupHeader; headerJson: string; body: Uint8Array } {
  const magic = utf8ToBytes(MAGIC);
  for (let i = 0; i < magic.length; i++) if (bytes[i] !== magic[i]) throw new BackupError('format', 'Tohle není záloha LifeOS.');
  let nl = magic.length;
  while (nl < bytes.length && nl < magic.length + 4096 && bytes[nl] !== 10) nl++;
  if (bytes[nl] !== 10) throw new BackupError('format', 'Záloha je poškozená.');
  const headerJson = utf8(bytes.subarray(magic.length, nl));
  let header: BackupHeader;
  try {
    header = JSON.parse(headerJson);
  } catch {
    throw new BackupError('format', 'Záloha je poškozená.');
  }
  if (header?.v !== 1 || header.kdf?.alg !== 'scrypt') throw new BackupError('format', 'Tuto verzi zálohy aplikace nezná.');
  return { header, headerJson, body: bytes.subarray(nl + 1) };
}

/** Jen hlavička — datum zálohy, bez hesla. */
export function readBackupHeader(bytes: Uint8Array): BackupHeader {
  return split(bytes).header;
}

export async function openBackup(bytes: Uint8Array, password: string): Promise<BackupContent> {
  const { header, headerJson, body } = split(bytes);
  if (body.length < 12 + 16) throw new BackupError('format', 'Záloha je poškozená.');
  const key = await deriveKey(password, header.kdf);
  let plain: Uint8Array;
  try {
    plain = gcm(key, body.subarray(0, 12), utf8ToBytes(headerJson)).decrypt(body.subarray(12));
  } catch {
    throw new BackupError('password', 'Heslo nesedí, nebo je soubor poškozený.');
  }
  const len = new DataView(plain.buffer, plain.byteOffset).getUint32(0);
  const meta = JSON.parse(utf8(plain.subarray(4, 4 + len))) as Omit<BackupContent, 'files'> & { files: { name: string; length: number }[] };
  if (meta.schema > SCHEMA_VERSION) throw new BackupError('newer', 'Záloha je z novější verze aplikace. Aktualizujte aplikaci.');
  const files = new Map<string, Uint8Array>();
  let off = 4 + len;
  for (const f of meta.files) {
    files.set(f.name, plain.slice(off, off + f.length));
    off += f.length;
  }
  return { account: meta.account, createdAt: meta.createdAt, schema: meta.schema, tables: meta.tables, files };
}

/** Nahraje zálohu do (čerstvé) databáze — stávající obsah tabulek nahradí. */
export async function restoreBackup(db: SqlDriver, files: BackupFiles, c: BackupContent): Promise<void> {
  const safeName = /^[A-Za-z0-9-]+\.[a-z0-9]{1,6}$/;
  await db.transaction(async () => {
    // Pořadí kvůli cizím klíčům: nejdřív závislé.
    for (const t of ['attachments', 'records', 'person_data', 'persons', 'settings'] as const) await db.run(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      for (const row of c.tables[t] ?? []) {
        const cols = Object.keys(row).filter((k) => /^[a-z_]+$/.test(k));
        if (!cols.length) continue;
        await db.run(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((k) => row[k]));
      }
    }
  });
  for (const [name, bytes] of c.files) {
    if (safeName.test(name)) files.write(name, bytes);
  }
}
