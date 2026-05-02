/**
 * Regenera `analisis.rows` desde `datos.rows` con las mismas reglas que el Excel (SPEC_PANEL_FINANCIERO).
 * Así, al guardar captura con ceros, la validación/análisis queda alineado con datos crudos.
 */
import type { DatosRow } from './types';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function dedupeByFecha(rows: DatosRow[]): DatosRow[] {
  const map = new Map<string, DatosRow>();
  for (const r of rows) {
    const f = r.fecha;
    if (!f || typeof f !== 'string' || !ISO_DAY.test(f)) continue;
    const prev = map.get(f);
    const rn = typeof r._row === 'number' ? r._row : 0;
    const pn = prev && typeof prev._row === 'number' ? prev._row : -1;
    if (!prev || rn >= pn) map.set(f, r);
  }
  return [...map.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((k) => map.get(k)!);
}

function cxpTotalAmadeus(a: DatosRow['amadeus']): number {
  const c = a.cxp;
  return c.sandvik + c.vargus + c.mexicana + c.otros;
}

function bancosAmadeusMxn(a: DatosRow['amadeus'], tc: number): number {
  return a.bancos.bajio_usd * tc + a.bancos.bajio_mxn + a.bancos.hsbc;
}

function flujoAmadeus(d: DatosRow): number {
  return d.amadeus.cxc + bancosAmadeusMxn(d.amadeus, d.tc) - cxpTotalAmadeus(d.amadeus);
}

function flujoSadama(d: DatosRow): number {
  return d.sadama.cxc - d.sadama.cxp + d.sadama.banco;
}

function bancosTotal(d: DatosRow): number {
  return bancosAmadeusMxn(d.amadeus, d.tc) + d.sadama.banco;
}

function inventarioTotal(d: DatosRow): number {
  return d.sadama.inventarios + d.amadeus.inventarios;
}

function buildOne(curr: DatosRow, prev: DatosRow | null): Record<string, unknown> {
  const cxpT = cxpTotalAmadeus(curr.amadeus);
  const banMxn = bancosAmadeusMxn(curr.amadeus, curr.tc);
  const flujoA = flujoAmadeus(curr);
  const flujoS = flujoSadama(curr);
  const flujoTot = flujoA + flujoS;
  const invT = inventarioTotal(curr);
  const banTot = bancosTotal(curr);

  const pCxpT = prev ? cxpTotalAmadeus(prev.amadeus) : null;
  const pBanTot = prev ? bancosTotal(prev) : null;
  const pFlujoA = prev ? flujoAmadeus(prev) : null;
  const pFlujoS = prev ? flujoSadama(prev) : null;
  const pFlujoTot = prev ? pFlujoA! + pFlujoS! : null;
  const pInvT = prev ? inventarioTotal(prev) : null;

  return {
    _row: curr._row,
    fecha: curr.fecha,
    sadama: {
      cxc: curr.sadama.cxc,
      cxp: curr.sadama.cxp,
      banco: curr.sadama.banco,
      inventarios: curr.sadama.inventarios,
      fact_dia_mes: curr.sadama.fact_dia_mes,
    },
    amadeus: {
      cxc: curr.amadeus.cxc,
      dif_cxc: prev ? curr.amadeus.cxc - prev.amadeus.cxc : null,
      fact_dia_mes: curr.amadeus.fact_dia_mes,
      dif_ventas: prev ? curr.amadeus.fact_dia_mes - prev.amadeus.fact_dia_mes : null,
      cxp: {
        sandvik: curr.amadeus.cxp.sandvik,
        vargus: curr.amadeus.cxp.vargus,
        mexicana: curr.amadeus.cxp.mexicana,
        otros: curr.amadeus.cxp.otros,
        total: cxpT,
      },
      compras_mes: curr.amadeus.compras_mes,
      dif_compras: prev ? curr.amadeus.compras_mes - prev.amadeus.compras_mes : null,
      dif_cxp: prev ? cxpT - pCxpT! : null,
      bancos: {
        bajio_usd: curr.amadeus.bancos.bajio_usd,
        bajio_mxn: curr.amadeus.bancos.bajio_mxn,
        hsbc: curr.amadeus.bancos.hsbc,
        total_mxn: banMxn,
      },
      inventarios: curr.amadeus.inventarios,
      dif_inventarios: prev ? curr.amadeus.inventarios - prev.amadeus.inventarios : null,
    },
    tc: curr.tc,
    flujos: {
      amadeus: flujoA,
      dif_amadeus: prev ? flujoA - pFlujoA! : null,
      sadama: flujoS,
      dif_sadama: prev ? flujoS - pFlujoS! : null,
      total: flujoTot,
      dif_total: prev ? flujoTot - pFlujoTot! : null,
    },
    totales: {
      bancos: banTot,
      dif_bancos: prev ? banTot - pBanTot! : null,
      inventario: invT,
      dif_inventario: prev ? invT - pInvT! : null,
    },
  };
}

/** Una fila de análisis por cada fecha en datos (deduplicado por fecha). */
export function rebuildAnalisisRowsFromDatos(datosRows: DatosRow[]): Record<string, unknown>[] {
  const sorted = dedupeByFecha(datosRows);
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i]!;
    const prev = i > 0 ? sorted[i - 1]! : null;
    out.push(buildOne(curr, prev));
  }
  return out;
}
