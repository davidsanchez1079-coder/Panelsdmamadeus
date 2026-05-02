import type { ReactNode } from 'react';

import type { FlujoDailyComparativo } from '@/lib/dailyFlujoComparativo';
import { formatShortFecha } from '@/lib/dateDisplay';
import { getDeltaDirection, getPolarity, getSemaforo } from '@/lib/executive';
import { formatMXN, formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { YoYBadge } from './YoYBadge';

export type HeroFlujoYoyKey = 'flujo_total' | 'flujo_sadama' | 'flujo_amadeus';

function deltaToneClass(dir: ReturnType<typeof getDeltaDirection>) {
  return dir === 'good'
    ? 'text-emerald-700 dark:text-emerald-300'
    : dir === 'bad'
      ? 'text-red-700 dark:text-red-300'
      : 'text-zinc-600 dark:text-zinc-400';
}

function signedMxn(n: number | null) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return 'sin cambio';
  const core = formatMXN(Math.abs(n));
  if (n > 0) return `+${core}`;
  return formatMXN(n);
}

export function HeroFlujoBanner({
  title,
  yoyKpiKey,
  actual,
  yoyDeltaPct,
  anterior,
  delta,
  daily,
  className,
  yoyExplainFooter,
  facturacionYtd,
  facturacionYtdLabel,
  facturacionYtdKpiKey = 'facturacion_amadeus_ytd',
  hideFlujoYoyWhenNoFacturacion,
  heroHighlight = 'flujo',
}: {
  title: string;
  yoyKpiKey: HeroFlujoYoyKey;
  actual: number;
  anterior: number | null | undefined;
  delta: number | null | undefined;
  yoyDeltaPct: number | null | undefined;
  daily: FlujoDailyComparativo | null;
  className?: string;
  /** Texto bajo la fila YoY (p. ej. distinguir flujo vs facturación). */
  yoyExplainFooter?: ReactNode;
  /**
   * Si viene definido, muestra debajo (o como héroe si `heroHighlight` es `facturacion_ytd`)
   * el YTD de facturación (suma MTD mensual ene → corte).
   */
  facturacionYtd?: {
    ytdActual: number;
    ytdAnterior: number;
    yearActual: string;
    yearAnterior: string;
  };
  /** Leyenda corta: p. ej. «Amadeus», «Sadama», «total (Sadama + Amadeus)». */
  facturacionYtdLabel?: string;
  /** Polaridad del badge % (misma convención que `YoYBadge`). */
  facturacionYtdKpiKey?: string;
  /**
   * Si true y no hay `facturacionYtd`, no mostrar el YoY de flujo (p. ej. ~55M histórico);
   * útil en la tarjeta «Flujo total» donde el equipo quiere solo el YTD de facturación.
   */
  hideFlujoYoyWhenNoFacturacion?: boolean;
  /**
   * `facturacion_ytd`: la cifra grande es el YTD de facturación; el flujo queda como referencia debajo.
   * `flujo` (defecto): comportamiento anterior (hero = flujo).
   */
  heroHighlight?: 'flujo' | 'facturacion_ytd';
}) {
  const polarity = getPolarity(yoyKpiKey);
  const facturacionDeltaPct =
    facturacionYtd != null && Number.isFinite(facturacionYtd.ytdAnterior) && facturacionYtd.ytdAnterior !== 0
      ? ((facturacionYtd.ytdActual - facturacionYtd.ytdAnterior) / facturacionYtd.ytdAnterior) * 100
      : facturacionYtd != null && facturacionYtd.ytdAnterior === 0 && facturacionYtd.ytdActual !== 0
        ? 100
        : null;
  const heroIsFactYtd = heroHighlight === 'facturacion_ytd' && facturacionYtd != null;
  const sem =
    heroIsFactYtd && facturacionYtd != null ? getSemaforo(facturacionDeltaPct) : getSemaforo(yoyDeltaPct);
  const semBar =
    sem === 'pos'
      ? 'border-l-emerald-500 dark:shadow-[0_0_32px_-6px_rgba(16,185,129,0.35)]'
      : sem === 'neg'
        ? 'border-l-red-500 dark:shadow-[0_0_32px_-6px_rgba(239,68,68,0.3)]'
        : sem === 'stable'
          ? 'border-l-amber-400 dark:shadow-[0_0_28px_-6px_rgba(251,191,36,0.25)]'
          : 'border-l-sky-400 dark:shadow-[0_0_28px_-6px_rgba(56,189,248,0.2)]';
  /* Modo claro: fondo pastel por estado. Modo oscuro: fondo SIEMPRE oscuro (sin degradados claros) para leer bien el texto. */
  const bg =
    sem === 'pos'
      ? 'border-emerald-200/80 bg-emerald-50 dark:border-zinc-600/60 dark:bg-zinc-950 dark:ring-1 dark:ring-white/[0.06]'
      : sem === 'neg'
        ? 'border-red-200/80 bg-red-50 dark:border-zinc-600/60 dark:bg-zinc-950 dark:ring-1 dark:ring-white/[0.06]'
        : sem === 'stable'
          ? 'border-amber-200/80 bg-amber-50 dark:border-zinc-600/60 dark:bg-zinc-950 dark:ring-1 dark:ring-white/[0.06]'
          : 'border-zinc-200/80 bg-zinc-50 dark:border-zinc-600/60 dark:bg-zinc-950 dark:ring-1 dark:ring-white/[0.06]';

  const displayFlujo = daily ? daily.last.flujo : actual;
  const vsMonthStartDelta =
    daily && daily.monthStart.fecha !== daily.last.fecha ? daily.last.flujo - daily.monthStart.flujo : null;
  const vsMonthStartPct =
    vsMonthStartDelta != null && daily && daily.monthStart.flujo !== 0
      ? (vsMonthStartDelta / daily.monthStart.flujo) * 100
      : null;
  const vsMonthDir =
    vsMonthStartDelta == null || vsMonthStartDelta === 0
      ? ('neutral' as const)
      : vsMonthStartPct != null
        ? getDeltaDirection(polarity, vsMonthStartPct)
        : getDeltaDirection(polarity, vsMonthStartDelta > 0 ? 1 : -1);
  const yoyDeltaDir = getDeltaDirection(polarity, yoyDeltaPct);
  const factPolarity = getPolarity(facturacionYtdKpiKey);
  const factDeltaMxn =
    facturacionYtd != null && Number.isFinite(facturacionYtd.ytdActual) && Number.isFinite(facturacionYtd.ytdAnterior)
      ? facturacionYtd.ytdActual - facturacionYtd.ytdAnterior
      : null;
  const factDeltaDir = getDeltaDirection(factPolarity, facturacionDeltaPct);
  const factLabel = facturacionYtdLabel ?? 'Amadeus';

  return (
    <section
      className={cn(
        'rounded-xl border border-l-4 p-5 shadow-sm dark:shadow-[0_4px_28px_rgba(0,0,0,0.35)]',
        semBar,
        bg,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {title}
            {daily ? (
              <span className="text-zinc-500 dark:text-zinc-500">
                {' '}
                · último registro {formatShortFecha(daily.last.fecha)}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-white">
            {heroIsFactYtd && facturacionYtd ? formatMXN(facturacionYtd.ytdActual) : formatMXN(displayFlujo)}
          </div>
          {heroIsFactYtd ? (
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Flujo total al corte
              {daily ? (
                <>
                  {' '}
                  <span className="tabular-nums">{formatShortFecha(daily.last.fecha)}</span>
                </>
              ) : null}
              :{' '}
              <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                {formatMXN(displayFlujo)}
              </span>
            </div>
          ) : null}

          {daily ? (
            <div className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
              {heroIsFactYtd ? (
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Evolución del flujo (últimos registros)
                </div>
              ) : null}
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-zinc-500 dark:text-zinc-400">Primer registro del mes en curso</span>
                <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                  {formatShortFecha(daily.monthStart.fecha)}
                </span>
                <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{formatMXN(daily.monthStart.flujo)}</span>
                {vsMonthStartDelta != null ? (
                  <span className={cn('tabular-nums font-medium', deltaToneClass(vsMonthDir))}>
                    (Δ último vs este punto: {signedMxn(vsMonthStartDelta)}
                    {vsMonthStartPct != null ? <> · {formatPct(vsMonthStartPct)}</> : null})
                  </span>
                ) : null}
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Últimos 5 registros <span className="font-normal">(vs dato anterior en la serie)</span>
                </div>
                <ul className="mt-2 space-y-2">
                  {daily.lastFive.map((p) => {
                    const dir =
                      p.delta == null || p.delta === 0
                        ? 'neutral'
                        : p.deltaPct != null
                          ? getDeltaDirection(polarity, p.deltaPct)
                          : p.delta > 0
                            ? getDeltaDirection(polarity, 1)
                            : getDeltaDirection(polarity, -1);
                    const tone = deltaToneClass(dir);
                    return (
                      <li
                        key={p.fecha}
                        className="flex flex-col gap-0.5 border-b border-zinc-200/90 pb-2 last:border-0 last:pb-0 dark:border-zinc-600/50"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
                          <span className="font-medium text-zinc-800 dark:text-zinc-100">{formatShortFecha(p.fecha)}</span>
                          <span className="text-zinc-900 dark:text-zinc-100">{formatMXN(p.flujo)}</span>
                        </div>
                        {p.vsPrevFecha != null && p.delta != null ? (
                          <div className={cn('text-xs tabular-nums', tone)}>
                            vs {formatShortFecha(p.vsPrevFecha)}: {signedMxn(p.delta)}
                            {p.deltaPct != null ? <> · {formatPct(p.deltaPct)}</> : null}
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">Sin registro anterior en la serie</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="mt-3 border-t border-zinc-200/80 pt-3 text-sm text-zinc-700 dark:border-zinc-600/60 dark:text-zinc-300">
            {facturacionYtd ? (
              heroIsFactYtd ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    vs mismo lapso {facturacionYtd.yearAnterior}
                  </span>
                  <span className="tabular-nums text-zinc-800 dark:text-zinc-100">
                    {formatMXN(facturacionYtd.ytdAnterior)}
                  </span>
                  <span
                    className={cn(
                      'tabular-nums font-medium',
                      factDeltaMxn == null ? 'text-zinc-900 dark:text-zinc-100' : deltaToneClass(factDeltaDir),
                    )}
                  >
                    {factDeltaMxn == null ? '—' : formatMXN(factDeltaMxn)}
                  </span>
                  <YoYBadge
                    kpiKey={facturacionYtdKpiKey}
                    deltaPct={facturacionDeltaPct}
                    title="Variación YTD de facturación vs el mismo lapso del año anterior (ene → mes de corte)"
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="text-zinc-500 dark:text-zinc-500">
                    YTD fact. {factLabel} ({facturacionYtd.yearActual})
                  </span>
                  <span className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatMXN(facturacionYtd.ytdActual)}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    vs mismo lapso {facturacionYtd.yearAnterior}
                  </span>
                  <span className="tabular-nums text-zinc-800 dark:text-zinc-100">
                    {formatMXN(facturacionYtd.ytdAnterior)}
                  </span>
                  <span
                    className={cn(
                      'tabular-nums font-medium',
                      factDeltaMxn == null ? 'text-zinc-900 dark:text-zinc-100' : deltaToneClass(factDeltaDir),
                    )}
                  >
                    {factDeltaMxn == null ? '—' : formatMXN(factDeltaMxn)}
                  </span>
                  <YoYBadge
                    kpiKey={facturacionYtdKpiKey}
                    deltaPct={facturacionDeltaPct}
                    title="Variación YTD de facturación vs el mismo lapso del año anterior (ene → mes de corte)"
                  />
                </div>
              )
            ) : hideFlujoYoyWhenNoFacturacion ? (
              <p className="text-xs leading-snug text-amber-800 dark:text-amber-200/90">
                YTD de facturación no disponible para esta fecha de corte. Pulse Actualizar o revise los datos
                capturados.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-500 dark:text-zinc-500">YoY · flujo (mismo mes cal.)</span>
                  <span className="tabular-nums text-zinc-900 dark:text-zinc-100">
                    {anterior == null ? '—' : formatMXN(anterior)}
                  </span>
                  <span
                    className={cn(
                      'tabular-nums font-medium',
                      delta == null ? 'text-zinc-900 dark:text-zinc-100' : deltaToneClass(yoyDeltaDir),
                    )}
                  >
                    {delta == null ? '—' : formatMXN(delta)}
                  </span>
                  <YoYBadge kpiKey={yoyKpiKey} deltaPct={yoyDeltaPct} />
                </div>
                {yoyExplainFooter ? <div className="mt-2">{yoyExplainFooter}</div> : null}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium',
              sem === 'pos'
                ? 'border-emerald-200 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-950/50 dark:text-emerald-100'
                : sem === 'neg'
                  ? 'border-red-200 text-red-800 dark:border-red-400/50 dark:bg-red-950/50 dark:text-red-100'
                  : sem === 'stable'
                    ? 'border-amber-200 text-amber-900 dark:border-amber-400/50 dark:bg-amber-950/50 dark:text-amber-100'
                    : 'border-zinc-200 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-200',
            )}
          >
            {sem === 'pos'
              ? 'Mejorando'
              : sem === 'neg'
                ? 'En riesgo'
                : sem === 'stable'
                  ? 'Estable'
                  : 'Sin dato'}
          </span>
        </div>
      </div>
    </section>
  );
}

