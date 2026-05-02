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

/**
 * Interpreta montos pegados desde Excel/hojas (coma como miles, punto decimal US;
 * también 1.234,56 con coma decimal). Quita espacios finos y símbolos de moneda.
 */
export function parseMoney(raw: string): number {
  let s = raw.trim();
  if (s === '') return 0;

  s = s.replace(/[\s\u00A0\u202F]/g, '');
  s = s.replace(/[$€£¥₿]/g, '');
  s = s.replace(/\b(MXN|USD|EUR|mxn|usd|eur)\b/gi, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const segments = s.split(',');
    if (segments.length === 2) {
      const left = segments[0]!;
      const right = segments[1]!;
      const digitsOnlyLeft = left.replace(/\D/g, '');
      if (right.length <= 2 && /^\d+$/.test(right)) {
        s = left.replace(/\./g, '').replace(/,/g, '') + '.' + right;
      } else if (right.length === 3 && digitsOnlyLeft.length <= 4) {
        s = digitsOnlyLeft + right;
      } else {
        s = s.replace(/,/g, '');
      }
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastDot !== -1) {
    const segments = s.split('.');
    if (segments.length > 2) {
      const last = segments[segments.length - 1]!;
      if (last.length <= 2 && /^\d+$/.test(last)) {
        s = segments.slice(0, -1).join('') + '.' + last;
      } else {
        s = s.replace(/\./g, '');
      }
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Texto para inputs de monto: el cero se muestra vacío (sin “0” en pantalla). */
export function amountToInputString(n: number): string {
  if (typeof n !== 'number' || !Number.isFinite(n) || n === 0) return '';
  return String(n);
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
    tc: amountToInputString(row.tc),
    sadama: {
      banco: amountToInputString(row.sadama.banco),
      inventarios: amountToInputString(row.sadama.inventarios),
      cxc: amountToInputString(row.sadama.cxc),
      cxp: amountToInputString(row.sadama.cxp),
      fact_dia_mes: amountToInputString(row.sadama.fact_dia_mes),
    },
    amadeus: {
      inventarios: amountToInputString(row.amadeus.inventarios),
      cxc: amountToInputString(row.amadeus.cxc),
      fact_dia_mes: amountToInputString(row.amadeus.fact_dia_mes),
      compras_mes: amountToInputString(row.amadeus.compras_mes),
      sandvik: amountToInputString(row.amadeus.cxp.sandvik),
      vargus: amountToInputString(row.amadeus.cxp.vargus),
      mexicana: amountToInputString(row.amadeus.cxp.mexicana),
      otros: amountToInputString(row.amadeus.cxp.otros),
      bajio_usd: amountToInputString(row.amadeus.bancos.bajio_usd),
      bajio_mxn: amountToInputString(row.amadeus.bancos.bajio_mxn),
      hsbc: amountToInputString(row.amadeus.bancos.hsbc),
    },
  };
}
