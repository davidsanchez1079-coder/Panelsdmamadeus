/** Utilidades para la pantalla de captura diaria (esquema `DatosRow`). */

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
