import * as SQLite from 'expo-sqlite';
import type { SqlDriver, SqlValue } from '@/data/driver';

/**
 * expo-sqlite (SQLCipher) v roli SqlDriveru.
 *
 * `PRAGMA key` musí být první příkaz po otevření. Klíč je náhodných 32 B
 * (hex), proto syntaxe `x'…'` — SQLCipher ho pak použije přímo jako klíč
 * a nepouští přes vlastní KDF.
 */

export const DB_NAME = 'humancare.db';

export async function openEncryptedDb(keyHex: string): Promise<SqlDriver> {
  if (!/^[0-9a-f]{64}$/.test(keyHex)) throw new Error('Neplatný klíč databáze.');
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  try {
    await db.execAsync(`PRAGMA key = "x'${keyHex}'";`);
    // Se špatným klíčem padne až první skutečné čtení — tady, ne v půlce obrazovky.
    await db.getFirstAsync('SELECT count(*) AS n FROM sqlite_master');
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  } catch (e) {
    await db.closeAsync().catch(() => {});
    throw e;
  }
  return wrap(db);
}

export async function deleteDb(): Promise<void> {
  try {
    await SQLite.deleteDatabaseAsync(DB_NAME);
  } catch {
    // Databáze neexistovala.
  }
}

function wrap(db: SQLite.SQLiteDatabase): SqlDriver {
  // Transakce jedna po druhé: SQLite má jedno spojení a dvě souběžné
  // transakce by se do sebe zamotaly. Vnořené volání jde přes savepoint.
  let chain: Promise<unknown> = Promise.resolve();
  let depth = 0;
  let sp = 0;

  const runTx = async (fn: () => Promise<void>) => {
    const name = 'sp' + sp++;
    depth++;
    await db.execAsync(`SAVEPOINT ${name}`);
    try {
      await fn();
      await db.execAsync(`RELEASE ${name}`);
    } catch (e) {
      await db.execAsync(`ROLLBACK TO ${name}; RELEASE ${name};`).catch(() => {});
      throw e;
    } finally {
      depth--;
    }
  };

  return {
    async exec(sql) {
      await db.execAsync(sql);
    },
    async run(sql, params: SqlValue[] = []) {
      const r = await db.runAsync(sql, params);
      return { changes: r.changes };
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return (await db.getAllAsync(sql, params)) as T[];
    },
    async first<T>(sql: string, params: SqlValue[] = []) {
      return ((await db.getFirstAsync(sql, params)) as T) ?? null;
    },
    transaction(fn) {
      if (depth > 0) return runTx(fn);
      const next = chain.then(() => runTx(fn));
      chain = next.catch(() => {});
      return next;
    },
    async close() {
      await chain.catch(() => {});
      await db.closeAsync();
    },
  };
}
