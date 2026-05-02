/**
 * Serie de facturación **Amadeus** 2025 del cuadro (cortes quincenales).
 * Escribe solo `amadeus.fact_dia_mes` — no modifica Sadama.
 *
 * Parte del archivo en `git HEAD` (sin cambios locales sin commitear).
 */
import { execSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const jsonRel = 'data/sadama_amadeus_v1.json';
const jsonPath = path.join(root, jsonRel);

const AMADEUS_FACT_2025 = [
  ['2025-01-01', 14_000_000],
  ['2025-01-16', 15_000_000],
  ['2025-02-01', 16_000_000],
  ['2025-02-15', 17_000_000],
  ['2025-03-01', 18_000_000],
  ['2025-03-16', 19_000_000],
  ['2025-04-01', 20_000_000],
  ['2025-04-16', 21_000_000],
  ['2025-05-01', 22_000_000],
  ['2025-05-16', 23_000_000],
  ['2025-06-01', 24_000_000],
  ['2025-06-16', 25_000_000],
  ['2025-07-01', 26_000_000],
  ['2025-07-16', 27_000_000],
  ['2025-08-01', 28_000_000],
  ['2025-08-16', 29_000_000],
  ['2025-09-01', 30_000_000],
  ['2025-09-16', 31_000_000],
  ['2025-10-01', 32_000_000],
  ['2025-10-16', 33_000_000],
  ['2025-11-01', 34_000_000],
  ['2025-11-16', 35_000_000],
  ['2025-12-01', 36_000_000],
  ['2025-12-16', 37_000_000],
];

function loadBaseline() {
  const raw = execSync(`git show HEAD:${jsonRel}`, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

const data = loadBaseline();
const rows = data.datos.rows;
const byFecha = new Map(rows.map((r, i) => [r.fecha, i]));

let template = rows.find((r) => r.fecha === '2025-05-16');
if (!template) template = rows.find((r) => r.sadama && r.amadeus && r.tc);
if (!template) throw new Error('No hay fila plantilla con sadama+amadeus');

let inserted = 0;
let updated = 0;

for (const [fecha, fact] of AMADEUS_FACT_2025) {
  const idx = byFecha.get(fecha);
  if (idx !== undefined) {
    rows[idx].amadeus ??= {};
    rows[idx].amadeus.fact_dia_mes = fact;
    updated++;
  } else {
    const row = structuredClone(template);
    delete row._row;
    row.fecha = fecha;
    row.amadeus ??= {};
    row.amadeus.fact_dia_mes = fact;
    rows.push(row);
    byFecha.set(fecha, rows.length - 1);
    inserted++;
  }
}

/* Último valor del cuadro por mes calendario → lo pegamos en la **última fecha** del mes en el JSON
   (así el “último MTD del mes” coincide con la tabla aunque haya capturas internas posteriores al 1/16). */
const sheetBestByMonth = new Map();
for (const [fecha, fact] of AMADEUS_FACT_2025) {
  const ym = fecha.slice(0, 7);
  const cur = sheetBestByMonth.get(ym);
  if (!cur || fecha > cur.fecha) {
    sheetBestByMonth.set(ym, { fecha, fact });
  }
}
let monthEnds = 0;
for (const [ym, { fact: mtdSheet }] of sheetBestByMonth) {
  const inMonth = rows.filter((r) => r.fecha && r.fecha.startsWith(ym));
  if (inMonth.length === 0) continue;
  const maxFecha = inMonth.map((r) => r.fecha).sort((a, b) => a.localeCompare(b)).at(-1);
  const row = rows.find((r) => r.fecha === maxFecha);
  if (row) {
    row.amadeus ??= {};
    row.amadeus.fact_dia_mes = mtdSheet;
    monthEnds++;
  }
}

rows.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
rows.forEach((r, i) => {
  r._row = i + 1;
});

fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(
  `OK ${jsonRel}: Amadeus fact_dia_mes 2025 — +${inserted} filas, ${updated} puntos; última fecha/mes alineada (${monthEnds} meses). Total ${rows.length} filas.`,
);
