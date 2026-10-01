import { fold } from './doctorRegistry';

/**
 * Našeptávání léků z Databáze léčivých přípravků SÚKL (otevřená data,
 * scripts/import-leky.mjs). Běží offline. Kód SÚKL a ATC se uloží k léku —
 * jsou to kódy, které potřebuje export do FHIR.
 *
 * Řádek: [kód SÚKL, název, síla, léková forma, ATC, dodává se 1/0]
 */
export type DrugRow = [string, string, string, string, string, number];

export interface DrugSuggestion {
  code: string;
  name: string;
  strength: string;
  form: string;
  atc: string;
}

export function buildDrugIndex(rows: DrugRow[]): { rows: DrugRow[]; hay: string[] } {
  return { rows, hay: rows.map((r) => fold(r[1] + ' ' + r[2])) };
}

/** „EUTHYROX“ → „Euthyrox“; kombinace s čísly a zkratkami nechá. */
export function prettyName(n: string): string {
  if (n !== n.toUpperCase()) return n;
  return n
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
}

/** „50MCG“ → „50 µg“, „500MG/5ML“ → „500 mg/5 ml“. */
export function prettyStrength(s: string): string {
  return s
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\bMCG\b|\bUG\b/gi, 'µg')
    .replace(/\b(MG|G|ML|L)\b/g, (m) => m.toLowerCase())
    .replace(/\bIU\b/g, 'IU')
    .trim();
}

export function searchDrugs(index: { rows: DrugRow[]; hay: string[] }, query: string, limit = 6): DrugSuggestion[] {
  const words = fold(query).split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return [];
  const hits: { i: number; score: number }[] = [];
  for (let i = 0; i < index.hay.length; i++) {
    const h = index.hay[i];
    if (!words.every((w) => h.includes(w))) continue;
    const score = (h.startsWith(words[0]) ? 4 : 0) + index.rows[i][5] * 2;
    hits.push({ i, score });
    if (hits.length > 300) break;
  }
  hits.sort((a, b) => b.score - a.score || index.hay[a.i].length - index.hay[b.i].length);
  return hits.slice(0, limit).map(({ i }) => {
    const [code, name, strength, form, atc] = index.rows[i];
    return { code, name: prettyName(name), strength: prettyStrength(strength), form, atc };
  });
}

/** Najde v řádku textu (např. ze skeneru) lék z registru — podle prvního slova názvu. */
export function matchDrugInLine(index: { rows: DrugRow[]; hay: string[] }, line: string): DrugSuggestion | null {
  const words = fold(line).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  for (const w of words) {
    const hit = searchDrugs(index, w, 1)[0];
    if (hit && fold(hit.name).split(/\s+/)[0] === w) return hit;
  }
  return null;
}
