import { MONTHS_NOM, addDays, diffDays, parseLocalDate } from './dates';
import type { LocalDate, RecordDraft } from './types';

/**
 * Co přichází ze školky: nástěnka, akce, platby, fotky, dotazníky
 * a docházka. Ve fázi 1 to školka poslat neumí (chybí server), takže
 * data vznikají jen jako ukázka v telefonu a jsou tak označená. Co jde
 * udělat bez serveru, je skutečné: zápis akce do kalendáře, QR platba
 * z účtu, který zadá rodič, odpovědi v dotaznících a omluvené dny.
 */

export interface Nastenka {
  id: string;
  date: LocalDate;
  title: string;
  text: string;
  file?: string;
}

export interface Akce {
  id: string;
  date: LocalDate;
  time?: string;
  title: string;
  place?: string;
  note?: string;
  price?: number;
  /** Dotazník, kterým se na akci přihlašuje. */
  dotaznik?: string;
  /** Zavřeno, svátek — jen informace, do kalendáře nepatří. */
  info?: boolean;
}

export interface Platba {
  id: string;
  title: string;
  amount: number;
  due: LocalDate;
  paidAt?: string;
  akce?: string;
}

export interface Album {
  id: string;
  date: LocalDate;
  title: string;
  count: number;
  /** Náhledové barvy — skutečné fotky přijdou se serverem. */
  colors: string[];
  seen?: boolean;
}

export interface Dotaznik {
  id: string;
  question: string;
  sub?: string;
  due: LocalDate;
  /** První volba je „ano“ — u akce přihlásí a vytvoří platbu. */
  options: string[];
  answer?: string;
  answeredAt?: string;
  akce?: string;
}

export interface SkolkaFeed {
  demo?: boolean;
  /** Kdy bylo dítě dnes zapsané jako příchozí. */
  prichod?: { date: LocalDate; time: string };
  /** Dny, kdy bylo dítě ve školce. */
  pritomen?: LocalDate[];
  nastenka?: Nastenka[];
  akce?: Akce[];
  platby?: Platba[];
  alba?: Album[];
  dotazniky?: Dotaznik[];
}

export const isEmptyFeed = (f: SkolkaFeed): boolean => !f.demo && !f.akce?.length && !f.platby?.length && !f.nastenka?.length;

export const unpaid = (f: SkolkaFeed): Platba[] => (f.platby ?? []).filter((p) => !p.paidAt).sort((a, b) => a.due.localeCompare(b.due));
export const openSurveys = (f: SkolkaFeed): Dotaznik[] => (f.dotazniky ?? []).filter((d) => !d.answer).sort((a, b) => a.due.localeCompare(b.due));
export const upcomingAkce = (f: SkolkaFeed, today: LocalDate): Akce[] => (f.akce ?? []).filter((a) => a.date >= today).sort((a, b) => a.date.localeCompare(b.date));
export const newAlba = (f: SkolkaFeed): Album[] => (f.alba ?? []).filter((a) => !a.seen);

/** „1 240 Kč“ */
export function czk(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Kč';
}

/** „čt 8. 10.“ */
export function dayShortCz(date: LocalDate): string {
  const d = parseLocalDate(date);
  return ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'][d.getDay()] + ' ' + d.getDate() + '. ' + (d.getMonth() + 1) + '.';
}

const isWeekday = (date: LocalDate) => {
  const g = parseLocalDate(date).getDay();
  return g !== 0 && g !== 6;
};

/** Nejbližší všední den od `date` (včetně). */
export function weekdayFrom(date: LocalDate): LocalDate {
  let d = date;
  while (!isWeekday(d)) d = addDays(d, 1);
  return d;
}

/* ------------------------------------------------------------- platby */

/**
 * Český účet „prefix-číslo/banka“ → IBAN (CZ, mod 97). Vrátí null,
 * když účet nemá platný tvar nebo kontrolní součet — QR z neplatného
 * účtu by banka stejně odmítla.
 */
