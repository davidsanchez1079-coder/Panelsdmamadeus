/** Flujo total desde fila de `datos.rows` (SPEC_PANEL_FINANCIERO). */

import { totalCxpAmadeusFromCxp } from './cxpAmadeusHelpers';

function num(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

export type DatosRowMinimal = {
  _row?: number;
  fecha?: string;
  tc?: number;
  flujos?: { sadama?: number; amadeus?: number; total?: number };
  sadama?: Record<string, unknown>;
  amadeus?: Record<string, unknown>;
};

export type FlujoBreakdown = { sadama: number; amadeus: number; total: number };

function computeFlujoSadamaAmadeus(row: DatosRowMinimal): { sadama: number; amadeus: number } | null {
  const tc = num(row.tc);
  const s = row.sadama;
  const a = row.amadeus;
  if (!s || !a) return null;

  const cxpA = a.cxp as Record<string, unknown> | undefined;
  let totalCxp = 0;
  if (cxpA && typeof cxpA.total === 'number') {
    totalCxp = cxpA.total;
  } else if (cxpA) {
    totalCxp = totalCxpAmadeusFromCxp(cxpA);
  }

  const b = a.bancos as Record<string, unknown> | undefined;
  let totalBancos = 0;
  if (b && typeof b.total_mxn === 'number') {
    totalBancos = b.total_mxn;
  } else if (b) {
    totalBancos = num(b.bajio_usd) * tc + num(b.bajio_mxn) + num(b.hsbc);
  }

  const cxcA = num(a.cxc);
  const cxcS = num(s.cxc);
  const cxpS = num(s.cxp);
  const bancoS = num(s.banco);

  const flujoAmadeus = cxcA + totalBancos - totalCxp;
  const flujoSadama = cxcS - cxpS + bancoS;
  return { sadama: flujoSadama, amadeus: flujoAmadeus };
}

/** Desglose Sadama / Amadeus / Total; prioriza `flujos` del JSON si viene completo. */
export function flujoBreakdownFromDatosRow(row: DatosRowMinimal): FlujoBreakdown | null {
  const f = row.flujos;
  if (
    f &&
    typeof f.sadama === 'number' &&
    Number.isFinite(f.sadama) &&
    typeof f.amadeus === 'number' &&
    Number.isFinite(f.amadeus) &&
    typeof f.total === 'number' &&
    Number.isFinite(f.total)
  ) {
    return { sadama: f.sadama, amadeus: f.amadeus, total: f.total };
  }

  const parts = computeFlujoSadamaAmadeus(row);
  if (parts) {
    const sum = parts.sadama + parts.amadeus;
    const total = f && typeof f.total === 'number' && Number.isFinite(f.total) ? f.total : sum;
    return { sadama: parts.sadama, amadeus: parts.amadeus, total };
  }

  return null;
}

export function flujoTotalFromDatosRow(row: DatosRowMinimal): number | null {
  const b = flujoBreakdownFromDatosRow(row);
  if (b) return b.total;
  const f = row.flujos;
  if (f && typeof f.total === 'number' && Number.isFinite(f.total)) return f.total;
  return null;
}
