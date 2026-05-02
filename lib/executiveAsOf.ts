import { format, subDays } from 'date-fns';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Zona horaria del negocio (cierre operativo); evita que en Vercel (UTC) el “hoy” desplace el corte un día. */
const AS_OF_TIMEZONE = 'America/Mexico_City';

function ymdInTimeZone(d: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return format(d, 'yyyy-MM-dd');
  }
}

/**
 * Corte de fechas del ejecutivo: por defecto equivalente a "ayer" **en la zona del negocio**
 * para no adelantar cierres del día en curso; si ya existe captura del día (p. ej. 1 may con hoy 1 may en MX),
 * el corte sube a esa fecha, sin pasar de “hoy” en esa misma zona.
 */
export function resolveExecutiveAsOfDay(rows: unknown[], now: Date = new Date()): string {
  const todayStr = ymdInTimeZone(now, AS_OF_TIMEZONE);
  const yesterdayStr = ymdInTimeZone(subDays(now, 1), AS_OF_TIMEZONE);
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
