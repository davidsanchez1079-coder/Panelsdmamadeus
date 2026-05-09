import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

import type { FacturacionMesRow } from '@/lib/facturacionMonthly';

/** Mapa `yyyy-mm` → monto neto mensual oficial (MXN). */
export type MontoNetoMensualByMonth = Record<string, number>;
/** @deprecated Use `MontoNetoMensualByMonth`. */
export type AmadeusMontoNetoByMonth = MontoNetoMensualByMonth;

function mesLabel(yyyymm: string): string {
  const d = parse(`${yyyymm}-01`, 'yyyy-MM-dd', new Date());
  if (Number.isNaN(d.getTime())) return yyyymm;
  return format(d, 'MMM yyyy', { locale: es });
}

/** Incluye solo meses hasta el corte inclusive (`yyyy-mm` ≤ mes de `asOfDay`). */
function mesHastaCorte(yyyymm: string, asOfDay: string): boolean {
  return yyyymm <= asOfDay.slice(0, 7);
}

/**
 * Sustituye (o inserta) totales mensuales de facturación con montos netos oficiales por mes (misma lógica Sadama/Amadeus).
 * El mes calendario de `asOfDay` **no** se sustituye: ahí debe reflejarse el MTD acumulado de la captura diaria hasta el corte.
 */
export function applyOfficialMontoNetoMensual(
  monthly: FacturacionMesRow[],
  byMonth: Record<string, number> | null | undefined,
  asOfDay: string,
): FacturacionMesRow[] {
  if (!byMonth || Object.keys(byMonth).length === 0) return monthly;
  const mesOperativo = asOfDay.slice(0, 7);
  const map = new Map<string, FacturacionMesRow>();
  for (const r of monthly) {
    map.set(r.yyyymm, { ...r });
  }
  for (const [yyyymm, val] of Object.entries(byMonth)) {
    if (!mesHastaCorte(yyyymm, asOfDay)) continue;
    if (yyyymm === mesOperativo) continue;
    if (typeof val !== 'number' || !Number.isFinite(val)) continue;
    const prev = map.get(yyyymm);
    if (prev) {
      map.set(yyyymm, { ...prev, totalFacturacionMes: val });
    } else {
      map.set(yyyymm, {
        yyyymm,
        label: mesLabel(yyyymm),
        totalFacturacionMes: val,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));
}

/** Montos netos mensuales oficiales Amadeus (`data/amadeus_monto_neto_mensual.json`). */
export const applyAmadeusMontoNetoPorMes = applyOfficialMontoNetoMensual;

/** Montos netos mensuales oficiales Sadama (`data/sadama_monto_neto_mensual.json`). */
export const applySadamaMontoNetoPorMes = applyOfficialMontoNetoMensual;
