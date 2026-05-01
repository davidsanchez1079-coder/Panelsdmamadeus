import type { FlujoDailyComparativo } from '@/lib/dailyFlujoComparativo';
import { formatShortFecha } from '@/lib/dateDisplay';
import { getDeltaDirection, getPolarity, getSemaforo } from '@/lib/executive';
import { formatMXN, formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { YoYBadge } from './YoYBadge';

const FLOJO_POLARITY = getPolarity('flujo_total');

function signedMxn(n: number | null) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return 'sin cambio';
  const core = formatMXN(Math.abs(n));
  if (n > 0) return `+${core}`;
  return formatMXN(n);
}

export function HeroFlujoBanner({
  actual,
  yoyDeltaPct,
  anterior,
  delta,
  daily,
  className,
}: {
  actual: number;
  anterior: number | null | undefined;
  delta: number | null | undefined;
  yoyDeltaPct: number | null | undefined;
  daily: FlujoDailyComparativo | null;
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

  const displayFlujo = daily ? daily.last.flujo : actual;
  const vsMonthStartDelta =
    daily && daily.monthStart.fecha !== daily.last.fecha ? daily.last.flujo - daily.monthStart.flujo : null;
  const vsMonthStartPct =
    vsMonthStartDelta != null && daily && daily.monthStart.flujo !== 0
      ? (vsMonthStartDelta / daily.monthStart.flujo) * 100
      : null;

  return (
    <section className={cn('rounded-xl border p-5', bg, className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Flujo total
            {daily ? (
              <span className="text-zinc-500 dark:text-zinc-400">
                {' '}
                · último registro {formatShortFecha(daily.last.fecha)}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatMXN(displayFlujo)}</div>

          {daily ? (
            <div className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-zinc-500 dark:text-zinc-400">Primer registro del mes en curso</span>
                <span className="tabular-nums font-medium">{formatShortFecha(daily.monthStart.fecha)}</span>
                <span className="tabular-nums">{formatMXN(daily.monthStart.flujo)}</span>
                {vsMonthStartDelta != null ? (
                  <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                    (Δ último vs este punto: {signedMxn(vsMonthStartDelta)}
                    {vsMonthStartPct != null ? <> · {formatPct(vsMonthStartPct)}</> : null})
                  </span>
                ) : null}
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Últimos 5 registros <span className="font-normal">(vs dato anterior en la serie)</span>
                </div>
                <ul className="mt-2 space-y-2">
                  {daily.lastFive.map((p) => {
                    const dir =
                      p.delta == null || p.delta === 0
                        ? 'neutral'
                        : p.deltaPct != null
                          ? getDeltaDirection(FLOJO_POLARITY, p.deltaPct)
                          : p.delta > 0
                            ? getDeltaDirection(FLOJO_POLARITY, 1)
                            : getDeltaDirection(FLOJO_POLARITY, -1);
                    const tone =
                      dir === 'good'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : dir === 'bad'
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-zinc-600 dark:text-zinc-400';
                    return (
                      <li key={p.fecha} className="flex flex-col gap-0.5 border-b border-zinc-100 pb-2 last:border-0 last:pb-0 dark:border-zinc-800">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
                          <span className="font-medium text-zinc-800 dark:text-zinc-100">{formatShortFecha(p.fecha)}</span>
                          <span>{formatMXN(p.flujo)}</span>
                        </div>
                        {p.vsPrevFecha != null && p.delta != null ? (
                          <div className={cn('text-xs tabular-nums', tone)}>
                            vs {formatShortFecha(p.vsPrevFecha)}: {signedMxn(p.delta)}
                            {p.deltaPct != null ? <> · {formatPct(p.deltaPct)}</> : null}
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">Sin registro anterior en la serie</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-200/80 pt-3 text-sm text-zinc-700 dark:border-zinc-700/80 dark:text-zinc-200">
            <span className="text-zinc-500 dark:text-zinc-400">YoY mismo mes</span>
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

