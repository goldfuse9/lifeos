import type { HcRecord, LocalDate } from './types';
import { diffDays, numericDate } from './dates';
import { fold } from './doctorRegistry';
import { addYears, vaccineOf } from './vaccines';

/**
 * Katalog očkování podle českého očkovacího kalendáře (vyhláška
 * č. 537/2006 Sb., stav k 1/2026) a přehled očkování jedné karty.
 *
 * Povinná (pravidelná) očkování dětí jsou zároveň podmínkou přijetí do
 * mateřské školy a dětské skupiny (§ 50 zákona č. 258/2000 Sb.).
 * Věky a intervaly jsou orientační — termín vždy určuje lékař.
 */

export type VaxGroup = 'povinne' | 'doporucene';

export interface VaxDef {
  key: string;
  name: string;
  /** Proti čemu (krátce). */
  against: string;
  group: VaxGroup;
  /** Podmínka pro MŠ / dětskou skupinu. */
  school?: boolean;
  /** Kdy se podává (text pro člověka). */
  when: string;
  /** Kolik dávek by mělo být podáno do věku (měsíce) — pro děti. */
  expect?: { doses: number; byMonths: number }[];
  /** Návrh přeočkování v letech (předvyplní se v zápisu). */
  boosterYears: number | null;
  /** Obsahuje tetanus (pro výpočet přeočkování dospělých). */
  tetanus?: boolean;
  /** Názvy a obchodní názvy pro rozpoznání v textu a v zápisu. */
  aliases: string[];
}

