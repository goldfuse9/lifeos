import type { HcRecord, LocalDate } from './types';
import { addDays, diffDays, plural } from './dates';

/**
 * Menstruační cyklus — čisté výpočty bez I/O.
 *
 * Fakta jsou jen to, co člověk zapsal (záznamy typu `cycle` v ose).
 * Všechno ostatní — příští menstruace, plodné dny — je ODHAD z průměru
 * posledních cyklů a tak se to i ukazuje.
 */

export type Flow = 'spotting' | 'light' | 'medium' | 'heavy';

export const FLOWS: [Flow, string][] = [
  ['spotting', 'Špinění'],
  ['light', 'Slabé'],
  ['medium', 'Střední'],
  ['heavy', 'Silné'],
];
export const FLOW_LABEL: Record<Flow, string> = Object.fromEntries(FLOWS) as Record<Flow, string>;

export const PAIN_LABEL = ['Žádná', 'Mírná', 'Střední', 'Silná'];

/** Příznaky, které se k cyklu váží nejčastěji (stejné jako sekce Cyklus v zápisu). */
export const CYCLE_SYMPTOMS = ['Křeče v podbřišku', 'Bolest v kříži', 'Citlivá prsa', 'Nadýmání', 'Bolest hlavy', 'Únava', 'Výkyvy nálad', 'Chutě na jídlo', 'Akné', 'Nevolnost'];

/** Nastavení cyklu jedné karty (person_data, sekce „cycle“). */
export interface CycleSettings {
  enabled?: boolean;
  /** Obvyklá délka cyklu ve dnech — použije se, dokud nejsou zapsané aspoň dva cykly. */
  cycleLength?: number;
  /** Obvyklá délka menstruace ve dnech. */
  periodLength?: number;
  /** Začátek poslední menstruace zadaný při nastavení (než přibudou zápisy). */
  lastStart?: LocalDate;
  /** Nepravidelný cyklus — předpověď se ukazuje jako rozmezí. */
  irregular?: boolean;
  /** Nezobrazovat dlaždici na Přehledu (diskrétnost). */
  hideOnOverview?: boolean;
}

export const CYCLE_DEFAULTS = { cycleLength: 28, periodLength: 5 };

/** Data zápisu dne, uložená v metadata.cycle záznamu. */
export interface CycleLog {
  flow?: Flow;
  /** Tento den začala menstruace. */
  start?: boolean;
  /** Bolest 0–3. */
  pain?: number;
  symptoms?: string[];
  /** Den cyklu v okamžiku zápisu. */
  day?: number;
  /** U začátku: o kolik dní později (+) / dříve (−) než odhad. */
  shift?: number | null;
}

export function cycleLogOf(r: HcRecord): CycleLog | null {
  const c = (r.metadata as { cycle?: CycleLog }).cycle;
  return r.type === 'cycle' && c ? c : null;
}

export interface CycleInfo {
  enabled: boolean;
  hasData: boolean;
  lastStart: LocalDate | null;
  /** Den cyklu dnes (1 = první den menstruace). */
  day: number | null;
  avgLength: number;
  minLength: number;
  maxLength: number;
  periodLength: number;
  irregular: boolean;
  nextStart: LocalDate | null;
  /** Kolik dní zbývá do odhadu příští menstruace (záporné = zpoždění). */
  daysUntil: number | null;
  /** Rozmezí odhadu u nepravidelného cyklu. */
  nextRange: [LocalDate, LocalDate] | null;
  inPeriod: boolean;
  /** Ovulace a plodné dny (odhad, dny cyklu). */
  ovulationDay: number;
  fertileFrom: number;
  fertileTo: number;
  phase: 'menstruace' | 'folikulární' | 'plodné dny' | 'ovulace' | 'luteální' | 'zpoždění';
  chance: 'nízká' | 'zvýšená' | 'vysoká';
  history: CycleHistoryItem[];
  /** Průměrná bolest (0–3) v posledních čtyřech cyklech, null = nezapsáno. */
  painAvg: number | null;
  painByCycle: (number | null)[];
  warnings: string[];
}

