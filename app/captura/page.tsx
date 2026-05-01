import Link from 'next/link';

import { loadPanelV1 } from '@/lib/panelV1';
import { CaptureClient } from './CaptureClient';

export default async function CapturaPage() {
  const v1 = await loadPanelV1();
  const rows = v1.datos.rows as unknown[];

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="border-b border-border bg-background px-4 py-3 dark:border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-sm font-semibold">Captura diaria</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Orden: Sadama (izq.) → Amadeus (der.) → TC al cierre del día de registro
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Inicio
            </Link>
            <Link
              href="/executive"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Dashboard ejecutivo
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <CaptureClient initialRows={rows} />
      </div>
    </main>
  );
}
