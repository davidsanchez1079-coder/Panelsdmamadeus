import { format, isValid, parse, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import type { DailyKpiPoint } from '@/lib/dailyKpisFromRow';

/** Qué campo MTD usar al cerrar cada mes (última fecha del mes en la serie). */
export type FacturacionOrigen = 'amadeus' | 'sadama' | 'combinada';

function pickFacturacionMtd(p: DailyKpiPoint, origen: FacturacionOrigen): number {
  switch (origen) {
    case 'amadeus':
      return p.facturacion_amadeus_mes ?? 0;
    case 'sadama':
      return p.facturacion_sadama_mes ?? 0;
    case 'combinada':
    default:
      return p.facturacion_dia ?? 0;
  }
}

export type FacturacionMesRow = {
  yyyymm: string;
  label: string;
  totalFacturacionMes: number;
};

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Partes calendario del corte sin pasar por `Date` (evita desfase mes/año en UTC vs México). */
export function parseIsoDayParts(asOfDay: string): { y: number; m: number; d: number } | null {
  if (!ISO_DAY.test(asOfDay)) return null;
  const [ys, ms, ds] = asOfDay.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** `parseISO` a veces falla con strings locales; se refuerza con `parse` ISO. */
export function parseAsOfDay(asOfDay: string): Date {
  const a = parseISO(asOfDay);
  if (isValid(a)) return a;
  const b = parse(asOfDay, 'yyyy-MM-dd', new Date());
  return b;
}

function formatMesLabel(yyyymm: string): string {
  const d = parse(`${yyyymm}-01`, 'yyyy-MM-dd', new Date());
  if (Number.isNaN(d.getTime())) return yyyymm;
  return format(d, 'MMM yyyy', { locale: es });
}

/**
 * Monto “cerrado” por mes calendario (YYYY-MM) hasta `asOfDay` inclusive; orden cronológico.
 * En cada día el MTD (`fact_dia_mes` según `origen`) es acumulado del mes: **no** se suman filas del mismo mes.
 * Para cada mes se usa el **último** registro (fecha máxima ≤ asOfDay) como total de ese mes — coherente con captura
 * «Fact. día / mes» (MTD) y con el criterio de comparativo mensual. En el ejecutivo, si existen JSON de monto neto
 * mensual oficial (`data/*_monto_neto_mensual.json`), sustituyen la serie por marca antes de sumar el total.
 */
export function aggregateFacturacionPorMesCalendario(
  series: DailyKpiPoint[],
  asOfDay: string,
  /** Por defecto Amadeus: mismo criterio que el reporte de facturación Amadeus (`fact_dia_mes`). */
  origen: FacturacionOrigen = 'amadeus',
): FacturacionMesRow[] {
  const best = new Map<string, { fecha: string; total: number }>();
  for (const p of series) {
    if (p.fecha > asOfDay) continue;
    const key = p.fecha.slice(0, 7);
    const total = pickFacturacionMtd(p, origen);
    const prev = best.get(key);
    if (!prev || p.fecha >= prev.fecha) {
      best.set(key, { fecha: p.fecha, total });
    }
  }
  return [...best.keys()]
    .sort()
    .map((yyyymm) => ({
      yyyymm,
      label: formatMesLabel(yyyymm),
      totalFacturacionMes: best.get(yyyymm)?.total ?? 0,
    }));
}

/**
 * Mes calendario del corte (`asOfDay`) vs el mes calendario anterior (para barras y variación %).
 */
export function mesActualVsMesAnteriorCalendario(
  monthly: FacturacionMesRow[],
  asOfDay: string,
): { anterior: FacturacionMesRow | null; actual: FacturacionMesRow | null } {
  const parts = parseIsoDayParts(asOfDay);
  if (!parts) return { anterior: null, actual: null };
  const { y: cy, m: cm } = parts;
  const actualKey = `${cy}-${String(cm).padStart(2, '0')}`;
  const anteriorKey =
    cm === 1
      ? `${cy - 1}-12`
      : `${cy}-${String(cm - 1).padStart(2, '0')}`;
  const actual = monthly.find((m) => m.yyyymm === actualKey) ?? null;
  const anterior = monthly.find((m) => m.yyyymm === anteriorKey) ?? null;
  return { anterior, actual };
}

/**
 * YTD por mes: en cada punto de ene…mes de corte, suma los **totales mensuales** ya cerrados
 * (último dato de cada mes), no suma días sueltos. Compara año en curso vs año anterior.
 */
export function ytdComparativaAnioVsAnioAnterior(
  monthly: FacturacionMesRow[],
  asOfDay: string,
): { label: string; ytdAnioActual: number; ytdAnioAnterior: number }[] {
  const parts = parseIsoDayParts(asOfDay);
  if (!parts) return [];
  const yAct = parts.y;
  const mMax = parts.m - 1;
  const yAnt = yAct - 1;
  const out: { label: string; ytdAnioActual: number; ytdAnioAnterior: number }[] = [];
  let cumA = 0;
  let cumB = 0;
  for (let m = 0; m <= mMax; m++) {
    const mm = String(m + 1).padStart(2, '0');
    const yyyymmA = `${yAct}-${mm}`;
    const yyyymmB = `${yAnt}-${mm}`;
    const rowA = monthly.find((r) => r.yyyymm === yyyymmA);
    const rowB = monthly.find((r) => r.yyyymm === yyyymmB);
    cumA += rowA?.totalFacturacionMes ?? 0;
    cumB += rowB?.totalFacturacionMes ?? 0;
    out.push({
      label: MONTH_LABELS[m]!,
      ytdAnioActual: cumA,
      ytdAnioAnterior: cumB,
    });
  }
  return out;
}

/** Totales YTD facturación (ene → mes de `asOfDay`) para año en curso vs mismo lapso año anterior; una sola fuente para hero y cintillos. */
export function ytdFacturacionResumen(
  monthly: FacturacionMesRow[],
  asOfDay: string,
): { ytdActual: number; ytdAnterior: number; yearActual: string; yearAnterior: string } | null {
  const parts = parseIsoDayParts(asOfDay);
  if (!parts) return null;
  const yAct = parts.y;
  const mMax = parts.m - 1;
  if (!Number.isFinite(mMax) || mMax < 0 || mMax > 11) return null;
  const yAnt = yAct - 1;
  let cumA = 0;
  let cumB = 0;
  for (let m = 0; m <= mMax; m++) {
    const mm = String(m + 1).padStart(2, '0');
    const yyyymmA = `${yAct}-${mm}`;
    const yyyymmB = `${yAnt}-${mm}`;
    cumA += monthly.find((r) => r.yyyymm === yyyymmA)?.totalFacturacionMes ?? 0;
    cumB += monthly.find((r) => r.yyyymm === yyyymmB)?.totalFacturacionMes ?? 0;
  }
  return {
    ytdActual: cumA,
    ytdAnterior: cumB,
    yearActual: String(yAct),
    yearAnterior: String(yAnt),
  };
}
