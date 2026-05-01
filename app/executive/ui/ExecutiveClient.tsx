'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import type { FlujoDailyComparativo } from '@/lib/dailyFlujoComparativo';
import type { DailyKpiPoint } from '@/lib/dailyKpisFromRow';
import { formatCierreLabel } from '@/lib/dateDisplay';
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
  const [mode, setMode] = useState<ExecutiveMode>('last_month');
  const [mounted, setMounted] = useState(false);
  const [rangePreset, setRangePreset] = useState<ChartRangePreset>('last_12_months');
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

  const cxpDonut = useMemo(() => cxpDonutFromDailyPoint(lastBucket), [lastBucket]);

  const periodHint = `${rangePresetShortLabel(rangePreset)} · corte máx. ${asOfDay}`;

  const onExportPdf = () => {
    window.print();
  };

  const xAxisAngle = chartRows.length > 8 ? -32 : 0;

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
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
          {view.dataNote}
        </div>
      ) : null}

      {ageBanner ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
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
        <div className="rounded-xl border bg-background p-4">
          <div className="mb-2 text-sm font-semibold">Flujo total (MXN) por fecha</div>
          <div className="h-[240px]">
            {mounted && flujoChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={flujoChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    angle={xAxisAngle}
                    textAnchor={xAxisAngle ? 'end' : 'middle'}
                    height={xAxisAngle ? 56 : 28}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))} />
                  <Tooltip
                    formatter={(v) => (typeof v === 'number' ? formatMXN(v) : String(v))}
                    labelFormatter={(_, items) => {
                      const p = items?.[0]?.payload as { bucketEnd?: string } | undefined;
                      return p?.bucketEnd ? `Corte ${p.bucketEnd}` : String(_);
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="flujo"
                    stroke="currentColor"
                    strokeWidth={2}
                    dot={flujoChart.length <= 4}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sin datos en este alcance</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <div className="mb-2 text-sm font-semibold">Bancos (MXN) por cuenta y fecha</div>
          <div className="h-[240px]">
            {mounted && bancosChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bancosChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    angle={xAxisAngle}
                    textAnchor={xAxisAngle ? 'end' : 'middle'}
                    height={xAxisAngle ? 56 : 28}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))} />
                  <Tooltip
                    formatter={(v) => (typeof v === 'number' ? formatMXN(v) : String(v))}
                    labelFormatter={(_, items) => {
                      const p = items?.[0]?.payload as { bucketEnd?: string } | undefined;
                      return p?.bucketEnd ? `Corte ${p.bucketEnd}` : String(_);
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" stackId="b" dataKey="bajio_mxn" name="Bajío MXN" fill="#71717a" stroke="#3f3f46" fillOpacity={0.35} />
                  <Area type="monotone" stackId="b" dataKey="hsbc" name="HSBC" fill="#a1a1aa" stroke="#52525b" fillOpacity={0.35} />
                  <Area
                    type="monotone"
                    stackId="b"
                    dataKey="bajio_usd_mxn"
                    name="Bajío USD (MXN)"
                    fill="#d4d4d8"
                    stroke="#71717a"
                    fillOpacity={0.45}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sin datos en este alcance</div>
            )}
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Áreas apiladas; montos en MXN al tipo de cambio del día.</div>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <div className="mb-2 text-sm font-semibold">CXP por proveedor (último corte del período)</div>
          <div className="h-[240px]">
            {mounted && cxpDonut.some((s) => s.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(v) => (typeof v === 'number' ? formatMXN(v) : String(v))} />
                  <Legend />
                  <Pie data={cxpDonut} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} />
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

        <div className="rounded-xl border bg-background p-4">
          <div className="mb-2 text-sm font-semibold">Inventario total (MXN) por fecha</div>
          <div className="h-[240px]">
            {mounted && inventarioChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inventarioChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    angle={xAxisAngle}
                    textAnchor={xAxisAngle ? 'end' : 'middle'}
                    height={xAxisAngle ? 56 : 28}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (typeof v === 'number' ? formatMXNAxis(v) : String(v))} />
                  <Tooltip
                    formatter={(v) => (typeof v === 'number' ? formatMXN(v) : String(v))}
                    labelFormatter={(_, items) => {
                      const p = items?.[0]?.payload as { bucketEnd?: string } | undefined;
                      return p?.bucketEnd ? `Corte ${p.bucketEnd}` : String(_);
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="inventario"
                    stroke="currentColor"
                    strokeWidth={2}
                    dot={inventarioChart.length <= 4}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sin datos en este alcance</div>
            )}
          </div>
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
