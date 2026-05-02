import Link from 'next/link';
import { format, subDays } from 'date-fns';

import { buildDailyKpisSeries } from '@/lib/buildDailyKpisSeries';
import { buildFlujoDailyComparativoBundle } from '@/lib/dailyFlujoComparativo';
import { formatCierreLabel } from '@/lib/dateDisplay';
import { getExecutiveViewModel } from '@/lib/executive';
import { loadExecutive } from '@/lib/loadExecutive';
import { loadPanelV1 } from '@/lib/panelV1';
import { ExecutiveClient } from './ui/ExecutiveClient';

export const dynamic = 'force-dynamic';

export default async function ExecutivePage() {
  // Regla operativa: el dashboard se muestra “hasta ayer” para evitar cortes del día en curso incompletos.
  const asOf = subDays(new Date(), 1);
  const asOfDay = format(asOf, 'yyyy-MM-dd');
  const [data, v1] = await Promise.all([loadExecutive(), loadPanelV1()]);
  const view = getExecutiveViewModel(data, asOf);
  const dailyFlujo = buildFlujoDailyComparativoBundle(v1.datos.rows, asOf);
  const dailyKpisSeries = buildDailyKpisSeries(v1.datos.rows, asOfDay);
  const cierre = view.lastMonth.fecha_cierre;
  const cierreLabel = formatCierreLabel(cierre, view.lastMonth.yyyymm);

  return (
    <main className="min-h-dvh">
      <div className="border-b border-zinc-200/90 bg-background dark:border-white/[0.07] dark:bg-zinc-950/70 dark:backdrop-blur-md dark:supports-[backdrop-filter]:bg-zinc-950/50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <div className="truncate bg-gradient-to-r from-zinc-900 to-zinc-700 bg-clip-text text-sm font-semibold text-transparent dark:from-sky-200 dark:via-white dark:to-sky-300">
              Dashboard Ejecutivo
            </div>
            <div className="truncate text-xs text-zinc-500 dark:text-sky-200/70">Cierre: {cierreLabel}</div>
          </div>
          <Link
            href="/captura"
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
          >
            Captura diaria
          </Link>
        </div>
      </div>

      <ExecutiveClient
        meta={data.meta}
        view={view}
        dailyFlujo={dailyFlujo}
        dailyKpisSeries={dailyKpisSeries}
        asOfDay={asOfDay}
      />
    </main>
  );
}

