'use client';

import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatChartDayNumeric } from '@/lib/dateDisplay';
import { formatMXN } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ChartStructureInfoButton } from './ChartStructureInfoButton';
import { YoYBadge } from './YoYBadge';

export type SparkTriplePoint = { x: string; sadama: number; amadeus: number; total: number };

const SPARK_THEME: Record<string, { totalStroke: string }> = {
  bancos_total: { totalStroke: 'var(--chart-spark-bancos-stroke)' },
  inventario_total: { totalStroke: 'var(--chart-spark-inventario-stroke)' },
  cxc_total: { totalStroke: 'var(--chart-spark-cxc-stroke)' },
  cxp_total: { totalStroke: 'var(--chart-spark-cxp-stroke)' },
};

const STROKE_SADAMA = 'var(--chart-line-flujo-sadama)';
const STROKE_AMADEUS = 'var(--chart-line-flujo-amadeus)';

type SparkTipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string;
    value?: unknown;
    dataKey?: unknown;
    payload?: SparkTriplePoint;
  }>;
};

function SparkTooltip({ active, payload }: SparkTipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as SparkTriplePoint | undefined;
  if (!row?.x) return null;
  const items = payload.filter((p) => p.name != null && typeof p.value === 'number');
  return (
    <div className="pointer-events-none z-50 max-w-[200px] rounded-md border border-zinc-400 bg-zinc-50 px-2 py-1.5 text-left shadow-lg dark:border-zinc-500 dark:bg-zinc-900">
      <div className="text-[10px] font-semibold text-zinc-900 dark:text-zinc-50">{formatChartDayNumeric(row.x)}</div>
      <ul className="mt-1 space-y-0.5">
        {items.map((p) => (
          <li key={String(p.dataKey)} className="flex justify-between gap-3 text-[11px] tabular-nums text-zinc-800 dark:text-zinc-200">
            <span>{p.name}</span>
            <span>{formatMXN(p.value as number)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Y_AXIS_AUTO: [string, string] = ['auto', 'auto'];

function ExecKPISparklines({
  showChart,
  sparkTriple,
  sparkStyle,
}: {
  showChart: boolean;
  sparkTriple: SparkTriplePoint[];
  sparkStyle: { totalStroke: string };
}) {
  if (!showChart) {
    return <div className="h-full w-full rounded-md bg-zinc-100 dark:bg-zinc-900" />;
  }
  if (sparkTriple.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-md bg-zinc-100 text-[10px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        Sin puntos en el filtro
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={sparkTriple} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
        <XAxis dataKey="x" type="category" hide />
        <YAxis hide domain={Y_AXIS_AUTO} />
        <Tooltip content={<SparkTooltip />} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} />
        <Legend
          verticalAlign="bottom"
          height={22}
          iconType="line"
          wrapperStyle={{ fontSize: 9, paddingTop: 2 }}
          formatter={(value) => <span className="text-zinc-600 dark:text-zinc-400">{value}</span>}
        />
        <Line
          type="monotone"
          dataKey="sadama"
          name="Sadama"
          stroke={STROKE_SADAMA}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="amadeus"
          name="Amadeus"
          stroke={STROKE_AMADEUS}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="total"
          name="Total"
          stroke={sparkStyle.totalStroke}
          strokeWidth={2.25}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ExecKPICard({
  title,
  kpiKey,
  value,
  deltaPct,
  sparkTriple,
  showChart = true,
}: {
  title: string;
  kpiKey: string;
  value: number | null | undefined;
  deltaPct: number | null | undefined;
  sparkTriple: SparkTriplePoint[];
  showChart?: boolean;
}) {
  const first = sparkTriple[0];
  const last = sparkTriple[sparkTriple.length - 1];
  const rangeLabel =
    first && last
      ? first.x === last.x
        ? formatChartDayNumeric(first.x)
        : `${formatChartDayNumeric(first.x)} → ${formatChartDayNumeric(last.x)}`
      : null;

  const sparkStyle = SPARK_THEME[kpiKey] ?? { totalStroke: 'var(--chart-line-flujo)' };

  const allY = sparkTriple.flatMap((p) => [p.sadama, p.amadeus, p.total]);
  const minY = allY.length ? Math.min(...allY) : 0;
  const maxY = allY.length ? Math.max(...allY) : 0;
  const scaleHint =
    sparkTriple.length > 1 && Number.isFinite(minY) && Number.isFinite(maxY) && minY !== maxY ? (
      <div className="flex justify-between gap-1 text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
        <span>mín. {formatMXN(minY)}</span>
        <span>máx. {formatMXN(maxY)}</span>
      </div>
    ) : null;

  return (
    <div
      className={cn(
        'dashboard-panel group rounded-xl border border-border bg-background p-4 dark:shadow-none',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">{title}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{value == null ? '—' : formatMXN(value)}</div>
        </div>
        <YoYBadge kpiKey={kpiKey} deltaPct={deltaPct} className="shrink-0" />
      </div>

      <div className="chart-root mt-2 h-[88px] w-full min-w-0 text-foreground">
        <ExecKPISparklines showChart={showChart} sparkTriple={sparkTriple} sparkStyle={sparkStyle} />
      </div>

      {rangeLabel ? (
        <div className="mt-1.5 truncate text-center text-[10px] text-zinc-500 dark:text-zinc-400" title={rangeLabel}>
          Fechas en gráfica: {rangeLabel}
        </div>
      ) : null}
      {scaleHint}

      <ChartStructureInfoButton panelTitle="Estructura de esta mini gráfica" className="mt-2 w-full">
        <p>
          Tres líneas: Sadama, Amadeus y total. Pasa el cursor para ver montos. Para ver la serie completa con más detalle usa el icono de ampliar en las
          gráficas principales más abajo.
        </p>
      </ChartStructureInfoButton>
    </div>
  );
}
