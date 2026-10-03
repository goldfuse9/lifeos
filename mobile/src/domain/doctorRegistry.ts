import type { DoctorRole } from './types';

/**
 * Našeptávání lékařů z otevřených dat NRPZS, přibalených v aplikaci
 * (scripts/import-lekari.mjs). Běží offline.
 *
 * Záznam registru je n-tice kvůli velikosti:
 * [jméno lékaře, název ordinace, obory, obec, ulice, telefon]
 */
export type RegistryRow = [string, string, string, string, string, string];

export interface DoctorSuggestion {
  name: string;
  place: string;
  specialty: string;
  role: DoctorRole;
  phone: string;
  city: string;
}

export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Obor z registru → role v aplikaci. */
export function roleFor(obory: string): DoctorRole {
  const o = fold(obory);
  if (o.includes('pro deti a dorost') || o.includes('pediatr')) return 'pediatr';
  if (o.includes('vseobecne prakticke')) return 'praktik';
  if (o.includes('zubni') || o.includes('stomatolog')) return 'zubar';
  if (o.includes('gynekolog')) return 'gyn';
  return 'spec';
}

/** Index pro rychlé hledání — jednou při prvním použití. */
export function buildIndex(rows: RegistryRow[]): { rows: RegistryRow[]; hay: string[] } {
  return { rows, hay: rows.map((r) => fold(r[0] + ' ' + r[1] + ' ' + r[2] + ' ' + r[3])) };
}

/**
 * Všechna slova dotazu musí v záznamu být. Přednost mají ti, jejichž
 * jméno (příjmení) slovem z dotazu začíná.
 */
export function searchRegistry(index: { rows: RegistryRow[]; hay: string[] }, query: string, limit = 8): DoctorSuggestion[] {
  const words = fold(query).split(/\s+/).filter((w) => w.length >= 2 && !['mudr', 'mddr'].includes(w.replace(/\./g, '')));
  if (!words.length) return [];
  const hits: { i: number; score: number }[] = [];
  for (let i = 0; i < index.hay.length; i++) {
    const h = index.hay[i];
    if (!words.every((w) => h.includes(w))) continue;
    const nameWords = fold(index.rows[i][0]).split(/[\s.,]+/);
    const score = words.reduce((s, w) => s + (nameWords.some((n) => n.startsWith(w)) ? 2 : 0), 0);
    hits.push({ i, score });
    if (hits.length > 400) break;
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map(({ i }) => {
    const [name, org, obory, city, street, phone] = index.rows[i];
    const role = roleFor(obory);
    return {
      name,
      place: [org, street, city].filter(Boolean).join(', '),
      specialty: role === 'spec' ? obory.split(',')[0] : '',
      role,
      phone,
      city,
    };
  });
}
