import { endOfMonth, format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const YYYY_MM = /^\d{4}-\d{2}$/;
const YEAR_ONLY = /^\d{4}$/;

/**
 * Etiqueta legible para cierre. Corrige imports rotos donde solo llega el año (p. ej. "2026")
 * usando el último día del mes `fallbackYyyymm` cuando aplica.
 */
export function formatCierreLabel(fechaCierre: string | undefined | null, fallbackYyyymm?: string | null): string {
  if (!fechaCierre) return '—';
  if (ISO_DAY.test(fechaCierre)) {
    const d = parseISO(fechaCierre);
    if (!isValid(d)) return fechaCierre;
    return format(d, "d 'de' MMMM yyyy", { locale: es });
  }
  if (YEAR_ONLY.test(fechaCierre) && fallbackYyyymm && YYYY_MM.test(fallbackYyyymm)) {
    const d = endOfMonth(parseISO(`${fallbackYyyymm}-01`));
    if (!isValid(d)) return fechaCierre;
    return format(d, "d 'de' MMMM yyyy", { locale: es });
  }
  return fechaCierre;
}

export function formatShortFecha(isoDay: string): string {
  if (!isoDay || !ISO_DAY.test(isoDay)) return isoDay || '—';
  const d = parseISO(isoDay);
  if (!isValid(d)) return isoDay;
  return format(d, 'd MMM yy', { locale: es });
}
