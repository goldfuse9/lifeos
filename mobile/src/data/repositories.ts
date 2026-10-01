import type { SqlDriver } from './driver';
import type {
  AppSettings,
  Attachment,
  AttachmentKind,
  DoctorList,
  EmergencyData,
  HcRecord,
  Id,
  LocalDate,
  Person,
  PersonalData,
  RecordDraft,
  RecordMetadata,
  RecordType,
  Relation,
} from '@/domain/types';
import { DEFAULT_SETTINGS } from '@/domain/types';
import type { CycleSettings } from '@/domain/cycle';

/**
 * Repozitáře — jediné místo, které zná SQL. Služby a obrazovky pracují
 * s doménovými objekty. Všechny dotazy vynechávají smazané řádky
 * (deleted_at), smazání je měkké kvůli budoucí synchronizaci.
 */

export interface Clock {
  now(): Date;
}
export interface IdGen {
  (): string;
}

type Row = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? '' : String(v));
const strOrNull = (v: unknown): string | null => (v == null ? null : String(v));

function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== 'string' || !v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function toPerson(r: Row): Person {
  return {
    id: str(r.id),
    name: str(r.name),
    relation: str(r.relation) as Relation,
    birthDate: strOrNull(r.birth_date),
    color: Number(r.color) || 0,
    isSelf: Number(r.is_self) === 1,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
    deletedAt: strOrNull(r.deleted_at),
  };
}

function toRecord(r: Row): HcRecord {
  return {
    id: str(r.id),
    personId: str(r.person_id),
    type: str(r.type) as RecordType,
    title: str(r.title),
    description: str(r.description),
    date: str(r.date),
    time: strOrNull(r.time),
    metadata: parseJson<RecordMetadata>(r.metadata, {}),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
    deletedAt: strOrNull(r.deleted_at),
  };
}

function toAttachment(r: Row): Attachment {
  return {
    id: str(r.id),
    recordId: str(r.record_id),
    personId: str(r.person_id),
    name: str(r.name),
    mimeType: str(r.mime_type),
    size: Number(r.size) || 0,
    kind: str(r.kind) as AttachmentKind,
    fileName: str(r.file_name),
    createdAt: str(r.created_at),
    deletedAt: strOrNull(r.deleted_at),
  };
}

/** Řazení osy: nejnovější den nahoře, v rámci dne nejpozdější čas nahoře, celodenní na konci dne. */
const ORDER_DESC = `ORDER BY date DESC, CASE WHEN time IS NULL THEN 0 ELSE 1 END DESC, time DESC, created_at DESC`;
const ORDER_ASC = `ORDER BY date ASC, CASE WHEN time IS NULL THEN 0 ELSE 1 END ASC, time ASC, created_at ASC`;

export class PersonRepository {
  constructor(private db: SqlDriver, private clock: Clock, private newId: IdGen) {}

  async list(): Promise<Person[]> {
    const rows = await this.db.all<Row>(
      `SELECT * FROM persons WHERE deleted_at IS NULL ORDER BY is_self DESC, created_at ASC`,
    );
    return rows.map(toPerson);
  }

  async get(id: Id): Promise<Person | null> {
    const r = await this.db.first<Row>(`SELECT * FROM persons WHERE id = ? AND deleted_at IS NULL`, [id]);
    return r ? toPerson(r) : null;
  }