export function czIban(account: string): string | null {
  const m = /^\s*(?:(\d{1,6})-)?(\d{2,10})\s*\/\s*(\d{4})\s*$/.exec(account);
  if (!m) return null;
  const prefix = (m[1] ?? '').padStart(6, '0');
  const num = m[2].padStart(10, '0');
  const bank = m[3];
  // Kontrola čísla účtu dle vyhlášky ČNB (váhy 6,3,7,9,10,5,8,4,2,1)
  const w = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];
  const ok = (s: string) => s.split('').reduce((sum, c, i) => sum + Number(c) * w[i + (10 - s.length)], 0) % 11 === 0;
  if (!ok(prefix) || !ok(num)) return null;
  const bban = bank + prefix + num;
  const check = 98 - mod97(bban + '123500'); // C=12, Z=35
  return 'CZ' + String(check).padStart(2, '0') + bban;
}

function mod97(digits: string): number {
  let r = 0;
  for (const c of digits) r = (r * 10 + Number(c)) % 97;
  return r;
}

/** Text QR platby (formát SPAYD, který čtou české bankovní aplikace). */
export function spayd(p: { iban: string; amount: number; vs?: string; msg?: string }): string {
  const clean = (s: string) => s.replace(/\*/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 60);
  const parts = ['SPD', '1.0', 'ACC:' + p.iban, 'AM:' + p.amount.toFixed(2), 'CC:CZK'];
  if (p.vs && /^\d{1,10}$/.test(p.vs)) parts.push('X-VS:' + p.vs);
  if (p.msg) parts.push('MSG:' + clean(p.msg));
  return parts.join('*');
}

/* ----------------------------------------------------------- docházka */

export type DenStav = 'in' | 'omluven' | 'volno' | 'budouci' | 'nic';

export function denStav(date: LocalDate, today: LocalDate, pritomen: Set<string>, omluveno: Set<string>): DenStav {
  if (!isWeekday(date)) return 'volno';
  if (omluveno.has(date)) return 'omluven';
  if (pritomen.has(date)) return 'in';
  return date > today ? 'budouci' : 'nic';
}

export function monthStats(year: number, month: number, today: LocalDate, pritomen: Set<string>, omluveno: Set<string>) {
  let inn = 0;
  let om = 0;
  let work = 0;
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  for (let d = first; parseLocalDate(d).getMonth() === month; d = addDays(d, 1)) {
    if (!isWeekday(d)) continue;
    work++;
    const s = denStav(d, today, pritomen, omluveno);
    if (s === 'in') inn++;
    if (s === 'omluven') om++;
  }
  return { inn, om, work };
}

/* --------------------------------------------------------------- ukázka */

