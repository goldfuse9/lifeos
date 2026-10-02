import { buildDrugIndex, matchDrugInLine, searchDrugs, type DrugRow, type DrugSuggestion } from '@/domain/drugRegistry';

/**
 * Registr léků přibalený v aplikaci (src/data/leky-registr.json, vzniká
 * skriptem scripts/import-leky.mjs). Načte se až při prvním hledání.
 */
let index: ReturnType<typeof buildDrugIndex> | null = null;

function load() {
  if (!index) {
    const rows = require('./leky-registr.json') as DrugRow[];
    index = buildDrugIndex(Array.isArray(rows) ? rows : []);
  }
  return index;
}

export function drugRegistryAvailable(): boolean {
  return load().rows.length > 0;
}

export function suggestDrugs(query: string, limit = 6): DrugSuggestion[] {
  return searchDrugs(load(), query, limit);
}

export function findDrugInLine(line: string): DrugSuggestion | null {
  return matchDrugInLine(load(), line);
}
