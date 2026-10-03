import { buildIndex, searchRegistry, type DoctorSuggestion, type RegistryRow } from '@/domain/doctorRegistry';

/**
 * Registr lékařů přibalený v aplikaci (src/data/lekari-registr.json,
 * vzniká skriptem scripts/import-lekari.mjs). Načte se až při prvním
 * hledání, aby nezdržoval start aplikace.
 */
let index: ReturnType<typeof buildIndex> | null = null;

function load() {
  if (!index) {
    const rows = require('./lekari-registr.json') as RegistryRow[];
    index = buildIndex(Array.isArray(rows) ? rows : []);
  }
  return index;
}

export function registryAvailable(): boolean {
  return load().rows.length > 0;
}

export function suggestDoctors(query: string, limit = 6): DoctorSuggestion[] {
  return searchRegistry(load(), query, limit);
}
