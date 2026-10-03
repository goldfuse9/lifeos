import Database from 'better-sqlite3';
import { randomBytes, randomUUID } from 'crypto';
import type { SqlDriver, SqlValue } from '@/data/driver';
import type { KeyStore } from '@/services/auth';
import type { FileStore } from '@/services/attachments';

/** better-sqlite3 v roli SqlDriveru — stejné SQL jako v telefonu, jen bez SQLCipheru. */
export function memoryDriver(): SqlDriver {
  const db = new Database(':memory:');
  let depth = 0;
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params: SqlValue[] = []) {
      const r = db.prepare(sql).run(...params);
      return { changes: r.changes };
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      const st = db.prepare(sql);
      return (st.reader ? st.all(...params) : (st.run(...params), [])) as T[];
    },
    async first<T>(sql: string, params: SqlValue[] = []) {
      const st = db.prepare(sql);
      if (!st.reader) {
        st.run(...params);
        return null;
      }
      return ((st.get(...params) as T) ?? null) as T | null;
    },
    async transaction(fn) {
      // Vnořené transakce přes savepointy — stejně jako v aplikaci.
      const name = 'sp' + depth++;
      db.exec(`SAVEPOINT ${name}`);
      try {
        await fn();
        db.exec(`RELEASE ${name}`);
      } catch (e) {
        db.exec(`ROLLBACK TO ${name}`);
        db.exec(`RELEASE ${name}`);
        throw e;
      } finally {
        depth--;
      }
    },
    async close() {
      db.close();
    },
  };
}

export function memoryKeyStore(): KeyStore & { data: Map<string, string>; bioFails: boolean } {
  const data = new Map<string, string>();
  const ks = {
    data,
    bioFails: false,
    async get(key: string, opts?: { requireAuthentication?: boolean }) {
      if (opts?.requireAuthentication && ks.bioFails) throw new Error('user_cancel');
      return data.get(key) ?? null;
    },
    async set(key: string, value: string) {
      data.set(key, value);
    },
    async delete(key: string) {
      data.delete(key);
    },
  };
  return ks;
}

export function memoryFileStore(sources: Record<string, number> = {}): FileStore & { files: Map<string, number> } {
  const files = new Map<string, number>();
  return {
    files,
    async importFrom(uri, fileName) {
      if (!(uri in sources)) throw new Error('Soubor nejde přečíst.');
      files.set(fileName, sources[uri]);
      return { size: sources[uri] };
    },
    uriFor: (f) => 'file:///sandbox/' + f,
    exists: (f) => files.has(f),
    remove: (f) => {
      files.delete(f);
    },
    list: () => [...files.keys()],
    removeAll: () => files.clear(),
  };
}

export const nodeRandom = (n: number) => new Uint8Array(randomBytes(n));
export const uuid = () => randomUUID();

export function fixedClock(iso = '2026-10-01T08:00:00.000Z') {
  let t = new Date(iso).getTime();
  return {
    now: () => new Date(t),
    tick(ms = 1000) {
      t += ms;
    },
  };
}
