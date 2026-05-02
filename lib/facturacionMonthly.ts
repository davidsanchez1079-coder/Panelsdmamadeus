import { format, parse, parseISO, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

import type { DailyKpiPoint } from '@/lib/dailyKpisFromRow';

export type FacturacionMesRow = {
  yyyymm: string;
  label: string;
  totalFacturacionMes: number;
};

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatMesLabel(yyyymm: string): string {
  const d = parse(`${yyyymm}-01`, 'yyyy-MM-dd', new Date());
  if (Number.isNaN(d.getTime())) return yyyymm;
  return format(d, 'MMM yyyy', { locale: es });
}

/**
 * Totales por mes calendario (YYYY-MM) hasta `asOfDay` inclusive; orden cronológico.
 * `facturacion_dia` es acumulado mensual (MTD) en cada corte: no se suman los días;
 * para cada mes se toma el valor del **último** registro (fecha más reciente en ese mes).
 */
export function aggregateFacturacionPorMesCalendario(
  series: DailyKpiPoint[],
  asOfDay: string,
): FacturacionMesRow[] {
  const best = new Map<string, { fecha: string; total: number }>();
  for (const p of series) {
    if (p.fecha > asOfDay) continue;
    const key = p.fecha.slice(0, 7);
    const total = p.facturacion_dia ?? 0;
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
  const asOf = parseISO(asOfDay);
  if (Number.isNaN(asOf.getTime())) return { anterior: null, actual: null };
  const cy = asOf.getFullYear();
  const cm = asOf.getMonth();
  const actualKey = `${cy}-${String(cm + 1).padStart(2, '0')}`;
  const prev = subMonths(asOf, 1);
  const anteriorKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const actual = monthly.find((m) => m.yyyymm === actualKey) ?? null;
  const anterior = monthly.find((m) => m.yyyymm === anteriorKey) ?? null;
  return { anterior, actual };
}

/** YTD acumulado por mes: año en curso vs mismo acumulado del año pasado (hasta el mes de corte de asOf). */
export function ytdComparativaAnioVsAnioAnterior(
  monthly: FacturacionMesRow[],
  asOfDay: string,
): { label: string; ytdAnioActual: number; ytdAnioAnterior: number }[] {
  const asOf = parseISO(asOfDay);
  const yAct = asOf.getFullYear();
  const mMax = asOf.getMonth();
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
