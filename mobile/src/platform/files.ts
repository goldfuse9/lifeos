import { Directory, File, Paths } from 'expo-file-system';
import type { FileStore } from '@/services/attachments';

/**
 * Přílohy v aplikačním sandboxu: Documents/attachments/<uuid>.<přípona>.
 * Na iOS i Androidu jde o soukromou složku aplikace, kterou jiné aplikace
 * nevidí a kterou OS šifruje spolu se zařízením.
 */
function dir(): Directory {
  const d = new Directory(Paths.document, 'attachments');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

function safe(fileName: string): string {
  if (!/^[A-Za-z0-9-]+\.[a-z0-9]{1,6}$/.test(fileName)) throw new Error('Neplatný název souboru.');
  return fileName;
}

export const sandboxFiles: FileStore = {
  async importFrom(sourceUri, fileName) {
    const dest = new File(dir(), safe(fileName));
    if (dest.exists) dest.delete();
    await new File(sourceUri).copy(dest);
    const size = new File(dir(), fileName).size ?? 0;
    return { size };
  },
  uriFor(fileName) {
    return new File(dir(), safe(fileName)).uri;
  },
  exists(fileName) {
    try {
      return new File(dir(), safe(fileName)).exists;
    } catch {
      return false;
    }
  },
  remove(fileName) {
    try {
      const f = new File(dir(), safe(fileName));
      if (f.exists) f.delete();
    } catch {
      // už neexistuje
    }
  },
  list() {
    return dir()
      .list()
      .filter((x): x is File => x instanceof File)
      .map((f) => f.name);
  },
  removeAll() {
    const d = new Directory(Paths.document, 'attachments');
    if (d.exists) d.delete();
  },
};

/** Dočasný soubor v cache (export). */
export function cacheFile(name: string, content: string): string {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(content);
  return f.uri;
}

export function removeCacheFile(name: string): void {
  try {
    const f = new File(Paths.cache, name);
    if (f.exists) f.delete();
  } catch {
    // nic
  }
}
