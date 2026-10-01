/**
 * Doména HumanCare — fáze 1.
 *
 * Jeden společný model pro časovou osu i kalendář: `HcRecord`. Událost
 * v kalendáři je záznam s datem a časem v budoucnu; v ose je tentýž řádek.
 * Nejsou to dva systémy, jen dva pohledy.
 *
 * Každá entita nese `id` (UUID), `createdAt`, `updatedAt` a `deletedAt`.
 * Měkké mazání je tu kvůli fázi 2 — synchronizace potřebuje vědět, co
 * zmizelo, ne jen co zbylo.
 */

export type Id = string;
/** ISO 8601 v UTC, např. 2026-10-01T07:30:00.000Z */
export type Timestamp = string;
/** Místní kalendářní den, YYYY-MM-DD */
export type LocalDate = string;
/** Místní čas, HH:mm */
export type LocalTime = string;

export type RecordType =
  | 'event'
  | 'visit'
  | 'symptom'
  | 'result'
  | 'med'
  | 'doc'
  | 'note'
  | 'mood';

export interface RecordChild {
  label: string;
  value: string;
  type: RecordType;
}

/**
 * Volná rozšiřující data záznamu. Pole, která zná UI, jsou pojmenovaná;
 * cokoliv dalšího (budoucí klinický model, FHIR odkazy…) se vejde vedle.
 */
export interface RecordMetadata {
  /** Nálada 0–4 (velmi špatně … výborně) */
  mood?: number;
  /** Obecné příznaky / štítky nálady */
  tags?: string[];
  /** Podzáznamy (oblasti těla, měření, doporučení) */
  children?: RecordChild[];
  /** Odznak u výsledku, např. „V normě“ */
  badge?: string;
  badgeTone?: 'ok' | 'warn';
  /** Kde / u koho (lékař, ordinace) */
  place?: string;
  [key: string]: unknown;
}

export interface HcRecord {
  id: Id;
  personId: Id;
  type: RecordType;
  title: string;
  description: string;
  date: LocalDate;
  /** null = celý den */
  time: LocalTime | null;
  metadata: RecordMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

export type RecordDraft = Pick<HcRecord, 'type' | 'title' | 'description' | 'date' | 'time'> & {
  metadata?: RecordMetadata;
};

export type AttachmentKind = 'photo' | 'pdf' | 'file';

export interface Attachment {
  id: Id;
  recordId: Id;
  personId: Id;
  name: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  /** Název souboru uvnitř aplikačního sandboxu (ne absolutní cesta — ta se mezi instalacemi mění) */
  fileName: string;
  createdAt: Timestamp;
  deletedAt: Timestamp | null;
}

export type Relation = 'self' | 'partner' | 'child' | 'parent' | 'other';

export interface Person {
  id: Id;
  name: string;
  relation: Relation;
  /** YYYY-MM-DD nebo null */
  birthDate: LocalDate | null;
  /** Index palety avatarů */
  color: number;
  isSelf: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

/** Osobní údaje — stránka „Osobní údaje“ v nastavení. */
export interface PersonalData {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  sex?: 'žena' | 'muž' | 'jiné';
  insurer?: string;
  insuranceNo?: string;
  phone?: string;
  email?: string;
  address?: string;
  height?: string;
  weight?: string;
  smoking?: string;
  alcohol?: string;
  activity?: string;
}

/** Nouzové údaje — co se ukáže na nouzové kartě. */
export interface EmergencyData {
  allergies?: string;
  conditions?: string;
  meds?: string;
  blood?: string;
  implants?: string;
  ice?: string;
  surgeries?: string;
  tetanus?: string;
  communication?: string;
  wishes?: string;
}

export type DoctorRole = 'praktik' | 'zubar' | 'gyn' | 'pediatr' | 'spec';

export interface Doctor {
  id: Id;
  name: string;
  role: DoctorRole;
  /** Obor nebo poznámka, např. „ORL“ */
  specialty?: string;
  phone?: string;
  place?: string;
}

export interface DoctorList {
  list?: Doctor[];
}

export interface AppSettings {
  biometricEnabled: boolean;
  /** Za kolik sekund na pozadí se aplikace zamkne. 0 = hned. */
  autoLockSeconds: number;
  /** Výchozí karta po odemknutí */
  lastPersonId: Id | null;
  /** Vzhled pozadí z plátna */
  background: 'čiré sklo' | 'teplé sklo' | 'chladné sklo' | 'bílé';
  /** Barva tlačítka „já“ */
  avatarStyle: 'limetková' | 'černá';
  /** Jestli se v zápisu nabízí sekce Cyklus */
  cycleTracking: boolean;
  /** Posledních pět hledání na Přehledu */
  recentSearches: string[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  biometricEnabled: false,
  autoLockSeconds: 60,
  lastPersonId: null,
  background: 'čiré sklo',
  avatarStyle: 'limetková',
  cycleTracking: false,
  recentSearches: [],
};

export interface Account {
  name: string;
  email: string;
  createdAt: Timestamp;
}