/** Ukázková data relativně k dnešku — aby šlo všechno vyzkoušet bez školky. */
export function demoFeed(today: LocalDate): SkolkaFeed {
  const d = (n: number) => weekdayFrom(addDays(today, n));
  const month = parseLocalDate(today).getMonth();
  const prevMonth = MONTHS_NOM[(month + 11) % 12].toLowerCase();
  const thisMonth = MONTHS_NOM[month].toLowerCase();
  const pritomen: LocalDate[] = [];
  for (let x = addDays(today, -40); x <= today; x = addDays(x, 1)) if (isWeekday(x)) pritomen.push(x);
  const drak = d(5);
  const divadlo = d(11);
  const zoo = d(13);
  return {
    demo: true,
    prichod: isWeekday(today) ? { date: today, time: '07:52' } : undefined,
    pritomen,
    nastenka: [
      { id: 'n1', date: addDays(today, -1), title: 'Drakiáda ' + dayShortCz(drak), text: 'Sraz v 15:30 na zahradě školky. Draky vezměte z domu.' },
      { id: 'n2', date: addDays(today, -3), title: 'Jídelníček na ' + thisMonth, text: 'Nový jídelníček visí v šatně a je v příloze.', file: 'jidelnicek.pdf' },
    ],
    akce: [
      { id: 'drak', date: drak, time: '15:30', title: 'Drakiáda', place: 'zahrada školky', note: 'draka z domu' },
      { id: 'divadlo', date: divadlo, time: '09:30', title: 'Divadlo Koloběžka', place: 've třídě', price: 80 },
      { id: 'zoo', date: zoo, time: '08:00', title: 'Výlet do ZOO', place: 'sraz před školkou', note: 'batoh, pití, pláštěnka', price: 250, dotaznik: 'zoo' },
      { id: 'foto', date: d(18), title: 'Fotografování', note: 'sváteční oblečení' },
    ],
    platby: [
      { id: 'strava', title: 'Stravné — ' + thisMonth, amount: 1240, due: addDays(today, 12) },
      { id: 'divadlo', title: 'Divadlo Koloběžka', amount: 80, due: addDays(today, -1), paidAt: new Date(parseLocalDate(addDays(today, -1))).toISOString(), akce: 'divadlo' },
      { id: 'strava-pred', title: 'Stravné — ' + prevMonth, amount: 1180, due: addDays(today, -20), paidAt: new Date(parseLocalDate(addDays(today, -23))).toISOString() },
    ],
    alba: [
      { id: 'a1', date: addDays(today, -2), title: 'Podzimní tvoření', count: 24, colors: ['#F6C9A8', '#F7B56A', '#D7F23A', '#FBE3CF'] },
      { id: 'a2', date: addDays(today, -9), title: 'Výlet k rybníku', count: 12, colors: ['#CFE3FA', '#B2CCFA', '#AAE8D6', '#E8EFFD'], seen: true },
      { id: 'a3', date: addDays(today, -30), title: 'První dny ve školce', count: 18, colors: ['#E5D4FA', '#C8AAF5', '#F7B3C7', '#F3E8FC'], seen: true },
    ],
    dotazniky: [
      { id: 'zoo', question: 'Pojede na výlet do ZOO ' + dayShortCz(zoo) + '?', sub: '8:00–15:00 · ' + czk(250) + ' · batoh, pití, pláštěnka', due: d(5), options: ['Ano, pojede', 'Nepojede'], akce: 'zoo' },
      { id: 'alergie', question: 'Platí alergie a léky, které školka vidí?', sub: 'Kontrola na začátku roku', due: d(10), options: ['Ano, beze změny', 'Upravit'] },
    ],
  };
}

/** Odpověď na dotazník: u akce s cenou první („ano“) volba přidá platbu. */
export function answerSurvey(f: SkolkaFeed, id: string, answer: string, today: LocalDate, nowIso: string): SkolkaFeed {
  const dot = (f.dotazniky ?? []).find((x) => x.id === id);
  if (!dot) return f;
  const yes = answer === dot.options[0];
  const akce = dot.akce ? (f.akce ?? []).find((a) => a.id === dot.akce) : undefined;
  let platby = (f.platby ?? []).filter((p) => !(akce && p.akce === akce.id && !p.paidAt));
  if (yes && akce?.price) platby = [...platby, { id: 'akce-' + akce.id, title: akce.title, amount: akce.price, due: diffDays(today, akce.date) > 3 ? addDays(akce.date, -3) : today, akce: akce.id }];
  return {
    ...f,
    dotazniky: (f.dotazniky ?? []).map((x) => (x.id === id ? { ...x, answer, answeredAt: nowIso } : x)),
    platby,
  };
}

/** Termín akce do kalendáře (událost s odkazem na akci). */
export function akceRecord(a: Akce, demo?: boolean): RecordDraft {
  return { type: 'event', title: a.title, description: [a.place, a.note].filter(Boolean).join(' · '), date: a.date, time: a.time ?? null, metadata: { skolkaAkce: a.id, place: a.place, ...(demo ? { skolkaDemo: true } : {}) } };
}
