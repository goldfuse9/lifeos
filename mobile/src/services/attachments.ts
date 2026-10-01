import type { Attachment, AttachmentKind, Id } from '@/domain/types';
import type { AttachmentRepository } from '@/data/repositories';

/**
 * Přílohy: soubor se zkopíruje do aplikačního sandboxu pod náhodným
 * jménem (původní název je jen v databázi) a teprve pak se zapíše řádek.
 * Když zápis do databáze selže, kopie se uklidí.
 */

export interface FileStore {
  /** Zkopíruje soubor ze zdrojové URI do sandboxu, vrátí velikost. */
  importFrom(sourceUri: string, fileName: string): Promise<{ size: number }>;
  /** URI, přes kterou jde soubor zobrazit nebo předat systému. */
  uriFor(fileName: string): string;
  exists(fileName: string): boolean;
  remove(fileName: string): void;
  list(): string[];
  removeAll(): void;
}

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export function kindFor(mime: string, name: string): AttachmentKind {
  const n = name.toLowerCase();
  if (mime.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|gif)$/.test(n)) return 'photo';
  if (mime === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  return 'file';
}

export function guessMime(name: string): string {
  const n = name.toLowerCase();
  if (/\.jpe?g$/.test(n)) return 'image/jpeg';
  if (n.endsWith('.png')) return 'image/png';
  if (/\.hei[cf]$/.test(n)) return 'image/heic';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.txt')) return 'text/plain';
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

function extension(name: string, mime: string): string {
  const m = /\.([a-z0-9]{1,6})$/i.exec(name);
  if (m) return m[1].toLowerCase();
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'application/pdf') return 'pdf';
  return 'bin';
}

/** Odstraní z názvu cesty a řídicí znaky, zkrátí ho. */
export function cleanName(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'soubor';
  const cleaned = base.replace(/[\u0000-\u001f]/g, '').trim();
  return (cleaned || 'soubor').slice(0, 120);
}

export class AttachmentService {
  constructor(private repo: AttachmentRepository, private files: FileStore, private newId: () => string) {}

  async add(recordId: Id, personId: Id, picked: PickedFile): Promise<Attachment> {
    if (picked.size != null && picked.size > MAX_ATTACHMENT_BYTES) {
      throw new Error('Soubor je větší než 50 MB.');
    }
    const name = cleanName(picked.name);
    const mime = picked.mimeType || guessMime(name);
    const id = this.newId();
    const fileName = id + '.' + extension(name, mime);
    const { size } = await this.files.importFrom(picked.uri, fileName);
    if (size > MAX_ATTACHMENT_BYTES) {
      this.files.remove(fileName);
      throw new Error('Soubor je větší než 50 MB.');
    }
    try {
      return await this.repo.create({ id, recordId, personId, name, mimeType: mime, size, kind: kindFor(mime, name), fileName });
    } catch (e) {
      this.files.remove(fileName);
      throw e;
    }
  }

  async remove(id: Id): Promise<void> {
    const a = await this.repo.get(id);
    if (!a) return;
    await this.repo.softDelete(id);
    this.files.remove(a.fileName);
  }

  uri(a: Attachment): string {
    return this.files.uriFor(a.fileName);
  }

  available(a: Attachment): boolean {
    return this.files.exists(a.fileName);
  }

  /**
   * Smaže ze sandboxu soubory, ke kterým už nevede žádný živý záznam
   * (smazané záznamy, nedokončené importy). Volá se po odemknutí.
   */
  async collectGarbage(): Promise<number> {
    const live = await this.repo.liveFileNames();
    let n = 0;
    for (const f of this.files.list()) {
      if (!live.has(f)) {
        this.files.remove(f);
        n++;
      }
    }
    return n;
  }
}
