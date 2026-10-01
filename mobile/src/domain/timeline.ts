import type { HcRecord, LocalDate, RecordChild, RecordMetadata, RecordType } from './types';
import { MOODS, SYM_GROUPS, SYM_INTENSITY } from './recordTypes';
import { dayTitle, daySubtitle, plural } from './dates';

/**
 * Čisté funkce nad záznamy — seskupení do dnů pro osu, výběr „Blíží se“
 * a „Naposledy“ pro Přehled. Žádné I/O, takže jdou otestovat v Node.
 */

export interface TimelineDay {
  date: LocalDate;
  title: string;
  subtitle: string;
  isToday: boolean;
  isFuture: boolean;
  records: HcRecord[];
}

/** Záznamy musí přijít seřazené sestupně (repozitář to dělá). */
export function groupByDay(records: HcRecord[], today: LocalDate): TimelineDay[] {
  const days: TimelineDay[] = [];
  let cur: TimelineDay | null = null;
  for (const r of records) {
    if (!cur || cur.date !== r.date) {
      cur = {
        date: r.date,
        title: dayTitle(r.date, today),
        subtitle: daySubtitle(r.date, today),
        isToday: r.date === today,
        isFuture: r.date > today,
        records: [],
      };
      days.push(cur);
    }
    cur.records.push(r);
  }
  return days;
}

/**
 * Vloží do seznamu dnů prázdný „Dnes“, pokud v něm není — osa má mít
 * čáru „Teď“ i v den, kdy se ještě nic nestalo.
 */
export function ensureToday(days: TimelineDay[], today: LocalDate): TimelineDay[] {
  if (days.some((d) => d.date === today)) return days;
  const empty: TimelineDay = { date: today, title: 'Dnes', subtitle: daySubtitle(today, today), isToday: true, isFuture: false, records: [] };
  const idx = days.findIndex((d) => d.date < today);
  if (idx === -1) return [...days, empty];
  return [...days.slice(0, idx), empty, ...days.slice(idx)];
}

export function daySummary(day: TimelineDay): string {
  const n = day.records.length;
  return day.subtitle + ' · ' + n + ' ' + plural(n, 'záznam', 'záznamy', 'záznamů');
}

/** Index záznamu, před který patří čára „Teď“ v dnešním dni (seřazeno sestupně). */
export function nowLineIndex(day: TimelineDay, nowTime: string): number {
  if (!day.isToday) return -1;
  const i = day.records.findIndex((r) => r.time != null && r.time <= nowTime);
  if (i !== -1) return i;
  // Všechno dnešní je až později → čára pod nimi (před celodenními).
  const firstAllDay = day.records.findIndex((r) => r.time == null);
  return firstAllDay === -1 ? day.records.length : firstAllDay;
}

/** Je záznam ještě před námi? */
export function isUpcoming(r: HcRecord, today: LocalDate, nowTime: string): boolean {
  if (r.date > today) return true;
  if (r.date < today) return false;
  return r.time == null ? true : r.time >= nowTime;
}

/** Text pod názvem v osách a seznamech. */
export function recordSubtitle(r: HcRecord): string {
  const m = r.metadata || {};
  if (r.description) return r.description.split('\n')[0];
  if (m.place) return m.place;
  if (m.tags && m.tags.length) return m.tags.join(', ');
  if (m.children && m.children.length) return m.children.length + ' ' + plural(m.children.length, 'oblast', 'oblasti', 'oblastí') + ' těla';
  return '';
}

export interface SymptomSelection {
  mood: number | null;
  general: string[];
  byGroup: Record<string, string[]>;
  intensity: Record<string, number>;
  flow: string | null;
}

export function emptySelection(): SymptomSelection {
  return { mood: null, general: [], byGroup: {}, intensity: {}, flow: null };
}

export function selectionCount(s: SymptomSelection): number {
  let n = s.general.length + (s.flow ? 1 : 0);
  for (const k of Object.keys(s.byGroup)) n += (s.byGroup[k] || []).length;
  return n;
}

/**
 * Z výběru v zápisu nálady a příznaků udělá záznam — stejná logika jako
 * `buildEntry` na desce Časová osa, jen ukládá do databáze.
 */
export function buildSymptomRecord(s: SymptomSelection): { type: RecordType; title: string; description: string; metadata: RecordMetadata } | null {
  const children: RecordChild[] = [];
  for (const g of SYM_GROUPS) {
    const items = (s.byGroup[g.key] || []).slice();
    if (g.cycle && s.flow) items.unshift('menstruace ' + s.flow.toLowerCase());
    if (!items.length) continue;
    const lvl = s.intensity[g.key] ? ' · ' + SYM_INTENSITY[s.intensity[g.key] - 1].toLowerCase() : '';
    children.push({ label: g.name, value: items.join(', ') + lvl, type: 'symptom' });
  }
  const hasMood = s.mood != null;
  if (!hasMood && !children.length && !s.general.length) return null;
  const title = hasMood ? MOODS[s.mood!].title : s.general.length === 1 && !children.length ? s.general[0] : 'Zápis příznaků';
  return {
    type: hasMood ? 'mood' : 'symptom',
    title,
    description: '',
    metadata: { ...(hasMood ? { mood: s.mood! } : {}), tags: s.general.slice(), children },
  };
}