  async create(p: { name: string; relation: Relation; birthDate?: LocalDate | null; color?: number; isSelf?: boolean }): Promise<Person> {
    const now = this.clock.now().toISOString();
    const id = this.newId();
    await this.db.run(
      `INSERT INTO persons (id, name, relation, birth_date, color, is_self, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, p.name.trim(), p.relation, p.birthDate ?? null, p.color ?? 0, p.isSelf ? 1 : 0, now, now],
    );
    return (await this.get(id))!;
  }

  async update(id: Id, patch: Partial<Pick<Person, 'name' | 'relation' | 'birthDate' | 'color'>>): Promise<Person> {
    const cur = await this.get(id);
    if (!cur) throw new Error('Karta neexistuje.');
    const next = { ...cur, ...patch };
    await this.db.run(
      `UPDATE persons SET name = ?, relation = ?, birth_date = ?, color = ?, updated_at = ? WHERE id = ?`,
      [next.name.trim(), next.relation, next.birthDate ?? null, next.color, this.clock.now().toISOString(), id],
    );
    return (await this.get(id))!;
  }

  async softDelete(id: Id): Promise<void> {
    const p = await this.get(id);
    if (!p) return;
    if (p.isSelf) throw new Error('Vlastní kartu nelze smazat.');
    const now = this.clock.now().toISOString();
    await this.db.transaction(async () => {
      await this.db.run(`UPDATE persons SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
      await this.db.run(`UPDATE records SET deleted_at = ?, updated_at = ? WHERE person_id = ? AND deleted_at IS NULL`, [now, now, id]);
      await this.db.run(`UPDATE attachments SET deleted_at = ? WHERE person_id = ? AND deleted_at IS NULL`, [now, id]);
    });
  }
}

export interface RecordQuery {
  personId: Id;
  types?: RecordType[];
  from?: LocalDate;
  to?: LocalDate;
  text?: string;
  onlyWithAttachments?: boolean;
  order?: 'asc' | 'desc';
  limit?: number;
}

export class RecordRepository {
  constructor(private db: SqlDriver, private clock: Clock, private newId: IdGen) {}

  async get(id: Id): Promise<HcRecord | null> {
    const r = await this.db.first<Row>(`SELECT * FROM records WHERE id = ? AND deleted_at IS NULL`, [id]);
    return r ? toRecord(r) : null;
  }

  async query(q: RecordQuery): Promise<HcRecord[]> {
    const where = ['person_id = ?', 'deleted_at IS NULL'];
    const params: (string | number)[] = [q.personId];
    if (q.types && q.types.length) {
      where.push(`type IN (${q.types.map(() => '?').join(',')})`);
      params.push(...q.types);
    }
    if (q.from) {
      where.push('date >= ?');
      params.push(q.from);
    }
    if (q.to) {
      where.push('date <= ?');
      params.push(q.to);
    }
    if (q.onlyWithAttachments) {
      where.push('EXISTS (SELECT 1 FROM attachments a WHERE a.record_id = records.id AND a.deleted_at IS NULL)');
    }
    if (q.text && q.text.trim()) {
      // Hledá se v názvu, popisu, metadatech i v názvech příloh. LIKE stačí
      // na stovky záznamů jednoho člověka; fulltext (FTS5) až bude potřeba.
      const like = '%' + q.text.trim().toLowerCase().replace(/[%_]/g, (m) => '\\' + m) + '%';
      where.push(`(lower(title) LIKE ? ESCAPE '\\' OR lower(description) LIKE ? ESCAPE '\\' OR lower(metadata) LIKE ? ESCAPE '\\'
        OR EXISTS (SELECT 1 FROM attachments a WHERE a.record_id = records.id AND a.deleted_at IS NULL AND lower(a.name) LIKE ? ESCAPE '\\'))`);
      params.push(like, like, like, like);
    }
    const sql = `SELECT * FROM records WHERE ${where.join(' AND ')} ${q.order === 'asc' ? ORDER_ASC : ORDER_DESC}${q.limit ? ' LIMIT ' + Math.floor(q.limit) : ''}`;
    const rows = await this.db.all<Row>(sql, params);
    return rows.map(toRecord);
  }

  /** Dny, ve kterých má osoba aspoň jeden záznam (pro tečky v kalendáři). */
  async datesWithRecords(personId: Id, from: LocalDate, to: LocalDate): Promise<Map<LocalDate, number>> {
    const rows = await this.db.all<{ date: string; n: number }>(
      `SELECT date, COUNT(*) AS n FROM records WHERE person_id = ? AND deleted_at IS NULL AND date >= ? AND date <= ? GROUP BY date`,
      [personId, from, to],
    );
    return new Map(rows.map((r) => [String(r.date), Number(r.n)]));
  }

