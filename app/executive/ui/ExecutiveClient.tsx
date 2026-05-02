'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

import type { FlujoDailyComparativoBundle } from '@/lib/dailyFlujoComparativo';
import type { DailyKpiPoint } from '@/lib/dailyKpisFromRow';
import { formatChartDayNumeric, formatCierreLabel } from '@/lib/dateDisplay';
import {
  buildFilteredChartSeries,
  rangePresetShortLabel,
  type ChartCustomDateRange,
  type ChartGranularity,
  type ChartRangePreset,
  type ChartRow,
} from '@/lib/chartSeriesFilters';
import { cxpProveedoresConPct } from '@/lib/cxpDonutFromDaily';
import {
  aggregateFacturacionPorMesCalendario,
  mesActualVsMesAnteriorCalendario,
  ytdComparativaAnioVsAnioAnterior,
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

import type { ExecutiveViewModel, YoYDelta } from '@/lib/executive';
import type { JsonMeta } from '@/lib/types';
import { formatMXN, formatMXNAxis, formatPct } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { DashboardChartFilters } from '@/components/executive/DashboardChartFilters';
import { ExecutiveSwitch, type ExecutiveMode } from '@/components/executive/ExecutiveSwitch';
import { ThemeToggle } from '@/components/executive/ThemeToggle';
import { HeroFlujoBanner } from '@/components/executive/HeroFlujoBanner';
import { ExecKPICard } from '@/components/executive/ExecKPICard';
import { AlertsBanner } from '@/components/executive/AlertsBanner';
import { ChartDataTable } from '@/components/executive/ChartDataTable';

const KPI_ORDER = [
  { key: 'bancos_total', title: 'Bancos' },
  { key: 'inventario_total', title: 'Inventario' },
  { key: 'cxc_total', title: 'CXC' },
  { key: 'cxp_total', title: 'CXP' },
] as const;

type KpiSparkKey = (typeof KPI_ORDER)[number]['key'];

function pickYoY(yoy: Record<string, YoYDelta> | null | undefined, kpiKey: string) {
  const d = yoy?.[kpiKey];
  return d && typeof d === 'object' ? d : null;
}

function buildSparkFromChartRows(rows: ChartRow[], kpiKey: KpiSparkKey) {
  return rows.map((r) => ({
    x: r.bucketEnd,
    y: typeof r[kpiKey] === 'number' ? r[kpiKey] : 0,
  }));
}

type ChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown; name?: string; value?: unknown; dataKey?: unknown }>;
};

function TooltipShell({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[240px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-lg dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50">
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

function FlujoTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { bucketEnd?: string } | undefined;
  if (!row?.bucketEnd) return null;
  const items = payload.filter((p) => p.name != null && typeof p.value === 'number');
  return (
    <TooltipShell>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de corte</div>
      <div className="text-sm font-semibold leading-tight">{formatCierreLabel(row.bucketEnd)}</div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Flujo (MXN)</div>
      <ul className="mt-1 space-y-1 text-xs">
        {items.map((p) => (
          <li key={String(p.dataKey)} className="flex justify-between gap-3 tabular-nums">
            <span className="text-zinc-600 dark:text-zinc-300">{p.name}</span>
            <span>{formatMXN(p.value as number)}</span>
          </li>
        ))}
      </ul>
    </TooltipShell>
  );
}

function InventarioTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { bucketEnd?: string } | undefined;
  if (!row?.bucketEnd) return null;
  const items = payload.filter((p) => p.name != null && typeof p.value === 'number');
  return (
    <TooltipShell>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de corte</div>
      <div className="text-sm font-semibold leading-tight">{formatCierreLabel(row.bucketEnd)}</div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Inventario (MXN)</div>
      <ul className="mt-1 space-y-1 text-xs">
        {items.map((p) => (
          <li key={String(p.dataKey)} className="flex justify-between gap-3 tabular-nums">
            <span className="text-zinc-600 dark:text-zinc-300">{p.name}</span>
            <span>{formatMXN(p.value as number)}</span>
          </li>
        ))}
      </ul>
    </TooltipShell>
  );
}

type PieTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string;
    value?: number;
    payload?: { name?: string; value?: number; pct?: number; fill?: string };
  }>;
};

function CxpPieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0]!;
  const name = (item.payload?.name ?? item.name) as string;
  const value = (typeof item.value === 'number' ? item.value : item.payload?.value) as number;
  const pct = item.payload?.pct;
  return (
    <TooltipShell>
      <div className="text-sm font-semibold leading-tight">{name}</div>
      <div className="mt-1 text-sm font-medium tabular-nums">{formatMXN(value)}</div>
      {pct != null && Number.isFinite(pct) ? (
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {formatPct(pct)} del total CXP
        </div>
      ) : null}
    </TooltipShell>
  );
}

function BancosTooltip({ active, payload }: ChartTooltipProps) {
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
    <TooltipShell>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de corte</div>
      <div className="text-sm font-semibold leading-tight">{formatCierreLabel(row.bucketEnd)}</div>
      <ul className="mt-2 space-y-1 text-xs">
        {payload
          .filter((p) => p.name && typeof p.value === 'number')
          .map((p) => (
            <li key={String(p.dataKey)} className="flex justify-between gap-3 tabular-nums">
              <span className="text-zinc-600 dark:text-zinc-300">{p.name}</span>
              <span>{formatMXN(p.value as number)}</span>
            </li>
          ))}
      </ul>
      <div className="mt-2 border-t border-zinc-200 pt-2 text-xs font-semibold tabular-nums dark:border-zinc-700">
        Total bancos: {formatMXN(row.total)}
      </div>
    </TooltipShell>
  );
}

