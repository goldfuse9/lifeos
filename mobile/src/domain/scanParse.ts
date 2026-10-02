import type { LocalDate, LocalTime } from './types';
import { addDays, isValidLocalDate } from './dates';
import { TIME_PRESETS } from './meds';

/**
 * Vytažení údajů z textu vyfocené lékařské zprávy, receptu nebo žádanky.
 * Čistá pravidla, žádná AI ani síť — text rozpozná telefon a tady se
 * jen hledají běžné české zápisy:
 *   léky s dávkováním „1-0-1“, „1x denně“, „ráno a večer“,
 *   „kontrola za 3 měsíce“, „kontrola 12. 11. 2026 v 8:30“,
 *   „MUDr. Jana Nováková“, diagnózy MKN-10 („E03.9“).
 * Výsledek je vždy jen návrh — člověk ho před uložením zkontroluje.
 */

export type DocKind = 'zprava' | 'recept' | 'zadanka';

export interface ScannedMed {
  /** Řádek, ze kterého lék pochází (pro kontrolu). */
  line: string;
  name: string;
  dose?: string;
  times: LocalTime[];
  /** „podle potřeby“ apod. — bez pravidelného času. */
  asNeeded: boolean;
}

export interface ScanResult {
  kind: DocKind;
  title: string;
  date: LocalDate | null;
  doctor: string | null;
  diagnoses: string[];
  meds: ScannedMed[];
  followUp: { date: LocalDate; time: LocalTime | null; line: string } | null;
}

const MONTHS_GEN: Record<string, number> = {
  ledna: 1, února: 2, unora: 2, března: 3, brezna: 3, dubna: 4, května: 5, kvetna: 5, června: 6, cervna: 6,
  července: 7, cervence: 7, srpna: 8, září: 9, zari: 9, října: 10, rijna: 10, listopadu: 11, prosince: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

function mkDate(d: number, m: number, y: number): LocalDate | null {
  if (y < 100) y += 2000;
  const s = `${y}-${pad(m)}-${pad(d)}`;
  return isValidLocalDate(s) ? s : null;
}

/** Všechna data v řádku: „12. 11. 2026“, „12.11.26“, „12. listopadu 2026“, „12. 11.“ (rok doplní). */
export function datesIn(line: string, refYear: number): { date: LocalDate; index: number }[] {
  const out: { date: LocalDate; index: number }[] = [];
  const num = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4}|\d{2}(?!\d))?/g;
  let m: RegExpExecArray | null;
  while ((m = num.exec(line))) {
    const d = mkDate(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : refYear);
    if (d) out.push({ date: d, index: m.index });
  }
  const word = /(\d{1,2})\s*\.\s*([a-záčďéěíňóřšťúůýž]+)\s+(\d{4})/gi;
  while ((m = word.exec(line))) {
    const mo = MONTHS_GEN[m[2].toLowerCase()];
    const d = mo ? mkDate(Number(m[1]), mo, Number(m[3])) : null;
    if (d) out.push({ date: d, index: m.index });
  }
  return out.sort((a, b) => a.index - b.index);
}

