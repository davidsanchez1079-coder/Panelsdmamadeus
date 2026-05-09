'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { format, isValid, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

import type { FlujoDailyComparativoBundle } from '@/lib/dailyFlujoComparativo';
import type { DailyKpiPoint } from '@/lib/dailyKpisFromRow';
import { formatChartDayNumeric, formatCierreLabel } from '@/lib/dateDisplay';
import {
  buildFilteredChartSeries,
  rangePresetShortLabel,
  sliceSeriesByPreset,
  type ChartCustomDateRange,
  type ChartGranularity,
  type ChartRangePreset,
  type ChartRow,
} from '@/lib/chartSeriesFilters';
import { cxpProveedoresConPct } from '@/lib/cxpDonutFromDaily';
import { applyAmadeusMontoNetoPorMes, applySadamaMontoNetoPorMes } from '@/lib/amadeusMontoNetoApply';
import {
  aggregateFacturacionPorMesCalendario,
  mesActualVsMesAnteriorCalendario,
  parseAsOfDay,
  type FacturacionMesRow,
  ytdComparativaAnioVsAnioAnterior,
  ytdFacturacionResumen,
} from '@/lib/facturacionMonthly';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getDeltaDirection, getPolarity, type ExecutiveViewModel, type YoYDelta } from '@/lib/executive';
import type { JsonMeta } from '@/lib/types';
import { formatMXN, formatMXNAxis, formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DashboardChartFilters } from '@/components/executive/DashboardChartFilters';
import { ExecutiveSwitch, type ExecutiveMode } from '@/components/executive/ExecutiveSwitch';
import { ThemeToggle } from '@/components/executive/ThemeToggle';
import { HeroFlujoBanner } from '@/components/executive/HeroFlujoBanner';
import { ChartStructureInfoButton } from '@/components/executive/ChartStructureInfoButton';
import { ChartExpandIconButton } from '@/components/executive/ChartExpandIconButton';
import { ExecKPICard, type SparkTriplePoint } from '@/components/executive/ExecKPICard';
import { AlertsBanner } from '@/components/executive/AlertsBanner';
import { ChartDataTable } from '@/components/executive/ChartDataTable';
import { YoYBadge } from '@/components/executive/YoYBadge';

function CxpSortedLegend({ payload, wide }: { payload?: unknown[]; wide?: boolean }) {
  const items = (payload ?? [])
    .map((p) => p as { value?: unknown; color?: string; payload?: { pct?: number; value?: number; name?: string } })
    .map((p) => ({
      value: typeof p.payload?.value === 'number' ? p.payload.value : typeof p.value === 'number' ? p.value : 0,
      pct: p.payload?.pct,
      name: p.payload?.name,
      color: p.color,
    }))
    .filter((x) => x.name)
    .sort((a, b) => b.value - a.value);

  if (items.length === 0) return null;
  return (
    <ul className={cn('mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1', wide ? 'text-sm' : 'text-xs')}>
      {items.map((it) => (
        <li key={String(it.name)} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: it.color }} aria-hidden />
          <span className="text-zinc-700 dark:text-zinc-200">
            {it.name}
            {it.pct != null && Number.isFinite(it.pct) ? <span className="tabular-nums text-zinc-500 dark:text-zinc-400"> ({formatPct(it.pct)})</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

const KPI_ORDER = [
  { key: 'bancos_total', title: 'Bancos' },
  { key: 'inventario_total', title: 'Inventario' },
  { key: 'cxc_total', title: 'CXC' },
  { key: 'cxp_total', title: 'CXP' },
] as const;

type KpiSparkKey = (typeof KPI_ORDER)[number]['key'];

const KPI_EXPAND_TARGET: Record<KpiSparkKey, 'bancos' | 'inventario' | 'cxp_total' | 'cxc'> = {
  bancos_total: 'bancos',
  inventario_total: 'inventario',
  cxc_total: 'cxc',
  cxp_total: 'cxp_total',
};

const KPI_SPARK_MAP: Record<KpiSparkKey, { s: keyof ChartRow; a: keyof ChartRow; t: keyof ChartRow }> = {
  bancos_total: { s: 'bancos_sadama', a: 'bancos_amadeus', t: 'bancos_total' },
  inventario_total: { s: 'inventario_sadama', a: 'inventario_amadeus', t: 'inventario_total' },
  cxc_total: { s: 'cxc_sadama', a: 'cxc_amadeus', t: 'cxc_total' },
  cxp_total: { s: 'cxp_sadama', a: 'cxp_amadeus', t: 'cxp_total' },
};

function pickYoY(yoy: Record<string, YoYDelta> | null | undefined, kpiKey: string) {
  const d = yoy?.[kpiKey];
  return d && typeof d === 'object' ? d : null;
}

function deltaPctFromChartRows(rows: ChartRow[], k: keyof ChartRow): number | null {
  if (rows.length < 2) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const lastV = last ? (last[k] as unknown) : null;
  const firstV = first ? (first[k] as unknown) : null;
  if (typeof lastV !== 'number' || typeof firstV !== 'number') return null;
  if (!Number.isFinite(lastV) || !Number.isFinite(firstV)) return null;
  if (firstV === 0) return null;
  return ((lastV - firstV) / Math.abs(firstV)) * 100;
}

function summarizeSeriesDeltaMXN(
  rows: Array<{ bucketEnd: string } & Record<string, unknown>>,
  valueKey: string,
): {
  startDate: string;
  endDate: string;
  startValue: number;
  endValue: number;
  deltaPct: number | null;
} | null {
  if (rows.length < 2) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const startDate = typeof first.bucketEnd === 'string' ? first.bucketEnd : '';
  const endDate = typeof last.bucketEnd === 'string' ? last.bucketEnd : '';
  const startValue = typeof first[valueKey] === 'number' ? (first[valueKey] as number) : NaN;
  const endValue = typeof last[valueKey] === 'number' ? (last[valueKey] as number) : NaN;
  if (!startDate || !endDate) return null;
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) return null;
  const deltaPct = startValue === 0 ? null : ((endValue - startValue) / Math.abs(startValue)) * 100;
  return { startDate, endDate, startValue, endValue, deltaPct };
}

function scopeNarrative(
  preset: ChartRangePreset,
  customRange: ChartCustomDateRange,
  asOfDay: string,
): { label: string; showDates: boolean } {
  switch (preset) {
    case 'year_natural':
      return { label: 'el año en curso', showDates: false };
    case 'month_natural':
      return { label: 'el mes en curso', showDates: false };
    case 'last_3_months':
      return { label: 'los últimos 3 meses', showDates: false };
    case 'last_12_months':
      return { label: 'los últimos 12 meses', showDates: false };
    case 'last_7_points':
      return { label: 'los últimos 7 registros', showDates: false };
    case 'last_5':
      return { label: 'los últimos 5 registros', showDates: false };
    case 'last_1':
      return { label: 'el último registro', showDates: false };
    case 'calendar_7d':
      return { label: 'los últimos 7 días', showDates: false };
    case 'custom_range': {
      const endCap = customRange.end && customRange.end > asOfDay ? asOfDay : customRange.end || asOfDay;
      if (customRange.start && endCap) {
        return { label: `el rango ${customRange.start} → ${endCap}`, showDates: false };
      }
      // Solo en rango personalizado mostramos el intervalo con fechas.
      return { label: 'el rango personalizado', showDates: true };
    }
    default:
      return { label: rangePresetShortLabel(preset, preset === 'custom_range' ? customRange : null), showDates: false };
  }
}

function toneNumberClass(kpiKey: string, deltaPct: number | null): string {
  const polarity = getPolarity(kpiKey);
  const dir = getDeltaDirection(polarity, deltaPct);
  if (dir === 'good') return 'text-emerald-700 dark:text-emerald-300';
  if (dir === 'bad') return 'text-red-700 dark:text-red-300';
  return 'text-zinc-700 dark:text-zinc-300';
}

function numFromChartRow(r: ChartRow, k: keyof ChartRow): number {
  const v = r[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function buildSparkTripleFromChartRows(rows: ChartRow[], kpiKey: KpiSparkKey): SparkTriplePoint[] {
  const m = KPI_SPARK_MAP[kpiKey];
  return rows.map((r) => ({
    x: r.bucketEnd,
    sadama: numFromChartRow(r, m.s),
    amadeus: numFromChartRow(r, m.a),
    total: numFromChartRow(r, m.t),
  }));
}

/** Misma lógica que la gráfica pero sin agrupar: un punto por día con captura (para tablas KPI). */
function buildSparkTripleFromDailyPoints(points: DailyKpiPoint[], kpiKey: KpiSparkKey): SparkTriplePoint[] {
  const m = KPI_SPARK_MAP[kpiKey];
  return points.map((p) => ({
    x: p.fecha,
    sadama: numFromChartRow(p as ChartRow, m.s),
    amadeus: numFromChartRow(p as ChartRow, m.a),
    total: numFromChartRow(p as ChartRow, m.t),
  }));
}

type ChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown; name?: string | number; value?: unknown; dataKey?: unknown }>;
};

function TooltipShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-w-[240px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-lg dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50',
        className,
      )}
    >
      {children}
    </div>
  );
}

const PIE_FILLS = [
  'var(--chart-pie-0)',
  'var(--chart-pie-1)',
  'var(--chart-pie-2)',
  'var(--chart-pie-3)',
  'var(--chart-pie-4)',
] as const;

const axisTick = { fontSize: 10, fill: 'var(--chart-tick)' };
const axisTickLg = { fontSize: 12, fill: 'var(--chart-tick)' };

