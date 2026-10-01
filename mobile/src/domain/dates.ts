import type { LocalDate, LocalTime } from './types';

/**
 * Datum a čas v češtině. Všechno je místní — prototyp běží v jednom
 * telefonu a záznam „v 8:00“ má zůstat v 8:00, i když člověk odletí
 * do jiného pásma.
 */

export const MONTHS_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
export const MONTHS_NOM = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
export const MONTHS_SHORT = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
export const WEEKDAYS = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
export const WEEKDAYS_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
/** Kalendář začíná pondělím */
export const CAL_WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

const pad = (n: number) => (n < 10 ? '0' + n : String(n));

export function toLocalDate(d: Date): LocalDate {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function toLocalTime(d: Date): LocalTime {
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

export function parseLocalDate(s: LocalDate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidLocalDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseLocalDate(s);
  return toLocalDate(d) === s;
}

export function isValidLocalTime(s: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

export function combine(date: LocalDate, time: LocalTime | null): Date {
  const d = parseLocalDate(date);
  if (time) {
    const [h, mi] = time.split(':').map(Number);
    d.setHours(h, mi, 0, 0);
  }
  return d;
}

export function addDays(date: LocalDate, n: number): LocalDate {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + n);
  return toLocalDate(d);
}

/** Rozdíl ve dnech b − a (kalendářní, ne 24h bloky). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/** „Čtvrtek 24. září“ */
export function longDate(date: LocalDate): string {
  const d = parseLocalDate(date);
  const wd = WEEKDAYS[d.getDay()];
  return wd.charAt(0).toUpperCase() + wd.slice(1) + ' ' + d.getDate() + '. ' + MONTHS_GEN[d.getMonth()];
}

/** „24. září 2026“, rok jen když není letošní */
export function shortDate(date: LocalDate, today: LocalDate): string {
  const d = parseLocalDate(date);
  const sameYear = d.getFullYear() === parseLocalDate(today).getFullYear();
  return d.getDate() + '. ' + MONTHS_GEN[d.getMonth()] + (sameYear ? '' : ' ' + d.getFullYear());
}

/** „24. 9. 2026“ */
export function numericDate(date: LocalDate): string {
  const d = parseLocalDate(date);
  return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear();
}

/** Nadpis dne v ose: Dnes / Včera / Zítra / Pondělí … / 3. září */
export function dayTitle(date: LocalDate, today: LocalDate): string {
  const n = diffDays(today, date);
  if (n === 0) return 'Dnes';
  if (n === -1) return 'Včera';
  if (n === 1) return 'Zítra';
  if (n > -7 && n < 0) {
    const wd = WEEKDAYS[parseLocalDate(date).getDay()];
    return wd.charAt(0).toUpperCase() + wd.slice(1);
  }
  return shortDate(date, today);
}

/** Podnadpis dne: datum, pokud ho už nenese nadpis. */
export function daySubtitle(date: LocalDate, today: LocalDate): string {
  const n = diffDays(today, date);
  if (n >= -1 && n <= 1) return longDate(date);
  if (n > -7 && n < 0) return parseLocalDate(date).getDate() + '. ' + MONTHS_GEN[parseLocalDate(date).getMonth()];
  const wd = WEEKDAYS[parseLocalDate(date).getDay()];
  return wd.charAt(0).toUpperCase() + wd.slice(1);
}

/** „za 3 dny“, „zítra“, „dnes“, „před 2 dny“ */
export function relativeDays(date: LocalDate, today: LocalDate): string {
  const n = diffDays(today, date);
  if (n === 0) return 'dnes';
  if (n === 1) return 'zítra';
  if (n === -1) return 'včera';
  if (n > 0) {
    if (n < 5) return 'za ' + n + ' dny';
    if (n < 14) return 'za ' + n + ' dní';
    const w = Math.round(n / 7);
    if (n < 60) return 'za ' + w + (w < 5 ? ' týdny' : ' týdnů');
    const m = Math.round(n / 30);
    return 'za ' + m + (m < 5 ? ' měsíce' : ' měsíců');
  }
  const p = -n;
  if (p < 7) return 'před ' + p + ' dny';
  return shortDate(date, today);
}

/** „Dobré ráno“ podle hodiny */
export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Dobrou noc';
  if (h < 10) return 'Dobré ráno';
  if (h < 18) return 'Dobrý den';
  return 'Dobrý večer';
}

/** Česká množná čísla: plural(3, 'záznam', 'záznamy', 'záznamů') */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' kB';
  return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}

/** Věk v letech k danému dni */
export function ageOn(birth: LocalDate, today: LocalDate): number {
  const b = parseLocalDate(birth);
  const t = parseLocalDate(today);
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

export function ageLabel(age: number): string {
  return age + ' ' + plural(age, 'rok', 'roky', 'let');
}

/** Pondělí týdne, ve kterém leží `date` */
export function startOfWeek(date: LocalDate): LocalDate {
  const d = parseLocalDate(date);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return toLocalDate(d);
}

/** 42 dní mřížky měsíce (6 týdnů od pondělí) */
export function monthGrid(year: number, month: number): LocalDate[] {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - shift);
  const out: LocalDate[] = [];
  for (let i = 0; i < 42; i++) {
    out.push(toLocalDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }
  return out;
}

/** Skloňování jména do 2. pádu pro „karta Terezy“ — jen nejčastější vzory, jinak beze změny. */
export function genitive(name: string): string {
  if (/[ae]$/i.test(name) && name.length > 2) {
    if (/za$/i.test(name)) return name.slice(0, -1) + 'y';
    if (/a$/i.test(name)) return name.slice(0, -1) + (/[kghrdtn]a$/i.test(name) ? 'y' : 'i');
    return name;
  }
  if (/[bcdfghjklmnpqrstvwxzčďňřšťž]$/i.test(name)) return name + 'a';
  if (/o$/i.test(name)) return name.slice(0, -1) + 'a';
  return name;
}

/** 5. pád pro pozdrav „Ahoj, Terezo“ — nejčastější vzory, jinak beze změny. */
export function vocative(name: string): string {
  const n = name.trim().split(/\s+/)[0] || name;
  if (/a$/i.test(n)) return n.slice(0, -1) + 'o';
  if (/(ek)$/i.test(n)) return n.slice(0, -2) + 'ku';
  if (/[kgh]$/i.test(n)) return n + 'u';
  if (/[šžčřcjť]$/i.test(n)) return n + 'i';
  if (/r$/i.test(n) && n.length > 3 && !/[aeiouy]r$/i.test(n)) return n.slice(0, -1) + 'ře';
  if (/[bdflmnprstvz]$/i.test(n)) return n + 'e';
  return n;
}
