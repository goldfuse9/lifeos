#!/usr/bin/env node
/**
 * Převede otevřená data NRPZS (Národní registr poskytovatelů zdravotních
 * služeb, ÚZIS) na kompaktní seznam pro našeptávání lékařů v aplikaci.
 *
 * 1. Stáhněte CSV „Místa poskytování zdravotních služeb“:
 *    https://nrpzs.uzis.cz/index.php?pg=home--otevrena-data
 * 2. Ve složce mobile spusťte:
 *    node scripts/import-lekari.mjs ~/Downloads/<soubor>.csv
 * 3. Vznikne src/data/lekari-registr.json — sestavte aplikaci znovu.
 *
 * Bere jen ambulantní péči (ordinace), kde je uvedené jméno lékaře.
 * Názvy sloupců se hledají volně (bez ohledu na diakritiku a velikost),
 * takže drobné změny exportu skript přežije. Když nějaký povinný sloupec
 * chybí, vypíše, které sloupce v souboru jsou.
 */
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = process.argv[2];
if (!file) {
  console.error('Použití: node scripts/import-lekari.mjs <cesta k CSV z NRPZS>');
  process.exit(1);
}

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const COLS = {
  doctor: ['odbornyzastupce', 'odbornyzastupcejmeno'],
  name: ['nazevcely', 'nazevzarizeni', 'nazev', 'nazevposkytovatele'],
  obor: ['oborpece', 'obory', 'obor'],
  forma: ['formapece', 'forma'],
  obec: ['obec', 'obecnazev', 'mesto'],
  ulice: ['ulice'],
  cislo: ['cislodomovniorientacni', 'cislo'],
  tel: ['poskytoveltelefon', 'poskytovateltelefon', 'telefon'],
};
const REQUIRED = ['name', 'obor', 'obec'];

/** Jednoduchý CSV parser s uvozovkami; řádek může pokračovat přes zalomení. */
function splitLine(line, sep) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return { cells: out, open: q };
}

const rl = createInterface({ input: createReadStream(resolve(file), { encoding: 'utf8' }), crlfDelay: Infinity });
let header = null;
let sep = ',';
let idx = {};
let pending = '';
const seen = new Set();
const out = [];
let rows = 0;

for await (let line of rl) {
  if (!header) {
    line = line.replace(/^﻿/, '');
    sep = (line.match(/;/g) || []).length > (line.match(/,/g) || []).length ? ';' : ',';
    header = splitLine(line, sep).cells;
    const h = header.map(norm);
    for (const [k, cands] of Object.entries(COLS)) idx[k] = h.findIndex((x) => cands.includes(x));
    const missing = REQUIRED.filter((k) => idx[k] < 0);
    if (missing.length) {
      console.error('Chybí sloupce: ' + missing.join(', '));
      console.error('Sloupce v souboru: ' + header.join(' | '));
      process.exit(2);
    }
    continue;
  }
  pending = pending ? pending + '\n' + line : line;
  const { cells, open } = splitLine(pending, sep);
  if (open) continue;
  pending = '';
  rows++;
  const get = (k) => (idx[k] >= 0 ? (cells[idx[k]] || '').trim() : '');
  const forma = get('forma').toLowerCase();
  if (forma && !forma.includes('ambulant')) continue;
  const doctor = get('doctor').replace(/\s+/g, ' ');
  const name = get('name').replace(/\s+/g, ' ');
  const who = doctor || (/\b(MUDr|MDDr|MUC)\b/.test(name) ? name : '');
  if (!who) continue;
  const obor = get('obor').split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 3).join(', ');
  const obec = get('obec');
  const street = [get('ulice'), get('cislo')].filter(Boolean).join(' ');
  const tel = get('tel').split(/[,;]/)[0].trim();
  const key = norm(who + obec + street);
  if (seen.has(key)) continue;
  seen.add(key);
  // [jméno lékaře, název ordinace, obory, obec, ulice, telefon]
  out.push([who, name === who ? '' : name, obor, obec, street, tel]);
}

out.sort((a, b) => a[0].localeCompare(b[0], 'cs'));
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/lekari-registr.json');
writeFileSync(target, JSON.stringify(out));
const mb = (Buffer.byteLength(JSON.stringify(out)) / 1024 / 1024).toFixed(1);
console.log(`Hotovo: ${out.length} lékařů z ${rows} řádků → src/data/lekari-registr.json (${mb} MB)`);
