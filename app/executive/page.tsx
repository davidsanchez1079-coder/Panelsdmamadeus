import { format, subDays } from 'date-fns';

import { buildDailyKpisSeries } from '@/lib/buildDailyKpisSeries';
import { buildFlujoDailyComparativo } from '@/lib/dailyFlujoComparativo';
import { formatCierreLabel } from '@/lib/dateDisplay';
import { getExecutiveViewModel, loadExecutive } from '@/lib/executive';
import { loadPanelV1 } from '@/lib/panelV1';
import { ExecutiveClient } from './ui/ExecutiveClient';

export default async function ExecutivePage() {
  // Regla operativa: el dashboard se muestra “hasta ayer” para evitar cortes del día en curso incompletos.
  const asOf = subDays(new Date(), 1);
  const asOfDay = format(asOf, 'yyyy-MM-dd');
  const [data, v1] = await Promise.all([loadExecutive(), loadPanelV1()]);
  const view = getExecutiveViewModel(data, asOf);
  const dailyComparativo = buildFlujoDailyComparativo(v1.datos.rows, asOf);
  const dailyKpisSeries = buildDailyKpisSeries(v1.datos.rows, asOfDay);
  const cierre = view.lastMonth.fecha_cierre;
  const cierreLabel = formatCierreLabel(cierre, view.lastMonth.yyyymm);

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

      <ExecutiveClient
        meta={data.meta}
        view={view}
        dailyComparativo={dailyComparativo}
        dailyKpisSeries={dailyKpisSeries}
        asOfDay={asOfDay}
      />
    </main>
  );
}

