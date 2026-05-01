import Link from 'next/link';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

import { formatMXN } from '@/lib/format';
import { cn } from '@/lib/utils';
import { YoYBadge } from './YoYBadge';

type SparkPoint = { x: string; y: number };

export function ExecKPICard({
  title,
  kpiKey,
  value,
  deltaPct,
  sparkline,
  href,
}: {
  title: string;
  kpiKey: string;
  value: number | null | undefined;
  deltaPct: number | null | undefined;
  sparkline: SparkPoint[];
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group rounded-xl border bg-background p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

      <div className="mt-3 h-[50px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkline}>
            <Area
              type="monotone"
              dataKey="y"
              stroke="currentColor"
              fill="currentColor"
              className="text-zinc-900/20 dark:text-zinc-100/20"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Click para ver detalle</div>
    </Link>
  );
}

