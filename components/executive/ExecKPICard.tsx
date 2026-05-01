'use client';

import Link from 'next/link';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatChartDayNumeric } from '@/lib/dateDisplay';
import { formatMXN } from '@/lib/format';
import { cn } from '@/lib/utils';
import { YoYBadge } from './YoYBadge';

type SparkPoint = { x: string; y: number };

const SPARK_THEME: Record<string, { stroke: string; fill: string }> = {
  bancos_total: { stroke: 'var(--chart-spark-bancos-stroke)', fill: 'var(--chart-spark-bancos-fill)' },
  inventario_total: { stroke: 'var(--chart-spark-inventario-stroke)', fill: 'var(--chart-spark-inventario-fill)' },
  cxc_total: { stroke: 'var(--chart-spark-cxc-stroke)', fill: 'var(--chart-spark-cxc-fill)' },
  cxp_total: { stroke: 'var(--chart-spark-cxp-stroke)', fill: 'var(--chart-spark-cxp-fill)' },
};

type SparkTipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
};

function SparkTooltip({ active, payload }: SparkTipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as SparkPoint | undefined;
  if (!row?.x) return null;
  return (
    <div className="pointer-events-none z-50 rounded-md border border-zinc-400 bg-zinc-50 px-2 py-1.5 text-left shadow-lg dark:border-zinc-500 dark:bg-zinc-900">
      <div className="text-[10px] font-semibold text-zinc-900 dark:text-zinc-50">{formatChartDayNumeric(row.x)}</div>
      <div className="text-[11px] tabular-nums text-zinc-800 dark:text-zinc-200">{formatMXN(row.y)}</div>
    </div>
  );
}

export function ExecKPICard({
  title,
  kpiKey,
  value,
  deltaPct,
  sparkline,
  href,
  showChart = true,
}: {
  title: string;
  kpiKey: string;
  value: number | null | undefined;
  deltaPct: number | null | undefined;
  sparkline: SparkPoint[];
  href: string;
  showChart?: boolean;
}) {
  const first = sparkline[0];
  const last = sparkline[sparkline.length - 1];
  const rangeLabel =
    first && last
      ? first.x === last.x
        ? formatChartDayNumeric(first.x)
        : `${formatChartDayNumeric(first.x)} → ${formatChartDayNumeric(last.x)}`
      : null;

  const sparkStyle = SPARK_THEME[kpiKey] ?? {
    stroke: 'var(--chart-line-flujo)',
    fill: 'var(--chart-spark-fill)',
  };

  const minY = sparkline.length ? Math.min(...sparkline.map((p) => p.y)) : 0;
  const maxY = sparkline.length ? Math.max(...sparkline.map((p) => p.y)) : 0;
  const scaleHint =
    sparkline.length > 1 && Number.isFinite(minY) && Number.isFinite(maxY) && minY !== maxY ? (
      <div className="flex justify-between gap-1 text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
        <span>mín. {formatMXN(minY)}</span>
        <span>máx. {formatMXN(maxY)}</span>
      </div>
    ) : null;

  return (
    <Link
      href={href}
      className={cn(
        'dashboard-panel group rounded-xl border border-border bg-background p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:ring-1 dark:hover:ring-sky-500/25',
      )}
      title={`Ir al dashboard completo: ${title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">{title}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{value == null ? '—' : formatMXN(value)}</div>
        </div>
        <YoYBadge kpiKey={kpiKey} deltaPct={deltaPct} className="shrink-0" />
      </div>

      <div className="chart-root mt-2 h-[72px] w-full min-w-0 text-foreground">
        {showChart && sparkline.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
              <XAxis dataKey="x" type="category" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<SparkTooltip />} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="y"
                stroke={sparkStyle.stroke}
                fill={sparkStyle.fill}
                strokeWidth={2}
                activeDot={{
                  r: 4,
                  fill: sparkStyle.stroke,
                  stroke: 'var(--color-background)',
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : showChart ? (
          <div className="flex h-full items-center justify-center rounded-md bg-zinc-100 text-[10px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            Sin puntos en el filtro
          </div>
        ) : (
          <div className="h-full w-full rounded-md bg-zinc-100 dark:bg-zinc-900" />
        )}
      </div>

      {rangeLabel ? (
        <div className="mt-1.5 truncate text-center text-[10px] text-zinc-500 dark:text-zinc-400" title={rangeLabel}>
          Fechas en gráfica: {rangeLabel}
        </div>
      ) : null}
      {scaleHint}

      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Pasa el cursor sobre la línea para ver fecha y monto · Click para detalle
      </div>
    </Link>
  );
}
