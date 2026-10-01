import type { EmergencyData } from './types';

/**
 * Pole nouzových údajů — podle stránky „Nouzové údaje“ na plátně,
 * seřazená podle důležitosti pro záchranáře.
 */
export interface EmergencyField {
  k: keyof EmergencyData;
  label: string;
  prio: 1 | 2 | 3;
  ph?: string;
  options?: string[];
}

export const EMERGENCY_FIELDS: EmergencyField[] = [
  { k: 'allergies', label: 'Alergie a reakce', prio: 1, ph: 'Na co a jak se projevuje' },
  { k: 'conditions', label: 'Onemocnění', prio: 1, ph: 'Dlouhodobá onemocnění a diagnózy' },
  { k: 'meds', label: 'Léky, které užívá', prio: 1, ph: 'Název, dávka, jak často' },
  { k: 'blood', label: 'Krevní skupina', prio: 2, options: ['nevím', '0+', '0−', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−'] },
  { k: 'ice', label: 'Koho volat', prio: 2, ph: 'Jméno, vztah, telefon' },
  { k: 'implants', label: 'Implantáty a pomůcky', prio: 2, ph: 'Kardiostimulátor, pumpa, naslouchadla…' },
  { k: 'surgeries', label: 'Operace a hospitalizace', prio: 3, ph: 'Co a kdy' },
  { k: 'tetanus', label: 'Očkování proti tetanu', prio: 3, ph: 'Rok posledního přeočkování' },
  { k: 'communication', label: 'Komunikace a jazyk', prio: 3, ph: 'Na co má záchranář myslet' },
  { k: 'wishes', label: 'Přání a dárcovství', prio: 3, ph: 'Např. dříve vyslovené přání' },
];

export const PRIO_LABEL: Record<1 | 2 | 3, [string, string, string]> = {
  1: ['Nejdůležitější', '#D92D20', 'Záchranář to potřebuje vědět hned — alergie, nemoci a léky.'],
  2: ['Důležité', '#F7931E', ''],
  3: ['Doplňující', '#514F57', ''],
};

export function emergencyProgress(e: EmergencyData): { filled: number; total: number } {
  const total = EMERGENCY_FIELDS.length;
  const filled = EMERGENCY_FIELDS.filter((f) => !!e[f.k] && e[f.k] !== 'nevím').length;
  return { filled, total };
}

/** První telefonní číslo v textu („Roman, manžel, 777 123 456“ → „777123456“). */
export function extractPhone(text: string | undefined): string | null {
  if (!text) return null;
  const m = /(\+?\d[\d\s]{7,15}\d)/.exec(text);
  if (!m) return null;
  const digits = m[1].replace(/\s+/g, '');
  return digits.replace(/\D/g, '').length >= 9 ? digits : null;
}
