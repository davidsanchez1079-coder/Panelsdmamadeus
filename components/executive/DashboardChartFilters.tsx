'use client';

import type { ChartGranularity, ChartRangePreset } from '@/lib/chartSeriesFilters';
import { CHART_GRANULARITY_OPTIONS, CHART_RANGE_OPTIONS } from '@/lib/chartSeriesFilters';
import { cn } from '@/lib/utils';

export function DashboardChartFilters({
  rangePreset,
  granularity,
  onRangeChange,
  onGranularityChange,
  className,
}: {
  rangePreset: ChartRangePreset;
  granularity: ChartGranularity;
  onRangeChange: (v: ChartRangePreset) => void;
  onGranularityChange: (v: ChartGranularity) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-background p-3 sm:flex-row sm:flex-wrap sm:items-end',
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
        elige agrupación por semana o mes.
      </p>
    </div>
  );
}
