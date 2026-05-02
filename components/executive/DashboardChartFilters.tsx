'use client';

import type {
  ChartCustomDateRange,
  ChartGranularity,
  ChartRangePreset,
} from '@/lib/chartSeriesFilters';
import { CHART_GRANULARITY_OPTIONS, CHART_RANGE_OPTIONS } from '@/lib/chartSeriesFilters';
import { cn } from '@/lib/utils';

export function DashboardChartFilters({
  rangePreset,
  granularity,
  customRange,
  asOfDay,
  onRangeChange,
  onGranularityChange,
  onCustomRangeChange,
  className,
}: {
  rangePreset: ChartRangePreset;
  granularity: ChartGranularity;
  customRange: ChartCustomDateRange;
  /** Fecha máxima en los datos (tope para “hasta”). */
  asOfDay: string;
  onRangeChange: (v: ChartRangePreset) => void;
  onGranularityChange: (v: ChartGranularity) => void;
  onCustomRangeChange: (next: ChartCustomDateRange) => void;
  className?: string;
}) {
  const dateInputClass =
    'rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

  return (
    <div
      className={cn(
        'dashboard-panel flex flex-col gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:flex-wrap sm:items-end',
        className,
      )}
    >
      <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Alcance de datos
        <select
          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          value={rangePreset}
          onChange={(e) => onRangeChange(e.target.value as ChartRangePreset)}
        >
          {CHART_RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {rangePreset === 'custom_range' ? (
        <div className="flex min-w-[240px] flex-1 flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Desde
            <input
              type="date"
              max={customRange.end || asOfDay}
              value={customRange.start}
              onChange={(e) => onCustomRangeChange({ ...customRange, start: e.target.value })}
              className={dateInputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Hasta
            <input
              type="date"
              min={customRange.start || undefined}
              max={asOfDay}
              value={customRange.end}
              onChange={(e) => onCustomRangeChange({ ...customRange, end: e.target.value })}
              className={dateInputClass}
            />
          </label>
          <p className="pb-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 sm:max-w-[200px]">
            El “hasta” no puede superar el último corte del dashboard ({asOfDay}).
          </p>
        </div>
      ) : null}

      <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Agrupación en gráficas
        <select
          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          value={granularity}
          onChange={(e) => onGranularityChange(e.target.value as ChartGranularity)}
        >
          {CHART_GRANULARITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:max-w-md sm:flex-1">
        Las gráficas usan montos (MXN) en el eje vertical y fechas o periodos en el horizontal. Con muchos puntos,
        elige agrupación por semana o mes. El rango personalizado filtra por fecha de corte incluida en el intervalo.
      </p>
    </div>
  );
}
