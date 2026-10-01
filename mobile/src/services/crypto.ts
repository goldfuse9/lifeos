import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { gcm } from '@noble/ciphers/aes.js';

/**
 * Kryptografické minimum pro lokální účet.
 *
 * Heslo se nikde neukládá. Z hesla se scryptem odvodí klíč (KEK), kterým
 * se zašifruje náhodný klíč databáze (DEK). Uložený je jen zašifrovaný DEK.
 * Ověření hesla = podaří se DEK rozšifrovat (AES-GCM má autentizační tag,
 * takže špatné heslo neprojde potichu).
 *
 * Všechno je čisté JS (noble) — běží stejně v Hermesu i v testech v Node.
 */

export interface KdfParams {
  alg: 'scrypt';
  N: number;
  r: number;
  p: number;
  salt: string;
}

/** Parametry pro nové účty. N=2^14 (16 MiB) je kompromis pro JS na telefonu; parametry se ukládají, takže jdou později zvednout. */
export const KDF_DEFAULTS = { N: 1 << 14, r: 8, p: 1 };

export type RandomBytes = (n: number) => Uint8Array;

export async function deriveKey(password: string, params: KdfParams): Promise<Uint8Array> {
  return scryptAsync(utf8ToBytes(password.normalize('NFKC')), hexToBytes(params.salt), {
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen: 32,
  });
}

/** nonce (12 B) || šifrový text s tagem, hex */
export function seal(key: Uint8Array, plaintext: Uint8Array, random: RandomBytes, aad?: string): string {
  const nonce = random(12);
  const ct = gcm(key, nonce, aad ? utf8ToBytes(aad) : undefined).encrypt(plaintext);
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce, 0);
  out.set(ct, nonce.length);
  return bytesToHex(out);
}

export function open(key: Uint8Array, sealedHex: string, aad?: string): Uint8Array {
  const all = hexToBytes(sealedHex);
  if (all.length < 12 + 16) throw new Error('Poškozená data.');
  const nonce = all.slice(0, 12);
  const ct = all.slice(12);
  return gcm(key, nonce, aad ? utf8ToBytes(aad) : undefined).decrypt(ct);
}

export { bytesToHex, hexToBytes };