export const VAX_CATALOG: VaxDef[] = [
  {
    key: 'hexa',
    name: 'Hexavakcína',
    against: 'záškrt, tetanus, černý kašel, dětská obrna, Hib, hepatitida B',
    group: 'povinne',
    school: true,
    when: '3 dávky: od 9. týdne, ve 4. měsíci, v 11.–13. měsíci',
    expect: [
      { doses: 1, byMonths: 4 },
      { doses: 2, byMonths: 6 },
      { doses: 3, byMonths: 14 },
    ],
    boosterYears: null,
    tetanus: true,
    aliases: ['hexavakcina', 'hexa', 'infanrix hexa', 'hexacima', 'hexyon', 'vaxelis', 'dtap-hib-hepb-ipv'],
  },
  {
    key: 'mmr',
    name: 'Spalničky, zarděnky, příušnice (MMR)',
    against: 'spalničky, zarděnky, příušnice',
    group: 'povinne',
    school: true,
    when: '2 dávky: 13.–18. měsíc a 5.–6. rok',
    expect: [
      { doses: 1, byMonths: 19 },
      { doses: 2, byMonths: 84 },
    ],
    boosterYears: null,
    aliases: ['mmr', 'spalnicky', 'zardenky', 'priusnice', 'priorix', 'm-m-rvaxpro', 'mmrvaxpro', 'priorix-tetra', 'proquad'],
  },
  {
    key: 'dtap',
    name: 'Přeočkování: záškrt, tetanus, černý kašel',
    against: 'záškrt, tetanus, černý kašel',
    group: 'povinne',
    school: true,
    when: '5.–6. rok',
    expect: [{ doses: 1, byMonths: 84 }],
    boosterYears: null,
    tetanus: true,
    aliases: ['dtap', 'tdap', 'infanrix', 'boostrix', 'adacel', 'tetraxim'],
  },
  {
    key: 'dtap-ipv',
    name: 'Přeočkování: záškrt, tetanus, černý kašel, dětská obrna',
    against: 'záškrt, tetanus, černý kašel, dětská obrna',
    group: 'povinne',
    when: '10.–11. rok',
    expect: [{ doses: 1, byMonths: 144 }],
    boosterYears: null,
    tetanus: true,
    aliases: ['dtap-ipv', 'tdap-ipv', 'boostrix polio', 'adacel polio', 'infanrix-ipv', 'repevax'],
  },
  {
    key: 'tetanus',
    name: 'Tetanus',
    against: 'tetanus (dospělí)',
    group: 'povinne',
    when: 'v 25.–26. roce, pak každých 10–15 let',
    boosterYears: 10,
    tetanus: true,
    aliases: ['tetanus', 'tetavax', 'te anatoxin', 'tetanol', 'alteana', 'tdap dospeli'],
  },
  { key: 'pneumo', name: 'Pneumokok', against: 'pneumokokové infekce', group: 'doporucene', when: 'kojenci (hrazeno), senioři 65+', boosterYears: null, aliases: ['pneumokok', 'prevenar', 'vaxneuvance', 'synflorix', 'pneumovax', 'apexxnar'] },
  { key: 'menb', name: 'Meningokok B', against: 'meningokok skupiny B', group: 'doporucene', when: 'kojenci a batolata (hrazeno)', boosterYears: null, aliases: ['meningokok b', 'bexsero', 'trumenba'] },
  { key: 'menacwy', name: 'Meningokok A, C, W, Y', against: 'meningokok skupin A, C, W, Y', group: 'doporucene', when: 'batolata a dospívající (hrazeno)', boosterYears: null, aliases: ['meningokok acwy', 'meningokok', 'nimenrix', 'menquadfi', 'menveo'] },
  { key: 'hpv', name: 'HPV', against: 'lidský papilomavirus', group: 'doporucene', when: '11–13 let (hrazeno)', boosterYears: null, aliases: ['hpv', 'gardasil', 'cervarix'] },
  { key: 'rota', name: 'Rotaviry', against: 'rotavirové průjmy', group: 'doporucene', when: 'kojenci do 6 měsíců', boosterYears: null, aliases: ['rotavir', 'rotarix', 'rotateq'] },
  { key: 'tbe', name: 'Klíšťová encefalitida', against: 'klíšťová encefalitida', group: 'doporucene', when: 'základ 3 dávky, první přeočkování za 3 roky, pak 5 let', boosterYears: 3, aliases: ['kliste', 'klistova', 'encefalitida', 'fsme', 'fsme-immun', 'encepur', 'tbe'] },
  { key: 'flu', name: 'Chřipka', against: 'chřipka', group: 'doporucene', when: 'každý rok na podzim', boosterYears: 1, aliases: ['chripka', 'influvac', 'vaxigrip', 'fluarix', 'efluelda', 'fluenz', 'influenza'] },
  { key: 'covid', name: 'COVID-19', against: 'covid-19', group: 'doporucene', when: 'podle aktuálního doporučení', boosterYears: null, aliases: ['covid', 'comirnaty', 'spikevax', 'nuvaxovid'] },
  { key: 'hepa', name: 'Hepatitida A', against: 'žloutenka typu A', group: 'doporucene', when: '2 dávky', boosterYears: null, aliases: ['hepatitida a', 'havrix', 'avaxim', 'vaqta', 'twinrix'] },
  { key: 'hepb', name: 'Hepatitida B (dospělí)', against: 'žloutenka typu B', group: 'doporucene', when: '3 dávky', boosterYears: null, aliases: ['hepatitida b', 'engerix', 'heplisav'] },
  { key: 'varicella', name: 'Plané neštovice', against: 'plané neštovice', group: 'doporucene', when: '2 dávky od 1 roku', boosterYears: null, aliases: ['plane nestovice', 'varicella', 'varilrix', 'varivax'] },
];

const byKey = new Map(VAX_CATALOG.map((v) => [v.key, v]));
export const vaxDef = (key: string) => byKey.get(key) ?? null;