export function ExecutiveClient({
  meta,
  view,
  dailyFlujo,
  dailyKpisSeries,
  asOfDay,
}: {
  meta: JsonMeta;
  view: ExecutiveViewModel;
  dailyFlujo: FlujoDailyComparativoBundle;
  dailyKpisSeries: DailyKpiPoint[];
  asOfDay: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ExecutiveMode>('ytd');
  const [mounted, setMounted] = useState(false);
  const [rangePreset, setRangePreset] = useState<ChartRangePreset>('year_natural');
  const [granularity, setGranularity] = useState<ChartGranularity>('auto');
  const [customRange, setCustomRange] = useState<ChartCustomDateRange>({ start: '', end: '' });
  const [facturacionVista, setFacturacionVista] = useState<'mes_vs_mes' | 'ytd_anios'>('ytd_anios');

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
    const pie = rows.map((r, i) => ({ ...r, fill: PIE_FILLS[i % PIE_FILLS.length] }));
    return { total, rows, pie };
  }, [lastBucket]);

  const periodHint = `${rangePresetShortLabel(rangePreset, rangePreset === 'custom_range' ? customRange : null)} · corte máx. ${asOfDay}`;

  const monthlyFact = useMemo(
    () => aggregateFacturacionPorMesCalendario(dailyKpisSeries, asOfDay, 'amadeus'),
    [dailyKpisSeries, asOfDay],
  );
  const mesVsPair = useMemo(
    () => mesActualVsMesAnteriorCalendario(monthlyFact, asOfDay),
    [monthlyFact, asOfDay],
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
    () => ytdComparativaAnioVsAnioAnterior(monthlyFact, asOfDay),
    [monthlyFact, asOfDay],
  );
  const ytdYears = useMemo(() => {
    const y = parseISO(asOfDay).getFullYear();
    return { actual: String(y), anterior: String(y - 1) };
  }, [asOfDay]);

  const ytdFactSnapshot = useMemo(() => {
    const s = ytdFactSeries;
    if (!s.length) return null;
    return s[s.length - 1] ?? null;
  }, [ytdFactSeries]);

  const mesCorteNombre = useMemo(() => format(parseISO(asOfDay), 'MMMM', { locale: es }), [asOfDay]);

  const onExportPdf = () => {
    window.print();
  };

  const showChartBrush = chartRows.length > 6;
  const chartPlotHeight = showChartBrush ? 292 : 248;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {mode === 'last_month' ? 'Último mes' : 'YTD'} · Cierre: {cierreLabel}
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

      {ytdFactSnapshot ? (
        <div className="mb-4 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-950/35">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200/95">
            Facturación Amadeus · YTD {ytdYears.actual} (ene → {mesCorteNombre})
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-white">
              {formatMXN(ytdFactSnapshot.ytdAnioActual)}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Mismo lapso {ytdYears.anterior}:{' '}
              <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                {formatMXN(ytdFactSnapshot.ytdAnioAnterior)}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-500">
            Suma de los totales mensuales (último MTD de cada mes). Detalle en el panel inferior.
          </p>
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
          facturacionYtd={
            ytdFactSnapshot
              ? {
                  ytdActual: ytdFactSnapshot.ytdAnioActual,
                  ytdAnterior: ytdFactSnapshot.ytdAnioAnterior,
                  yearActual: ytdYears.actual,
                  yearAnterior: ytdYears.anterior,
                }
              : undefined
          }
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
          const deltaPct = pickYoY(yoy, key)?.delta_pct ?? null;
          const sparkline = buildSparkFromChartRows(chartRows, key);
          return (
            <ExecKPICard
              key={key}
              title={title}
              kpiKey={key}
              value={value}
              deltaPct={deltaPct}
              sparkline={sparkline}
              href={`/?kpi=${key}`}
              showChart={mounted}
            />
          );
        })}
      </div>

      <div className="dashboard-panel mt-4 rounded-xl border border-border bg-background p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Facturación Amadeus (acumulada por mes)</div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Solo <span className="font-medium">Amadeus</span> (fact. día/mes MTD): por mes
              se usa el último corte (MTD). El YTD del gráfico suma esos meses de enero al mes de corte (como tu reporte
              anual por mes). Sadama no se incluye aquí. Corte de datos:{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {format(parseISO(asOfDay), "d 'de' MMMM yyyy", { locale: es })}
              </span>
              .
            </p>
            {ytdFactSnapshot ? (
              <p className="mt-2 text-sm tabular-nums text-zinc-800 dark:text-zinc-100">
                YTD {ytdYears.actual}: <span className="font-semibold">{formatMXN(ytdFactSnapshot.ytdAnioActual)}</span>
                {' · '}
                <span className="font-normal text-zinc-500 dark:text-zinc-400">
                  {ytdYears.anterior}: {formatMXN(ytdFactSnapshot.ytdAnioAnterior)}
                </span>
              </p>
            ) : null}
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
                        name="Fact. Amadeus (MXN)"
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
                <LineChart data={ytdFactSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" tick={axisTick} />
                  <YAxis
                    width={56}
                    tick={axisTick}
                    tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload as
                        | { label: string; ytdAnioActual: number; ytdAnioAnterior: number }
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
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="dashboard-panel rounded-xl border border-border bg-background p-4">
          <div className="mb-2 text-sm font-semibold">Flujo (MXN) por fecha · Sadama, Amadeus y total</div>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Tres series consolidadas. Eje inferior: fecha de corte (dd/mm/aaaa). Pasa el mouse o usa la banda gris para acercar el rango.
          </p>
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
          <div className="mb-2 text-sm font-semibold">Bancos (MXN) por cuenta y fecha</div>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Misma escala de fechas que arriba; tooltip con desglose y total por día o periodo.
          </p>
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
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Áreas apiladas; montos en MXN al tipo de cambio del día.</div>
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
          <div className="mb-2 text-sm font-semibold">CXP por proveedor (último corte del período)</div>
          {lastBucket ? (
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              Total CXP al corte{' '}
              <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">{formatMXN(cxpVista.total)}</span>{' '}
              · participación por proveedor en % sobre ese total.
            </p>
          ) : null}
          <div className="chart-root h-[240px] w-full text-foreground">
            {mounted && cxpVista.pie.some((s) => s.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CxpPieTooltip />} />
                  <Legend
                    formatter={(value, entry) => {
                      const p = entry.payload as { pct?: number; name?: string } | undefined;
                      if (p?.pct != null && Number.isFinite(p.pct)) return `${value} (${formatPct(p.pct)})`;
                      return String(value);
                    }}
                  />
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
          {lastBucket ? (
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Basado en fecha {lastBucket.bucketEnd}.</div>
          ) : null}
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
          <div className="mb-2 text-sm font-semibold">Inventario (MXN) por fecha · Sadama, Amadeus y total</div>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Tres series (mismo criterio de color que flujo: Sadama / Amadeus / total). Eje: dd/mm/aaaa.
          </p>
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

      <AlertsBanner yoy={yoy} className="mt-4" />

      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={() => router.push('/')} title="Ir al dashboard completo">
          Ir al dashboard completo
        </Button>
      </div>
    </div>
  );
}