export interface CycleHistoryItem {
  start: LocalDate;
  recordId: string | null;
  /** Délka cyklu (do dalšího začátku); poslední probíhající cyklus nemá. */
  length: number | null;
  periodDays: number;
  shift: number | null;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Spočítá stav cyklu ze zápisů (libovolné pořadí) a nastavení.
 */
export function computeCycle(settings: CycleSettings, records: HcRecord[], today: LocalDate): CycleInfo {
  const enabled = !!settings.enabled;
  const logs = records
    .map((r) => ({ r, c: cycleLogOf(r) }))
    .filter((x): x is { r: HcRecord; c: CycleLog } => !!x.c && x.r.date <= today)
    .sort((a, b) => (a.r.date < b.r.date ? -1 : a.r.date > b.r.date ? 1 : 0));

  // Začátky: zapsané + začátek z nastavení, pokud je starší než první zápis.
  const startRecs = logs.filter((x) => x.c.start);
  const starts: { date: LocalDate; id: string | null; shift: number | null }[] = startRecs.map((x) => ({ date: x.r.date, id: x.r.id, shift: x.c.shift ?? null }));
  if (settings.lastStart && settings.lastStart <= today && !starts.some((s) => Math.abs(diffDays(s.date, settings.lastStart!)) < 10)) {
    starts.push({ date: settings.lastStart, id: null, shift: null });
    starts.sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  const baseLen = clamp(settings.cycleLength ?? CYCLE_DEFAULTS.cycleLength, 15, 60);
  const basePeriod = clamp(settings.periodLength ?? CYCLE_DEFAULTS.periodLength, 1, 12);

  // Délky dokončených cyklů (vynechat zjevné chyby — kratší než 15 nebo delší než 90 dní).
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const L = diffDays(starts[i - 1].date, starts[i].date);
    if (L >= 15 && L <= 90) lengths.push(L);
  }
  const recent = lengths.slice(-6);
  const avgLength = recent.length >= 1 ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : baseLen;
  const minLength = recent.length ? Math.min(...recent) : baseLen;
  const maxLength = recent.length ? Math.max(...recent) : baseLen;
  const irregular = !!settings.irregular || (recent.length >= 3 && maxLength - minLength > 7);

  // Délka menstruace u každého cyklu = dny se zapsaným krvácením (ne špinění) do 12 dní od začátku.
  const periodDaysFor = (start: LocalDate, end: LocalDate | null): number => {
    const dates = new Set(
      logs
        .filter((x) => x.c.flow && x.c.flow !== 'spotting' && x.r.date >= start && (!end || x.r.date < end) && diffDays(start, x.r.date) < 12)
        .map((x) => x.r.date),
    );
    return dates.size;
  };

  const history: CycleHistoryItem[] = starts.map((s, i) => {
    const next = starts[i + 1]?.date ?? null;
    return { start: s.date, recordId: s.id, length: next ? diffDays(s.date, next) : null, periodDays: periodDaysFor(s.date, next), shift: s.shift };
  });
  const loggedPeriods = history.map((h) => h.periodDays).filter((n) => n > 0).slice(-6);
  const periodLength = loggedPeriods.length >= 2 ? Math.round(loggedPeriods.reduce((a, b) => a + b, 0) / loggedPeriods.length) : basePeriod;

  const lastStart = starts.length ? starts[starts.length - 1].date : null;
  const day = lastStart ? diffDays(lastStart, today) + 1 : null;
  const nextStart = lastStart ? addDays(lastStart, avgLength) : null;
  const daysUntil = nextStart ? diffDays(today, nextStart) : null;
  const nextRange: [LocalDate, LocalDate] | null = lastStart && irregular ? [addDays(lastStart, Math.min(minLength, avgLength - 3)), addDays(lastStart, Math.max(maxLength, avgLength + 3))] : null;

  // Krvácení zapsané dnes nebo včera znamená „probíhá menstruace“, i když odhad říká jinak.
  const bleedingNow = logs.some((x) => x.c.flow && x.c.flow !== 'spotting' && diffDays(x.r.date, today) <= 1 && (!lastStart || x.r.date >= lastStart));
  const inPeriod = day != null && (day <= periodLength || bleedingNow) && day <= 12;

  const ovulationDay = clamp(avgLength - 14, 8, avgLength - 5);
  const fertileFrom = ovulationDay - 5;
  const fertileTo = ovulationDay + 1;

  let phase: CycleInfo['phase'] = 'folikulární';
  let chance: CycleInfo['chance'] = 'nízká';
  if (day != null) {
    if (inPeriod) phase = 'menstruace';
    else if (daysUntil != null && daysUntil < 0) phase = 'zpoždění';
    else if (day === ovulationDay) {
      phase = 'ovulace';
      chance = 'vysoká';
    } else if (day >= fertileFrom && day <= fertileTo) {
      phase = 'plodné dny';
      chance = day >= ovulationDay - 2 ? 'vysoká' : 'zvýšená';
    } else if (day > fertileTo) phase = 'luteální';
  }

  // Bolest: nejvyšší zapsaná v každém z posledních čtyř cyklů.
  const painByCycle = history.slice(-4).map((h) => {
    const end = addDays(h.start, h.length ?? 60);
    const vals = logs.filter((x) => x.r.date >= h.start && x.r.date < end && typeof x.c.pain === 'number').map((x) => x.c.pain as number);
    return vals.length ? Math.max(...vals) : null;
  });
  const painVals = painByCycle.filter((v): v is number => v != null);
  const painAvg = painVals.length ? painVals.reduce((a, b) => a + b, 0) / painVals.length : null;

  // Upozornění — jen věcně, s doporučením poradit se s gynekologem.
  const warnings: string[] = [];
  if (daysUntil != null && daysUntil <= -7) warnings.push(`Menstruace má ${-daysUntil} ${plural(-daysUntil, 'den', 'dny', 'dní')} zpoždění.`);
  if (recent.length >= 2 && recent.slice(-2).every((L) => L < 21)) warnings.push('Poslední cykly byly kratší než 21 dní.');
  if (recent.length >= 2 && recent.slice(-2).every((L) => L > 35)) warnings.push('Poslední cykly byly delší než 35 dní.');
  if (history.some((h) => h.periodDays > 7)) warnings.push('Krvácení trvalo déle než 7 dní.');
  if (painVals.length >= 2 && painVals.slice(-2).every((v) => v >= 3)) warnings.push('Silná bolest se opakuje.');

  return {
    enabled,
    hasData: !!lastStart,
    lastStart,
    day,
    avgLength,
    minLength,
    maxLength,
    periodLength,
    irregular,
    nextStart,
    daysUntil,
    nextRange,
    inPeriod,
    ovulationDay,
    fertileFrom,
    fertileTo,
    phase,
    chance,
    history: history.slice().reverse(),
    painAvg,
    painByCycle,
    warnings,
  };
}

/** Posun skutečného začátku proti odhadu (+ později, − dříve). */
export function shiftFor(info: CycleInfo, start: LocalDate): number | null {
  if (!info.lastStart || !info.nextStart || start <= info.lastStart) return null;
  return diffDays(info.nextStart, start);
}

export function shiftLabel(shift: number | null | undefined): string {
  if (shift == null) return '';
  if (shift === 0) return 'v odhadovaný den';
  const n = Math.abs(shift);
  return `o ${n} ${plural(n, 'den', 'dny', 'dní')} ${shift > 0 ? 'později' : 'dříve'}, než byl odhad`;
}

/**
 * Z formuláře dne udělá záznam do osy: název, popis a podzáznamy
 * (krvácení, příznaky, bolest, posun).
 */
export function buildCycleRecord(log: CycleLog, note: string): { title: string; description: string; metadata: Record<string, unknown> } {
  const children: { label: string; value: string; type: 'cycle' | 'symptom' | 'note' }[] = [];
  if (log.flow) children.push({ label: 'Krvácení', value: FLOW_LABEL[log.flow], type: 'cycle' });
  if (log.symptoms && log.symptoms.length) children.push({ label: 'Příznaky', value: log.symptoms.join(', '), type: 'symptom' });
  if (log.pain) children.push({ label: 'Bolest', value: PAIN_LABEL[log.pain], type: 'symptom' });
  if (log.start && log.shift != null) children.push({ label: 'Posun', value: shiftLabel(log.shift), type: 'note' });
  const title = log.start
    ? 'Začátek menstruace'
    : log.flow
      ? (log.flow === 'spotting' ? 'Špinění' : 'Menstruace') + (log.day ? ` · ${log.day}. den` : '')
      : 'Cyklus' + (log.day ? ` · ${log.day}. den` : '');
  return { title, description: note.trim(), metadata: { cycle: log, children } };
}
