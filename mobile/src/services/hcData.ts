import type { SqlDriver } from '@/data/driver';
import { migrate } from '@/data/migrations';
import {
  AttachmentRepository,
  PersonDataRepository,
  PersonRepository,
  RecordRepository,
  SettingsRepository,
  type Clock,
} from '@/data/repositories';
import { AttachmentService, type FileStore } from './attachments';

/**
 * Jeden vstupní bod k datům odemknuté relace. Vzniká až po odemknutí
 * (bez klíče databáze neexistuje) a zaniká zamčením.
 *
 * Fáze 2: sem se přidá synchronizace — obrazovky volají jen tyhle
 * objekty, takže se jich to nedotkne.
 */
export class HcData {
  readonly persons: PersonRepository;
  readonly records: RecordRepository;
  readonly attachments: AttachmentRepository;
  readonly personData: PersonDataRepository;
  readonly settings: SettingsRepository;
  readonly files: AttachmentService;

  private constructor(readonly db: SqlDriver, fileStore: FileStore, clock: Clock, newId: () => string) {
    this.persons = new PersonRepository(db, clock, newId);
    this.records = new RecordRepository(db, clock, newId);
    this.attachments = new AttachmentRepository(db, clock, newId);
    this.personData = new PersonDataRepository(db, clock);
    this.settings = new SettingsRepository(db);
    this.files = new AttachmentService(this.attachments, fileStore, newId);
  }

  static async open(db: SqlDriver, fileStore: FileStore, clock: Clock, newId: () => string): Promise<HcData> {
    await migrate(db);
    return new HcData(db, fileStore, clock, newId);
  }

  /** Vlastní karta; vznikne při registraci. */
  async self() {
    const all = await this.persons.list();
    return all.find((p) => p.isSelf) ?? null;
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
