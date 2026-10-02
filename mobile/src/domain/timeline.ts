import type { HcRecord, LocalDate, RecordChild, RecordMetadata, RecordType } from './types';
import { MOODS, SYM_GROUPS, SYM_INTENSITY } from './recordTypes';
import { combine, dayTitle, daySubtitle, plural } from './dates';

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

/** Za jak dlouho po plánovaném čase se záznam objeví v ose. */
export const REVEAL_AFTER_MS = 60 * 60 * 1000;

/**
 * Naplánovaný záznam, jehož čas ještě nenastal (+ hodina). Do osy patří
 * jen to, co se stalo — plán je v kalendáři a v „Blíží se“.
 * Naplánovaný = jeho čas je pozdější než chvíle, kdy byl zapsán.
 * Celodenní se ukáže od začátku svého dne.
 */
export function isPending(r: HcRecord, now: Date): boolean {
  const at = combine(r.date, r.time).getTime();
  const created = Date.parse(r.createdAt);
  if (!Number.isFinite(created) || at <= created + 5 * 60 * 1000) return false;
  return now.getTime() < (r.time ? at + REVEAL_AFTER_MS : at);
}

/** Typy, které jsou „potíže“ — rychlá volba ve filtru osy. */
export const PROBLEM_TYPES: RecordType[] = ['symptom', 'mood', 'cycle'];

export interface ProblemCount {
  name: string;
  count: number;
  /** Část dne, kdy se potíž objevuje nejčastěji (aspoň polovina zápisů). */
  usual: 'ráno' | 'odpoledne' | 'večer' | 'v noci' | null;
}

function partOfDay(time: string | null): ProblemCount['usual'] {
  if (!time) return null;
  const h = Number(time.slice(0, 2));
  return h >= 5 && h < 11 ? 'ráno' : h >= 11 && h < 17 ? 'odpoledne' : h >= 17 && h < 22 ? 'večer' : 'v noci';
}

/** Jednotlivé potíže v záznamu (příznaky, štítky, příznaky cyklu, špatná nálada). */
export function problemsIn(r: HcRecord): string[] {
  const out = new Set<string>();
  const m = r.metadata as RecordMetadata & { cycle?: { symptoms?: string[] } };
  if (r.type === 'symptom' || r.type === 'mood') {
    for (const t of m.tags ?? []) out.add(t);
    for (const c of m.children ?? []) {
      if (c.type !== 'symptom') continue;
      for (const s of c.value.replace(/\s·\s.*$/, '').split(/,\s*/)) if (s.trim()) out.add(s.trim()[0].toUpperCase() + s.trim().slice(1));
    }
    if (r.type === 'mood' && typeof m.mood === 'number' && m.mood <= 1) out.add('Špatná nálada');
  }
  if (r.type === 'cycle') for (const s of m.cycle?.symptoms ?? []) out.add(s);
  return [...out];
}

/** Kolikrát se která potíž objevila a kdy nejčastěji — nejčastější nahoře. */
export function problemSummary(records: HcRecord[], limit = 4): ProblemCount[] {
  const map = new Map<string, { count: number; parts: Map<string, number> }>();
  for (const r of records) {
    const part = partOfDay(r.time);
    for (const p of problemsIn(r)) {
      const e = map.get(p) ?? { count: 0, parts: new Map() };
      e.count++;
      if (part) e.parts.set(part, (e.parts.get(part) ?? 0) + 1);
      map.set(p, e);
    }
  }
  return [...map.entries()]
    .map(([name, e]) => {
      const [top, second] = [...e.parts.entries()].sort((a, b) => b[1] - a[1]);
      const usual = top && e.count >= 2 && top[1] * 2 >= e.count && (!second || second[1] < top[1]) ? (top[0] as ProblemCount['usual']) : null;
      return { name, count: e.count, usual };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'cs'))
    .slice(0, limit);
}
