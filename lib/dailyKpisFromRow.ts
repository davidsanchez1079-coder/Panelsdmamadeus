import type { DatosRowMinimal } from './flujoFromRow';
import { flujoBreakdownFromDatosRow, flujoTotalFromDatosRow } from './flujoFromRow';

function num(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

export interface DailyKpiPoint {
  fecha: string;
  flujo_total: number;
  flujo_sadama: number;
  flujo_amadeus: number;
  bancos_total: number;
  bajio_mxn: number;
  hsbc: number;
  bajio_usd_mxn: number;
  inventario_total: number;
  inventario_sadama: number;
  inventario_amadeus: number;
  cxc_total: number;
  cxp_total: number;
  cxp_sandvik: number;
  cxp_vargus: number;
  cxp_mexicana: number;
  cxp_otros: number;
}

export function dailyKpisFromDatosRow(row: DatosRowMinimal): DailyKpiPoint | null {
  const fecha = row.fecha;
  if (!fecha || typeof fecha !== 'string') return null;

  const tc = num(row.tc);
  const s = row.sadama;
  const a = row.amadeus;
  if (!s || !a) return null;

  const flujo = flujoTotalFromDatosRow(row);
  if (flujo == null || !Number.isFinite(flujo)) return null;
  const flujoBreakdown = flujoBreakdownFromDatosRow(row);
  const flujo_sadama = flujoBreakdown?.sadama ?? 0;
  const flujo_amadeus = flujoBreakdown?.amadeus ?? 0;

  const cxpA = a.cxp as Record<string, unknown> | undefined;
  let totalCxpA = 0;
  let sand = 0;
  let varg = 0;
  let mex = 0;
  let otr = 0;
  if (cxpA && typeof cxpA.total === 'number') {
    totalCxpA = cxpA.total;
    sand = num(cxpA.sandvik);
    varg = num(cxpA.vargus);
    mex = num(cxpA.mexicana);
    otr = num(cxpA.otros);
  } else if (cxpA) {
    sand = num(cxpA.sandvik);
    varg = num(cxpA.vargus);
    mex = num(cxpA.mexicana);
    otr = num(cxpA.otros);
    totalCxpA = sand + varg + mex + otr;
  }

  const b = a.bancos as Record<string, unknown> | undefined;
  let totalBancosA = 0;
  let bajioUsd = 0;
  let bajioMxn = 0;
  let hsbc = 0;
  if (b && typeof b.total_mxn === 'number') {
    totalBancosA = b.total_mxn;
    bajioUsd = num(b.bajio_usd);
    bajioMxn = num(b.bajio_mxn);
    hsbc = num(b.hsbc);
  } else if (b) {
    bajioUsd = num(b.bajio_usd);
    bajioMxn = num(b.bajio_mxn);
    hsbc = num(b.hsbc);
    totalBancosA = bajioUsd * tc + bajioMxn + hsbc;
  }

  const bancoS = num(s.banco);
  const invS = num(s.inventarios);
  const invA = num(a.inventarios);
  const cxcS = num(s.cxc);
  const cxcA = num(a.cxc);
  const cxpS = num(s.cxp);

  const bancos_total = totalBancosA + bancoS;
  const bajio_usd_mxn = bajioUsd * tc;

  return {
    fecha,
    flujo_total: flujo,
    flujo_sadama,
    flujo_amadeus,
    bancos_total,
    bajio_mxn: bajioMxn,
    hsbc,
    bajio_usd_mxn,
    inventario_total: invS + invA,
    inventario_sadama: invS,
    inventario_amadeus: invA,
    cxc_total: cxcS + cxcA,
    cxp_total: cxpS + totalCxpA,
    cxp_sandvik: sand,
    cxp_vargus: varg,
    cxp_mexicana: mex,
    cxp_otros: otr,
  };
}
