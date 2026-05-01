/** Flujo total desde fila de `datos.rows` (SPEC_PANEL_FINANCIERO). */

function num(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

export type DatosRowMinimal = {
  _row?: number;
  fecha?: string;
  tc?: number;
  flujos?: { total?: number };
  sadama?: Record<string, unknown>;
  amadeus?: Record<string, unknown>;
};

export function flujoTotalFromDatosRow(row: DatosRowMinimal): number | null {
  if (row.flujos && typeof row.flujos.total === 'number' && Number.isFinite(row.flujos.total)) {
    return row.flujos.total;
  }

  const tc = num(row.tc);
  const s = row.sadama;
  const a = row.amadeus;
  if (!s || !a) return null;

  const cxpA = a.cxp as Record<string, unknown> | undefined;
  let totalCxp = 0;
  if (cxpA && typeof cxpA.total === 'number') {
    totalCxp = cxpA.total;
  } else if (cxpA) {
    for (const k of ['sandvik', 'vargus', 'mexicana', 'otros'] as const) {
      totalCxp += num(cxpA[k]);
    }
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
  return flujoAmadeus + flujoSadama;
}
