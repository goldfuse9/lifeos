import type { SqlDriver } from './driver';

/**
 * Migrace schématu. Číslo verze se drží v `PRAGMA user_version`.
 * Nové migrace se jen PŘIDÁVAJÍ na konec — stávající se nikdy nemění,
 * protože v telefonech testerů už proběhly.
 */
const MIGRATIONS: string[] = [
  // 1 — základ fáze 1
  `
  CREATE TABLE persons (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    relation TEXT NOT NULL,
    birth_date TEXT,
    color INTEGER NOT NULL DEFAULT 0,
    is_self INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE records (
    id TEXT PRIMARY KEY NOT NULL,
    person_id TEXT NOT NULL REFERENCES persons(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    time TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX records_person_date ON records(person_id, date, time);

  CREATE TABLE attachments (
    id TEXT PRIMARY KEY NOT NULL,
    record_id TEXT NOT NULL REFERENCES records(id),
    person_id TEXT NOT NULL REFERENCES persons(id),
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    kind TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX attachments_record ON attachments(record_id);
  CREATE INDEX attachments_person ON attachments(person_id);

  CREATE TABLE person_data (
    person_id TEXT NOT NULL REFERENCES persons(id),
    section TEXT NOT NULL,
    json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (person_id, section)
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: SqlDriver): Promise<number> {
  await db.exec('PRAGMA foreign_keys = ON;');
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const current = row ? Number(row.user_version) : 0;
  if (current > MIGRATIONS.length) {
    throw new Error(`Databáze je novější (${current}) než aplikace (${MIGRATIONS.length}).`);
  }
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.transaction(async () => {
      await db.exec(MIGRATIONS[v]);
      await db.exec(`PRAGMA user_version = ${v + 1};`);
    });
  }
  return MIGRATIONS.length;
}
