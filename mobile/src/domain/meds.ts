import type { LocalDate, LocalTime, RecordChild } from './types';

/**
 * Léky — co beru, kdy, a dnešní odškrtávání. Čisté funkce bez I/O.
 *
 * Do časové osy jde jen změna (začátek, změna dávky nebo času, konec),
 * ne každá spolknutá tableta — osa by se jinak zahltila.
 */

export interface Med {
  id: string;
  name: string;
  /** Volný text: „1 tableta“, „500 mg“, „10 kapek“. */
  dose?: string;
  /** Časy HH:MM; prázdné = podle potřeby. */
  times: LocalTime[];
  remind: boolean;
  active: boolean;
  note?: string;
  since?: LocalDate;
  until?: LocalDate;
}

export interface MedList {
  list?: Med[];
}

/** Odškrtnuté dávky: datum → klíče „idLéku@HH:MM“. */
export interface MedLog {
  days?: Record<LocalDate, string[]>;
}

export const TIME_PRESETS: [LocalTime, string][] = [
  ['08:00', 'Ráno'],
  ['12:00', 'V poledne'],
  ['18:00', 'Večer'],
  ['22:00', 'Na noc'],
];

const hm = (t: string) => t.replace(/^0/, '');

export function timeLabel(t: LocalTime): string {
  const p = TIME_PRESETS.find((x) => x[0] === t);
  return p ? `${p[1].toLowerCase()} ${hm(t)}` : hm(t);
}

export function medTitle(m: Pick<Med, 'name' | 'dose'>): string {
  return m.dose ? `${m.name} ${m.dose}` : m.name;
}

export function medSchedule(m: Pick<Med, 'times'>): string {
  return m.times.length ? [...m.times].sort().map(hm).join(', ') : 'podle potřeby';
}

export const doseKey = (medId: string, time: LocalTime) => `${medId}@${time}`;

export interface Dose {
  key: string;
  med: Med;
  time: LocalTime;
  taken: boolean;
}

/** Dnešní dávky, seřazené podle času. */
export function dosesFor(meds: Med[], log: MedLog, date: LocalDate): Dose[] {
  const taken = new Set(log.days?.[date] ?? []);
  const out: Dose[] = [];
  for (const m of meds) {
    if (!m.active) continue;
    for (const t of m.times) out.push({ key: doseKey(m.id, t), med: m, time: t, taken: taken.has(doseKey(m.id, t)) });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.med.name.localeCompare(b.med.name, 'cs'));
}

/** Přepne odškrtnutí a nechá jen posledních ~60 dní. */
export function toggleDose(log: MedLog, date: LocalDate, key: string): MedLog {
  const days = { ...(log.days ?? {}) };
  const cur = new Set(days[date] ?? []);
  if (cur.has(key)) cur.delete(key);
  else cur.add(key);
  days[date] = [...cur];
  const keep = Object.keys(days).sort().slice(-60);
  return { days: Object.fromEntries(keep.map((d) => [d, days[d]])) };
}

/** Text pro nouzovou kartu. */
export function medsForEmergency(meds: Med[]): string {
  return meds
    .filter((m) => m.active)
    .map((m) => `${medTitle(m)} (${medSchedule(m)})`)
    .join('; ');
}

export type MedChange = 'start' | 'change' | 'stop';

/** Záznam do osy při změně léku. */
export function medRecord(kind: MedChange, m: Med): { title: string; metadata: { medId: string; children: RecordChild[] } } {
  const title = (kind === 'start' ? 'Začátek: ' : kind === 'stop' ? 'Konec: ' : 'Změna: ') + medTitle(m);
  const children: RecordChild[] = [];
  if (kind !== 'stop') {
    if (m.dose) children.push({ label: 'Dávka', value: m.dose, type: 'med' });
    children.push({ label: 'Kdy', value: medSchedule(m), type: 'med' });
  }
  return { title, metadata: { medId: m.id, children } };
}

/** Změnilo se něco, co patří do osy? */
export function medChanged(a: Med, b: Med): boolean {
  return a.name !== b.name || (a.dose ?? '') !== (b.dose ?? '') || [...a.times].sort().join() !== [...b.times].sort().join();
}