  async count(personId: Id): Promise<number> {
    const r = await this.db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM records WHERE person_id = ? AND deleted_at IS NULL`, [personId]);
    return r ? Number(r.n) : 0;
  }

  async create(personId: Id, d: RecordDraft): Promise<HcRecord> {
    const now = this.clock.now().toISOString();
    const id = this.newId();
    await this.db.run(
      `INSERT INTO records (id, person_id, type, title, description, date, time, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, personId, d.type, d.title.trim(), (d.description || '').trim(), d.date, d.time, JSON.stringify(d.metadata || {}), now, now],
    );
    return (await this.get(id))!;
  }

  async update(id: Id, d: Partial<RecordDraft>): Promise<HcRecord> {
    const cur = await this.get(id);
    if (!cur) throw new Error('Záznam neexistuje.');
    const next = {
      type: d.type ?? cur.type,
      title: (d.title ?? cur.title).trim(),
      description: (d.description ?? cur.description).trim(),
      date: d.date ?? cur.date,
      time: d.time === undefined ? cur.time : d.time,
      metadata: d.metadata ?? cur.metadata,
    };
    await this.db.run(
      `UPDATE records SET type = ?, title = ?, description = ?, date = ?, time = ?, metadata = ?, updated_at = ? WHERE id = ?`,
      [next.type, next.title, next.description, next.date, next.time, JSON.stringify(next.metadata), this.clock.now().toISOString(), id],
    );
    return (await this.get(id))!;
  }

  async softDelete(id: Id): Promise<void> {
    const now = this.clock.now().toISOString();
    await this.db.transaction(async () => {
      await this.db.run(`UPDATE records SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
      await this.db.run(`UPDATE attachments SET deleted_at = ? WHERE record_id = ? AND deleted_at IS NULL`, [now, id]);
    });
  }
}

export class AttachmentRepository {
  constructor(private db: SqlDriver, private clock: Clock, private newId: IdGen) {}

  async get(id: Id): Promise<Attachment | null> {
    const r = await this.db.first<Row>(`SELECT * FROM attachments WHERE id = ? AND deleted_at IS NULL`, [id]);
    return r ? toAttachment(r) : null;
  }

  async forRecord(recordId: Id): Promise<Attachment[]> {
    const rows = await this.db.all<Row>(`SELECT * FROM attachments WHERE record_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`, [recordId]);
    return rows.map(toAttachment);
  }

  async forRecords(recordIds: Id[]): Promise<Map<Id, Attachment[]>> {
    const out = new Map<Id, Attachment[]>();
    if (!recordIds.length) return out;
    // SQLite má limit parametrů; po dávkách po 500 je to bezpečné.
    for (let i = 0; i < recordIds.length; i += 500) {
      const chunk = recordIds.slice(i, i + 500);
      const rows = await this.db.all<Row>(
        `SELECT * FROM attachments WHERE record_id IN (${chunk.map(() => '?').join(',')}) AND deleted_at IS NULL ORDER BY created_at ASC`,
        chunk,
      );
      for (const r of rows.map(toAttachment)) {
        const list = out.get(r.recordId) || [];
        list.push(r);
        out.set(r.recordId, list);
      }
    }
    return out;
  }

  /** Všechny přílohy osoby i s datem a typem záznamu — pro obrazovku Dokumenty. */
  async forPerson(personId: Id): Promise<(Attachment & { recordDate: string; recordType: RecordType; recordTitle: string })[]> {
    const rows = await this.db.all<Row>(
      `SELECT a.*, r.date AS record_date, r.type AS record_type, r.title AS record_title
       FROM attachments a JOIN records r ON r.id = a.record_id
       WHERE a.person_id = ? AND a.deleted_at IS NULL AND r.deleted_at IS NULL
       ORDER BY r.date DESC, a.created_at DESC`,
      [personId],
    );
    return rows.map((r) => ({ ...toAttachment(r), recordDate: str(r.record_date), recordType: str(r.record_type) as RecordType, recordTitle: str(r.record_title) }));
  }

  async create(a: Omit<Attachment, 'id' | 'createdAt' | 'deletedAt'> & { id?: Id }): Promise<Attachment> {
    const id = a.id || this.newId();
    await this.db.run(
      `INSERT INTO attachments (id, record_id, person_id, name, mime_type, size, kind, file_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, a.recordId, a.personId, a.name, a.mimeType, a.size, a.kind, a.fileName, this.clock.now().toISOString()],
    );
    return (await this.get(id))!;
  }

  async rename(id: Id, name: string): Promise<void> {
    await this.db.run(`UPDATE attachments SET name = ? WHERE id = ?`, [name.trim(), id]);
  }

  async softDelete(id: Id): Promise<void> {
    await this.db.run(`UPDATE attachments SET deleted_at = ? WHERE id = ?`, [this.clock.now().toISOString(), id]);
  }

  /** Soubory, které už nemají živý řádek — smí se fyzicky smazat ze sandboxu. */
  async deletedFileNames(): Promise<string[]> {
    const rows = await this.db.all<{ file_name: string }>(
      `SELECT file_name FROM attachments WHERE deleted_at IS NOT NULL AND file_name NOT IN (SELECT file_name FROM attachments WHERE deleted_at IS NULL)`,
    );
    return rows.map((r) => String(r.file_name));
  }

  async liveFileNames(): Promise<Set<string>> {
    const rows = await this.db.all<{ file_name: string }>(`SELECT file_name FROM attachments WHERE deleted_at IS NULL`);
    return new Set(rows.map((r) => String(r.file_name)));
  }
}

export type PersonSection = 'personal' | 'emergency' | 'doctors' | 'cycle';
type SectionData = { personal: PersonalData; emergency: EmergencyData; doctors: DoctorList; cycle: CycleSettings };

export class PersonDataRepository {
  constructor(private db: SqlDriver, private clock: Clock) {}

  async get<S extends PersonSection>(personId: Id, section: S): Promise<SectionData[S]> {
    const r = await this.db.first<{ json: string }>(`SELECT json FROM person_data WHERE person_id = ? AND section = ?`, [personId, section]);
    return parseJson<SectionData[S]>(r?.json, {} as SectionData[S]);
  }

  async set<S extends PersonSection>(personId: Id, section: S, data: SectionData[S]): Promise<void> {
    // Prázdné řetězce se neukládají — formulář je jinak nedokáže odlišit od „nevyplněno“.
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (typeof v === 'string' ? v.trim() !== '' : v != null) clean[k] = typeof v === 'string' ? v.trim() : v;
    }
    await this.db.run(
      `INSERT INTO person_data (person_id, section, json, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(person_id, section) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
      [personId, section, JSON.stringify(clean), this.clock.now().toISOString()],
    );
  }
}

export class SettingsRepository {
  constructor(private db: SqlDriver) {}

  async get(): Promise<AppSettings> {
    const rows = await this.db.all<{ key: string; value: string }>(`SELECT key, value FROM settings`);
    const out: AppSettings = { ...DEFAULT_SETTINGS };
    for (const r of rows) {
      if (r.key in out) (out as unknown as Record<string, unknown>)[r.key] = parseJson(r.value, (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[r.key]);
    }
    return out;
  }

  async set(patch: Partial<AppSettings>): Promise<AppSettings> {
    await this.db.transaction(async () => {
      for (const [k, v] of Object.entries(patch)) {
        if (!(k in DEFAULT_SETTINGS)) continue;
        await this.db.run(
          `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [k, JSON.stringify(v)],
        );
      }
    });
    return this.get();
  }
}
