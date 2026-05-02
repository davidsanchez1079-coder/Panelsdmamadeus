import Link from 'next/link';
import { parse } from 'date-fns';

import { buildDailyKpisSeries } from '@/lib/buildDailyKpisSeries';
import { buildFlujoDailyComparativoBundle } from '@/lib/dailyFlujoComparativo';
import { formatCierreLabel } from '@/lib/dateDisplay';
import type { ExecutiveData } from '@/lib/executive';
import { getExecutiveViewModel } from '@/lib/executive';
import { resolveExecutiveAsOfDay } from '@/lib/executiveAsOf';
import { loadExecutive } from '@/lib/loadExecutive';
import { rebuildExecutiveFromDatosRows } from '@/lib/rebuildExecutiveFromDatos';
import { loadPanelV1 } from '@/lib/panelV1';
import type { DatosRow } from '@/lib/types';
import { ExecutiveClient } from './ui/ExecutiveClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ExecutivePage() {
  const [data, v1] = await Promise.all([loadExecutive(), loadPanelV1()]);
  const asOfDay = resolveExecutiveAsOfDay(v1.datos.rows);
  const asOf = parse(asOfDay, 'yyyy-MM-dd', new Date());

  const rowsThroughAsOf = (v1.datos.rows as DatosRow[]).filter(
    (r) => typeof r.fecha === 'string' && r.fecha <= asOfDay,
  );

  let dataForView: ExecutiveData = data;
  try {
    if (rowsThroughAsOf.length > 0) {
      const rebuilt = rebuildExecutiveFromDatosRows(rowsThroughAsOf);
      dataForView = {
        ...data,
        monthly: rebuilt.monthly,
        yoy_months: rebuilt.yoy_months,
        executive: rebuilt.executive,
      };
    }
  } catch {
    /* Sin meses agregables o datos incompletos: se usa el JSON ejecutivo en disco. */
  }

  const view = getExecutiveViewModel(dataForView, asOf);
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

