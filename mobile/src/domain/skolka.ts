import { WEEKDAYS_SHORT, addDays, ageOn, parseLocalDate } from './dates';
import type { LocalDate } from './types';

/**
 * Školka — rodičovská strana na kartě dítěte (3–7 let).
 *
 * Fáze 1 je jen telefon: školka do aplikace zatím nic poslat neumí. Co jde
 * udělat hned, dělá se hned — omluvenka a „dnes vyzvedne někdo jiný“ se
 * zapíší do osy a odejdou školce jako SMS / sdílená zpráva. Zprávy ze školky
 * (teplota, úraz) a sdílení údajů se školkou přijdou se serverem ve fázi 2;
 * nastavení „Co školka vidí“ se ukládá už teď, aby se nemuselo vyplňovat
 * znovu.
 */

export interface SkolkaShare {
  alergie: boolean;
  kontakty: boolean;
  poverene: boolean;
  ockovani: boolean;
  anamneza: boolean;
}

export interface SkolkaData {
  /** Název školky, např. „MŠ Sluníčko“. Bez něj školka není nastavená. */
  name?: string;
  trida?: string;
  phone?: string;
  /** Klíč značky ze šatny (ZNACKY). */
  znacka?: string;
  /** Kdo smí dítě vyzvedávat kromě rodičů. */
  poverene?: string[];
  share?: Partial<SkolkaShare>;
}

export const SHARE_DEFAULT: SkolkaShare = { alergie: true, kontakty: true, poverene: true, ockovani: false, anamneza: false };

export function shareOf(d: SkolkaData): SkolkaShare {
  return { ...SHARE_DEFAULT, ...(d.share ?? {}) };
}

/** Věk, kdy se školka na kartě nabízí sama (do 7 — odklad školní docházky). */
export const SKOLKA_AGE = { from: 3, to: 7 } as const;

export function skolkaAge(birth: LocalDate | null, today: LocalDate): boolean {
  if (!birth) return false;
  const a = ageOn(birth, today);
  return a >= SKOLKA_AGE.from && a <= SKOLKA_AGE.to;
}

/** Dlaždice se ukáže dítěti ve věku školky, nebo komukoli, kdo školku už má nastavenou. */
export function showSkolka(birth: LocalDate | null, d: SkolkaData, today: LocalDate): boolean {
  return !!d.name || skolkaAge(birth, today);
}

export const isSet = (d: SkolkaData): boolean => !!d.name;

/* ------------------------------------------------------------- omluvenka */

export type OmluvaKdy = 'dnes' | 'zitra' | 'dnes-zitra';
export const OMLUVA_KDY: [OmluvaKdy, string][] = [
  ['dnes', 'Dnes'],
  ['zitra', 'Zítra'],
  ['dnes-zitra', 'Dnes a zítra'],
];
export const OMLUVA_PROC = ['Nemoc', 'Lékař', 'Dovolená', 'Jiné'] as const;

export function omluvaDays(kdy: OmluvaKdy, today: LocalDate): LocalDate[] {
  if (kdy === 'dnes') return [today];
  if (kdy === 'zitra') return [addDays(today, 1)];
  return [today, addDays(today, 1)];
}

/** „pá 3. 10.“ */
export function dayShort(date: LocalDate): string {
  const d = parseLocalDate(date);
  return WEEKDAYS_SHORT[d.getDay()].toLowerCase() + ' ' + d.getDate() + '. ' + (d.getMonth() + 1) + '.';
}

const podpis = (parent: string | null) => (parent ? 'Děkuji, ' + parent : 'Děkuji');

/**
 * Text omluvenky pro SMS. Jméno dítěte zůstává v 1. pádě a věta je stavěná
 * tak, aby nepotřebovala skloňovat — automatické skloňování jmen by se
 * u části dětí spletlo a v omluvence to vypadá hloupě.
 */
