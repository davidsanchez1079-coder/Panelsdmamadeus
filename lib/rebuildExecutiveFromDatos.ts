/**
 * Reconstruye `monthly`, `yoy_months` y el bloque `executive` a partir de `datos.rows`
 * (misma lógica de flujos diarios que el panel). Por mes: **flujo** = valor del **último día**
 * con datos (nivel al cierre, no suma de días); stocks (bancos, inventarios, etc.) = último día.
 */
import type { DatosRow } from './types';
import { dailyKpisFromDatosRow } from './dailyKpisFromRow';
import type { DatosRowMinimal } from './flujoFromRow';
import type { ExecutiveData, MonthlyAggregate, MonthlyYoY, YoYDelta } from './executive';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const YOY_KPI_KEYS = [
  'flujo_total',
  'flujo_sadama',
  'flujo_amadeus',
  'bancos_total',
  'inventario_total',
  'cxc_total',
  'cxp_total',
  'cxp_sadama',
  'cxp_sandvik',
  'cxp_vargus',
  'cxp_mexicana',
  'cxp_probadores_amadeus',
  'cxp_otros',
  'bajio_usd_mxn',
  'bajio_mxn',
  'hsbc',
  'banco_sadama',
  'inventarios_sadama',
  'inventarios_amadeus',
  'tc',
] as const;

function num(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

function dedupeByFecha(rows: DatosRow[]): DatosRow[] {
  const map = new Map<string, DatosRow>();
  for (const r of rows) {
    const f = r.fecha;
    if (!f || typeof f !== 'string' || !ISO_DAY.test(f)) continue;
    const prev = map.get(f);
    const rowNum = typeof r._row === 'number' ? r._row : 0;
    const prevNum = prev && typeof prev._row === 'number' ? prev._row : -1;
    if (!prev || rowNum >= prevNum) map.set(f, r);
  }
  return [...map.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((k) => map.get(k)!);
}

function emptyYoy(): Record<string, null> {
  const o: Record<string, null> = {};
  for (const k of YOY_KPI_KEYS) o[k] = null;
  return o;
}

function aggregateOneMonth(monthRows: DatosRow[]): MonthlyAggregate | null {
  const sorted = [...monthRows].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const last = sorted[sorted.length - 1];
  if (!last?.fecha) return null;

  let tcSum = 0;
  let tcMin = Infinity;
  let tcMax = -Infinity;
  let tcN = 0;

  for (const r of sorted) {
    const k = dailyKpisFromDatosRow(r as DatosRowMinimal);
    if (!k) continue;
    const t = num(r.tc);
    tcSum += t;
    tcN += 1;
    tcMin = Math.min(tcMin, t);
    tcMax = Math.max(tcMax, t);
  }

  const lastK = dailyKpisFromDatosRow(last as DatosRowMinimal);
  if (!lastK) return null;

  const n = sorted.length;
  const avgTc = tcN > 0 ? tcSum / tcN : num(last.tc);

  return {
    yyyymm: last.fecha.slice(0, 7),
    fecha_cierre: last.fecha,
    dias_con_data: n,
    flujo_total: lastK.flujo_total,
    flujo_sadama: lastK.flujo_sadama,
    flujo_amadeus: lastK.flujo_amadeus,
    bancos_total: lastK.bancos_total,
    inventario_total: lastK.inventario_total,
    cxc_total: lastK.cxc_total,
    cxp_total: lastK.cxp_total,
    cxp_sadama: lastK.cxp_sadama,
    cxp_sandvik: lastK.cxp_sandvik,
    cxp_vargus: lastK.cxp_vargus,
    cxp_mexicana: lastK.cxp_mexicana,
    cxp_probadores_amadeus: lastK.cxp_probadores_amadeus,
    cxp_otros: lastK.cxp_otros,
    bajio_usd_mxn: lastK.bajio_usd_mxn,
    bajio_mxn: lastK.bajio_mxn,
    hsbc: lastK.hsbc,
    banco_sadama: num(last.sadama?.banco),
    inventarios_sadama: lastK.inventario_sadama,
    inventarios_amadeus: lastK.inventario_amadeus,
    tc: avgTc,
    tc_min: tcMin === Infinity ? num(last.tc) : tcMin,
    tc_max: tcMax === -Infinity ? num(last.tc) : tcMax,
  };
}

function buildYoYDelta(actual: number, anterior: number): YoYDelta {
  const delta = actual - anterior;
  const delta_pct = anterior !== 0 ? delta / anterior : actual !== 0 ? 1 : 0;
  return { actual, anterior, delta, delta_pct };
}

function yoyForMonth(cur: MonthlyAggregate, prevYear: MonthlyAggregate | undefined): MonthlyYoY {
  const base: MonthlyYoY = {
    yyyymm: cur.yyyymm,
    fecha_cierre: cur.fecha_cierre,
    hasYoY: Boolean(prevYear),
    yoy: {},
  };

  const pick = (k: (typeof YOY_KPI_KEYS)[number]): YoYDelta | null => {
    if (!prevYear) return null;
    const a = cur[k as keyof MonthlyAggregate];
    const b = prevYear[k as keyof MonthlyAggregate];
    if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)) return null;
    return buildYoYDelta(a, b);
  };

  const yoy: Record<string, YoYDelta | null> = {};
  for (const k of YOY_KPI_KEYS) {
    yoy[k] = pick(k);
  }
  base.yoy = yoy as MonthlyYoY['yoy'];
  return base;
}

