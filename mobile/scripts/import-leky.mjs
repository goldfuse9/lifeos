#!/usr/bin/env node
/**
 * Převede otevřená data SÚKL (Databáze léčivých přípravků, DLP) na
 * kompaktní seznam pro našeptávání léků v aplikaci.
 *
 * 1. Stáhněte a rozbalte ZIP „Databáze léčivých přípravků DLP“:
 *    https://opendata.sukl.cz/?q=katalog%2Fdatabaze-lecivych-pripravku-dlp
 * 2. Ve složce mobile spusťte:
 *    node scripts/import-leky.mjs ~/Downloads/DLP20260925
 *    (složka s rozbalenými CSV, nebo přímo dlp_lecivepripravky.csv)
 * 3. Vznikne src/data/leky-registr.json — sestavte aplikaci znovu.
 *
 * Výstup: [kód SÚKL, název, síla, léková forma, ATC, dodává se 1/0],
 * jedna položka na kombinaci název + síla + forma (balení se slučují).
 * Kódování CSV (UTF-8 / Windows-1250) a oddělovač se poznají samy.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = process.argv[2];
if (!arg) {
  console.error('Použití: node scripts/import-leky.mjs <složka DLP nebo dlp_lecivepripravky.csv>');
  process.exit(1);
}
const dir = statSync(arg).isDirectory() ? arg : dirname(arg);
const mainFile = statSync(arg).isDirectory() ? join(arg, 'dlp_lecivepripravky.csv') : arg;

function readText(path) {
  const buf = readFileSync(path);
  const utf = new TextDecoder('utf-8').decode(buf);
  return utf.includes('�') ? new TextDecoder('windows-1250').decode(buf) : utf;
}

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
  return out.map((s) => s.trim());
}

function readCsv(path) {
  const lines = readText(path).replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const head = splitLine(lines[0], sep).map((h) => h.toUpperCase());
  return lines.slice(1).map((l) => {
    const cells = splitLine(l, sep);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}

const rows = readCsv(mainFile);
if (!rows.length || !('KOD_SUKL' in rows[0]) || !('NAZEV' in rows[0])) {
  console.error('V souboru chybí sloupce KOD_SUKL / NAZEV. Sloupce:', Object.keys(rows[0] ?? {}).join(', '));
  process.exit(1);
}

// Názvy lékových forem (TBL NOB → tableta), když je soubor po ruce.
const forms = new Map();
const formFile = join(dir, 'dlp_formy.csv');
if (existsSync(formFile)) for (const f of readCsv(formFile)) forms.set(f.FORMA, f.NAZEV);

const seen = new Map();
for (const r of rows) {
  const name = r.NAZEV;
  if (!name) continue;
  const key = [name, r.SILA, r.FORMA].join('|');
  const supplied = r.DODAVKY === 'A' ? 1 : 0;
  const prev = seen.get(key);
  if (prev && (prev[5] || !supplied)) continue;
  seen.set(key, [r.KOD_SUKL, name, r.SILA || '', (forms.get(r.FORMA) || r.FORMA || '').toLowerCase(), r.ATC_WHO || '', supplied]);
}

const out = [...seen.values()].sort((a, b) => b[5] - a[5] || a[1].localeCompare(b[1], 'cs'));
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/leky-registr.json');
writeFileSync(target, JSON.stringify(out));
console.log(`Hotovo: ${out.length} léků (z ${rows.length} balení) → ${target}`);
