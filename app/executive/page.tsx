import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { loadExecutive } from '@/lib/executive';
import { ExecutiveClient } from './ui/ExecutiveClient';

export default async function ExecutivePage() {
  const data = await loadExecutive();
  const cierre = data.executive.last_month.fecha_cierre;
  const cierreLabel = cierre ? format(parseISO(cierre), "d 'de' MMMM yyyy", { locale: es }) : '—';

  return (
    <main className="min-h-dvh">
      <div className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Dashboard Ejecutivo</div>
            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">Cierre: {cierreLabel}</div>
          </div>
        </div>
      </div>

      <ExecutiveClient data={data} />
    </main>
  );
}