export function omluvaText(p: { child: string; days: LocalDate[]; proc: string; parent: string | null }): string {
  const kdy = p.days.map(dayShort).join(' a ');
  return `Dobrý den, posílám omluvenku: ${p.child} — ${kdy} — ${p.proc.toLowerCase()}. ${podpis(p.parent)}`;
}

/* ---------------------------------------------------------- vyzvednutí */

export const VYZV_KDY = ['Po obědě', 'Po spaní', 'Odpoledne'] as const;

export function vyzvText(p: { child: string; who: string; kdy: string; parent: string | null }): string {
  return `Dobrý den, dnes vyzvedne: ${p.child} — ${p.kdy.toLowerCase()} — ${p.who}. ${podpis(p.parent)}`;
}

/** Ze školky vyzvedávají vždy rodiče; v nabídce jsou k nim pověřené osoby. */
export function pickupOptions(d: SkolkaData): string[] {
  return (d.poverene ?? []).map((s) => s.trim()).filter(Boolean);
}

/** Odkaz na SMS s předvyplněným textem. iOS chce `&body=`, Android `?body=`. */
export function smsUrl(phone: string, body: string, ios: boolean): string {
  const num = phone.replace(/[^\d+]/g, '');
  return `sms:${num}${ios ? '&' : '?'}body=${encodeURIComponent(body)}`;
}

/* ---------------------------------------------------------------- značky
   Stejné značky jako na tabletu ve školce (lifeos-skolka). Kresba je
   ve viewBoxu 48×48, černá linka a výplň — jako nálepka v šatně. */

export interface Znacka {
  key: string;
  name: string;
  svg: string;
}

const g = (inner: string) => `<g stroke="#17181A" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`;

