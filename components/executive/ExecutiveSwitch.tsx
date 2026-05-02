'use client';

import { Button } from '@/components/ui/button';

export type ExecutiveMode = 'last_month' | 'ytd';

export function ExecutiveSwitch({
  mode,
  onChange,
}: {
  mode: ExecutiveMode;
  onChange: (m: ExecutiveMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-background p-1">
      <Button
        type="button"
        size="sm"
        variant={mode === 'last_month' ? 'default' : 'ghost'}
        onClick={() => onChange('last_month')}
        title="Ver último mes"
      >
        Último mes
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === 'ytd' ? 'default' : 'ghost'}
        onClick={() => onChange('ytd')}
        title="Ver acumulado del año (YTD)"
      >
        YTD
      </Button>
    </div>
  );
}

