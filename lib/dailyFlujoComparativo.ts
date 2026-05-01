import { format } from 'date-fns';

import type { DatosRowMinimal } from './flujoFromRow';
import { flujoTotalFromDatosRow } from './flujoFromRow';

export interface FlujoDailyPoint {
  fecha: string;
  flujo: number;
  _row?: number;
}

/** Variación vs el registro anterior inmediato en la serie diaria. */
export interface FlujoDailyPointWithDelta extends FlujoDailyPoint {
  vsPrevFecha: string | null;
  delta: number | null;
  deltaPct: number | null;
}

export interface FlujoDailyComparativo {
  asOfDay: string;
  last: FlujoDailyPoint;
  monthStart: FlujoDailyPoint;
  lastFive: FlujoDailyPointWithDelta[];
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function dedupeByFecha(rows: DatosRowMinimal[]): DatosRowMinimal[] {
  const map = new Map<string, DatosRowMinimal>();
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

/**
 * Último dato (hasta `asOf`), primer registro del mes calendario en curso (`asOf`) si existe;
 * si no hay ninguna fila ese mes, el primer registro del mes del último dato.
 * Incluye los últimos 5 registros con Δ$ y Δ% vs el dato anterior inmediato.
 */
function withVersusPrevious(slice: FlujoDailyPoint[], all: FlujoDailyPoint[]): FlujoDailyPointWithDelta[] {
  const start = all.length - slice.length;
  return slice.map((p, i) => {
    const g = start + i;
    const prev = g > 0 ? all[g - 1]! : null;
    if (!prev) {
      return { ...p, vsPrevFecha: null, delta: null, deltaPct: null };
    }
    const delta = p.flujo - prev.flujo;
    const deltaPct = prev.flujo !== 0 ? (delta / prev.flujo) * 100 : null;
    return { ...p, vsPrevFecha: prev.fecha, delta, deltaPct };
  });
}

export function buildFlujoDailyComparativo(rows: unknown[], asOf: Date): FlujoDailyComparativo | null {
  const asOfDay = format(asOf, 'yyyy-MM-dd');
  const calendarMonth = format(asOf, 'yyyy-MM');
  const deduped = dedupeByFecha(rows as DatosRowMinimal[]);
  const points: FlujoDailyPoint[] = [];
  for (const r of deduped) {
    const flujo = flujoTotalFromDatosRow(r);
    if (flujo == null || !Number.isFinite(flujo)) continue;
    const fecha = r.fecha as string;
    if (fecha > asOfDay) continue;
    points.push({ fecha, flujo, _row: r._row });
  }
  if (points.length === 0) return null;

  const last = points[points.length - 1]!;
  let monthStart = points.find((p) => p.fecha.startsWith(calendarMonth));
  if (!monthStart) {
    const monthOfLast = last.fecha.slice(0, 7);
    monthStart = points.find((p) => p.fecha.startsWith(monthOfLast));
  }
  if (!monthStart) return null;

  const lastFiveSlice = points.slice(-5);
  const lastFive = withVersusPrevious(lastFiveSlice, points).reverse();

  return {
    asOfDay,
    last,
    monthStart,
    lastFive,
  };
}
