import type { HcRecord, LocalDate, PersonalData } from './types';
import { addMonthsLocal, diffDays, numericDate } from './dates';

/**
 * Preventivní prohlídky a screeningy hrazené z veřejného pojištění
 * (stav 2026: VZP, ZP MV, screeningy.vzp.cz). Orientační — podrobnosti
 * a nárok potvrdí lékař nebo pojišťovna.
 *
 * Provedená prohlídka = záznam v ose (návštěva) s metadata.prevention.
 * Naplánovaná = takový záznam v budoucnu.
 */

export type Sex = 'žena' | 'muž' | 'jiné' | undefined;

export interface PrevDef {
  key: string;
  name: string;
  /** Kde / u koho. */
  who: string;
  /** Co obnáší (krátce). */
  what: string;
  /** Jak často (text). */
  often: string;
  /** Interval v měsících pro výpočet „příště“ (null = určí lékař). */
  months: number | null;
  /** Pro koho — věk v letech (včetně) a pohlaví. */
  minAge: number;
  maxAge?: number;
  sex?: 'žena' | 'muž';
  /** Jen pro kuřáky (screening plic). */
  smokers?: boolean;
}

export const PREVENTION: PrevDef[] = [
  { key: 'praktik-deti', name: 'Prohlídka u dětského lékaře', who: 'praktický lékař pro děti a dorost', what: 'růst, vývoj, zrak, sluch, očkování', often: 'v 1. roce několikrát, pak zhruba každé 2 roky', months: 24, minAge: 0, maxAge: 17 },
  { key: 'praktik', name: 'Preventivní prohlídka u praktika', who: 'praktický lékař', what: 'tlak, krev a moč, EKG, podle věku cholesterol, ledviny, játra', often: 'každé 2 roky', months: 24, minAge: 18 },
  { key: 'zubar-deti', name: 'Zubař — preventivní prohlídka', who: 'zubní lékař', what: 'kontrola zubů a dásní', often: '2× ročně', months: 6, minAge: 1, maxAge: 17 },
  { key: 'zubar', name: 'Zubař — preventivní prohlídka', who: 'zubní lékař', what: 'kontrola zubů a dásní', often: '1× ročně', months: 12, minAge: 18 },
  { key: 'gyn', name: 'Gynekologická prohlídka', who: 'gynekolog', what: 'prohlídka a cytologie (screening rakoviny děložního hrdla), od 35 let i HPV test', often: '1× ročně', months: 12, minAge: 15, sex: 'žena' },
  { key: 'mamo', name: 'Mamografie', who: 'mamografické centrum (žádanka od gynekologa nebo praktika)', what: 'screening rakoviny prsu', often: 'každé 2 roky', months: 24, minAge: 45, sex: 'žena' },
  { key: 'kolon', name: 'Screening rakoviny tlustého střeva', who: 'praktik nebo gynekolog (test), gastroenterolog (kolonoskopie)', what: 'test na skryté krvácení ve stolici, nebo kolonoskopie', often: 'test každé 2 roky, nebo kolonoskopie 1× za 10 let', months: 24, minAge: 45, maxAge: 74 },
  { key: 'prostata', name: 'Screening rakoviny prostaty', who: 'praktický lékař, urolog', what: 'krevní test PSA', often: 'interval určí lékař podle výsledku', months: null, minAge: 50, maxAge: 69, sex: 'muž' },
  { key: 'plice', name: 'Screening rakoviny plic', who: 'praktický lékař → nízkodávkové CT', what: 'pro kuřáky a bývalé kuřáky', often: 'podle programu, určí lékař', months: null, minAge: 55, maxAge: 74, smokers: true },
];

export const prevDef = (key: string) => PREVENTION.find((p) => p.key === key) ?? null;

export function prevKeyOf(r: HcRecord): string | null {
  const k = (r.metadata as { prevention?: unknown }).prevention;
  return typeof k === 'string' ? k : null;
}

export function ageOnDate(birth: LocalDate, today: LocalDate): number {
  const [by, bm, bd] = birth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Které prohlídky se karty týkají (věk, pohlaví, kouření). Bez data narození — dospělé bez věkových screeningů. */
export function applicable(birth: LocalDate | null, personal: PersonalData, today: LocalDate): PrevDef[] {
  const age = birth ? ageOnDate(birth, today) : null;
  const sex = personal.sex as Sex;
  const smoker = !!personal.smoking && personal.smoking !== 'Nekouřím';
  return PREVENTION.filter((p) => {
    if (age == null) return p.minAge === 18 || (p.minAge === 15 && p.sex === 'žena' && sex === 'žena');
    if (age < p.minAge || (p.maxAge != null && age > p.maxAge)) return false;
    if (p.sex && sex && sex !== 'jiné' && sex !== p.sex) return false;
    if (p.sex && !sex) return false;
    if (p.smokers && !smoker) return false;
    return true;
  });
}

export type PrevState = 'now' | 'planned' | 'soon' | 'ok' | 'ask';

export interface PrevStatus {
  def: PrevDef;
  last: HcRecord | null;
  planned: HcRecord | null;
  /** Od kdy je nárok na další (null = hned, nebo určí lékař). */
  nextFrom: LocalDate | null;
  state: PrevState;
  hint: string;
}

export function preventionOverview(defs: PrevDef[], records: HcRecord[], today: LocalDate): PrevStatus[] {
  const out: PrevStatus[] = [];
  for (const def of defs) {
    const mine = records.filter((r) => prevKeyOf(r) === def.key);
    const last = mine.filter((r) => r.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    const planned = mine.filter((r) => r.date > today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    const nextFrom = last && def.months ? addMonthsLocal(last.date, def.months) : null;
    let state: PrevState;
    let hint: string;
    if (planned) {
      state = 'planned';
      hint = 'Naplánováno na ' + numericDate(planned.date) + (planned.time ? ' ' + planned.time.replace(/^0/, '') : '');
    } else if (!last) {
      state = def.months ? 'now' : 'ask';
      hint = def.months ? 'Bez záznamu — můžete se objednat' : 'Zeptejte se lékaře';
    } else if (!nextFrom) {
      state = 'ask';
      hint = 'Naposledy ' + numericDate(last.date) + ' · další určí lékař';
    } else {
      const left = diffDays(today, nextFrom);
      state = left <= 0 ? 'now' : left <= 45 ? 'soon' : 'ok';
      hint = 'Naposledy ' + numericDate(last.date) + (left <= 0 ? ' · nárok na další už teď' : ' · další od ' + numericDate(nextFrom));
    }
    out.push({ def, last, planned, nextFrom, state, hint });
  }
  const rank: Record<PrevState, number> = { now: 0, soon: 1, planned: 2, ask: 3, ok: 4 };
  return out.sort((a, b) => rank[a.state] - rank[b.state] || PREVENTION.indexOf(a.def) - PREVENTION.indexOf(b.def));
}
