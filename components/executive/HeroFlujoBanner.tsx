import { formatMXN } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getSemaforo } from '@/lib/executive';
import { YoYBadge } from './YoYBadge';

export function HeroFlujoBanner({
  actual,
  yoyDeltaPct,
  anterior,
  delta,
  className,
}: {
  actual: number;
  anterior: number | null | undefined;
  delta: number | null | undefined;
  yoyDeltaPct: number | null | undefined;
  className?: string;
}) {
  const sem = getSemaforo(yoyDeltaPct);
  const bg =
    sem === 'pos'
      ? 'bg-emerald-50 dark:bg-emerald-950/40'
      : sem === 'neg'
        ? 'bg-red-50 dark:bg-red-950/40'
        : sem === 'stable'
          ? 'bg-amber-50 dark:bg-amber-950/40'
          : 'bg-zinc-50 dark:bg-zinc-950/40';

  return (
    <section className={cn('rounded-xl border p-5', bg, className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Flujo total</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatMXN(actual)}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            <span className="text-zinc-500 dark:text-zinc-400">vs mismo mes del año anterior</span>
            <span className="tabular-nums">{anterior == null ? '—' : formatMXN(anterior)}</span>
            <span className="tabular-nums">{delta == null ? '—' : formatMXN(delta)}</span>
            <YoYBadge kpiKey="flujo_total" deltaPct={yoyDeltaPct} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium',
              sem === 'pos'
                ? 'border-emerald-200 text-emerald-800 dark:border-emerald-900 dark:text-emerald-200'
                : sem === 'neg'
                  ? 'border-red-200 text-red-800 dark:border-red-900 dark:text-red-200'
                  : sem === 'stable'
                    ? 'border-amber-200 text-amber-900 dark:border-amber-900 dark:text-amber-200'
                    : 'border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300',
            )}
          >
            {sem === 'pos'
              ? 'Mejorando'
              : sem === 'neg'
                ? 'En riesgo'
                : sem === 'stable'
                  ? 'Estable'
                  : 'Sin dato'}
          </span>
        </div>
      </div>
    </section>
  );
}