export const ZNACKY: Znacka[] = [
  { key: 'snehulak', name: 'sněhulák', svg: g('<circle cx="24" cy="35" r="10" fill="#FFFFFF"/><circle cx="24" cy="20" r="7" fill="#FFFFFF"/><rect x="18" y="5" width="12" height="8" rx="1.5" fill="#E0302B"/><rect x="15.5" y="12" width="17" height="3" rx="1.5" fill="#E0302B"/><path d="M24 21l5 1.5-5 1z" fill="#F28C28" stroke-width="1"/>') + '<circle cx="21.5" cy="19" r="1.3" fill="#17181A"/><circle cx="26.5" cy="19" r="1.3" fill="#17181A"/><circle cx="24" cy="31" r="1.4" fill="#17181A"/><circle cx="24" cy="37" r="1.4" fill="#17181A"/>' },
  { key: 'jablko', name: 'jablíčko', svg: g('<path d="M24 16c-3-3-12-2-12 8 0 8 5 14 8 14 1.5 0 2.5-1 4-1s2.5 1 4 1c3 0 8-6 8-14 0-10-9-11-12-8z" fill="#E0302B"/><path d="M24 16c0-3 1-5 3-7" fill="none"/><path d="M27 12c2-4 7-4 8-3-1 3-5 5-8 3z" fill="#3BA55C"/>') },
  { key: 'auticko', name: 'autíčko', svg: g('<path d="M6 33v-8a3 3 0 0 1 3-3h4l5-8h12l5 8h4a3 3 0 0 1 3 3v8z" fill="#2F6FDB"/><path d="M19 17h5v5h-8zM27 17h3l3 5h-6z" fill="#CFE3FA"/><circle cx="15" cy="34" r="4.5" fill="#FFFFFF"/><circle cx="33" cy="34" r="4.5" fill="#FFFFFF"/>') },
  { key: 'kytka', name: 'kytička', svg: g('<path d="M24 27v14" fill="none"/><path d="M24 36c-3-4-8-4-9-2 2 3 6 4 9 2z" fill="#3BA55C"/><circle cx="24" cy="11" r="5" fill="#F06BA8"/><circle cx="31.5" cy="16.5" r="5" fill="#F06BA8"/><circle cx="28.7" cy="25.5" r="5" fill="#F06BA8"/><circle cx="19.3" cy="25.5" r="5" fill="#F06BA8"/><circle cx="16.5" cy="16.5" r="5" fill="#F06BA8"/><circle cx="24" cy="19" r="4.5" fill="#F7B500"/>') },
  { key: 'micek', name: 'míček', svg: g('<circle cx="24" cy="24" r="15" fill="#2F6FDB"/><path d="M10 19c9 4 19 4 28 0v10c-9 4-19 4-28 0z" fill="#FFFFFF"/>') },
  { key: 'motyl', name: 'motýl', svg: g('<ellipse cx="15" cy="17" rx="9" ry="8" fill="#F28C28"/><ellipse cx="33" cy="17" rx="9" ry="8" fill="#F28C28"/><ellipse cx="17" cy="31" rx="7" ry="6" fill="#F7B500"/><ellipse cx="31" cy="31" rx="7" ry="6" fill="#F7B500"/><rect x="22" y="11" width="4" height="27" rx="2" fill="#17181A"/>') },
  { key: 'lodicka', name: 'lodička', svg: g('<path d="M7 31h34l-6 9H13z" fill="#2F6FDB"/><path d="M24 7v24" fill="none"/><path d="M26 9l11 19H26z" fill="#FFFFFF"/><path d="M22 13l-9 15h9z" fill="#E0302B"/>') },
  { key: 'srdce', name: 'srdíčko', svg: g('<path d="M24 40C12 31 7 25 7 18a8.5 8.5 0 0 1 17-3 8.5 8.5 0 0 1 17 3c0 7-5 13-17 22z" fill="#F06BA8"/>') },
  { key: 'hvezda', name: 'hvězdička', svg: g('<polygon points="24,6 29,18 42,18 32,26 36,39 24,31 12,39 16,26 6,18 19,18" fill="#F7B500"/>') },
  { key: 'tresne', name: 'třešničky', svg: g('<path d="M16 27c2-9 7-15 14-19M32 27c0-8-1-13-2-19" fill="none"/><circle cx="16" cy="33" r="7" fill="#C81E3A"/><circle cx="32" cy="33" r="7" fill="#C81E3A"/>') },
  { key: 'muchomurka', name: 'muchomůrka', svg: g('<rect x="19" y="23" width="10" height="16" rx="4" fill="#FFFFFF"/><path d="M8 25a16 14 0 0 1 32 0z" fill="#E0302B"/>') + '<circle cx="17" cy="18" r="2.4" fill="#FFFFFF"/><circle cx="27" cy="15" r="2.6" fill="#FFFFFF"/><circle cx="33" cy="21" r="1.9" fill="#FFFFFF"/><circle cx="23" cy="21.5" r="1.7" fill="#FFFFFF"/>' },
  { key: 'mesic', name: 'měsíček', svg: g('<path d="M30 7a17 17 0 1 0 11 27A14 14 0 0 1 30 7z" fill="#F7B500"/>') },
  { key: 'domecek', name: 'domeček', svg: g('<rect x="12" y="22" width="24" height="18" fill="#F7B500"/><path d="M8 24L24 9l16 15z" fill="#E0302B"/><rect x="21" y="29" width="7" height="11" fill="#FFFFFF"/>') },
  { key: 'destnik', name: 'deštník', svg: g('<path d="M24 24v12a4 4 0 0 1-8 0" fill="none"/><path d="M6 24a18 16 0 0 1 36 0z" fill="#8B5CF6"/>') },
  { key: 'strom', name: 'stromeček', svg: g('<rect x="21" y="30" width="6" height="10" fill="#8A5A2B"/><path d="M24 6l14 24H10z" fill="#3BA55C"/>') },
  { key: 'beruska', name: 'beruška', svg: g('<circle cx="24" cy="13" r="6" fill="#17181A"/><circle cx="24" cy="27" r="13" fill="#E0302B"/><path d="M24 14v26" fill="none"/>') + '<circle cx="18" cy="24" r="2.5" fill="#17181A"/><circle cx="30" cy="24" r="2.5" fill="#17181A"/><circle cx="19" cy="33" r="2.5" fill="#17181A"/><circle cx="29" cy="33" r="2.5" fill="#17181A"/>' },
  { key: 'rybka', name: 'rybička', svg: g('<path d="M31 24l11-8v16z" fill="#F28C28"/><ellipse cx="20" cy="24" rx="13" ry="9" fill="#F28C28"/>') + '<circle cx="13" cy="22" r="2" fill="#17181A"/>' },
  { key: 'balonek', name: 'balónek', svg: g('<path d="M24 35c-3 4 3 6 0 10" fill="none" stroke-width="1.5"/><path d="M22 32h4l-2 3z" fill="#E0302B"/><ellipse cx="24" cy="19" rx="11" ry="13" fill="#E0302B"/>') },
  { key: 'klic', name: 'klíček', svg: g('<path d="M22 21h19v6h-3v5h-5v-5h-2v4h-5v-4h-4z" fill="#F7B500"/><circle cx="15" cy="24" r="9" fill="#F7B500"/><circle cx="15" cy="24" r="3.5" fill="#FFFFFF"/>') },
  { key: 'mracek', name: 'mráček', svg: g('<path d="M14 36a8 8 0 0 1 0-16 11 11 0 0 1 21-2 8 8 0 0 1 0 18z" fill="#8EC5F0"/>') },
  { key: 'mrkev', name: 'mrkvička', svg: g('<path d="M24 16l-6-9M24 16V5M24 16l6-9" fill="none" stroke="#3BA55C" stroke-width="3"/><path d="M16 16h16l-8 26z" fill="#F28C28"/>') },
  { key: 'hruska', name: 'hruška', svg: g('<path d="M24 12V6" fill="none"/><path d="M24 12c-4 0-5 5-5 9-4 3-7 6-7 11a12 9 0 0 0 24 0c0-5-3-8-7-11 0-4-1-9-5-9z" fill="#A8C93A"/>') },
  { key: 'zvonek', name: 'zvoneček', svg: g('<circle cx="24" cy="38" r="3.5" fill="#FFFFFF"/><path d="M24 8c-7 0-11 6-11 13v9l-4 5h30l-4-5v-9c0-7-4-13-11-13z" fill="#F7B500"/>') },
  { key: 'duha', name: 'duha', svg: g('<path d="M5 37a19 19 0 0 1 38 0h-6a13 13 0 0 0-26 0z" fill="#E0302B"/><path d="M11 37a13 13 0 0 1 26 0h-6a7 7 0 0 0-14 0z" fill="#F7B500"/><path d="M17 37a7 7 0 0 1 14 0z" fill="#2F6FDB"/>') },
  { key: 'hrnek', name: 'hrníček', svg: g('<path d="M32 19h3a5.5 5.5 0 0 1 0 11h-3v-3h3a2.5 2.5 0 0 0 0-5h-3z" fill="#2F6FDB"/><path d="M10 15h22v15a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8z" fill="#2F6FDB"/>') },
  { key: 'list', name: 'lístek', svg: g('<path d="M10 38C10 18 22 8 40 8c0 18-10 30-30 30z" fill="#3BA55C"/><path d="M12 36L32 16" fill="none"/>') },
  { key: 'slunce', name: 'sluníčko', svg: g('<path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M14 34l-4 4" fill="none"/><circle cx="24" cy="24" r="9" fill="#F7B500"/>') },
  { key: 'snek', name: 'šnek', svg: g('<path d="M6 38h28c4 0 6-3 6-7v-9" fill="#A8C93A"/><circle cx="22" cy="26" r="11" fill="#F28C28"/><path d="M22 26a3 3 0 1 1 3 3 6 6 0 1 1-6-6" fill="none"/><path d="M40 22l-2-6M40 22l3-5" fill="none"/>') },
];

export function znackaOf(key: string | undefined): Znacka | null {
  return ZNACKY.find((z) => z.key === key) ?? null;
}
