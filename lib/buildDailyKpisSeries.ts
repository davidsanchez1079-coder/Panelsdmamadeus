import type { DatosRowMinimal } from './flujoFromRow';
import { dailyKpisFromDatosRow, type DailyKpiPoint } from './dailyKpisFromRow';

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

/** Serie diaria deduplicada, filtrada a `fecha <= asOfDay`, KPIs en MXN. */
export function buildDailyKpisSeries(rows: unknown[], asOfDay: string): DailyKpiPoint[] {
  const out: DailyKpiPoint[] = [];
  for (const r of dedupeByFecha(rows as DatosRowMinimal[])) {
    const p = dailyKpisFromDatosRow(r);
    if (!p) continue;
    if (p.fecha > asOfDay) continue;
    out.push(p);
  }
  return out;
}
