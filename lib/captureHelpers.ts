/** Utilidades para la pantalla de captura diaria (esquema `DatosRow`). */

import type { DatosRow } from './types';

type RowLike = { fecha?: string; tc?: number; _row?: number };

export function suggestTcForFecha(rows: unknown[], isoDate: string): number | null {
  let exact: number | null = null;
  let best: { f: string; tc: number } | null = null;
  for (const raw of rows) {
    const r = raw as RowLike;
    if (!r.fecha || typeof r.tc !== 'number' || !Number.isFinite(r.tc)) continue;
    if (r.fecha === isoDate) exact = r.tc;
    if (r.fecha <= isoDate && (!best || r.fecha > best.f)) best = { f: r.fecha, tc: r.tc };
  }
  if (exact != null) return exact;
  return best?.tc ?? null;
}

export function nextDatosRowNumber(rows: unknown[]): number {
  let m = 0;
  for (const raw of rows) {
    const n = (raw as RowLike)._row;
    if (typeof n === 'number' && n > m) m = n;
  }
  return m + 1;
}

function parseMoney(raw: string): number {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function buildDatosRowFromCapture(input: {
  _row: number;
  fecha: string;
  tc: string;
  sadama: {
    banco: string;
    inventarios: string;
    cxc: string;
    cxp: string;
    fact_dia_mes: string;
  };
  amadeus: {
    inventarios: string;
    cxc: string;
    fact_dia_mes: string;
    compras_mes: string;
    sandvik: string;
    vargus: string;
    mexicana: string;
    otros: string;
    bajio_usd: string;
    bajio_mxn: string;
    hsbc: string;
  };
}) {
  return {
    _row: input._row,
    fecha: input.fecha,
    sadama: {
      banco: parseMoney(input.sadama.banco),
      inventarios: parseMoney(input.sadama.inventarios),
      cxc: parseMoney(input.sadama.cxc),
      cxp: parseMoney(input.sadama.cxp),
      fact_dia_mes: parseMoney(input.sadama.fact_dia_mes),
    },
    amadeus: {
      inventarios: parseMoney(input.amadeus.inventarios),
      cxc: parseMoney(input.amadeus.cxc),
      fact_dia_mes: parseMoney(input.amadeus.fact_dia_mes),
      compras_mes: parseMoney(input.amadeus.compras_mes),
      cxp: {
        sandvik: parseMoney(input.amadeus.sandvik),
        vargus: parseMoney(input.amadeus.vargus),
        mexicana: parseMoney(input.amadeus.mexicana),
        otros: parseMoney(input.amadeus.otros),
      },
      bancos: {
        bajio_usd: parseMoney(input.amadeus.bajio_usd),
        bajio_mxn: parseMoney(input.amadeus.bajio_mxn),
        hsbc: parseMoney(input.amadeus.hsbc),
      },
    },
    tc: parseMoney(input.tc),
  };
}

/** Rellena el formulario de captura a partir de una fila guardada (edición). */
export function captureStringsFromDatosRow(row: DatosRow) {
  return {
    fecha: row.fecha,
    tc: String(row.tc),
    sadama: {
      banco: String(row.sadama.banco),
      inventarios: String(row.sadama.inventarios),
      cxc: String(row.sadama.cxc),
      cxp: String(row.sadama.cxp),
      fact_dia_mes: String(row.sadama.fact_dia_mes),
    },
    amadeus: {
      inventarios: String(row.amadeus.inventarios),
      cxc: String(row.amadeus.cxc),
      fact_dia_mes: String(row.amadeus.fact_dia_mes),
      compras_mes: String(row.amadeus.compras_mes),
      sandvik: String(row.amadeus.cxp.sandvik),
      vargus: String(row.amadeus.cxp.vargus),
      mexicana: String(row.amadeus.cxp.mexicana),
      otros: String(row.amadeus.cxp.otros),
      bajio_usd: String(row.amadeus.bancos.bajio_usd),
      bajio_mxn: String(row.amadeus.bancos.bajio_mxn),
      hsbc: String(row.amadeus.bancos.hsbc),
    },
  };
}