function timeIn(line: string): LocalTime | null {
  const m = /(?:\bv\s*|\bod\s*|\b)([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:hod|h\b)?/i.exec(line.replace(/\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*\d{2,4}/g, ' '));
  return m ? `${pad(Number(m[1]))}:${m[2]}` : null;
}

function addMonths(date: LocalDate, n: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, d);
  if (dt.getDate() !== d) dt.setDate(0);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

const MORNING = TIME_PRESETS[0][0];
const NOON = TIME_PRESETS[1][0];
const EVENING = TIME_PRESETS[2][0];
const NIGHT = TIME_PRESETS[3][0];

/** Dávkování → časy. „1-0-1“, „½-0-0“, „1-1-1-1“, „2x denně“, „ráno“… */
export function scheduleIn(line: string): { times: LocalTime[]; asNeeded: boolean; at: number } | null {
  const l = line.toLowerCase();
  const scheme = /(?:^|[^\d/.,])((?:\d(?:[,.]5)?|½|0)\s*[-–]\s*(?:\d(?:[,.]5)?|½|0)\s*[-–]\s*(?:\d(?:[,.]5)?|½|0)(?:\s*[-–]\s*(?:\d(?:[,.]5)?|½|0))?)(?![\d/])/.exec(l);
  if (scheme) {
    const parts = scheme[1].split(/[-–]/).map((p) => p.trim());
    const slots = parts.length === 4 ? [MORNING, NOON, EVENING, NIGHT] : [MORNING, NOON, EVENING];
    const times = parts.map((p, i) => (p !== '0' ? slots[i] : null)).filter((t): t is string => !!t);
    return { times, asNeeded: false, at: scheme.index + scheme[0].indexOf(scheme[1]) };
  }
  const daily = /(\d)\s*[x×]\s*(?:denně|denne|d\b|za\s*den)/.exec(l);
  if (daily) {
    const n = Number(daily[1]);
    const times = n === 1 ? [MORNING] : n === 2 ? [MORNING, EVENING] : n === 3 ? [MORNING, NOON, EVENING] : [MORNING, NOON, EVENING, NIGHT];
    // Upřesnění „1x denně večer“
    if (n === 1 && /večer|vecer/.test(l)) return { times: [EVENING], asNeeded: false, at: daily.index };
    if (n === 1 && /na noc/.test(l)) return { times: [NIGHT], asNeeded: false, at: daily.index };
    return { times, asNeeded: false, at: daily.index };
  }
  const words: [RegExp, LocalTime][] = [
    [/\bráno\b|\brano\b/, MORNING],
    [/\bv poledne\b|\bpoledne\b/, NOON],
    [/\bvečer\b|\bvecer\b/, EVENING],
    [/\bna noc\b/, NIGHT],
  ];
  const found = words.filter(([re]) => re.test(l));
  if (found.length) {
    const at = Math.min(...found.map(([re]) => l.search(re)));
    return { times: found.map(([, t]) => t), asNeeded: false, at };
  }
  const prn = /podle potřeby|dle potřeby|při bolesti|pri bolesti|p\.\s*p\.|\bpp\b|při potížích/.exec(l);
  if (prn) return { times: [], asNeeded: true, at: prn.index };
  return null;
}

const STRENGTH = /(\d+(?:[,.]\d+)?)\s*(mg|mcg|µg|ug|g|ml|iu|m\.?\s?j\.?|%)(?:\s*\/\s*(\d+(?:[,.]\d+)?)?\s*(ml|g|dávk\w*))?/i;

function cleanStrength(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\b(mcg|ug)\b/i, 'µg')
    .replace(/(\d)(mg|µg|g|ml)/i, '$1 $2')
    .replace(/,/g, ',')
    .trim();
}

/** Slova, která nejsou názvem léku (začátek řádku, formy, zkratky). */
const NOISE = /^(rp\.?|rec\.?|medikace|terapie|doporučen[áa] terapie|léčba|lecba|chronická medikace|\d+[.)]|[-•*–])\s*/i;
const FORMS = /\b(tbl|tbl\.|tob|cps|cps\.|tablet[ay]?|tobolk[ay]?|gtt|sir|ung|crm|inj|amp|por|flm|nob|eff|sus|sol)\b\.?/gi;

/** Je řádek pravděpodobně lék? Musí mít dávkování a název, ne datum kontroly. */
function medFromLine(line: string, known: ((line: string) => { name: string; strength: string } | null) | null): ScannedMed | null {
  if (/kontrol|objedn|narozen|nar\.|tel\.|telefon|ičo|ičp/i.test(line)) return null;
  const sch = scheduleIn(line);
  if (!sch) return null;
  const hit = known?.(line) ?? null;
  const before = line.slice(0, sch.at);
  const st = STRENGTH.exec(before) ?? STRENGTH.exec(line);
  let name = hit?.name ?? before.replace(NOISE, '').replace(STRENGTH, ' ').replace(FORMS, ' ').replace(/[,;:]+$/, '');
  name = name.replace(/\s+/g, ' ').replace(/^[^\p{L}]+|[^\p{L}\d]+$/gu, '').trim();
  if (!name || name.length < 3 || !/\p{L}{3}/u.test(name)) return null;
  // Prvních pár slov stačí („Euthyrox 50 mcg tbl. por. ...“ → „Euthyrox“)
  name = name.split(' ').slice(0, 3).join(' ');
  const dose = st ? cleanStrength(st[0]) : hit?.strength || undefined;
  return { line: line.trim(), name, dose, times: sch.times, asNeeded: sch.asNeeded };
}