/** Název (zapsaný nebo z textu) → položka katalogu. Nejdelší alias vyhrává. */
export function matchVaccine(text: string): VaxDef | null {
  const t = fold(text);
  let best: { def: VaxDef; len: number } | null = null;
  for (const def of VAX_CATALOG) {
    for (const a of [def.name, ...def.aliases]) {
      const fa = fold(a);
      if (fa.length >= 3 && (t === fa || new RegExp(`(^|[^a-z0-9])${fa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(t)) && (!best || fa.length > best.len)) best = { def, len: fa.length };
    }
  }
  return best?.def ?? null;
}

export type VaxState = 'due' | 'missing' | 'soon' | 'ok' | 'notyet' | 'unknown';

export interface VaxStatus {
  def: VaxDef | null;
  /** Název řádku (z katalogu, nebo jak ho člověk zapsal). */
  name: string;
  group: VaxGroup;
  doses: HcRecord[];
  last: HcRecord | null;
  nextDue: LocalDate | null;
  state: VaxState;
  /** Krátké vysvětlení stavu. */
  hint: string;
}

const ageMonths = (birth: LocalDate, today: LocalDate) => {
  const [by, bm, bd] = birth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0);
};

/**
 * Přehled pro jednu kartu: všechna povinná (i bez záznamu, podle věku)
 * a nepovinná, která mají záznam. Seřazeno: nejdřív co potřebuje pozornost.
 */
export function vaxOverview(records: HcRecord[], birth: LocalDate | null, today: LocalDate): VaxStatus[] {
  const groups = new Map<string, { def: VaxDef | null; name: string; doses: HcRecord[] }>();
  for (const r of records) {
    const v = vaccineOf(r);
    if (!v) continue;
    const def = matchVaccine(v.name);
    const k = def?.key ?? 'x:' + fold(v.name);
    const g = groups.get(k) ?? { def, name: def?.name ?? v.name, doses: [] };
    g.doses.push(r);
    groups.set(k, g);
  }
  for (const def of VAX_CATALOG) if (def.group === 'povinne' && !groups.has(def.key)) groups.set(def.key, { def, name: def.name, doses: [] });

  const age = birth ? ageMonths(birth, today) : null;
  const lastTetanus = records
    .filter((r) => {
      const v = vaccineOf(r);
      return v && matchVaccine(v.name)?.tetanus;
    })
    .map((r) => r.date)
    .sort()
    .pop();

  const out: VaxStatus[] = [];
  for (const g of groups.values()) {
    const doses = g.doses.sort((a, b) => b.date.localeCompare(a.date));
    const last = doses[0] ?? null;
    const recNext = last ? vaccineOf(last)?.nextDue ?? null : null;
    let nextDue = recNext;
    let state: VaxState = 'unknown';
    let hint = '';
    const def = g.def;

    if (def?.key === 'tetanus') {
      // Dospělí: přeočkování 10–15 let od poslední dávky s tetanem.
      if (age != null && age < 25 * 12 && !doses.length) {
        state = 'notyet';
        hint = 'Poprvé v 25.–26. roce';
      } else if (lastTetanus) {
        nextDue = recNext ?? addYears(lastTetanus, 15);
        const left = diffDays(today, nextDue);
        state = left < 0 ? 'due' : left <= 365 ? 'soon' : 'ok';
        hint = 'Naposledy ' + numericDate(lastTetanus);
      } else {
        hint = 'Bez záznamu — opište z očkovacího průkazu';
      }
    } else if (def?.expect && age != null && age < 18 * 12) {
      // Děti: kolik dávek by podle věku mělo být.
      const due = def.expect.filter((e) => age >= e.byMonths).reduce((n, e) => Math.max(n, e.doses), 0);
      if (doses.length >= (def.expect[def.expect.length - 1]?.doses ?? 1)) {
        state = 'ok';
        hint = 'Hotovo';
      } else if (doses.length < due) {
        state = 'missing';
        hint = `Podle věku ${due} ${due === 1 ? 'dávka' : 'dávky'}, zapsáno ${doses.length}`;
      } else {
        state = 'notyet';
        hint = def.when;
      }
    } else if (nextDue) {
      const left = diffDays(today, nextDue);
      state = left < 0 ? 'due' : left <= 60 ? 'soon' : 'ok';
    } else if (doses.length) {
      state = 'ok';
    } else {
      hint = 'Bez záznamu — opište z očkovacího průkazu';
    }
    out.push({ def, name: g.name, group: def?.group ?? 'doporucene', doses, last, nextDue, state, hint });
  }
  const rank: Record<VaxState, number> = { due: 0, missing: 1, soon: 2, ok: 3, notyet: 4, unknown: 5 };
  const order = (s: VaxStatus) => (s.def ? VAX_CATALOG.indexOf(s.def) : 99);
  return out.sort((a, b) => rank[a.state] - rank[b.state] || order(a) - order(b) || a.name.localeCompare(b.name, 'cs'));
}

export interface VaxNotice {
  tone: 'warn' | 'info';
  title: string;
  text: string;
}

/** Informační okénko: po termínu, chybějící povinná, sezónní očkování. */
export function vaxNotices(list: VaxStatus[], today: LocalDate, isChild: boolean): VaxNotice[] {
  const out: VaxNotice[] = [];
  const due = list.filter((s) => s.state === 'due');
  const soon = list.filter((s) => s.state === 'soon');
  const missing = list.filter((s) => s.state === 'missing');
  if (due.length) out.push({ tone: 'warn', title: 'Po termínu přeočkování', text: due.map((s) => s.name + (s.nextDue ? ` (od ${numericDate(s.nextDue)})` : '')).join(', ') });
  if (missing.length) out.push({ tone: 'warn', title: 'Chybí povinná očkování', text: missing.map((s) => s.name).join(', ') + (isChild ? '. Jsou podmínkou přijetí do mateřské školy.' : '.') });
  if (soon.length) out.push({ tone: 'info', title: 'Brzy přeočkovat', text: soon.map((s) => s.name + (s.nextDue ? ` do ${numericDate(s.nextDue)}` : '')).join(', ') });

  const month = Number(today.slice(5, 7));
  const flu = list.find((s) => s.def?.key === 'flu');
  const fluThisSeason = flu?.last && diffDays(flu.last.date, today) < 200;
  if (month >= 9 && month <= 11 && !fluThisSeason) out.push({ tone: 'info', title: 'Sezóna očkování proti chřipce', text: 'Nejvhodnější je očkovat v říjnu a listopadu, před začátkem chřipkové sezóny.' });
  const tbe = list.find((s) => s.def?.key === 'tbe');
  if (month >= 1 && month <= 4 && (!tbe || tbe.state === 'due' || tbe.state === 'soon')) out.push({ tone: 'info', title: 'Před sezónou klíšťat', text: tbe?.doses.length ? 'Zkontrolujte přeočkování proti klíšťové encefalitidě, klíšťata jsou aktivní od jara.' : 'Základní očkování proti klíšťové encefalitidě je dobré začít v zimě, aby ochrana stihla jaro.' });
  return out;
}

/** Řádek nalezený na fotce očkovacího průkazu. */
export interface VaxCardEntry {
  name: string;
  date: LocalDate;
  line: string;
}

/**
 * Z textu očkovacího průkazu vytáhne dvojice „očkování + datum“.
 * Průkazy bývají tabulka (datum · vakcína · šarže · razítko), proto se
 * hledá v řádku a když v něm datum chybí, i v řádku pod ním.
 */
export function parseVaxCard(text: string, today: LocalDate, datesIn: (line: string, refYear: number) => { date: LocalDate }[]): VaxCardEntry[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const refYear = Number(today.slice(0, 4));
  const out: VaxCardEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/narozen|nar\.|datum narození/i.test(l)) continue;
    const def = matchVaccine(l);
    if (!def) continue;
    const d = datesIn(l, refYear).find((x) => x.date <= today) ?? datesIn(lines[i + 1] ?? '', refYear).find((x) => x.date <= today) ?? datesIn(lines[i - 1] ?? '', refYear).find((x) => x.date <= today);
    if (!d) continue;
    if (!out.some((e) => e.name === def.name && e.date === d.date)) out.push({ name: def.name, date: d.date, line: l });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Rok poslední dávky obsahující tetanus (pro nouzovou kartu). */
export function lastTetanusYear(records: HcRecord[]): string | null {
  const d = records
    .filter((r) => {
      const v = vaccineOf(r);
      return v && matchVaccine(v.name)?.tetanus;
    })
    .map((r) => r.date)
    .sort()
    .pop();
  return d ? d.slice(0, 4) : null;
}
