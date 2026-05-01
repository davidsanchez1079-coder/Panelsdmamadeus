'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import type { FlujoDailyComparativo } from '@/lib/dailyFlujoComparativo';
import type { DailyKpiPoint } from '@/lib/dailyKpisFromRow';
import { formatChartDayNumeric, formatCierreLabel } from '@/lib/dateDisplay';
import {
  buildFilteredChartSeries,
  rangePresetShortLabel,
  type ChartGranularity,
  type ChartRangePreset,
  type ChartRow,
} from '@/lib/chartSeriesFilters';
import { cxpDonutFromDailyPoint } from '@/lib/cxpDonutFromDaily';
import {
  Area,
  AreaChart,
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
import { formatMXN, formatMXNAxis } from '@/lib/format';
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
  const row = payload[0]?.payload as { bucketEnd?: string; flujo?: number } | undefined;
  if (!row?.bucketEnd) return null;
  return (
    <TooltipShell>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de corte</div>
      <div className="text-sm font-semibold leading-tight">{formatCierreLabel(row.bucketEnd)}</div>
      <div className="mt-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Flujo total (MXN)</div>
      <div className="text-sm font-semibold tabular-nums">{formatMXN(row.flujo)}</div>
    </TooltipShell>
  );
}

function InventarioTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { bucketEnd?: string; inventario?: number } | undefined;
  if (!row?.bucketEnd) return null;
  return (
    <TooltipShell>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de corte</div>
      <div className="text-sm font-semibold leading-tight">{formatCierreLabel(row.bucketEnd)}</div>
      <div className="mt-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Inventario (MXN)</div>
      <div className="text-sm font-semibold tabular-nums">{formatMXN(row.inventario)}</div>
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
  dailyComparativo,
  dailyKpisSeries,
  asOfDay,
}: {
  meta: JsonMeta;
  view: ExecutiveViewModel;
  dailyComparativo: FlujoDailyComparativo | null;
  dailyKpisSeries: DailyKpiPoint[];
  asOfDay: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ExecutiveMode>('ytd');
  const [mounted, setMounted] = useState(false);
  const [rangePreset, setRangePreset] = useState<ChartRangePreset>('year_natural');
  const [granularity, setGranularity] = useState<ChartGranularity>('auto');

  useEffect(() => {
    setMounted(true);
  }, []);

  const source = mode === 'last_month' ? view.lastMonth : view.ytd.comparativo;
  const yoy = source.yoy;
  const kpis = source.kpis;

  const flujoActual = typeof (kpis as Record<string, unknown>).flujo_total === 'number' ? (kpis as Record<string, number>).flujo_total : 0;
  const flujoYoY = pickYoY(yoy, 'flujo_total');

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
    () => buildFilteredChartSeries(dailyKpisSeries, asOfDay, rangePreset, granularity),
    [dailyKpisSeries, asOfDay, rangePreset, granularity],
  );

  const lastBucket = chartRows[chartRows.length - 1];

  const flujoChart = useMemo(
    () => chartRows.map((r) => ({ ...r, name: r.label, flujo: r.flujo_total })),
    [chartRows],
  );

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

  const inventarioChart = useMemo(
    () => chartRows.map((r) => ({ name: r.label, bucketEnd: r.bucketEnd, inventario: r.inventario_total })),
    [chartRows],
  );

  const cxpDonut = useMemo(() => {
    const base = cxpDonutFromDailyPoint(lastBucket);
    return base.map((d, i) => ({ ...d, fill: PIE_FILLS[i % PIE_FILLS.length] }));
  }, [lastBucket]);

  const periodHint = `${rangePresetShortLabel(rangePreset)} · corte máx. ${asOfDay}`;

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

      <HeroFlujoBanner
        actual={flujoActual}
        anterior={flujoYoY?.anterior ?? null}
        delta={flujoYoY?.delta ?? null}
        yoyDeltaPct={flujoYoY?.delta_pct ?? null}
        daily={dailyComparativo}
        className="min-h-[140px]"
      />

      <DashboardChartFilters
        className="mt-4"
        rangePreset={rangePreset}
        granularity={granularity}
        onRangeChange={setRangePreset}
        onGranularityChange={setGranularity}
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

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="dashboard-panel rounded-xl border border-border bg-background p-4">
          <div className="mb-2 text-sm font-semibold">Flujo total (MXN) por fecha</div>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Eje inferior: fecha de corte (dd/mm/aaaa). Pasa el mouse por un punto o usa la banda gris para acercar el rango.
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
                  <Line
                    type="monotone"
                    dataKey="flujo"
                    stroke="var(--chart-line-flujo)"
                    strokeWidth={2}
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
              { key: 'flujo', label: 'Flujo (MXN)', align: 'right' },
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
          <div className="chart-root h-[240px] w-full text-foreground">
            {mounted && cxpDonut.some((s) => s.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(v) => (typeof v === 'number' ? formatMXN(v) : String(v))} />
                  <Legend />
                  <Pie
                    data={cxpDonut}
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
        </div>

        <div className="dashboard-panel rounded-xl border border-border bg-background p-4">
          <div className="mb-2 text-sm font-semibold">Inventario total (MXN) por fecha</div>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Fechas en formato dd/mm/aaaa; revisa la tabla para el par fecha–monto exacto.
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
                  <Line
                    type="monotone"
                    dataKey="inventario"
                    stroke="var(--chart-line-inventario)"
                    strokeWidth={2}
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
            caption="Inventario total por fecha de corte (más reciente arriba)."
            columns={[
              { key: 'bucketEnd', label: 'Fecha' },
              { key: 'inventario', label: 'Inventario (MXN)', align: 'right' },
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
