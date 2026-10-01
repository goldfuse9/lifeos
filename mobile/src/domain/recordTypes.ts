import type { RecordType } from './types';

/**
 * Typy záznamů a jejich barvy — převzato 1:1 z desky Časová osa (Mix.dc.html).
 * `event` (Termín) je nový: kalendář potřebuje obecnou plánovanou událost
 * a žádný z typů na plátně to nevystihoval. Barva je z tečky „Blíží se“.
 */
export interface RecordTypeInfo {
  label: string;
  /** Množné číslo pro filtr */
  plural: string;
  color: string;
  text: string;
  tint: string;
}

export const RECORD_TYPES: Record<RecordType, RecordTypeInfo> = {
  event: { label: 'Termín', plural: 'Termíny', color: '#F7931E', text: '#7A4300', tint: '#FFF1E0' },
  visit: { label: 'Návštěva', plural: 'Návštěvy', color: '#9B3FE0', text: '#7E2FC0', tint: '#F3E9FD' },
  symptom: { label: 'Symptom', plural: 'Symptomy', color: '#0E8FA8', text: '#0B6F83', tint: '#E2F5F9' },
  result: { label: 'Výsledek', plural: 'Výsledky', color: '#3B6FE0', text: '#2D56B5', tint: '#E8EFFD' },
  med: { label: 'Lék', plural: 'Léky', color: '#D9920F', text: '#8A5A00', tint: '#FDF3DF' },
  doc: { label: 'Dokument', plural: 'Dokumenty', color: '#E0613B', text: '#A8412A', tint: '#FDECE6' },
  note: { label: 'Poznámka', plural: 'Poznámky', color: '#7A7682', text: '#5E5B66', tint: '#EFEEF1' },
  mood: { label: 'Nálada', plural: 'Nálady', color: '#E8830C', text: '#945000', tint: '#FFF1E0' },
  cycle: { label: 'Cyklus', plural: 'Cyklus', color: '#E0457B', text: '#A3265A', tint: '#FCE4EE' },
};

/** Pořadí v nabídce „Nový záznam“ a ve filtru. */
export const RECORD_TYPE_ORDER: RecordType[] = ['event', 'visit', 'symptom', 'result', 'med', 'doc', 'note', 'mood', 'cycle'];

/** Typy, které lze vytvořit obecným formulářem (nálada má vlastní zápis). */
export const EDITABLE_TYPES: RecordType[] = ['event', 'visit', 'symptom', 'result', 'med', 'doc', 'note'];

export const RECORD_TYPE_KEYS = Object.keys(RECORD_TYPES) as RecordType[];

export function isRecordType(v: unknown): v is RecordType {
  return typeof v === 'string' && v in RECORD_TYPES;
}

export interface MoodInfo {
  label: string;
  title: string;
  mouth: string;
  color: string;
  tint: string;
}

export const MOODS: MoodInfo[] = [
  { label: 'Velmi špatně', title: 'Cítí se velmi špatně', mouth: 'M8 16.6c1.1-1.5 2.5-2.3 4-2.3s2.9.8 4 2.3', color: '#C2413A', tint: '#FBE4E2' },
  { label: 'Špatně', title: 'Cítí se špatně', mouth: 'M8.6 16c1-.8 2.1-1.2 3.4-1.2s2.4.4 3.4 1.2', color: '#C8661C', tint: '#FCEBDD' },
  { label: 'Ujde to', title: 'Cítí se ujde to', mouth: 'M8.8 15.2h6.4', color: '#514F57', tint: '#F1F0EE' },
  { label: 'Dobře', title: 'Cítí se dobře', mouth: 'M8.6 14.4c1 .9 2.1 1.3 3.4 1.3s2.4-.4 3.4-1.3', color: '#B97300', tint: '#FDF1D8' },
  { label: 'Výborně', title: 'Cítí se výborně', mouth: 'M8 14c1.1 1.7 2.5 2.6 4 2.6s2.9-.9 4-2.6', color: '#E07A0B', tint: '#FFE7C7' },
];

export const SYM_GENERAL = ['Únava', 'Teplota', 'Zimnice', 'Nevolnost', 'Špatný spánek', 'Stres'];

export interface SymptomGroup {
  key: string;
  name: string;
  tint: string;
  fg: string;
  items: string[];
  flow?: string[];
  cycle?: boolean;
}

export const SYM_GROUPS: SymptomGroup[] = [
  { key: 'head', name: 'Hlava', tint: '#E8EFFD', fg: '#2D56B5', items: ['Bolest hlavy', 'Migréna', 'Závrať', 'Bolest v krku', 'Rýma', 'Bolest ucha', 'Bolest zubů', 'Pálení očí'] },
  { key: 'torso', name: 'Trup', tint: '#E2F5F9', fg: '#0B6F83', items: ['Kašel', 'Bolest na hrudi', 'Dušnost', 'Bolest břicha', 'Křeče v břiše', 'Nadýmání', 'Průjem', 'Zácpa', 'Pálení žáhy', 'Bolest zad'] },
  { key: 'limbs', name: 'Končetiny', tint: '#F3E9FD', fg: '#6E24B0', items: ['Bolest kloubů', 'Bolest svalů', 'Křeče v lýtkách', 'Brnění', 'Otok', 'Slabost'] },
  { key: 'skin', name: 'Kůže', tint: '#FDECE6', fg: '#A8412A', items: ['Vyrážka', 'Svědění', 'Kopřivka', 'Ekzém', 'Akné', 'Suchá kůže', 'Spálení', 'Modřina'] },
  {
    key: 'cycle', name: 'Cyklus', tint: '#FCE4EE', fg: '#A3265A', cycle: true,
    flow: ['Špinění', 'Slabá', 'Střední', 'Silná'],
    items: ['Křeče v podbřišku', 'Citlivá prsa', 'Nadýmání', 'Bolest v kříži', 'Výkyvy nálad', 'Chutě na jídlo', 'Akné', 'Únava'],
  },
];

export const SYM_INTENSITY = ['Mírné', 'Střední', 'Silné'];
/** Příznaky, u kterých se ukáže varování „volejte 155“. */
export const SYM_RED_FLAGS = ['Bolest na hrudi', 'Dušnost'];

export function isPainful(symptom: string): boolean {
  return /bolest|křeč|migréna/i.test(symptom);
}