/** Devuelve `yyyymm` del mismo mes un año antes. */
function prevYearMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  return `${y - 1}-${String(m).padStart(2, '0')}`;
}

export function rebuildExecutiveFromDatosRows(rows: DatosRow[]): Pick<ExecutiveData, 'monthly' | 'yoy_months' | 'executive'> {
  const clean = dedupeByFecha(rows);
  const byMonth = new Map<string, DatosRow[]>();
  for (const r of clean) {
    const key = r.fecha.slice(0, 7);
    const arr = byMonth.get(key) ?? [];
    arr.push(r);
    byMonth.set(key, arr);
  }

  const monthKeys = [...byMonth.keys()].sort((a, b) => a.localeCompare(b));
  const monthly: MonthlyAggregate[] = [];
  for (const mk of monthKeys) {
    const agg = aggregateOneMonth(byMonth.get(mk)!);
    if (agg) monthly.push(agg);
  }

  const byYyyymm = new Map(monthly.map((m) => [m.yyyymm, m]));

  const yoy_months: MonthlyYoY[] = monthly.map((m) => {
    const py = prevYearMonth(m.yyyymm);
    const prev = byYyyymm.get(py);
    return yoyForMonth(m, prev);
  });

  if (monthly.length === 0) {
    throw new Error('rebuildExecutiveFromDatosRows: sin meses agregables');
  }

  const last = monthly[monthly.length - 1]!;
  const lastYoY = yoy_months[yoy_months.length - 1]!;

  const comparativo: Record<string, YoYDelta> = {};
  for (const [k, v] of Object.entries(lastYoY.yoy)) {
    if (v && typeof v === 'object' && 'actual' in v) {
      comparativo[k] = { ...(v as YoYDelta) };
    }
  }

  const cy = last.yyyymm.slice(0, 4);
  const py = String(Number(cy) - 1);

  const executive: ExecutiveData['executive'] = {
    last_month: {
      yyyymm: last.yyyymm,
      fecha_cierre: last.fecha_cierre as string,
      kpis: { ...last },
      yoy: lastYoY.yoy,
      hasYoY: Boolean(lastYoY.hasYoY),
    },
    ytd: {
      current_year: cy,
      previous_year: py,
      fecha_corte: last.fecha_cierre as string,
      comparativo,
    },
    series_12m: monthly.slice(-12),
  };

  return { monthly, yoy_months, executive };
}
