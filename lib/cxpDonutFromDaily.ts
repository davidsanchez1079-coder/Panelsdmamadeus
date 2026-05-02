import type { DailyKpiPoint } from './dailyKpisFromRow';

export function cxpDonutFromDailyPoint(p: DailyKpiPoint | undefined | null) {
  if (!p) return [{ name: 'CXP total', value: 0 }];
  const parts = [
    { name: 'Sadama', value: p.cxp_sadama ?? 0 },
    { name: 'Sandvik', value: p.cxp_sandvik },
    { name: 'Vargus', value: p.cxp_vargus },
    { name: 'Mexicana', value: p.cxp_mexicana },
    { name: 'AMADEUS', value: p.cxp_probadores_amadeus ?? 0 },
    { name: 'Otros', value: p.cxp_otros },
  ];
  const sumParts = parts.reduce((a, b) => a + b.value, 0);
  const rest = p.cxp_total - sumParts;
  const withRest =
    Math.abs(rest) > 1 ? [...parts, { name: 'Ajuste / diferencia', value: rest }] : parts;
  const sum = withRest.reduce((a, b) => a + b.value, 0);
  return sum > 0 ? withRest : [{ name: 'CXP total', value: p.cxp_total }];
}

export type CxpProveedorRow = { name: string; value: number; pct: number };

/** Total CXP consolidado y filas con % respecto a `cxp_total` del punto de corte. */
export function cxpProveedoresConPct(p: DailyKpiPoint | undefined | null): {
  total: number;
  rows: CxpProveedorRow[];
} {
  const slices = cxpDonutFromDailyPoint(p);
  const total = typeof p?.cxp_total === 'number' && Number.isFinite(p.cxp_total) ? p.cxp_total : 0;
  const denom = total > 0 ? total : slices.reduce((a, s) => a + s.value, 0);
  const rows = slices.map((s) => ({
    name: s.name,
    value: s.value,
    pct: denom > 0 ? (s.value / denom) * 100 : 0,
  }));
  return { total, rows };
}
