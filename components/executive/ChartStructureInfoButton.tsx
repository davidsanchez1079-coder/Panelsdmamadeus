'use client';

import { useId, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ChartStructureInfoButton({
  panelTitle,
  children,
  className,
  buttonLabel = 'Información',
}: {
  panelTitle: string;
  children: ReactNode;
  className?: string;
  buttonLabel?: string;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('inline-flex max-w-full flex-col items-start gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-fit gap-1.5 px-2.5 text-xs font-normal text-zinc-600 dark:text-zinc-300"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-80"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        {buttonLabel}
      </Button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label={panelTitle}
          className="w-full max-w-prose rounded-lg border border-zinc-200 bg-zinc-50/95 p-3 text-xs leading-relaxed text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-200"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
