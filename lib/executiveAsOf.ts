import { format, subDays } from 'date-fns';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Corte de fechas del ejecutivo: por defecto equivalente a "ayer" para no adelantar
 * cierres del día en curso; si ya existe captura del día (p. ej. 1 may con hoy 1 may),
 * el corte sube a esa fecha, sin pasar de hoy.
 */
export function resolveExecutiveAsOfDay(rows: unknown[], now: Date = new Date()): string {
  const todayStr = format(now, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(now, 1), 'yyyy-MM-dd');
  let latestStr = '';
  for (const r of rows) {
    const f = (r as { fecha?: string }).fecha;
    if (typeof f !== 'string' || !ISO_DAY.test(f)) continue;
    if (!latestStr || f > latestStr) latestStr = f;
  }
  if (!latestStr) return yesterdayStr;
  const candidate = latestStr > yesterdayStr ? latestStr : yesterdayStr;
  return candidate > todayStr ? todayStr : candidate;
}
