/**
 * Tenké rozhraní nad SQL. V aplikaci ho implementuje expo-sqlite
 * (SQLCipher), v testech better-sqlite3. Repozitáře nevědí, který z nich
 * je pod nimi — a až přijde cloud (fáze 2), přidá se vedle, ne místo.
 */
export type SqlValue = string | number | null;

export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T | null>;
  transaction(fn: () => Promise<void>): Promise<void>;
  close(): Promise<void>;
}
