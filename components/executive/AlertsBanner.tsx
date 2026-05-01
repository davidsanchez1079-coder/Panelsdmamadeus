import { cn } from '@/lib/utils';
import type { YoYDelta } from '@/lib/executive';
import { formatMXN, formatPct } from '@/lib/format';
import { getDeltaDirection, getPolarity } from '@/lib/executive';

type AlertItem = {
  key: string;
  title: string;
  delta: YoYDelta;
};

const KPI_LABELS: Record<string, string> = {
  flujo_total: 'Flujo total',
  flujo_sadama: 'Flujo Sadama',
  flujo_amadeus: 'Flujo Amadeus',
  bancos_total: 'Bancos',
  inventario_total: 'Inventario',
  cxc_total: 'CXC',
  cxp_total: 'CXP',
  tc: 'Tipo de cambio',
};

export function AlertsBanner({
  yoy,
  className,
}: {
  yoy: Record<string, YoYDelta> | null | undefined;
  className?: string;
}) {
  if (!yoy) return null;

  const items: AlertItem[] = Object.entries(yoy)
    .map(([key, delta]) => ({
      key,
      title: KPI_LABELS[key] ?? key,
      delta,
    }))
    .filter((x) => Number.isFinite(x.delta?.delta_pct) && Math.abs(x.delta.delta_pct) >= 5)
    .sort((a, b) => Math.abs(b.delta.delta_pct) - Math.abs(a.delta.delta_pct))
    .slice(0, 4);

  if (items.length === 0) return null;

  return (
    <section className={cn('dashboard-panel rounded-xl border border-border bg-background p-3', className)} aria-label="Alertas">
      <div className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">Alertas</div>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((it) => {
          const polarity = getPolarity(it.key);
          const dir = getDeltaDirection(polarity, it.delta.delta_pct);
          const tone =
            dir === 'bad'
              ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-400/50 dark:bg-red-950/35 dark:text-red-50 dark:shadow-[0_0_20px_-4px_rgba(239,68,68,0.35)]'
              : dir === 'good'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/45 dark:bg-emerald-950/35 dark:text-emerald-50 dark:shadow-[0_0_20px_-4px_rgba(16,185,129,0.3)]'
                : 'border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-sky-500/30 dark:bg-slate-900/40 dark:text-zinc-100';

          return (
            <div key={it.key} className={cn('rounded-lg border p-3', tone)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{it.title}</div>
                  <div className="mt-1 text-xs tabular-nums opacity-90">
                    {formatMXN(it.delta.actual)} · Δ {formatMXN(it.delta.delta)} · {formatPct(it.delta.delta_pct)}
                  </div>
                </div>
                <div className="text-xs font-medium opacity-80">{Math.abs(it.delta.delta_pct) >= 10 ? 'Crítica' : 'Atención'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

