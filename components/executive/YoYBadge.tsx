import { cn } from '@/lib/utils';
import { formatPct } from '@/lib/format';
import { getDeltaDirection, getPolarity } from '@/lib/executive';

export function YoYBadge({
  kpiKey,
  deltaPct,
  className,
  title: titleProp,
}: {
  kpiKey: string;
  deltaPct: number | null | undefined;
  className?: string;
  /** Tooltip; si no se pasa, el default depende del contexto. */
  title?: string;
}) {
  const polarity = getPolarity(kpiKey);
  const dir = getDeltaDirection(polarity, deltaPct);

  const styles =
    dir === 'good'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
      : dir === 'bad'
        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300';

  const arrow =
    deltaPct == null || !Number.isFinite(deltaPct) || deltaPct === 0 ? '→' : deltaPct > 0 ? '↑' : '↓';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
        styles,
        className,
      )}
      title={titleProp ?? 'Variación vs inicio del periodo seleccionado'}
    >
      <span aria-hidden="true">{arrow}</span>
      <span>{formatPct(deltaPct)}</span>
    </span>
  );
}