export function parseScan(
  text: string,
  today: LocalDate,
  known: ((line: string) => { name: string; strength: string } | null) | null = null,
): ScanResult {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const all = lines.join('\n');
  const lower = all.toLowerCase();
  const refYear = Number(today.slice(0, 4));

  const kind: DocKind = /žádank|zadank|žádost o vyšetření|zadost o vysetreni/.test(lower) ? 'zadanka' : /\brecept\b|\brp\.|e-recept|erecept/.test(lower) && !/zpráva|zprava|anamnéz/.test(lower) ? 'recept' : 'zprava';

  // Lékař
  const doc = /\b(MUDr\.|MDDr\.|MU Dr\.)[ \t]*([\p{Lu}][\p{L}-]+(?:[ \t]+[\p{Lu}][\p{L}-]+){0,2})/u.exec(all);
  const doctor = doc ? `${doc[1].replace(/\s/g, '')} ${doc[2]}`.replace(/\s+(Ph\.D|CSc).*$/, '') : null;

  // Diagnózy MKN-10 (jen v řádcích s „Dg“ / „diagnóz“, aby se nechytaly jiné kódy)
  const diagnoses: string[] = [];
  for (const l of lines) {
    if (!/\bdg\b|diagn/i.test(l)) continue;
    for (const m of l.matchAll(/\b([A-TV-Z]\d{2}(?:\.\d{1,2})?)\b/g)) if (!diagnoses.includes(m[1])) diagnoses.push(m[1]);
  }

  // Datum dokumentu: „dne 2. 10. 2026“, „Datum: …“, jinak první datum, které není narození ani kontrola
  let date: LocalDate | null = null;
  for (const l of lines) {
    if (/narozen|nar\.|kontrol|platnost/i.test(l)) continue;
    const d = datesIn(l, refYear).find((x) => x.date <= today);
    if (d && (/\bdne\b|datum|vystaveno|v\s+\p{L}+\s+dne/iu.test(l) || !date)) {
      date = d.date;
      if (/\bdne\b|datum|vystaveno/i.test(l)) break;
    }
  }

  // Kontrola
  let followUp: ScanResult['followUp'] = null;
  for (let i = 0; i < lines.length && !followUp; i++) {
    const l = lines[i];
    if (!/kontrol|příště|pristi|objednán|objednan|další vyšetření|dalsi vysetreni/i.test(l)) continue;
    // Další řádek jen jako pokračování (ne „V Praze dne …“).
    const next = lines[i + 1] && !/\bdne\b|datum|podpis/i.test(lines[i + 1]) ? lines[i + 1] : '';
    const base = date ?? today;
    const abs = datesIn(l, refYear).find((d) => d.date > base) ?? datesIn(next, refYear).find((d) => d.date > base);
    if (abs) {
      followUp = { date: abs.date, time: timeIn(l + ' ' + next), line: l };
      break;
    }
    const rel = /za\s+(\d+|jeden|jednu|dva|dvě|tři|čtyři|šest|pul|půl)\s*(den|dny|dní|dnů|týd\w*|tyd\w*|měs\w*|mes\w*|rok\w*|let)/i.exec(l + ' ' + next);
    if (rel) {
      const words: Record<string, number> = { jeden: 1, jednu: 1, dva: 2, dvě: 2, tři: 3, čtyři: 4, šest: 6, pul: 0.5, půl: 0.5 };
      const n = Number(rel[1]) || words[rel[1].toLowerCase()] || 1;
      const u = rel[2].toLowerCase();
      const due = /^d/.test(u) ? addDays(base, n) : /^t/.test(u) ? addDays(base, Math.round(n * 7)) : /^m/.test(u) ? addMonths(base, Math.round(n)) : addMonths(base, Math.round(n * 12));
      followUp = { date: due, time: null, line: l };
    }
  }

  // Léky
  const meds: ScannedMed[] = [];
  for (const l of lines) {
    const m = medFromLine(l, known);
    if (m && !meds.some((x) => x.name.toLowerCase() === m.name.toLowerCase())) meds.push(m);
  }

  const title = kind === 'zadanka' ? 'Žádanka' : kind === 'recept' ? 'Recept' : 'Lékařská zpráva';
  return { kind, title: doctor && kind === 'zprava' ? `${title} · ${doctor}` : title, date, doctor, diagnoses, meds, followUp };
}

/** Řádky OCR seřazené do řádků textu podle polohy (tabulky v zprávách MLKit dělí do bloků). */
export function linesByPosition(items: { text: string; top: number; left: number; height: number }[]): string {
  const sorted = [...items].sort((a, b) => a.top + a.height / 2 - (b.top + b.height / 2));
  const rows: { cy: number; h: number; parts: { left: number; text: string }[] }[] = [];
  for (const it of sorted) {
    const cy = it.top + it.height / 2;
    const row = rows.find((r) => Math.abs(r.cy - cy) < Math.min(r.h, it.height) * 0.5);
    if (row) row.parts.push({ left: it.left, text: it.text });
    else rows.push({ cy, h: it.height, parts: [{ left: it.left, text: it.text }] });
  }
  return rows.map((r) => r.parts.sort((a, b) => a.left - b.left).map((p) => p.text).join('  ')).join('\n');
}
