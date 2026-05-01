import {
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';

import type { DailyKpiPoint } from './dailyKpisFromRow';

export type ChartRangePreset =
  | 'last_1'
  | 'last_5'
  | 'last_7_points'
  | 'calendar_7d'
  | 'month_natural'
  | 'year_natural'
  | 'last_12_months';

export type ChartGranularity = 'day' | 'week' | 'month' | 'auto';

export interface ChartRow extends DailyKpiPoint {
  label: string;
  bucketEnd: string;
}

export const CHART_RANGE_OPTIONS: { value: ChartRangePreset; label: string }[] = [
  { value: 'last_1', label: 'Último registro' },
  { value: 'last_5', label: 'Últimos 5 registros' },
  { value: 'last_7_points', label: 'Últimos 7 registros' },
  { value: 'calendar_7d', label: 'Últimos 7 días (calendario)' },
  { value: 'month_natural', label: 'Mes en curso (natural)' },
  { value: 'year_natural', label: 'Año en curso (natural)' },
  { value: 'last_12_months', label: 'Últimos 12 meses' },
];

export const CHART_GRANULARITY_OPTIONS: { value: ChartGranularity; label: string }[] = [
  { value: 'auto', label: 'Automática' },
  { value: 'day', label: 'Por día' },
  { value: 'week', label: 'Por semana (ISO)' },
  { value: 'month', label: 'Por mes' },
];

function weekKey(d: Date): string {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`;
}

function labelDay(fecha: string): string {
  return format(parseISO(fecha), 'd MMM yy', { locale: es });
}

function labelWeek(last: DailyKpiPoint): string {
  const d = parseISO(last.fecha);
  return `Sem. ${getISOWeek(d)} · ${format(d, 'MMM yy', { locale: es })}`;
}

function labelMonth(last: DailyKpiPoint): string {
  return format(parseISO(last.fecha), 'MMM yyyy', { locale: es });
}

export function sliceSeriesByPreset(
  fullSeriesAsc: DailyKpiPoint[],
  asOfDay: string,
  preset: ChartRangePreset,
): DailyKpiPoint[] {
  const eligible = fullSeriesAsc.filter((p) => p.fecha <= asOfDay);
  if (eligible.length === 0) return [];

  switch (preset) {
    case 'last_1':
      return [eligible[eligible.length - 1]!];
    case 'last_5':
      return eligible.slice(-5);
    case 'last_7_points':
      return eligible.slice(-7);
    case 'calendar_7d': {
      const end = parseISO(asOfDay);
      const start = format(subDays(end, 6), 'yyyy-MM-dd');
      return eligible.filter((p) => p.fecha >= start);
    }
    case 'month_natural': {
      const prefix = asOfDay.slice(0, 7);
      return eligible.filter((p) => p.fecha.startsWith(prefix));
    }
    case 'year_natural': {
      const y = asOfDay.slice(0, 4);
      return eligible.filter((p) => p.fecha.startsWith(y));
    }
    case 'last_12_months': {
      const end = parseISO(asOfDay);
      const start = format(startOfMonth(subMonths(end, 11)), 'yyyy-MM-dd');
      return eligible.filter((p) => p.fecha >= start);
    }
    default:
      return eligible;
  }
}

export function resolveChartGranularity(
  pointCount: number,
  preset: ChartRangePreset,
  g: ChartGranularity,
): 'day' | 'week' | 'month' {
  if (preset === 'last_12_months') {
    if (g === 'day') return 'month';
    if (g === 'auto') return 'month';
    return g;
  }
  if (g === 'auto') {
    if (pointCount > 60) return 'month';
    if (pointCount > 18) return 'week';
    return 'day';
  }
  return g;
}

function aggregatePoints(points: DailyKpiPoint[], granularity: 'day' | 'week' | 'month'): ChartRow[] {
  if (points.length === 0) return [];

  if (granularity === 'day') {
    return points.map((p) => ({
      ...p,
      label: labelDay(p.fecha),
      bucketEnd: p.fecha,
    }));
  }

  const groups = new Map<string, DailyKpiPoint[]>();
  for (const p of points) {
    const d = parseISO(p.fecha);
    const key = granularity === 'week' ? weekKey(d) : p.fecha.slice(0, 7);
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  const sortedKeys = [...groups.keys()].sort();
  return sortedKeys.map((key) => {
    const arr = groups.get(key)!;
    arr.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const last = arr[arr.length - 1]!;
    return {
      ...last,
      label: granularity === 'week' ? labelWeek(last) : labelMonth(last),
      bucketEnd: last.fecha,
    };
  });
}

export function buildFilteredChartSeries(
  fullSeriesAsc: DailyKpiPoint[],
  asOfDay: string,
  preset: ChartRangePreset,
  granularity: ChartGranularity,
): ChartRow[] {
  const sliced = sliceSeriesByPreset(fullSeriesAsc, asOfDay, preset);
  const resolved = resolveChartGranularity(sliced.length, preset, granularity);
  return aggregatePoints(sliced, resolved);
}

export function rangePresetShortLabel(preset: ChartRangePreset): string {
  return CHART_RANGE_OPTIONS.find((o) => o.value === preset)?.label ?? preset;
}
