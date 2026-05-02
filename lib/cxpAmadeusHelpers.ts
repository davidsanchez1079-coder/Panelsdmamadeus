/** CXP Amadeus: probadores + «otros» como varias líneas (monto + proveedor). */

function num(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

/** Suma montos de `otros_lineas`; si no hay, usa el campo legacy `otros`. */
export function sumOtrosMontoFromCxp(cxp: Record<string, unknown> | undefined): number {
  if (!cxp) return 0;
  const lines = cxp.otros_lineas;
  if (Array.isArray(lines) && lines.length > 0) {
    let acc = 0;
    for (const line of lines) {
      if (line && typeof line === 'object') acc += num((line as { monto?: unknown }).monto);
    }
    return acc;
  }
  return num(cxp.otros);
}

/** Monto línea Sadama en CXP Amadeus; lee `probadores_sadama` o legacy `probadores_amadeus`. */
export function probadoresSadamaFromCxp(cxp: Record<string, unknown> | undefined): number {
  if (!cxp) return 0;
  if (cxp.probadores_sadama !== undefined) return num(cxp.probadores_sadama);
  return num(cxp.probadores_amadeus);
}

/**
 * Total CXP Amadeus: si existe `total` explícito se respeta; si no, suma componentes
 * (incl. línea Sadama en CXP Amadeus y suma de otros).
 */
export function totalCxpAmadeusFromCxp(cxp: Record<string, unknown> | undefined): number {
  if (!cxp) return 0;
  if (typeof cxp.total === 'number' && Number.isFinite(cxp.total)) return cxp.total;
  return (
    num(cxp.sandvik) +
    num(cxp.vargus) +
    num(cxp.mexicana) +
    probadoresSadamaFromCxp(cxp) +
    sumOtrosMontoFromCxp(cxp)
  );
}
