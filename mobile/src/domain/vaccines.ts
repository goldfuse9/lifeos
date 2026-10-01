import type { HcRecord, LocalDate, RecordChild } from './types';
import { combine, diffDays, numericDate } from './dates';

/**
 * Očkování — každé očkování je záznam v ose (typ „vaccine“) s názvem
 * a případným datem přeočkování. Přehled se skládá ze záznamů, nic se
 * nedrží dvakrát.
 *
 * Intervaly jsou jen předvyplněný návrh podle běžného schématu; člověk
 * je vždy může změnit — rozhoduje lékař.
 */

export interface VaccineInfo {
  name: string;
  /** Datum přeočkování (null = není potřeba / nevím). */
  nextDue?: LocalDate | null;
}

export const VACCINES: { name: string; years: number | null }[] = [
  { name: 'Tetanus', years: 10 },
  { name: 'Klíšťová encefalitida', years: 3 },
  { name: 'Chřipka', years: 1 },
  { name: 'COVID-19', years: null },
  { name: 'Hepatitida A', years: null },
  { name: 'Hepatitida B', years: null },
  { name: 'Pneumokok', years: null },
  { name: 'Meningokok', years: null },
  { name: 'HPV', years: null },
  { name: 'Spalničky, zarděnky, příušnice', years: null },
];

export const DUE_OPTIONS: [number | null, string][] = [
  [null, 'Ne'],
  [1, 'Za rok'],
  [3, 'Za 3 roky'],
  [5, 'Za 5 let'],
  [10, 'Za 10 let'],
];

export function vaccineOf(r: HcRecord): VaccineInfo | null {
  const v = (r.metadata as { vaccine?: VaccineInfo }).vaccine;
  return r.type === 'vaccine' && v ? v : null;
}

export function addYears(date: LocalDate, years: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y + years, m - 1, d);
  // 29. 2. → 28. 2.
  if (dt.getMonth() !== m - 1) dt.setDate(0);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function suggestedYears(name: string): number | null {
  return VACCINES.find((v) => v.name.toLowerCase() === name.trim().toLowerCase())?.years ?? null;
}

export function vaccineRecord(v: VaccineInfo, dose?: string): { title: string; metadata: { vaccine: VaccineInfo; children: RecordChild[] } } {
  const children: RecordChild[] = [];
  if (dose) children.push({ label: 'Dávka', value: dose, type: 'vaccine' });
  if (v.nextDue) children.push({ label: 'Přeočkovat', value: numericDate(v.nextDue), type: 'vaccine' });
  return { title: 'Očkování: ' + v.name, metadata: { vaccine: v, children } };
}

export interface VaccineStatus {
  name: string;
  last: HcRecord;
  lastDate: LocalDate;
  nextDue: LocalDate | null;
  /** Dní do přeočkování (záporné = po termínu). */
  daysLeft: number | null;
  state: 'ok' | 'soon' | 'due' | 'none';
}

/** Poslední očkování proti každé nemoci a stav přeočkování. */
export function vaccineOverview(records: HcRecord[], today: LocalDate): VaccineStatus[] {
  const latest = new Map<string, HcRecord>();
  for (const r of records) {
    const v = vaccineOf(r);
    if (!v) continue;
    const k = v.name.trim().toLowerCase();
    const cur = latest.get(k);
    if (!cur || r.date > cur.date) latest.set(k, r);
  }
  const out: VaccineStatus[] = [];
  for (const r of latest.values()) {
    const v = vaccineOf(r)!;
    const nextDue = v.nextDue ?? null;
    const daysLeft = nextDue ? diffDays(today, nextDue) : null;
    const state = daysLeft == null ? 'none' : daysLeft < 0 ? 'due' : daysLeft <= 60 ? 'soon' : 'ok';
    out.push({ name: v.name, last: r, lastDate: r.date, nextDue, daysLeft, state });
  }
  const rank = { due: 0, soon: 1, ok: 2, none: 3 } as const;
  return out.sort((a, b) => rank[a.state] - rank[b.state] || (a.nextDue ?? '9').localeCompare(b.nextDue ?? '9') || a.name.localeCompare(b.name, 'cs'));
}

/** Rok posledního tetanu pro nouzovou kartu. */
export function tetanusYear(records: HcRecord[]): string | null {
  const t = vaccineOverview(records, '2000-01-01').find((v) => /tetan/i.test(v.name));
  return t ? t.lastDate.slice(0, 4) : null;
}

/** Připomenutí přeočkování — měsíc předem v 9:00 (nebo hned zítra, když už je blízko). */
export function vaccineReminders(
  items: { records: HcRecord[]; personId: string; personName: string; isSelf: boolean }[],
  now: Date,
  showTitle: boolean,
): { id: string; recordId: string; at: Date; title: string; body: string }[] {
  const out: { id: string; recordId: string; at: Date; title: string; body: string }[] = [];
  for (const { records, personId, personName, isSelf } of items) {
    for (const v of vaccineOverview(records, '2000-01-01')) {
      if (!v.nextDue) continue;
      const due = combine(v.nextDue, '09:00');
      let at = new Date(due.getTime() - 30 * 86400_000);
      if (at.getTime() <= now.getTime()) {
        if (due.getTime() <= now.getTime()) continue;
        at = new Date(now.getTime() + 86400_000);
        at.setHours(9, 0, 0, 0);
      }
      out.push({
        id: `vax:${personId}:${v.name}`,
        recordId: v.last.id,
        at,
        title: !isSelf && showTitle ? `Připomínka · ${personName}` : 'Připomínka',
        body: `${numericDate(v.nextDue)} · ${showTitle ? 'přeočkování: ' + v.name : 'blíží se přeočkování'}`,
      });
    }
  }
  return out;
}
