import type { HcRecord } from './types';
import { medTitle, type Med } from './meds';
import { combine, numericDate, toLocalDate } from './dates';

/**
 * Místní připomínky naplánovaných termínů — čistý výpočet „kdy a co“.
 * Plánuje je telefon sám, nic nejde přes server.
 *
 * Text na zamčené obrazovce je ve výchozím stavu obecný („naplánovaný
 * termín“) — název návštěvy je zdravotní údaj a vidí ho kdokoli u telefonu.
 */

export type RemindKey = '1h' | '1d';
export const REMIND_KEYS: [RemindKey, string][] = [
  ['1h', 'Hodinu předem'],
  ['1d', 'Den předem'],
];

/** iOS drží nejvýš 64 naplánovaných upozornění na aplikaci. */
export const MAX_SCHEDULED = 60;

export interface PlannedReminder {
  id: string;
  recordId: string;
  at: Date;
  title: string;
  body: string;
  /** Denní opakování (léky) — `at` je pak jen nejbližší výskyt. */
  daily?: { hour: number; minute: number };
}

export function remindOf(r: HcRecord): RemindKey[] {
  const v = r.metadata.remind;
  return Array.isArray(v) ? (v.filter((k) => k === '1h' || k === '1d') as RemindKey[]) : [];
}

const hhmm = (t: string) => t.replace(/^0/, '');

/** Kdy připomenout. Celodenní: den předem v 18:00, v den termínu v 8:00. */
export function reminderTime(r: HcRecord, key: RemindKey): Date {
  if (r.time) {
    const at = combine(r.date, r.time);
    return new Date(at.getTime() - (key === '1h' ? 3600_000 : 86400_000));
  }
  const d = combine(r.date, key === '1h' ? '08:00' : '18:00');
  if (key === '1d') d.setDate(d.getDate() - 1);
  return d;
}

export function remindersFor(
  items: { r: HcRecord; personName: string; isSelf: boolean }[],
  now: Date,
  showTitle: boolean,
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const { r, personName, isSelf } of items) {
    for (const key of remindOf(r)) {
      const at = reminderTime(r, key);
      if (at.getTime() <= now.getTime()) continue;
      const fireDay = toLocalDate(at);
      const when =
        r.date === fireDay
          ? r.time
            ? key === '1h'
              ? `Za hodinu (${hhmm(r.time)})`
              : `Dnes v ${hhmm(r.time)}`
            : 'Dnes'
          : toLocalDate(new Date(at.getTime() + 86400_000)) === r.date
            ? r.time
              ? `Zítra v ${hhmm(r.time)}`
              : 'Zítra'
            : numericDate(r.date) + (r.time ? ` v ${hhmm(r.time)}` : '');
      const what = showTitle ? r.title : 'naplánovaný termín';
      out.push({
        id: `${r.id}:${key}`,
        recordId: r.id,
        at,
        title: showTitle && !isSelf ? `Připomínka · ${personName}` : 'Připomínka',
        body: `${when} · ${what}`,
      });
    }
  }
  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out.slice(0, MAX_SCHEDULED);
}

/**
 * Denní připomínky léků. Léky stejné karty ve stejný čas jsou v jednom
 * upozornění. Text bez názvů léků, dokud to člověk nezapne.
 */
export function medRemindersFor(items: { meds: Med[]; personId: string; personName: string; isSelf: boolean }[], now: Date, showTitle: boolean): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const { meds, personId, personName, isSelf } of items) {
    const byTime = new Map<string, Med[]>();
    for (const m of meds) {
      if (!m.active || !m.remind) continue;
      for (const t of m.times) byTime.set(t, [...(byTime.get(t) ?? []), m]);
    }
    for (const [t, list] of byTime) {
      const [hour, minute] = t.split(':').map(Number);
      const at = new Date(now);
      at.setHours(hour, minute, 0, 0);
      if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
      const what = showTitle ? list.map(medTitle).join(', ') : list.length === 1 ? 'čas na lék' : `čas na léky (${list.length})`;
      out.push({
        id: `med:${personId}:${t}`,
        recordId: '',
        at,
        daily: { hour, minute },
        title: !isSelf ? `Připomínka · ${personName}` : 'Připomínka',
        body: `${hhmm(t)} · ${what}`,
      });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
