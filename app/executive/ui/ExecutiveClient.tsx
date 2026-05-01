'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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

import type { ExecutiveData, MonthlyAggregate, YoYDelta } from '@/lib/executive';
import { formatMXN } from '@/lib/format';
import { Button } from '@/components/ui/button';
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

function getKpiValue(agg: { kpis: Record<string, unknown> } | null | undefined, kpiKey: string) {
  const v = agg?.kpis?.[kpiKey];
  return typeof v === 'number' ? v : null;
}

function pickYoY(yoy: Record<string, YoYDelta> | null | undefined, kpiKey: string) {
  const d = yoy?.[kpiKey];
  return d && typeof d === 'object' ? d : null;
}

function monthLabel(yyyymm: string) {
  // yyyymm: YYYY-MM
  const [y, m] = yyyymm.split('-');
  const iso = `${y}-${m}-01`;
  return format(parseISO(iso), 'MMM yy', { locale: es });
}

function buildSpark(series12m: MonthlyAggregate[], kpiKey: string) {
  return series12m.map((m) => ({
    x: m.yyyymm,
    y: typeof m[kpiKey] === 'number' ? (m[kpiKey] as number) : 0,
  }));
}

export function ExecutiveClient({ data }: { data: ExecutiveData }) {
  const router = useRouter();
  const [mode, setMode] = useState<ExecutiveMode>('last_month');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const source = mode === 'last_month' ? data.executive.last_month : data.executive.ytd.comparativo;
  const yoy = source.yoy;
  const kpis = source.kpis;

  const flujoActual = typeof (kpis as any).flujo_total === 'number' ? ((kpis as any).flujo_total as number) : 0;
  const flujoYoY = pickYoY(yoy, 'flujo_total');

  const cierreLabel = useMemo(() => {
    const iso = mode === 'last_month' ? data.executive.last_month.fecha_cierre : data.executive.ytd.fecha_corte;
    if (!iso) return '—';
    return format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es });
  }, [data.executive.last_month.fecha_cierre, data.executive.ytd.fecha_corte, mode]);

  const ageBanner = useMemo(() => {
    const gen = data.meta.generated;
    if (!gen) return null;
    const t = Date.parse(gen);
    if (!Number.isFinite(t)) return null;
    const hours = (Date.now() - t) / (1000 * 60 * 60);
    if (hours <= 24) return null;
    return `Datos con más de 24h (generado: ${format(parseISO(gen), "d 'de' MMMM yyyy HH:mm", { locale: es })}).`;
  }, [data.meta.generated]);

  const series12m = data.executive.series_12m ?? [];
  const flujo12m = useMemo(
    () =>
      series12m.map((m) => ({
        name: monthLabel(m.yyyymm),
        flujo: typeof m.flujo_total === 'number' ? m.flujo_total : 0,
      })),
    [series12m],
  );

  const bancosByAccount12m = useMemo(() => {
    // Si el JSON trae bancos por cuenta dentro de kpis, lo usamos. Si no, mostramos bancos_total.
    return series12m.map((m) => {
      const bajio_mxn = typeof m.bajio_mxn === 'number' ? m.bajio_mxn : null;
      const hsbc = typeof m.hsbc === 'number' ? m.hsbc : null;
      const bajio_usd_mxn = typeof m.bajio_usd_mxn === 'number' ? m.bajio_usd_mxn : null;
      const total = typeof m.bancos_total === 'number' ? m.bancos_total : 0;
      return {
        name: monthLabel(m.yyyymm),
        bajio_mxn: bajio_mxn ?? 0,
        hsbc: hsbc ?? 0,
        bajio_usd_mxn: bajio_usd_mxn ?? 0,
        total,
      };
    });
  }, [series12m]);

  const cxpDonut = useMemo(() => {
    const k = kpis as Record<string, unknown>;
    const parts = [
      { name: 'Sandvik', value: typeof k.cxp_sandvik === 'number' ? (k.cxp_sandvik as number) : 0 },
      { name: 'Vargus', value: typeof k.cxp_vargus === 'number' ? (k.cxp_vargus as number) : 0 },
      { name: 'Mexicana', value: typeof k.cxp_mexicana === 'number' ? (k.cxp_mexicana as number) : 0 },
      { name: 'Otros', value: typeof k.cxp_otros === 'number' ? (k.cxp_otros as number) : 0 },
    ];
    const sum = parts.reduce((a, b) => a + b.value, 0);
    const total = typeof k.cxp_total === 'number' ? (k.cxp_total as number) : 0;
    return sum > 0 ? parts : [{ name: 'CXP total', value: total }];
  }, [kpis]);

  const ytdBars = useMemo(() => {
    const y = data.executive.ytd;
    const c = y.comparativo;
    const flow = c.yoy?.flujo_total;
    return [
      {
        name: String(y.previous_year),
        flujo: flow?.anterior ?? 0,
      },
      {
        name: String(y.current_year),
        flujo: flow?.actual ?? 0,
      },
    ];
  }, [data.executive.ytd]);

  const onExportPdf = () => {
    // Simple y barato: usar el diálogo de impresión del navegador.
    // El usuario puede “Guardar como PDF”.
    window.print();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {mode === 'last_month' ? 'Último mes' : 'YTD'} · Corte: {cierreLabel}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExecutiveSwitch mode={mode} onChange={setMode} />
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={onExportPdf} title="Exportar pantalla a PDF">
            PDF
          </Button>
        </div>
      </div>

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
        className="h-[140px]"
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {KPI_ORDER.map(({ key, title }) => {
          const v = (kpis as Record<string, unknown>)[key];
          const value = typeof v === 'number' ? v : null;
          const deltaPct = pickYoY(yoy, key)?.delta_pct ?? null;
          const sparkline = buildSpark(series12m, key);
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
          <div className="mb-2 text-sm font-semibold">Flujo total (12 meses)</div>
          <div className="h-[220px]">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={flujo12m}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => (typeof v === 'number' ? `${Math.round(v / 1000)}k` : String(v))}
                  />
                  <Tooltip formatter={(v) => (typeof v === 'number' ? formatMXN(v) : String(v))} />
                  <Line type="monotone" dataKey="flujo" stroke="currentColor" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-md bg-zinc-100 dark:bg-zinc-900" />
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <div className="mb-2 text-sm font-semibold">Bancos (12 meses)</div>
          <div className="h-[220px]">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bancosByAccount12m}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => (typeof v === 'number' ? `${Math.round(v / 1000)}k` : String(v))}
                  />
                  <Tooltip formatter={(v) => (typeof v === 'number' ? formatMXN(v) : String(v))} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="currentColor"
                    fill="currentColor"
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-md bg-zinc-100 dark:bg-zinc-900" />
            )}
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Nota: si el JSON trae cuentas por separado, las mostramos; si no, usamos bancos total.
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <div className="mb-2 text-sm font-semibold">CXP por proveedor (donut)</div>
          <div className="h-[220px]">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(v) => (typeof v === 'number' ? formatMXN(v) : String(v))} />
                  <Legend />
                  <Pie data={cxpDonut} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-md bg-zinc-100 dark:bg-zinc-900" />
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <div className="mb-2 text-sm font-semibold">YTD vs YTD anterior (flujo)</div>
          <div className="h-[220px]">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ytdBars}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => (typeof v === 'number' ? `${Math.round(v / 1000)}k` : String(v))}
                  />
                  <Tooltip formatter={(v) => (typeof v === 'number' ? formatMXN(v) : String(v))} />
                  <Bar dataKey="flujo" fill="currentColor" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-md bg-zinc-100 dark:bg-zinc-900" />
            )}
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Este bloque se amplía a más KPIs en el dashboard principal.
          </div>
        </div>
      </div>

      <AlertsBanner yoy={yoy} className="mt-4" />

      <div className="mt-4 flex justify-end">
        <Button
          variant="outline"
          onClick={() => router.push('/')}
          title="Ir al dashboard completo"
        >
          Ir al dashboard completo
        </Button>
      </div>
    </div>
  );
}