function FlujoTooltip({ active, payload, wide }: ChartTooltipProps & { wide?: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { bucketEnd?: string } | undefined;
  if (!row?.bucketEnd) return null;
  const items = payload.filter((p) => p.name != null && typeof p.value === 'number');
  return (
    <TooltipShell className={wide ? 'max-w-[min(92vw,440px)] px-3.5 py-2.5 text-sm' : undefined}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de corte</div>
      <div className="text-sm font-semibold leading-tight">{formatCierreLabel(row.bucketEnd)}</div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Flujo (MXN)</div>
      <ul className={cn('mt-1 space-y-1', wide ? 'space-y-1.5 text-sm' : 'text-xs')}>
        {items.map((p) => (
          <li key={String(p.dataKey)} className="flex justify-between gap-4 tabular-nums">
            <span className="text-zinc-600 dark:text-zinc-300">{p.name}</span>
            <span className="font-medium">{formatMXN(p.value as number)}</span>
          </li>
        ))}
      </ul>
    </TooltipShell>
  );
}

function InventarioTooltip({ active, payload, wide }: ChartTooltipProps & { wide?: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { bucketEnd?: string } | undefined;
  if (!row?.bucketEnd) return null;
  const items = payload.filter((p) => p.name != null && typeof p.value === 'number');
  return (
    <TooltipShell className={wide ? 'max-w-[min(92vw,440px)] px-3.5 py-2.5 text-sm' : undefined}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de corte</div>
      <div className="text-sm font-semibold leading-tight">{formatCierreLabel(row.bucketEnd)}</div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Inventario (MXN)</div>
      <ul className={cn('mt-1 space-y-1', wide ? 'space-y-1.5 text-sm' : 'text-xs')}>
        {items.map((p) => (
          <li key={String(p.dataKey)} className="flex justify-between gap-4 tabular-nums">
            <span className="text-zinc-600 dark:text-zinc-300">{p.name}</span>
            <span className="font-medium">{formatMXN(p.value as number)}</span>
          </li>
        ))}
      </ul>
    </TooltipShell>
  );
}

function CxcTooltip({ active, payload, wide }: ChartTooltipProps & { wide?: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { bucketEnd?: string } | undefined;
  if (!row?.bucketEnd) return null;
  const items = payload.filter((p) => p.name != null && typeof p.value === 'number');
  return (
    <TooltipShell className={wide ? 'max-w-[min(92vw,440px)] px-3.5 py-2.5 text-sm' : undefined}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de corte</div>
      <div className="text-sm font-semibold leading-tight">{formatCierreLabel(row.bucketEnd)}</div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">CXC (MXN)</div>
      <ul className={cn('mt-1 space-y-1', wide ? 'space-y-1.5 text-sm' : 'text-xs')}>
        {items.map((p) => (
          <li key={String(p.dataKey)} className="flex justify-between gap-4 tabular-nums">
            <span className="text-zinc-600 dark:text-zinc-300">{p.name}</span>
            <span className="font-medium">{formatMXN(p.value as number)}</span>
          </li>
        ))}
      </ul>
    </TooltipShell>
  );
}

function CxpTooltip({ active, payload, wide }: ChartTooltipProps & { wide?: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { bucketEnd?: string } | undefined;
  if (!row?.bucketEnd) return null;
  const items = payload.filter((p) => p.name != null && typeof p.value === 'number');
  return (
    <TooltipShell className={wide ? 'max-w-[min(92vw,440px)] px-3.5 py-2.5 text-sm' : undefined}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de corte</div>
      <div className="text-sm font-semibold leading-tight">{formatCierreLabel(row.bucketEnd)}</div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">CXP (MXN)</div>
      <ul className={cn('mt-1 space-y-1', wide ? 'space-y-1.5 text-sm' : 'text-xs')}>
        {items.map((p) => (
          <li key={String(p.dataKey)} className="flex justify-between gap-4 tabular-nums">
            <span className="text-zinc-600 dark:text-zinc-300">{p.name}</span>
            <span className="font-medium">{formatMXN(p.value as number)}</span>
          </li>
        ))}
      </ul>
    </TooltipShell>
  );
}

type PieTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: number;
    payload?: { name?: string; value?: number; pct?: number; fill?: string };
  }>;
};

function CxpPieTooltip({ active, payload, wide }: PieTooltipProps & { wide?: boolean }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]!;
  const name = (item.payload?.name ?? item.name) as string;
  const value = (typeof item.value === 'number' ? item.value : item.payload?.value) as number;
  const pct = item.payload?.pct;
  return (
    <TooltipShell className={wide ? 'max-w-[min(92vw,400px)] px-3.5 py-2.5' : undefined}>
      <div className={cn('font-semibold leading-tight', wide ? 'text-base' : 'text-sm')}>{name}</div>
      <div className={cn('mt-1 font-medium tabular-nums', wide ? 'text-base' : 'text-sm')}>{formatMXN(value)}</div>
      {pct != null && Number.isFinite(pct) ? (
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {formatPct(pct)} del total CXP
        </div>
      ) : null}
    </TooltipShell>
  );
}

function BancosTooltip({ active, payload, wide }: ChartTooltipProps & { wide?: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as
    | {
        bucketEnd?: string;
        total?: number;
        bajio_mxn?: number;
        hsbc?: number;
        bajio_usd_mxn?: number;
      }
    | undefined;
  if (!row?.bucketEnd) return null;
  return (
    <TooltipShell className={wide ? 'max-w-[min(92vw,440px)] px-3.5 py-2.5 text-sm' : undefined}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de corte</div>
      <div className="text-sm font-semibold leading-tight">{formatCierreLabel(row.bucketEnd)}</div>
      <ul className={cn('mt-2 space-y-1', wide ? 'space-y-1.5 text-sm' : 'text-xs')}>
        {payload
          .filter((p) => p.name && typeof p.value === 'number')
          .map((p) => (
            <li key={String(p.dataKey)} className="flex justify-between gap-4 tabular-nums">
              <span className="text-zinc-600 dark:text-zinc-300">{p.name}</span>
              <span className="font-medium">{formatMXN(p.value as number)}</span>
            </li>
          ))}
      </ul>
      <div
        className={cn(
          'mt-2 border-t border-zinc-200 pt-2 font-semibold tabular-nums dark:border-zinc-700',
          wide ? 'text-sm' : 'text-xs',
        )}
      >
        Total bancos: {formatMXN(row.total ?? 0)}
      </div>
    </TooltipShell>
  );
}

type ExecutiveExpandedChart = 'facturacion' | 'flujo' | 'bancos' | 'cxp_total' | 'cxp' | 'cxc' | 'inventario';

function resumenFactYtdWithFallback(monthly: FacturacionMesRow[], asOfDay: string) {
  const r = ytdFacturacionResumen(monthly, asOfDay);
  if (r) return r;
  const d = parseAsOfDay(asOfDay);
  if (!isValid(d)) return null;
  return {
    ytdActual: 0,
    ytdAnterior: 0,
    yearActual: String(d.getFullYear()),
    yearAnterior: String(d.getFullYear() - 1),
  };
}

/** Porcentaje contextual (p. ej. “falta” como fracción del YTD año anterior), sin signo forzado. */
function formatPctShare(n: number) {
  return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n) + '%';
}

type FacturacionYtdBrecha =
  | {
      kind: 'behind';
      faltaMxn: number;
      pctDelYtdAnterior: number | null;
      yearActual: string;
      yearAnterior: string;
    }
  | {
      kind: 'ahead';
      sobreMxn: number;
      pctDelYtdAnterior: number | null;
      yearActual: string;
      yearAnterior: string;
    }
  | { kind: 'equal'; yearActual: string; yearAnterior: string };

function facturacionYtdBrechaVsAnterior(
  resumen: { ytdActual: number; ytdAnterior: number; yearActual: string; yearAnterior: string } | null | undefined,
): FacturacionYtdBrecha | null {
  if (!resumen) return null;
  const { ytdActual, ytdAnterior, yearActual, yearAnterior } = resumen;
  if (!Number.isFinite(ytdActual) || !Number.isFinite(ytdAnterior)) return null;

  const scale = Math.max(Math.abs(ytdActual), Math.abs(ytdAnterior), 1);
  const near = Math.abs(ytdActual - ytdAnterior) <= scale * 1e-9 || Math.abs(ytdActual - ytdAnterior) < 1;
  if (near) return { kind: 'equal', yearActual, yearAnterior };

  if (ytdAnterior > 0) {
    if (ytdActual < ytdAnterior) {
      const falta = ytdAnterior - ytdActual;
      return {
        kind: 'behind',
        faltaMxn: falta,
        pctDelYtdAnterior: (falta / ytdAnterior) * 100,
        yearActual,
        yearAnterior,
      };
    }
    const sobre = ytdActual - ytdAnterior;
    return {
      kind: 'ahead',
      sobreMxn: sobre,
      pctDelYtdAnterior: (sobre / ytdAnterior) * 100,
      yearActual,
      yearAnterior,
    };
  }

  if (ytdActual > ytdAnterior) {
    return {
      kind: 'ahead',
      sobreMxn: ytdActual - ytdAnterior,
      pctDelYtdAnterior: null,
      yearActual,
      yearAnterior,
    };
  }
  return {
    kind: 'behind',
    faltaMxn: ytdAnterior - ytdActual,
    pctDelYtdAnterior: null,
    yearActual,
    yearAnterior,
  };
}

function FacturacionYtdBrechaCallout({
  brecha,
  className,
}: {
  brecha: FacturacionYtdBrecha | null;
  className?: string;
}) {
  if (!brecha) return null;

  if (brecha.kind === 'equal') {
    return (
      <p
        className={cn(
          'rounded-lg border border-zinc-200/90 bg-zinc-50/90 px-3 py-2 text-sm leading-snug text-zinc-800 dark:border-zinc-600/60 dark:bg-zinc-900/40 dark:text-zinc-200',
          className,
        )}
      >
        La facturación total acumulada (YTD {brecha.yearActual}, mismo lapso ene → mes de corte) va{' '}
        <span className="font-medium">alineada</span> con el YTD {brecha.yearAnterior} en ese lapso.
      </p>
    );
  }

  if (brecha.kind === 'behind') {
    return (
      <p
        className={cn(
          'rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm leading-snug text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/35 dark:text-amber-100/95',
          className,
        )}
      >
        Para igualar el YTD {brecha.yearAnterior} de facturación total (Sadama + Amadeus) en el mismo lapso,{' '}
        <span className="font-semibold tabular-nums text-red-700 dark:text-red-200">faltan {formatMXN(brecha.faltaMxn)}</span>
        {brecha.pctDelYtdAnterior != null ? (
          <>
            {' '}
            (
            <span className="tabular-nums font-medium text-red-700 dark:text-red-200">
              {formatPctShare(brecha.pctDelYtdAnterior)}
            </span>{' '}
            del YTD{' '}
            {brecha.yearAnterior})
          </>
        ) : null}
        .
      </p>
    );
  }

  return (
    <p
      className={cn(
        'rounded-lg border border-emerald-200/90 bg-emerald-50/90 px-3 py-2 text-sm leading-snug text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-100/95',
        className,
      )}
    >
      Respecto al YTD {brecha.yearAnterior} (mismo lapso), la facturación total {brecha.yearActual} va{' '}
      <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-200">
        {formatMXN(brecha.sobreMxn)} por encima
      </span>
      {brecha.pctDelYtdAnterior != null ? (
        <>
          {' '}
          (
          <span className="tabular-nums font-medium text-emerald-700 dark:text-emerald-200">
            {formatPct(brecha.pctDelYtdAnterior)}
          </span>{' '}
          sobre el YTD{' '}
          {brecha.yearAnterior})
        </>
      ) : null}
      .
    </p>
  );
}

/** Meta de planeación comunicada al equipo: +20% de facturación vs el mismo lapso del año anterior (YTD). */
const FACTURACION_PLAN_CRECC_YOY = 0.2;

/** Colchón superior del eje Y en la gráfica YTD de facturación (MXN): tope = máx. de las tres series + este monto. */
const FACTURACION_YTD_AXIS_TOP_PAD_MXN = 2_000_000;

type FacturacionVsObjetivo20 =
  | {
      kind: 'below';
      faltaMxn: number;
      pctDelObjetivo: number | null;
      ytdObjetivo: number;
      yearActual: string;
      yearAnterior: string;
    }
  | {
      kind: 'above';
      sobreMxn: number;
      pctDelObjetivo: number | null;
      ytdObjetivo: number;
      yearActual: string;
      yearAnterior: string;
    }
  | { kind: 'equal'; ytdObjetivo: number; yearActual: string; yearAnterior: string };

function facturacionYtdVsObjetivo20(
  resumen: { ytdActual: number; ytdAnterior: number; yearActual: string; yearAnterior: string } | null | undefined,
): FacturacionVsObjetivo20 | null {
  if (!resumen) return null;
  const { ytdActual, ytdAnterior, yearActual, yearAnterior } = resumen;
  if (!Number.isFinite(ytdActual) || !Number.isFinite(ytdAnterior)) return null;
  const ytdObjetivo = ytdAnterior * (1 + FACTURACION_PLAN_CRECC_YOY);
  const diff = ytdActual - ytdObjetivo;
  const scale = Math.max(Math.abs(ytdActual), Math.abs(ytdObjetivo), 1);
  if (Math.abs(diff) <= scale * 1e-9 || Math.abs(diff) < 1) {
    return { kind: 'equal', ytdObjetivo, yearActual, yearAnterior };
  }
  if (ytdObjetivo > 0) {
    if (diff < 0) {
      const falta = ytdObjetivo - ytdActual;
      return {
        kind: 'below',
        faltaMxn: falta,
        pctDelObjetivo: (falta / ytdObjetivo) * 100,
        ytdObjetivo,
        yearActual,
        yearAnterior,
      };
    }
    const sobre = ytdActual - ytdObjetivo;
    return {
      kind: 'above',
      sobreMxn: sobre,
      pctDelObjetivo: (sobre / ytdObjetivo) * 100,
      ytdObjetivo,
      yearActual,
      yearAnterior,
    };
  }
  if (diff > 0) {
    return {
      kind: 'above',
      sobreMxn: diff,
      pctDelObjetivo: null,
      ytdObjetivo,
      yearActual,
      yearAnterior,
    };
  }
  return {
    kind: 'below',
    faltaMxn: -diff,
    pctDelObjetivo: null,
    ytdObjetivo,
    yearActual,
    yearAnterior,
  };
}

function FacturacionObjetivo20Callout({
  data,
  className,
}: {
  data: FacturacionVsObjetivo20 | null;
  className?: string;
}) {
  if (!data) return null;
  const pctMeta = Math.round(FACTURACION_PLAN_CRECC_YOY * 100);
  return (
    <p
      className={cn(
        'rounded-lg border border-violet-200/90 bg-violet-50/90 px-3 py-2 text-sm leading-snug text-violet-950 dark:border-violet-400/35 dark:bg-violet-950/40 dark:text-violet-100/95',
        className,
      )}
    >
      <span className="font-medium">Objetivo planteado:</span> facturación total{' '}
      <span className="font-semibold tabular-nums">+{pctMeta}%</span> vs el YTD {data.yearAnterior} en el mismo lapso (ene → mes de
      corte). <span className="font-medium">Meta acumulada a la fecha:</span>{' '}
      <span className="font-semibold tabular-nums">{formatMXN(data.ytdObjetivo)}</span>.
      {data.kind === 'below' ? (
        <>
          {' '}
          Van{' '}
          <span className="font-semibold tabular-nums text-red-700 dark:text-red-200">{formatMXN(data.faltaMxn)}</span> por debajo de esa meta
          {data.pctDelObjetivo != null ? (
            <>
              {' '}
              (
              <span className="tabular-nums font-medium text-red-700 dark:text-red-200">
                {formatPctShare(data.pctDelObjetivo)}
              </span>{' '}
              del monto objetivo)
            </>
          ) : null}
          .
        </>
      ) : data.kind === 'above' ? (
        <>
          {' '}
          Superan la meta por{' '}
          <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-200">{formatMXN(data.sobreMxn)}</span>
          {data.pctDelObjetivo != null ? (
            <>
              {' '}
              (
              <span className="tabular-nums font-medium text-emerald-700 dark:text-emerald-200">
                {formatPct(data.pctDelObjetivo)}
              </span>{' '}
              sobre el objetivo)
            </>
          ) : null}
          .
        </>
      ) : (
        <>
          {' '}
          Coinciden con la meta de +{pctMeta}% sobre el YTD {data.yearAnterior}.
        </>
      )}
    </p>
  );
}

export function ExecutiveClient({
  meta,
  view,
  dailyFlujo,
  dailyKpisSeries,
  asOfDay,
  uiBuildStamp,
  amadeusMontoNetoPorMes,
  sadamaMontoNetoPorMes,
}: {
  meta: JsonMeta;
  view: ExecutiveViewModel;
  dailyFlujo: FlujoDailyComparativoBundle;
  dailyKpisSeries: DailyKpiPoint[];
  asOfDay: string;
  /** Mismo valor que en la cabecera (commit Vercel o `local` + hash de git). */
  uiBuildStamp: string;
  /** Monto neto mensual oficial Amadeus (`data/amadeus_monto_neto_mensual.json`). */
  amadeusMontoNetoPorMes?: Record<string, number> | null;
  /** Monto neto mensual oficial Sadama (`data/sadama_monto_neto_mensual.json`). */
  sadamaMontoNetoPorMes?: Record<string, number> | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ExecutiveMode>('ytd');
  const [mounted, setMounted] = useState(false);
  const [rangePreset, setRangePreset] = useState<ChartRangePreset>('year_natural');
  const [granularity, setGranularity] = useState<ChartGranularity>('day');
  const [customRange, setCustomRange] = useState<ChartCustomDateRange>({ start: '', end: '' });
  const [facturacionVista, setFacturacionVista] = useState<'mes_vs_mes' | 'ytd_anios'>('ytd_anios');
  const [expandedChart, setExpandedChart] = useState<ExecutiveExpandedChart | null>(null);

  const onRangePresetChange = (v: ChartRangePreset) => {
    setRangePreset(v);
    if (v === 'custom_range') {
      setCustomRange((prev) => {
        if (prev.start && prev.end) return prev;
        return {
          start: format(subDays(parseISO(asOfDay), 29), 'yyyy-MM-dd'),
          end: asOfDay,
        };
      });
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!expandedChart) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedChart(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedChart]);

  useEffect(() => {
    if (!expandedChart) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expandedChart]);

  const source = mode === 'last_month' ? view.lastMonth : view.ytd.comparativo;
  const yoy = source.yoy;
  const kpis = source.kpis;

  const kpisRec = kpis as Record<string, unknown>;
  const kpiNum = (key: string) => (typeof kpisRec[key] === 'number' ? (kpisRec[key] as number) : 0);
  const flujoActualTotal = kpiNum('flujo_total');
  const flujoActualSadama = kpiNum('flujo_sadama');
  const flujoActualAmadeus = kpiNum('flujo_amadeus');
  const yoyFlujoTotal = pickYoY(yoy, 'flujo_total');
  const yoyFlujoSadama = pickYoY(yoy, 'flujo_sadama');
  const yoyFlujoAmadeus = pickYoY(yoy, 'flujo_amadeus');

  const cierreLabel = useMemo(() => {
    const iso = mode === 'last_month' ? view.lastMonth.fecha_cierre : view.ytd.fecha_corte;
    return formatCierreLabel(iso, view.lastMonth.yyyymm);
  }, [view.lastMonth.fecha_cierre, view.lastMonth.yyyymm, view.ytd.fecha_corte, mode]);

  const ageBanner = useMemo(() => {
    const gen = meta.generated;
    if (!gen) return null;
    const t = Date.parse(gen);
    if (!Number.isFinite(t)) return null;
    const hours = (Date.now() - t) / (1000 * 60 * 60);
    if (hours <= 24) return null;
    return `Datos con más de 24h (generado: ${format(parseISO(gen), "d 'de' MMMM yyyy HH:mm", { locale: es })}).`;
  }, [meta.generated]);

  const chartRows = useMemo(
    () =>
      buildFilteredChartSeries(
        dailyKpisSeries,
        asOfDay,
        rangePreset,
        granularity,
        rangePreset === 'custom_range' ? customRange : null,
      ),
    [dailyKpisSeries, asOfDay, rangePreset, granularity, customRange],
  );

  /** Serie diaria con el mismo alcance que las gráficas; la mini-tabla KPI no debe perder días por agrupación sem/mes. */
  const kpiTableDailySlice = useMemo(
    () =>
      sliceSeriesByPreset(
        dailyKpisSeries,
        asOfDay,
        rangePreset,
        rangePreset === 'custom_range' ? customRange : null,
      ),
    [dailyKpisSeries, asOfDay, rangePreset, customRange],
  );

  const lastBucket = chartRows[chartRows.length - 1];

  const flujoChart = chartRows;

  const bancosChart = useMemo(
    () =>
      chartRows.map((r) => ({
        name: r.label,
        bucketEnd: r.bucketEnd,
        bajio_mxn: r.bajio_mxn,
        hsbc: r.hsbc,
        bajio_usd_mxn: r.bajio_usd_mxn,
        total: r.bancos_total,
      })),
    [chartRows],
  );

  const inventarioChart = chartRows;

  const cxpVista = useMemo(() => {
    const { total, rows } = cxpProveedoresConPct(lastBucket);
    const rowsSorted = [...rows].sort((a, b) => b.value - a.value);
    const pie = rowsSorted.map((r, i) => ({ ...r, fill: PIE_FILLS[i % PIE_FILLS.length] }));
    return { total, rows: rowsSorted, pie };
  }, [lastBucket]);

  const periodHint = `${rangePresetShortLabel(rangePreset, rangePreset === 'custom_range' ? customRange : null)} · corte máx. ${asOfDay}`;

  const monthlyFactAmadeus = useMemo(() => {
    const raw = aggregateFacturacionPorMesCalendario(dailyKpisSeries, asOfDay, 'amadeus');
    return applyAmadeusMontoNetoPorMes(raw, amadeusMontoNetoPorMes ?? null, asOfDay);
  }, [dailyKpisSeries, asOfDay, amadeusMontoNetoPorMes]);
  const monthlyFactSadama = useMemo(() => {
    const raw = aggregateFacturacionPorMesCalendario(dailyKpisSeries, asOfDay, 'sadama');
    return applySadamaMontoNetoPorMes(raw, sadamaMontoNetoPorMes ?? null, asOfDay);
  }, [dailyKpisSeries, asOfDay, sadamaMontoNetoPorMes]);
  const monthlyFactCombinada = useMemo(() => {
    const byM = new Map<string, FacturacionMesRow>();
    for (const r of monthlyFactSadama) {
      byM.set(r.yyyymm, { ...r });
    }
    for (const r of monthlyFactAmadeus) {
      const ex = byM.get(r.yyyymm);
      if (ex) {
        byM.set(r.yyyymm, {
          yyyymm: r.yyyymm,
          label: ex.label,
          totalFacturacionMes: ex.totalFacturacionMes + r.totalFacturacionMes,
        });
      } else {
        byM.set(r.yyyymm, { ...r });
      }
    }
    return [...byM.values()].sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));
  }, [monthlyFactSadama, monthlyFactAmadeus]);
  const mesVsPair = useMemo(
    () => mesActualVsMesAnteriorCalendario(monthlyFactCombinada, asOfDay),
    [monthlyFactCombinada, asOfDay],
  );
  const mesVsBarData = useMemo(() => {
    const { anterior, actual } = mesVsPair;
    const rows: { periodo: string; total: number }[] = [];
    if (anterior) rows.push({ periodo: anterior.label, total: anterior.totalFacturacionMes });
    if (actual) rows.push({ periodo: actual.label, total: actual.totalFacturacionMes });
    return rows;
  }, [mesVsPair]);
  const mesVsDeltaPct = useMemo(() => {
    const { anterior, actual } = mesVsPair;
    if (!anterior || !actual || anterior.totalFacturacionMes === 0) return null;
    return ((actual.totalFacturacionMes - anterior.totalFacturacionMes) / anterior.totalFacturacionMes) * 100;
  }, [mesVsPair]);
  const ytdFactSeries = useMemo(
    () => ytdComparativaAnioVsAnioAnterior(monthlyFactCombinada, asOfDay),
    [monthlyFactCombinada, asOfDay],
  );
  const ytdYears = useMemo(() => {
    const y = parseISO(asOfDay).getFullYear();
    return { actual: String(y), anterior: String(y - 1) };
  }, [asOfDay]);
  const ytdFactSeriesChart = useMemo(
    () =>
      ytdFactSeries.map((r) => ({
        ...r,
        ytdObjetivo20: r.ytdAnioAnterior * (1 + FACTURACION_PLAN_CRECC_YOY),
      })),
    [ytdFactSeries],
  );
  const ytdFactChartYAxisMax = useMemo(() => {
    if (ytdFactSeriesChart.length === 0) return undefined;
    let peak = 0;
    for (const r of ytdFactSeriesChart) {
      peak = Math.max(peak, r.ytdAnioActual, r.ytdAnioAnterior, r.ytdObjetivo20);
    }
    return peak + FACTURACION_YTD_AXIS_TOP_PAD_MXN;
  }, [ytdFactSeriesChart]);

  const resumenFactTotal = useMemo(
    () => resumenFactYtdWithFallback(monthlyFactCombinada, asOfDay),
    [monthlyFactCombinada, asOfDay],
  );
  const resumenFactSadama = useMemo(
    () => resumenFactYtdWithFallback(monthlyFactSadama, asOfDay),
    [monthlyFactSadama, asOfDay],
  );
  const resumenFactAmadeus = useMemo(
    () => resumenFactYtdWithFallback(monthlyFactAmadeus, asOfDay),
    [monthlyFactAmadeus, asOfDay],
  );
  const facturacionBrechaYtd = useMemo(
    () => facturacionYtdBrechaVsAnterior(resumenFactTotal),
    [resumenFactTotal],
  );
  const facturacionVsObjetivo20 = useMemo(
    () => facturacionYtdVsObjetivo20(resumenFactTotal),
    [resumenFactTotal],
  );

  const onExportPdf = () => {
    window.print();
  };

  const showChartBrush = chartRows.length > 6;
  const chartPlotHeight = showChartBrush ? 292 : 248;
  const fullscreenChartHeight = 'min(58vh, 580px)';

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {mode === 'last_month' ? 'Último mes' : 'YTD'} · Cierre: {cierreLabel}
          </span>
          <span
            className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500"
            title="Si no ves local y un hash de git, o un commit reciente en prod., esta pestaña puede estar sirviendo otra carpeta o caché."
          >
            · build {uiBuildStamp}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExecutiveSwitch mode={mode} onChange={setMode} />
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => router.refresh()} title="Recargar datos desde el servidor">
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={onExportPdf} title="Exportar pantalla a PDF">
            PDF
          </Button>
        </div>
      </div>

      {view.dataNote ? (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-400/35 dark:bg-gradient-to-r dark:from-sky-950/50 dark:to-slate-950/60 dark:text-sky-100 dark:shadow-[0_0_24px_-6px_rgba(56,189,248,0.2)]">
          {view.dataNote}
        </div>
      ) : null}

      {ageBanner ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/35 dark:bg-gradient-to-r dark:from-amber-950/45 dark:to-zinc-950/60 dark:text-amber-100 dark:shadow-[0_0_24px_-6px_rgba(251,191,36,0.15)]">
          {ageBanner}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <HeroFlujoBanner
          title="Flujo total"
          yoyKpiKey="flujo_total"
          actual={flujoActualTotal}
          anterior={yoyFlujoTotal?.anterior ?? null}
          delta={yoyFlujoTotal?.delta ?? null}
          yoyDeltaPct={yoyFlujoTotal?.delta_pct ?? null}
          daily={dailyFlujo.total}
          className="min-h-[140px]"
          facturacionYtd={resumenFactTotal ?? undefined}
          facturacionYtdLabel="total (Sadama + Amadeus)"
          facturacionYtdKpiKey="facturacion_total_ytd"
          hideFlujoYoyWhenNoFacturacion
        />
        <HeroFlujoBanner
          title="Flujo Sadama"
          yoyKpiKey="flujo_sadama"
          actual={flujoActualSadama}
          anterior={yoyFlujoSadama?.anterior ?? null}
          delta={yoyFlujoSadama?.delta ?? null}
          yoyDeltaPct={yoyFlujoSadama?.delta_pct ?? null}
          daily={dailyFlujo.sadama}
          className="min-h-[140px]"
          facturacionYtd={resumenFactSadama ?? undefined}
          facturacionYtdLabel="Sadama"
          facturacionYtdKpiKey="facturacion_sadama_ytd"
        />
        <HeroFlujoBanner
          title="Flujo Amadeus"
          yoyKpiKey="flujo_amadeus"
          actual={flujoActualAmadeus}
          anterior={yoyFlujoAmadeus?.anterior ?? null}
          delta={yoyFlujoAmadeus?.delta ?? null}
          yoyDeltaPct={yoyFlujoAmadeus?.delta_pct ?? null}
          daily={dailyFlujo.amadeus}
          className="min-h-[140px]"
          facturacionYtd={resumenFactAmadeus ?? undefined}
          facturacionYtdLabel="Amadeus"
          facturacionYtdKpiKey="facturacion_amadeus_ytd"
        />
      </div>

      <DashboardChartFilters
        className="mt-4"
        rangePreset={rangePreset}
        granularity={granularity}
        customRange={customRange}
        asOfDay={asOfDay}
        onRangeChange={onRangePresetChange}
        onGranularityChange={setGranularity}
        onCustomRangeChange={setCustomRange}
      />

      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{periodHint}</div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {KPI_ORDER.map(({ key, title }) => {
          const raw = (kpis as Record<string, unknown>)[key];
          const fallback = typeof raw === 'number' ? raw : null;
          const fromSeries = lastBucket && typeof lastBucket[key] === 'number' ? (lastBucket[key] as number) : null;
          const value = fromSeries ?? fallback;
          // El badge debe reflejar el periodo/agrupación seleccionados (último vs anterior en la serie graficada).
          const deltaPct = deltaPctFromChartRows(chartRows, key);
          const sparkTriple = buildSparkTripleFromChartRows(chartRows, key);
          const sparkTripleTable = buildSparkTripleFromDailyPoints(kpiTableDailySlice, key);
          return (
            <ExecKPICard
              key={key}
              title={title}
              kpiKey={key}
              value={value}
              deltaPct={deltaPct}
              sparkTriple={sparkTriple}
              sparkTripleTable={sparkTripleTable}
              showChart={mounted}
              asOfDay={asOfDay}
              onExpand={() => setExpandedChart(KPI_EXPAND_TARGET[key])}
              expandLabel={`Ampliar gráfica de ${title}`}
            />
          );
        })}
      </div>

      <div className="dashboard-panel mt-4 rounded-xl border border-border bg-background p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">Facturación total (Sadama + Amadeus)</div>
              <ChartExpandIconButton
                onClick={() => setExpandedChart('facturacion')}
                label="Ampliar gráfica de facturación"
              />
              <ChartStructureInfoButton
                panelTitle="Cálculo y estructura de la gráfica de facturación total"
                className="max-w-full"
              >
                <p>
                  Misma base que los héroes de facturación YTD: <span className="font-medium">Sadama + Amadeus</span> por mes; en cada mes se toma el
                  último registro con fecha ≤ corte (campos <span className="font-medium">Fact. día / mes</span> = MTD del mes). El{' '}
                  <span className="font-medium">mes del corte</span> se va actualizando con cada captura; los JSON{' '}
                  <span className="font-medium">data/amadeus_monto_neto_mensual.json</span> y{' '}
                  <span className="font-medium">data/sadama_monto_neto_mensual.json</span> solo sustituyen meses anteriores al de cierre (cierre oficial).
                  Los gráficos <span className="font-medium">mes vs mes</span> y <span className="font-medium">YTD año vs año</span> usan este total
                  combinado. En <span className="font-medium">YTD</span>, la línea punteada naranja es la meta <span className="font-medium">+20%</span>{' '}
                  sobre el acumulado del año anterior en cada mes. El eje vertical llega hasta el máximo de las tres series más 2&nbsp;M&nbsp;MXN de margen.
                  Corte operativo (México):{' '}
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {format(parseISO(asOfDay), "d 'de' MMMM yyyy", { locale: es })}
                  </span>
                  .
                </p>
              </ChartStructureInfoButton>
            </div>
            {resumenFactTotal ? (
              <p className="mt-2 text-sm tabular-nums text-zinc-800 dark:text-zinc-100">
                YTD total {resumenFactTotal.yearActual}:{' '}
                <span className="font-semibold">{formatMXN(resumenFactTotal.ytdActual)}</span>
                {' · '}
                <span className="font-normal text-zinc-500 dark:text-zinc-400">
                  {resumenFactTotal.yearAnterior}: {formatMXN(resumenFactTotal.ytdAnterior)}
                </span>
              </p>
            ) : null}
            {resumenFactSadama && resumenFactAmadeus ? (
              <p className="mt-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                Desglose YTD {resumenFactTotal?.yearActual ?? resumenFactSadama.yearActual}: Sadama{' '}
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatMXN(resumenFactSadama.ytdActual)}</span>
                {' · '}
                Amadeus{' '}
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatMXN(resumenFactAmadeus.ytdActual)}</span>
              </p>
            ) : null}
            <FacturacionYtdBrechaCallout brecha={facturacionBrechaYtd} className="mt-2" />
            <FacturacionObjetivo20Callout data={facturacionVsObjetivo20} className="mt-2" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={facturacionVista === 'mes_vs_mes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFacturacionVista('mes_vs_mes')}
            >
              Mes vs mes anterior
            </Button>
            <Button
              type="button"
              variant={facturacionVista === 'ytd_anios' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFacturacionVista('ytd_anios')}
            >
              YTD año vs año anterior
            </Button>
          </div>
        </div>

        {facturacionVista === 'mes_vs_mes' ? (
          mesVsBarData.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin datos de facturación en la serie diaria.</p>
          ) : (
            <>
              {mesVsDeltaPct != null ? (
                <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
                  Variación mes actual vs anterior:{' '}
                  <span className="font-semibold tabular-nums">{formatPct(mesVsDeltaPct)}</span>
                </p>
              ) : null}
              <div className="chart-root h-[220px] w-full text-foreground">
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mesVsBarData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis
                        dataKey="periodo"
                        tick={axisTick}
                        interval={0}
                        angle={-22}
                        textAnchor="end"
                        height={58}
                      />
                      <YAxis
                        width={56}
                        tick={axisTick}
                        tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                      />
                      <Tooltip
                        cursor={{ fill: 'var(--chart-brush-area)' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const row = payload[0].payload as { periodo: string; total: number };
                          return (
                            <TooltipShell>
                              <div className="text-sm font-semibold">{row.periodo}</div>
                              <div className="mt-1 text-sm tabular-nums">{formatMXN(row.total)}</div>
                            </TooltipShell>
                          );
                        }}
                      />
                      <Bar
                        dataKey="total"
                        name="Fact. total Sadama+Amadeus (MXN)"
                        fill="var(--chart-line-flujo)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </>
          )
        ) : ytdFactSeries.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin datos para YTD en el año en curso.</p>
        ) : (
          <div className="chart-root h-[260px] w-full text-foreground">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ytdFactSeriesChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" tick={axisTick} />
                  <YAxis
                    width={56}
                    tick={axisTick}
                    domain={ytdFactChartYAxisMax != null ? [0, ytdFactChartYAxisMax] : undefined}
                    tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload as
                        | {
                            label: string;
                            ytdAnioActual: number;
                            ytdAnioAnterior: number;
                            ytdObjetivo20: number;
                          }
                        | undefined;
                      if (!row) return null;
                      return (
                        <TooltipShell>
                          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Mes {row.label}</div>
                          <ul className="mt-2 space-y-1 text-xs">
                            <li className="flex justify-between gap-4 tabular-nums">
                              <span>YTD {ytdYears.actual}</span>
                              <span>{formatMXN(row.ytdAnioActual)}</span>
                            </li>
                            <li className="flex justify-between gap-4 tabular-nums">
                              <span>YTD {ytdYears.anterior}</span>
                              <span>{formatMXN(row.ytdAnioAnterior)}</span>
                            </li>
                            <li className="flex justify-between gap-4 tabular-nums">
                              <span>Meta +20%</span>
                              <span>{formatMXN(row.ytdObjetivo20)}</span>
                            </li>
                          </ul>
                        </TooltipShell>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="ytdAnioActual"
                    name={`Acumulado ${ytdYears.actual}`}
                    stroke="var(--chart-line-flujo)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ytdAnioAnterior"
                    name={`Acumulado ${ytdYears.anterior}`}
                    stroke="var(--chart-line-flujo-amadeus)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ytdObjetivo20"
                    name={`Meta +20% vs ${ytdYears.anterior}`}
                    stroke="var(--chart-line-objetivo-fact)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="dashboard-panel rounded-xl border border-border bg-background p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">Flujo (MXN) por fecha · Sadama, Amadeus y total</div>
              <ChartStructureInfoButton panelTitle="Estructura de la gráfica de flujo">
                <p>
                  Tres series consolidadas (Sadama, Amadeus y total). Eje inferior: fecha de corte (dd/mm/aaaa). Pasa el mouse sobre la gráfica o usa
                  la banda gris (brush) para acercar el rango cuando hay muchos puntos.
                </p>
              </ChartStructureInfoButton>
            </div>
            <ChartExpandIconButton onClick={() => setExpandedChart('flujo')} label="Ampliar gráfica de flujo" />
          </div>
          <div className="chart-root w-full text-foreground" style={{ height: chartPlotHeight }}>
            {mounted && flujoChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={flujoChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="bucketEnd"
                    tick={axisTick}
                    tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : String(v))}
                    minTickGap={22}
                    interval="preserveStartEnd"
                    angle={-38}
                    textAnchor="end"
                    height={62}
                  />
                  <YAxis
                    width={56}
                    tick={axisTick}
                    tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                  />
                  <Tooltip content={<FlujoTooltip />} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="line" />
                  <Line
                    type="monotone"
                    dataKey="flujo_sadama"
                    name="Sadama"
                    stroke="var(--chart-line-flujo-sadama)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 1, stroke: 'var(--color-background)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="flujo_amadeus"
                    name="Amadeus"
                    stroke="var(--chart-line-flujo-amadeus)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 1, stroke: 'var(--color-background)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="flujo_total"
                    name="Total"
                    stroke="var(--chart-line-flujo)"
                    strokeWidth={2.5}
                    dot={
                      flujoChart.length <= 12
                        ? {
                            r: 3,
                            fill: 'var(--chart-line-flujo)',
                            stroke: 'var(--color-background)',
                            strokeWidth: 1,
                          }
                        : false
                    }
                    activeDot={{
                      r: 5,
                      fill: 'var(--chart-line-flujo)',
                      stroke: 'var(--color-background)',
                      strokeWidth: 2,
                    }}
                  />
                  {showChartBrush ? (
                    <Brush
                      dataKey="bucketEnd"
                      height={18}
                      stroke="var(--chart-brush)"
                      fill="var(--chart-brush-area)"
                      tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : '')}
                      travellerWidth={9}
                    />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sin datos en este alcance</div>
            )}
          </div>
          <ChartDataTable
            rows={flujoChart}
            caption="Montos exactos por fecha de corte (el más reciente arriba)."
            columns={[
              { key: 'bucketEnd', label: 'Fecha' },
              { key: 'flujo_sadama', label: 'Sadama', align: 'right' },
              { key: 'flujo_amadeus', label: 'Amadeus', align: 'right' },
              { key: 'flujo_total', label: 'Total', align: 'right' },
            ]}
          />
        </div>

        <div className="dashboard-panel rounded-xl border border-border bg-background p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">Bancos (MXN) por cuenta y fecha</div>
              <ChartStructureInfoButton panelTitle="Estructura de la gráfica de bancos">
                <p>
                  Misma escala de fechas que flujo e inventario (filtros de alcance y agrupación). El tooltip muestra el desglose por cuenta y el total
                  del día o periodo.
                </p>
                <p className="mt-2">
                  Las áreas están <span className="font-medium">apiladas</span>; los montos están en MXN usando el tipo de cambio del día de cada
                  captura.
                </p>
              </ChartStructureInfoButton>
            </div>
            <ChartExpandIconButton onClick={() => setExpandedChart('bancos')} label="Ampliar gráfica de bancos" />
          </div>
          <div className="chart-root w-full text-foreground" style={{ height: chartPlotHeight }}>
            {mounted && bancosChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bancosChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="bucketEnd"
                    tick={axisTick}
                    tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : String(v))}
                    minTickGap={22}
                    interval="preserveStartEnd"
                    angle={-38}
                    textAnchor="end"
                    height={62}
                  />
                  <YAxis
                    width={56}
                    tick={axisTick}
                    tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                  />
                  <Tooltip content={<BancosTooltip />} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    stackId="b"
                    dataKey="bajio_mxn"
                    name="Bajío MXN"
                    fill="var(--chart-banco-a)"
                    stroke="var(--chart-banco-a)"
                    fillOpacity={0.55}
                    strokeWidth={1}
                  />
                  <Area
                    type="monotone"
                    stackId="b"
                    dataKey="hsbc"
                    name="HSBC"
                    fill="var(--chart-banco-b)"
                    stroke="var(--chart-banco-b)"
                    fillOpacity={0.55}
                    strokeWidth={1}
                  />
                  <Area
                    type="monotone"
                    stackId="b"
                    dataKey="bajio_usd_mxn"
                    name="Bajío USD (MXN)"
                    fill="var(--chart-banco-c)"
                    stroke="var(--chart-banco-c)"
                    fillOpacity={0.55}
                    strokeWidth={1}
                  />
                  {showChartBrush ? (
                    <Brush
                      dataKey="bucketEnd"
                      height={18}
                      stroke="var(--chart-brush)"
                      fill="var(--chart-brush-area)"
                      tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : '')}
                      travellerWidth={9}
                    />
                  ) : null}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sin datos en este alcance</div>
            )}
          </div>
          <ChartDataTable
            rows={bancosChart}
            caption="Totales y cuentas por fecha de corte (más reciente arriba)."
            columns={[
              { key: 'bucketEnd', label: 'Fecha' },
              { key: 'total', label: 'Total', align: 'right' },
              { key: 'bajio_mxn', label: 'Bajío MXN', align: 'right' },
              { key: 'hsbc', label: 'HSBC', align: 'right' },
              { key: 'bajio_usd_mxn', label: 'Bajío USD→MXN', align: 'right' },
            ]}
          />
        </div>

        <div className="dashboard-panel rounded-xl border border-border bg-background p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">CXP por proveedor (último corte del período)</div>
              {lastBucket ? (
                <ChartStructureInfoButton panelTitle="Estructura de la gráfica de CXP">
                  <p>
                    Total CXP al corte seleccionado:{' '}
                    <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{formatMXN(cxpVista.total)}</span>. Cada porción de la
                    dona es la participación del proveedor en % sobre ese total.
                  </p>
                  <p className="mt-2">
                    Basado en la fecha de corte <span className="font-medium tabular-nums">{lastBucket.bucketEnd}</span> (último bucket del filtro
                    actual).
                  </p>
                </ChartStructureInfoButton>
              ) : null}
            </div>
            <ChartExpandIconButton onClick={() => setExpandedChart('cxp')} label="Ampliar gráfica de CXP" />
          </div>
          <div className="chart-root h-[240px] w-full text-foreground">
            {mounted && cxpVista.pie.some((s) => s.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CxpPieTooltip />} />
                  <Legend content={(props) => <CxpSortedLegend payload={props.payload as unknown[]} />} />
                  <Pie
                    data={cxpVista.pie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    stroke="var(--chart-pie-stroke)"
                    strokeWidth={2}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sin datos en este alcance</div>
            )}
          </div>
          {lastBucket && cxpVista.rows.length > 0 ? (
            <div className="mt-3 rounded-md border border-zinc-200 dark:border-zinc-700">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-zinc-100 dark:bg-zinc-900/80">
                  <tr>
                    <th className="border-b border-zinc-200 px-2 py-1.5 text-left font-semibold dark:border-zinc-700">
                      Proveedor
                    </th>
                    <th className="border-b border-zinc-200 px-2 py-1.5 text-right font-semibold dark:border-zinc-700">
                      Monto (MXN)
                    </th>
                    <th className="border-b border-zinc-200 px-2 py-1.5 text-right font-semibold dark:border-zinc-700">
                      % del total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cxpVista.rows.map((r) => (
                    <tr
                      key={r.name}
                      className="border-b border-zinc-100 odd:bg-white even:bg-zinc-50 last:border-0 dark:border-zinc-800 dark:odd:bg-zinc-950/80 dark:even:bg-zinc-900/40"
                    >
                      <td className="px-2 py-1">{r.name}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatMXN(r.value)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatPct(r.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="dashboard-panel rounded-xl border border-border bg-background p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">Inventario (MXN) por fecha · Sadama, Amadeus y total</div>
              <ChartStructureInfoButton panelTitle="Estructura de la gráfica de inventario">
                <p>
                  Tres series con el mismo criterio de color que flujo: Sadama, Amadeus y total. Eje horizontal: fechas de corte (dd/mm/aaaa), alineadas
                  con el alcance y la agrupación del panel superior.
                </p>
              </ChartStructureInfoButton>
            </div>
            <ChartExpandIconButton
              onClick={() => setExpandedChart('inventario')}
              label="Ampliar gráfica de inventario"
            />
          </div>
          <div className="chart-root w-full text-foreground" style={{ height: chartPlotHeight }}>
            {mounted && inventarioChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inventarioChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="bucketEnd"
                    tick={axisTick}
                    tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : String(v))}
                    minTickGap={22}
                    interval="preserveStartEnd"
                    angle={-38}
                    textAnchor="end"
                    height={62}
                  />
                  <YAxis
                    width={56}
                    tick={axisTick}
                    tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                  />
                  <Tooltip content={<InventarioTooltip />} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="line" />
                  <Line
                    type="monotone"
                    dataKey="inventario_sadama"
                    name="Sadama"
                    stroke="var(--chart-line-flujo-sadama)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 1, stroke: 'var(--color-background)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="inventario_amadeus"
                    name="Amadeus"
                    stroke="var(--chart-line-flujo-amadeus)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 1, stroke: 'var(--color-background)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="inventario_total"
                    name="Total"
                    stroke="var(--chart-line-inventario)"
                    strokeWidth={2.5}
                    dot={
                      inventarioChart.length <= 12
                        ? {
                            r: 3,
                            fill: 'var(--chart-line-inventario)',
                            stroke: 'var(--color-background)',
                            strokeWidth: 1,
                          }
                        : false
                    }
                    activeDot={{
                      r: 5,
                      fill: 'var(--chart-line-inventario)',
                      stroke: 'var(--color-background)',
                      strokeWidth: 2,
                    }}
                  />
                  {showChartBrush ? (
                    <Brush
                      dataKey="bucketEnd"
                      height={18}
                      stroke="var(--chart-brush)"
                      fill="var(--chart-brush-area)"
                      tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : '')}
                      travellerWidth={9}
                    />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sin datos en este alcance</div>
            )}
          </div>
          <ChartDataTable
            rows={inventarioChart}
            caption="Inventario por fecha de corte (más reciente arriba)."
            columns={[
              { key: 'bucketEnd', label: 'Fecha' },
              { key: 'inventario_sadama', label: 'Sadama', align: 'right' },
              { key: 'inventario_amadeus', label: 'Amadeus', align: 'right' },
              { key: 'inventario_total', label: 'Total', align: 'right' },
            ]}
          />
        </div>
      </div>

      {expandedChart
        ? createPortal(
            <div
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-2 backdrop-blur-[1px] sm:p-4 print:hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="chart-fs-title"
              onClick={() => setExpandedChart(null)}
            >
          <div
            className="flex max-h-[100dvh] w-full max-w-[min(1280px,100%)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl dark:border-zinc-600"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0 pr-2">
                <h2 id="chart-fs-title" className="text-base font-semibold text-foreground">
                  {expandedChart === 'facturacion'
                    ? facturacionVista === 'mes_vs_mes'
                      ? 'Facturación · mes vs mes anterior'
                      : 'Facturación · YTD año vs año anterior'
                    : expandedChart === 'flujo'
                      ? 'Flujo (MXN) · Sadama, Amadeus y total'
                      : expandedChart === 'bancos'
                        ? 'Bancos (MXN) · cuentas apiladas'
                          : expandedChart === 'cxp_total'
                            ? 'CXP (MXN) · Sadama, Amadeus y total'
                            : expandedChart === 'cxp'
                              ? 'CXP por proveedor'
                          : expandedChart === 'cxc'
                            ? 'CXC (MXN) · Sadama, Amadeus y total'
                            : 'Inventario (MXN) · Sadama, Amadeus y total'}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{periodHint}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setExpandedChart(null)}>
                Cerrar
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {expandedChart === 'facturacion' ? (
                <>
                  <FacturacionYtdBrechaCallout brecha={facturacionBrechaYtd} className="mb-4" />
                  <FacturacionObjetivo20Callout data={facturacionVsObjetivo20} className="mb-4" />
                  <ChartStructureInfoButton
                    panelTitle="Cálculo y estructura de la gráfica de facturación total"
                    className="mb-4 max-w-full"
                  >
                    <p>
                      Misma base que los héroes de facturación YTD: <span className="font-medium">Sadama + Amadeus</span> por mes; en cada mes se toma
                      el último registro con fecha ≤ corte (campos <span className="font-medium">Fact. día / mes</span> = MTD del mes). El{' '}
                      <span className="font-medium">mes del corte</span> se va actualizando con cada captura; los JSON{' '}
                      <span className="font-medium">data/amadeus_monto_neto_mensual.json</span> y{' '}
                      <span className="font-medium">data/sadama_monto_neto_mensual.json</span> solo sustituyen meses anteriores al de cierre (cierre
                      oficial). Los gráficos <span className="font-medium">mes vs mes</span> y <span className="font-medium">YTD año vs año</span> usan
                      este total combinado. En <span className="font-medium">YTD</span>, la línea punteada naranja es la meta <span className="font-medium">+20%</span>{' '}
                      sobre el acumulado del año anterior en cada mes. El eje vertical llega hasta el máximo de las tres series más 2&nbsp;M&nbsp;MXN de
                      margen. Corte operativo (México):{' '}
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {format(parseISO(asOfDay), "d 'de' MMMM yyyy", { locale: es })}
                      </span>
                      .
                    </p>
                  </ChartStructureInfoButton>
                  {facturacionVista === 'mes_vs_mes' ? (
                  mesVsBarData.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin datos de facturación en la serie.</p>
                  ) : (
                    <>
                      {mesVsDeltaPct != null ? (
                        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">
                          Variación mes actual vs anterior:{' '}
                          <span className="font-semibold tabular-nums">{formatPct(mesVsDeltaPct)}</span>
                        </p>
                      ) : null}
                      <div className="chart-root w-full text-foreground" style={{ height: fullscreenChartHeight }}>
                        {mounted ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mesVsBarData} margin={{ top: 16, right: 20, left: 12, bottom: 12 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                              <XAxis
                                dataKey="periodo"
                                tick={axisTickLg}
                                interval={0}
                                angle={-18}
                                textAnchor="end"
                                height={56}
                              />
                              <YAxis
                                width={68}
                                tick={axisTickLg}
                                tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                              />
                              <Tooltip
                                cursor={{ fill: 'var(--chart-brush-area)' }}
                                content={({ active, payload }) => {
                                  if (!active || !payload?.[0]) return null;
                                  const row = payload[0].payload as { periodo: string; total: number };
                                  return (
                                    <TooltipShell className="max-w-[min(92vw,420px)] px-3.5 py-2.5">
                                      <div className="text-base font-semibold">{row.periodo}</div>
                                      <div className="mt-1 text-base tabular-nums font-medium">{formatMXN(row.total)}</div>
                                    </TooltipShell>
                                  );
                                }}
                              />
                              <Bar
                                dataKey="total"
                                name="Fact. total Sadama+Amadeus (MXN)"
                                fill="var(--chart-line-flujo)"
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : null}
                      </div>
                      <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700">
                        <table className="w-full border-collapse text-sm">
                          <thead className="bg-zinc-100 dark:bg-zinc-900/80">
                            <tr>
                              <th className="border-b px-3 py-2 text-left font-semibold dark:border-zinc-700">Periodo</th>
                              <th className="border-b px-3 py-2 text-right font-semibold dark:border-zinc-700">
                                Total (MXN)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {mesVsBarData.map((r) => (
                              <tr key={r.periodo} className="border-b border-zinc-100 dark:border-zinc-800">
                                <td className="px-3 py-2">{r.periodo}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMXN(r.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                ) : ytdFactSeries.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin datos para YTD en el año en curso.</p>
                ) : (
                  <>
                    <div className="chart-root w-full text-foreground" style={{ height: fullscreenChartHeight }}>
                      {mounted ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={ytdFactSeriesChart} margin={{ top: 16, right: 20, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                            <XAxis dataKey="label" tick={axisTickLg} />
                            <YAxis
                              width={68}
                              tick={axisTickLg}
                              domain={ytdFactChartYAxisMax != null ? [0, ytdFactChartYAxisMax] : undefined}
                              tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const row = payload[0]?.payload as
                                  | {
                                      label: string;
                                      ytdAnioActual: number;
                                      ytdAnioAnterior: number;
                                      ytdObjetivo20: number;
                                    }
                                  | undefined;
                                if (!row) return null;
                                return (
                                  <TooltipShell className="max-w-[min(92vw,440px)] px-3.5 py-2.5 text-sm">
                                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                      Mes {row.label}
                                    </div>
                                    <ul className="mt-2 space-y-2 text-sm">
                                      <li className="flex justify-between gap-6 tabular-nums">
                                        <span>YTD {ytdYears.actual}</span>
                                        <span className="font-semibold">{formatMXN(row.ytdAnioActual)}</span>
                                      </li>
                                      <li className="flex justify-between gap-6 tabular-nums">
                                        <span>YTD {ytdYears.anterior}</span>
                                        <span className="font-semibold">{formatMXN(row.ytdAnioAnterior)}</span>
                                      </li>
                                      <li className="flex justify-between gap-6 tabular-nums">
                                        <span>Meta +20%</span>
                                        <span className="font-semibold">{formatMXN(row.ytdObjetivo20)}</span>
                                      </li>
                                    </ul>
                                  </TooltipShell>
                                );
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                            <Line
                              type="monotone"
                              dataKey="ytdAnioActual"
                              name={`Acumulado ${ytdYears.actual}`}
                              stroke="var(--chart-line-flujo)"
                              strokeWidth={3}
                              dot={{ r: 4 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="ytdAnioAnterior"
                              name={`Acumulado ${ytdYears.anterior}`}
                              stroke="var(--chart-line-flujo-amadeus)"
                              strokeWidth={3}
                              dot={{ r: 4 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="ytdObjetivo20"
                              name={`Meta +20% vs ${ytdYears.anterior}`}
                              stroke="var(--chart-line-objetivo-fact)"
                              strokeWidth={2.5}
                              strokeDasharray="6 4"
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : null}
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700">
                      <table className="w-full border-collapse text-sm">
                        <thead className="bg-zinc-100 dark:bg-zinc-900/80">
                          <tr>
                            <th className="border-b px-3 py-2 text-left font-semibold dark:border-zinc-700">Mes</th>
                            <th className="border-b px-3 py-2 text-right font-semibold dark:border-zinc-700">
                              YTD {ytdYears.actual}
                            </th>
                            <th className="border-b px-3 py-2 text-right font-semibold dark:border-zinc-700">
                              YTD {ytdYears.anterior}
                            </th>
                            <th className="border-b px-3 py-2 text-right font-semibold dark:border-zinc-700">
                              Meta +20%
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {ytdFactSeriesChart.map((r) => (
                            <tr key={r.label} className="border-b border-zinc-100 dark:border-zinc-800">
                              <td className="px-3 py-2 font-medium">{r.label}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatMXN(r.ytdAnioActual)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatMXN(r.ytdAnioAnterior)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatMXN(r.ytdObjetivo20)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
                }
              </>
              ) : expandedChart === 'flujo' ? (
                <>
                  <ChartStructureInfoButton panelTitle="Estructura de la gráfica de flujo" className="mb-3 max-w-full">
                    <p>
                      Tres series: Sadama, Amadeus y total. Pasa el cursor sobre la gráfica para ver el desglose por línea; en esta vista el tooltip es
                      más ancho.
                    </p>
                  </ChartStructureInfoButton>
                  {(() => {
                    const s = summarizeSeriesDeltaMXN(flujoChart as unknown as Array<{ bucketEnd: string } & Record<string, unknown>>, 'flujo_total');
                    if (!s) return null;
                    const verb =
                      s.deltaPct == null || !Number.isFinite(s.deltaPct) || s.deltaPct === 0
                        ? 'se ha mantenido'
                        : s.deltaPct > 0
                          ? 'se ha incrementado'
                          : 'ha disminuido';
                    const scope = scopeNarrative(rangePreset, customRange, asOfDay);
                    return (
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-zinc-50/80 p-3 dark:bg-zinc-950/40">
                        <div className="min-w-0 text-sm text-zinc-700 dark:text-zinc-200">
                          <span className="font-medium">Flujo total</span> {verb} en {scope.label}
                          {scope.showDates ? (
                            <>
                              {' '}
                              de <span className="font-medium tabular-nums">{formatCierreLabel(s.startDate)}</span> a{' '}
                              <span className="font-medium tabular-nums">{formatCierreLabel(s.endDate)}</span>.
                            </>
                          ) : (
                            '.'
                          )}
                          {s.deltaPct != null && Number.isFinite(s.deltaPct) ? (
                            <>
                              {' '}
                              <span className={cn('font-semibold tabular-nums', toneNumberClass('flujo_total', s.deltaPct))}>
                                {formatPct(s.deltaPct)}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <YoYBadge kpiKey="flujo_total" deltaPct={s.deltaPct} />
                      </div>
                    );
                  })()}
                  <div className="chart-root w-full text-foreground" style={{ height: fullscreenChartHeight }}>
                    {mounted && flujoChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={flujoChart} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                          <XAxis
                            dataKey="bucketEnd"
                            tick={axisTickLg}
                            tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : String(v))}
                            minTickGap={28}
                            interval="preserveStartEnd"
                            angle={-32}
                            textAnchor="end"
                            height={68}
                          />
                          <YAxis
                            width={68}
                            tick={axisTickLg}
                            tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                          />
                          <Tooltip
                            content={(props) => (
                              <FlujoTooltip
                                active={props.active}
                                payload={props.payload as ChartTooltipProps['payload']}
                                wide
                              />
                            )}
                            cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} iconType="line" />
                          <Line
                            type="monotone"
                            dataKey="flujo_sadama"
                            name="Sadama"
                            stroke="var(--chart-line-flujo-sadama)"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 1, stroke: 'var(--color-background)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="flujo_amadeus"
                            name="Amadeus"
                            stroke="var(--chart-line-flujo-amadeus)"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 1, stroke: 'var(--color-background)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="flujo_total"
                            name="Total"
                            stroke="var(--chart-line-flujo)"
                            strokeWidth={3}
                            dot={
                              flujoChart.length <= 16
                                ? {
                                    r: 4,
                                    fill: 'var(--chart-line-flujo)',
                                    stroke: 'var(--color-background)',
                                    strokeWidth: 1,
                                  }
                                : false
                            }
                            activeDot={{
                              r: 6,
                              fill: 'var(--chart-line-flujo)',
                              stroke: 'var(--color-background)',
                              strokeWidth: 2,
                            }}
                          />
                          {showChartBrush ? (
                            <Brush
                              dataKey="bucketEnd"
                              height={22}
                              stroke="var(--chart-brush)"
                              fill="var(--chart-brush-area)"
                              tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : '')}
                              travellerWidth={10}
                            />
                          ) : null}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                        Sin datos en este alcance
                      </div>
                    )}
                  </div>
                  <ChartDataTable
                    rows={flujoChart}
                    caption="Montos por fecha de corte (más reciente arriba)."
                    tableMaxHeightClass="max-h-72"
                    columns={[
                      { key: 'bucketEnd', label: 'Fecha' },
                      { key: 'flujo_sadama', label: 'Sadama', align: 'right' },
                      { key: 'flujo_amadeus', label: 'Amadeus', align: 'right' },
                      { key: 'flujo_total', label: 'Total', align: 'right' },
                    ]}
                  />
                </>
              ) : expandedChart === 'bancos' ? (
                <>
                  <ChartStructureInfoButton panelTitle="Estructura de la gráfica de bancos" className="mb-3 max-w-full">
                    <p>
                      Áreas apiladas por cuenta; el tooltip lista cada línea y el total del día o periodo. Montos en MXN al tipo de cambio del día de
                      cada captura.
                    </p>
                  </ChartStructureInfoButton>
                  {(() => {
                    const s = summarizeSeriesDeltaMXN(bancosChart as unknown as Array<{ bucketEnd: string } & Record<string, unknown>>, 'total');
                    if (!s) return null;
                    const verb =
                      s.deltaPct == null || !Number.isFinite(s.deltaPct) || s.deltaPct === 0
                        ? 'se ha mantenido'
                        : s.deltaPct > 0
                          ? 'se ha incrementado'
                          : 'ha disminuido';
                    const scope = scopeNarrative(rangePreset, customRange, asOfDay);
                    return (
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-zinc-50/80 p-3 dark:bg-zinc-950/40">
                        <div className="min-w-0 text-sm text-zinc-700 dark:text-zinc-200">
                          <span className="font-medium">Bancos</span> {verb} en {scope.label}
                          {scope.showDates ? (
                            <>
                              {' '}
                              de <span className="font-medium tabular-nums">{formatCierreLabel(s.startDate)}</span> a{' '}
                              <span className="font-medium tabular-nums">{formatCierreLabel(s.endDate)}</span>.
                            </>
                          ) : (
                            '.'
                          )}
                          {s.deltaPct != null && Number.isFinite(s.deltaPct) ? (
                            <>
                              {' '}
                              <span className={cn('font-semibold tabular-nums', toneNumberClass('bancos_total', s.deltaPct))}>
                                {formatPct(s.deltaPct)}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <YoYBadge kpiKey="bancos_total" deltaPct={s.deltaPct} />
                      </div>
                    );
                  })()}
                  <div className="chart-root w-full text-foreground" style={{ height: fullscreenChartHeight }}>
                    {mounted && bancosChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={bancosChart} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                          <XAxis
                            dataKey="bucketEnd"
                            tick={axisTickLg}
                            tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : String(v))}
                            minTickGap={28}
                            interval="preserveStartEnd"
                            angle={-32}
                            textAnchor="end"
                            height={68}
                          />
                          <YAxis
                            width={68}
                            tick={axisTickLg}
                            tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                          />
                          <Tooltip
                            content={(props) => (
                              <BancosTooltip
                                active={props.active}
                                payload={props.payload as ChartTooltipProps['payload']}
                                wide
                              />
                            )}
                            cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 13 }} />
                          <Area
                            type="monotone"
                            stackId="b"
                            dataKey="bajio_mxn"
                            name="Bajío MXN"
                            fill="var(--chart-banco-a)"
                            stroke="var(--chart-banco-a)"
                            fillOpacity={0.55}
                            strokeWidth={1}
                          />
                          <Area
                            type="monotone"
                            stackId="b"
                            dataKey="hsbc"
                            name="HSBC"
                            fill="var(--chart-banco-b)"
                            stroke="var(--chart-banco-b)"
                            fillOpacity={0.55}
                            strokeWidth={1}
                          />
                          <Area
                            type="monotone"
                            stackId="b"
                            dataKey="bajio_usd_mxn"
                            name="Bajío USD (MXN)"
                            fill="var(--chart-banco-c)"
                            stroke="var(--chart-banco-c)"
                            fillOpacity={0.55}
                            strokeWidth={1}
                          />
                          {showChartBrush ? (
                            <Brush
                              dataKey="bucketEnd"
                              height={22}
                              stroke="var(--chart-brush)"
                              fill="var(--chart-brush-area)"
                              tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : '')}
                              travellerWidth={10}
                            />
                          ) : null}
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                        Sin datos en este alcance
                      </div>
                    )}
                  </div>
                  <ChartDataTable
                    rows={bancosChart}
                    caption="Totales y cuentas por fecha (más reciente arriba)."
                    tableMaxHeightClass="max-h-72"
                    columns={[
                      { key: 'bucketEnd', label: 'Fecha' },
                      { key: 'total', label: 'Total', align: 'right' },
                      { key: 'bajio_mxn', label: 'Bajío MXN', align: 'right' },
                      { key: 'hsbc', label: 'HSBC', align: 'right' },
                      { key: 'bajio_usd_mxn', label: 'Bajío USD→MXN', align: 'right' },
                    ]}
                  />
                </>
              ) : expandedChart === 'cxp_total' ? (
                <>
                  <ChartStructureInfoButton panelTitle="Estructura de la gráfica de CXP" className="mb-3 max-w-full">
                    <p>
                      Tres series: Sadama, Amadeus y total (cuentas por pagar). En esta vista ampliada el tooltip muestra con más espacio el importe de
                      cada línea.
                    </p>
                  </ChartStructureInfoButton>
                  {(() => {
                    const s = summarizeSeriesDeltaMXN(inventarioChart as unknown as Array<{ bucketEnd: string } & Record<string, unknown>>, 'cxp_total');
                    if (!s) return null;
                    const verb =
                      s.deltaPct == null || !Number.isFinite(s.deltaPct) || s.deltaPct === 0
                        ? 'se ha mantenido'
                        : s.deltaPct > 0
                          ? 'se ha incrementado'
                          : 'ha disminuido';
                    const scope = scopeNarrative(rangePreset, customRange, asOfDay);
                    return (
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-zinc-50/80 p-3 dark:bg-zinc-950/40">
                        <div className="min-w-0 text-sm text-zinc-700 dark:text-zinc-200">
                          <span className="font-medium">CXP</span> {verb} en {scope.label}
                          {scope.showDates ? (
                            <>
                              {' '}
                              de <span className="font-medium tabular-nums">{formatCierreLabel(s.startDate)}</span> a{' '}
                              <span className="font-medium tabular-nums">{formatCierreLabel(s.endDate)}</span>.
                            </>
                          ) : (
                            '.'
                          )}
                          {s.deltaPct != null && Number.isFinite(s.deltaPct) ? (
                            <>
                              {' '}
                              <span className={cn('font-semibold tabular-nums', toneNumberClass('cxp_total', s.deltaPct))}>
                                {formatPct(s.deltaPct)}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <YoYBadge kpiKey="cxp_total" deltaPct={s.deltaPct} />
                      </div>
                    );
                  })()}
                  <div className="chart-root w-full text-foreground" style={{ height: fullscreenChartHeight }}>
                    {mounted && inventarioChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={inventarioChart} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                          <XAxis
                            dataKey="bucketEnd"
                            tick={axisTickLg}
                            tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : String(v))}
                            minTickGap={28}
                            interval="preserveStartEnd"
                            angle={-32}
                            textAnchor="end"
                            height={68}
                          />
                          <YAxis
                            width={68}
                            tick={axisTickLg}
                            tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                          />
                          <Tooltip
                            content={(props) => (
                              <CxpTooltip
                                active={props.active}
                                payload={props.payload as ChartTooltipProps['payload']}
                                wide
                              />
                            )}
                            cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} iconType="line" />
                          <Line
                            type="monotone"
                            dataKey="cxp_sadama"
                            name="Sadama"
                            stroke="var(--chart-line-flujo-sadama)"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 1, stroke: 'var(--color-background)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="cxp_amadeus"
                            name="Amadeus"
                            stroke="var(--chart-line-flujo-amadeus)"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 1, stroke: 'var(--color-background)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="cxp_total"
                            name="Total"
                            stroke="var(--chart-spark-cxp-stroke)"
                            strokeWidth={3}
                            dot={inventarioChart.length <= 16 ? { r: 4, fill: 'var(--chart-spark-cxp-stroke)', stroke: 'var(--color-background)', strokeWidth: 1 } : false}
                            activeDot={{ r: 6, fill: 'var(--chart-spark-cxp-stroke)', stroke: 'var(--color-background)', strokeWidth: 2 }}
                          />
                          {showChartBrush ? (
                            <Brush
                              dataKey="bucketEnd"
                              height={22}
                              stroke="var(--chart-brush)"
                              fill="var(--chart-brush-area)"
                              tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : '')}
                              travellerWidth={10}
                            />
                          ) : null}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                        Sin datos en este alcance
                      </div>
                    )}
                  </div>
                  <ChartDataTable
                    rows={inventarioChart}
                    caption="CXP por fecha de corte (más reciente arriba)."
                    tableMaxHeightClass="max-h-72"
                    columns={[
                      { key: 'bucketEnd', label: 'Fecha' },
                      { key: 'cxp_sadama', label: 'Sadama', align: 'right' },
                      { key: 'cxp_amadeus', label: 'Amadeus', align: 'right' },
                      { key: 'cxp_total', label: 'Total', align: 'right' },
                    ]}
                  />
                </>
              ) : expandedChart === 'cxp' ? (
                <>
                  {lastBucket ? (
                    <ChartStructureInfoButton panelTitle="Estructura de la gráfica de CXP" className="mb-3 max-w-full">
                      <p>
                        Total CXP al corte:{' '}
                        <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatMXN(cxpVista.total)}</span>
                        {lastBucket.bucketEnd ? (
                          <>
                            {' '}
                            · fecha de corte <span className="font-medium tabular-nums">{lastBucket.bucketEnd}</span>
                          </>
                        ) : null}
                        . La dona muestra la participación de cada proveedor en % sobre ese total.
                      </p>
                    </ChartStructureInfoButton>
                  ) : null}
                  <div className="chart-root w-full text-foreground" style={{ height: 'min(52vh, 480px)' }}>
                    {mounted && cxpVista.pie.some((s) => s.value > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            content={(props) => (
                              <CxpPieTooltip
                                active={props.active}
                                payload={props.payload as PieTooltipProps['payload']}
                                wide
                              />
                            )}
                          />
                          <Legend
                            content={(props) => <CxpSortedLegend payload={props.payload as unknown[]} wide />}
                          />
                          <Pie
                            data={cxpVista.pie}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={64}
                            outerRadius={112}
                            stroke="var(--chart-pie-stroke)"
                            strokeWidth={2}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                        Sin datos en este alcance
                      </div>
                    )}
                  </div>
                  {lastBucket && cxpVista.rows.length > 0 ? (
                    <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700">
                      <table className="w-full border-collapse text-sm">
                        <thead className="bg-zinc-100 dark:bg-zinc-900/80">
                          <tr>
                            <th className="border-b px-3 py-2 text-left font-semibold dark:border-zinc-700">
                              Proveedor
                            </th>
                            <th className="border-b px-3 py-2 text-right font-semibold dark:border-zinc-700">
                              Monto (MXN)
                            </th>
                            <th className="border-b px-3 py-2 text-right font-semibold dark:border-zinc-700">
                              % del total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {cxpVista.rows.map((r) => (
                            <tr
                              key={r.name}
                              className="border-b border-zinc-100 dark:border-zinc-800"
                            >
                              <td className="px-3 py-2">{r.name}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMXN(r.value)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatPct(r.pct)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </>
              ) : expandedChart === 'cxc' ? (
                <>
                  <ChartStructureInfoButton panelTitle="Estructura de la gráfica de CXC" className="mb-3 max-w-full">
                    <p>
                      Tres series: Sadama, Amadeus y total (cuentas por cobrar). En esta vista ampliada el tooltip muestra con más espacio el importe de
                      cada línea.
                    </p>
                  </ChartStructureInfoButton>
                  {(() => {
                    const s = summarizeSeriesDeltaMXN(inventarioChart as unknown as Array<{ bucketEnd: string } & Record<string, unknown>>, 'cxc_total');
                    if (!s) return null;
                    const verb =
                      s.deltaPct == null || !Number.isFinite(s.deltaPct) || s.deltaPct === 0
                        ? 'se ha mantenido'
                        : s.deltaPct > 0
                          ? 'se ha incrementado'
                          : 'ha disminuido';
                    const scope = scopeNarrative(rangePreset, customRange, asOfDay);
                    const riskNote =
                      s.deltaPct == null || !Number.isFinite(s.deltaPct) || s.deltaPct === 0
                        ? null
                        : s.deltaPct > 0
                          ? 'Mientras más cuentas por cobrar, más capital se queda detenido: es un comportamiento riesgoso para la empresa.'
                          : 'La disminución de cuentas por cobrar reduce riesgo y libera capital hacia el flujo.';
                    return (
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-zinc-50/80 p-3 dark:bg-zinc-950/40">
                        <div className="min-w-0 text-sm text-zinc-700 dark:text-zinc-200">
                          <span className="font-medium">CXC</span> {verb} en {scope.label}
                          {scope.showDates ? (
                            <>
                              {' '}
                              de <span className="font-medium tabular-nums">{formatCierreLabel(s.startDate)}</span> a{' '}
                              <span className="font-medium tabular-nums">{formatCierreLabel(s.endDate)}</span>.
                            </>
                          ) : (
                            '.'
                          )}
                          {s.deltaPct != null && Number.isFinite(s.deltaPct) ? (
                            <>
                              {' '}
                              <span className={cn('font-semibold tabular-nums', toneNumberClass('cxc_total', s.deltaPct))}>
                                {formatPct(s.deltaPct)}
                              </span>
                            </>
                          ) : null}
                          {riskNote ? (
                            <>
                              {' '}
                              <span className={cn('font-medium', toneNumberClass('cxc_total', s.deltaPct))}>{riskNote}</span>
                            </>
                          ) : null}
                        </div>
                        <YoYBadge kpiKey="cxc_total" deltaPct={s.deltaPct} />
                      </div>
                    );
                  })()}
                  <div className="chart-root w-full text-foreground" style={{ height: fullscreenChartHeight }}>
                    {mounted && inventarioChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={inventarioChart} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                          <XAxis
                            dataKey="bucketEnd"
                            tick={axisTickLg}
                            tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : String(v))}
                            minTickGap={28}
                            interval="preserveStartEnd"
                            angle={-32}
                            textAnchor="end"
                            height={68}
                          />
                          <YAxis
                            width={68}
                            tick={axisTickLg}
                            tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                          />
                          <Tooltip
                            content={(props) => (
                              <CxcTooltip
                                active={props.active}
                                payload={props.payload as ChartTooltipProps['payload']}
                                wide
                              />
                            )}
                            cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} iconType="line" />
                          <Line
                            type="monotone"
                            dataKey="cxc_sadama"
                            name="Sadama"
                            stroke="var(--chart-line-flujo-sadama)"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 1, stroke: 'var(--color-background)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="cxc_amadeus"
                            name="Amadeus"
                            stroke="var(--chart-line-flujo-amadeus)"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 1, stroke: 'var(--color-background)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="cxc_total"
                            name="Total"
                            stroke="var(--chart-spark-cxc-stroke)"
                            strokeWidth={3}
                            dot={
                              inventarioChart.length <= 16
                                ? {
                                    r: 4,
                                    fill: 'var(--chart-spark-cxc-stroke)',
                                    stroke: 'var(--color-background)',
                                    strokeWidth: 1,
                                  }
                                : false
                            }
                            activeDot={{
                              r: 6,
                              fill: 'var(--chart-spark-cxc-stroke)',
                              stroke: 'var(--color-background)',
                              strokeWidth: 2,
                            }}
                          />
                          {showChartBrush ? (
                            <Brush
                              dataKey="bucketEnd"
                              height={22}
                              stroke="var(--chart-brush)"
                              fill="var(--chart-brush-area)"
                              tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : '')}
                              travellerWidth={10}
                            />
                          ) : null}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                        Sin datos en este alcance
                      </div>
                    )}
                  </div>
                  <ChartDataTable
                    rows={inventarioChart}
                    caption="CXC por fecha de corte (más reciente arriba)."
                    tableMaxHeightClass="max-h-72"
                    columns={[
                      { key: 'bucketEnd', label: 'Fecha' },
                      { key: 'cxc_sadama', label: 'Sadama', align: 'right' },
                      { key: 'cxc_amadeus', label: 'Amadeus', align: 'right' },
                      { key: 'cxc_total', label: 'Total', align: 'right' },
                    ]}
                  />
                </>
              ) : (
                <>
                  <ChartStructureInfoButton panelTitle="Estructura de la gráfica de inventario" className="mb-3 max-w-full">
                    <p>
                      Tres series: Sadama, Amadeus y total. En esta vista ampliada el tooltip muestra con más espacio el importe de cada línea.
                    </p>
                  </ChartStructureInfoButton>
                  {(() => {
                    const s = summarizeSeriesDeltaMXN(inventarioChart as unknown as Array<{ bucketEnd: string } & Record<string, unknown>>, 'inventario_total');
                    if (!s) return null;
                    const verb =
                      s.deltaPct == null || !Number.isFinite(s.deltaPct) || s.deltaPct === 0
                        ? 'se ha mantenido'
                        : s.deltaPct > 0
                          ? 'se ha incrementado'
                          : 'ha disminuido';
                    const scope = scopeNarrative(rangePreset, customRange, asOfDay);
                    return (
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-zinc-50/80 p-3 dark:bg-zinc-950/40">
                        <div className="min-w-0 text-sm text-zinc-700 dark:text-zinc-200">
                          <span className="font-medium">Inventario</span> {verb} en {scope.label}
                          {scope.showDates ? (
                            <>
                              {' '}
                              de <span className="font-medium tabular-nums">{formatCierreLabel(s.startDate)}</span> a{' '}
                              <span className="font-medium tabular-nums">{formatCierreLabel(s.endDate)}</span>.
                            </>
                          ) : (
                            '.'
                          )}
                          {s.deltaPct != null && Number.isFinite(s.deltaPct) ? (
                            <>
                              {' '}
                              <span className={cn('font-semibold tabular-nums', toneNumberClass('inventario_total', s.deltaPct))}>
                                {formatPct(s.deltaPct)}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <YoYBadge kpiKey="inventario_total" deltaPct={s.deltaPct} />
                      </div>
                    );
                  })()}
                  <div className="chart-root w-full text-foreground" style={{ height: fullscreenChartHeight }}>
                    {mounted && inventarioChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={inventarioChart} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                          <XAxis
                            dataKey="bucketEnd"
                            tick={axisTickLg}
                            tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : String(v))}
                            minTickGap={28}
                            interval="preserveStartEnd"
                            angle={-32}
                            textAnchor="end"
                            height={68}
                          />
                          <YAxis
                            width={68}
                            tick={axisTickLg}
                            tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                          />
                          <Tooltip
                            content={(props) => (
                              <InventarioTooltip
                                active={props.active}
                                payload={props.payload as ChartTooltipProps['payload']}
                                wide
                              />
                            )}
                            cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} iconType="line" />
                          <Line
                            type="monotone"
                            dataKey="inventario_sadama"
                            name="Sadama"
                            stroke="var(--chart-line-flujo-sadama)"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 1, stroke: 'var(--color-background)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="inventario_amadeus"
                            name="Amadeus"
                            stroke="var(--chart-line-flujo-amadeus)"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 1, stroke: 'var(--color-background)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="inventario_total"
                            name="Total"
                            stroke="var(--chart-line-inventario)"
                            strokeWidth={3}
                            dot={
                              inventarioChart.length <= 16
                                ? {
                                    r: 4,
                                    fill: 'var(--chart-line-inventario)',
                                    stroke: 'var(--color-background)',
                                    strokeWidth: 1,
                                  }
                                : false
                            }
                            activeDot={{
                              r: 6,
                              fill: 'var(--chart-line-inventario)',
                              stroke: 'var(--color-background)',
                              strokeWidth: 2,
                            }}
                          />
                          {showChartBrush ? (
                            <Brush
                              dataKey="bucketEnd"
                              height={22}
                              stroke="var(--chart-brush)"
                              fill="var(--chart-brush-area)"
                              tickFormatter={(v) => (typeof v === 'string' ? formatChartDayNumeric(v) : '')}
                              travellerWidth={10}
                            />
                          ) : null}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                        Sin datos en este alcance
                      </div>
                    )}
                  </div>
                  <ChartDataTable
                    rows={inventarioChart}
                    caption="Inventario por fecha de corte (más reciente arriba)."
                    tableMaxHeightClass="max-h-72"
                    columns={[
                      { key: 'bucketEnd', label: 'Fecha' },
                      { key: 'inventario_sadama', label: 'Sadama', align: 'right' },
                      { key: 'inventario_amadeus', label: 'Amadeus', align: 'right' },
                      { key: 'inventario_total', label: 'Total', align: 'right' },
                    ]}
                  />
                </>
              )}
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}

      <AlertsBanner yoy={yoy} className="mt-4" />

      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={() => router.push('/')} title="Ir al dashboard completo">
          Ir al dashboard completo
        </Button>
      </div>
    </div>
  );
}
