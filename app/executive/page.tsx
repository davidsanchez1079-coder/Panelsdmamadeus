import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { loadExecutive } from '@/lib/executive';
import { Button } from '@/components/ui/button';
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {}} disabled title="Exportar a PDF (se habilita en la vista)">
              PDF
            </Button>
          </div>
        </div>
      </div>

      <ExecutiveClient data={data} />
    </main>
  );
}

