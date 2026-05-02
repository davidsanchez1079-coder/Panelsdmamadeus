/**
 * Elimina datos posteriores a mayo 2026:
 * - Diarios (v1): fecha > 2026-05-31
 * - Ejecutivo: yyyymm > 2026-05
 * Recalcula rangos/count y alinea executive.last_month, ytd y series_12m.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const CUTOFF_DAY = '2026-05-31';
const CUTOFF_MONTH = '2026-05';

function trimV1() {
  const p = path.join(ROOT, 'data/sadama_amadeus_v1.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const key of ['datos', 'analisis']) {
    if (!j[key]?.rows) continue;
    const rows = j[key].rows.filter((r) => r.fecha && r.fecha <= CUTOFF_DAY);
    j[key].rows = rows;
    j[key].count = rows.length;
    const fechas = rows.map((r) => r.fecha).sort();
    if (fechas.length) {
      j[key].rango = { min: fechas[0], max: fechas[fechas.length - 1] };
    }
  }
  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`);
}

function trimExecutive() {
  const p = path.join(ROOT, 'data/sadama_amadeus_executive.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));

  j.monthly = j.monthly.filter((m) => m.yyyymm && m.yyyymm <= CUTOFF_MONTH);
  j.yoy_months = j.yoy_months.filter((m) => m.yyyymm && m.yyyymm <= CUTOFF_MONTH);

  const sorted = [...j.monthly]
    .filter((m) => m.yyyymm && m.fecha_cierre)
    .sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));

  if (sorted.length === 0) {
    throw new Error('trimExecutive: no quedaron filas mensuales tras el recorte');
  }

  const last = sorted[sorted.length - 1];
  const yoyEntry = j.yoy_months.find((x) => x.yyyymm === last.yyyymm);

  j.executive.series_12m = sorted.slice(-12);

  j.executive.last_month = {
    yyyymm: last.yyyymm,
    fecha_cierre: last.fecha_cierre,
    kpis: { ...last },
    yoy: yoyEntry?.yoy ?? {},
    hasYoY: Boolean(yoyEntry?.hasYoY),
  };

  const cy = last.yyyymm.slice(0, 4);
  const py = String(Number(cy) - 1);
  j.executive.ytd.current_year = cy;
  j.executive.ytd.previous_year = py;
  j.executive.ytd.fecha_corte = last.fecha_cierre;

  const comparativo = {};
  for (const [k, v] of Object.entries(j.executive.last_month.yoy)) {
    if (v && typeof v === 'object' && 'actual' in v) {
      comparativo[k] = { ...v };
    }
  }
  j.executive.ytd.comparativo = comparativo;

  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`);
}

trimV1();
trimExecutive();
console.log('OK: datos recortados hasta', CUTOFF_DAY, '/', CUTOFF_MONTH);
