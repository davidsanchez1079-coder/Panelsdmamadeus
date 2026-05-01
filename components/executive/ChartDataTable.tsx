'use client';

import { formatChartDayNumeric } from '@/lib/dateDisplay';
import { formatMXN } from '@/lib/format';
import { cn } from '@/lib/utils';

export type ChartTableColumn = { key: string; label: string; align?: 'left' | 'right' };

export function ChartDataTable({
  rows,
  columns,
  caption,
  className,
}: {
  rows: Record<string, unknown>[];
  columns: ChartTableColumn[];
  caption?: string;
  className?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className={cn('mt-3', className)}>
      {caption ? <p className="mb-1.5 text-xs text-zinc-500 dark:text-zinc-400">{caption}</p> : null}
      <div className="max-h-40 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-zinc-200/95 dark:bg-gradient-to-r dark:from-slate-800/95 dark:to-zinc-900/95 dark:text-zinc-100">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'border-b border-zinc-200 px-2 py-2 font-semibold dark:border-zinc-800',
                    c.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r, i) => {
              const fecha = typeof r.bucketEnd === 'string' ? r.bucketEnd : `row-${i}`;
              return (
                <tr
                  key={`${fecha}-${i}`}
                  className="border-b border-zinc-200 odd:bg-white even:bg-zinc-100/90 dark:border-zinc-600/35 dark:odd:bg-zinc-950/80 dark:even:bg-slate-900/40"
                >
                  {columns.map((c) => {
                    const raw = r[c.key];
                    let cell: string;
                    if (c.key === 'bucketEnd' && typeof raw === 'string') {
                      cell = formatChartDayNumeric(raw);
                    } else if (typeof raw === 'number') {
                      cell = formatMXN(raw);
                    } else {
                      cell = '—';
                    }
                    return (
                      <td
                        key={c.key}
                        className={cn(
                          'px-2 py-1.5 tabular-nums',
                          c.align === 'right' ? 'text-right' : 'text-left',
                        )}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
