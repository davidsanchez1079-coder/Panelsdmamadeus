import { format } from 'date-fns';

import type { JsonMeta } from './types';

export type Polarity = 'positive' | 'negative' | 'neutral';

export interface YoYDelta {
  actual: number;
  anterior: number;
  delta: number;
  /** En el JSON suele venir como fracción (ej. -0.37 = -37%). Tras `scaleYoYForDisplay` queda en puntos porcentuales. */
  delta_pct: number;
}

export interface MonthlyAggregate {
  yyyymm: string; // YYYY-MM
  fecha_cierre?: string; // ISO YYYY-MM-DD
  dias_con_data?: number;
  flujo_total?: number;
  flujo_sadama?: number;
  flujo_amadeus?: number;
  bancos_total?: number;
  inventario_total?: number;
  cxc_total?: number;
  cxp_total?: number;
  cxp_sandvik?: number;
  cxp_vargus?: number;
  cxp_mexicana?: number;
  cxp_otros?: number;
  bajio_usd_mxn?: number;
  bajio_mxn?: number;
  hsbc?: number;
  banco_sadama?: number;
  inventarios_sadama?: number;
  inventarios_amadeus?: number;
  tc?: number;
  tc_min?: number;
  tc_max?: number;
  // Permite campos futuros sin romper.
  [k: string]: unknown;
}

export interface MonthlyYoY {
  yyyymm: string;
  fecha_cierre?: string;
  hasYoY?: boolean;
  yoy: Record<string, YoYDelta>;
}

export interface ExecutiveYtdComparativoNormalized {
  kpis: Record<string, number>;
  yoy: Record<string, YoYDelta>;
}

export interface ExecutiveData {
  meta: JsonMeta;
  monthly: MonthlyAggregate[];
  yoy_months: MonthlyYoY[];
  executive: {
    last_month: {
      yyyymm: string;
      fecha_cierre: string;
      kpis: MonthlyAggregate;
      yoy: Record<string, YoYDelta>;
      hasYoY: boolean;
    };
    ytd: {
      current_year: string | number;
      previous_year: string | number;
      fecha_corte: string;
      /** En el archivo suele ser un mapa plano kpi → YoYDelta; lo normalizamos a kpis + yoy. */
      comparativo: ExecutiveYtdComparativoNormalized | Record<string, unknown>;
    };
    series_12m: MonthlyAggregate[];
  };
}

/** Vista lista para UI: último mes “válido” respecto a la fecha de hoy, sin meses futuros. */
export interface ExecutiveViewModel {
  /** Fecha calendario usada como “hoy” (solo día, local). */
  asOfDay: string;
  /** Aviso si el JSON traía un corte posterior a `asOfDay`. */
  dataNote: string | null;
  lastMonth: ExecutiveData['executive']['last_month'];
  ytd: {
    current_year: string;
    previous_year: string;
    fecha_corte: string;
    comparativo: ExecutiveYtdComparativoNormalized;
  };
  series12m: MonthlyAggregate[];
}

/** El JSON trae delta_pct como fracción (0.12 = 12%). Lo pasamos a puntos (12) para badges y semáforos. */
export function scaleYoYForDisplay(
  yoy: Record<string, YoYDelta | null | undefined>,
): Record<string, YoYDelta> {
  const out: Record<string, YoYDelta> = {};
  for (const [k, v] of Object.entries(yoy)) {
    if (!v || typeof v !== 'object') continue;
    const dp = v.delta_pct;
    const scaled =
      typeof dp === 'number' && dp !== 0 && Math.abs(dp) <= 1 ? dp * 100 : dp;
    out[k] = { ...v, delta_pct: scaled };
  }
  return out;
}

function yoyToComparativo(yoy: Record<string, YoYDelta>): ExecutiveYtdComparativoNormalized {
  const kpis: Record<string, number> = {};
  for (const [k, v] of Object.entries(yoy)) kpis[k] = v.actual;
  return { kpis, yoy };
}

function normalizeYtdComparativoFromFile(raw: Record<string, unknown>): ExecutiveYtdComparativoNormalized {
  const kpis: Record<string, number> = {};
  const yoy: Record<string, YoYDelta> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object') continue;
    const d = v as YoYDelta;
    if (typeof d.actual !== 'number') continue;
    yoy[k] = d;
    kpis[k] = d.actual;
  }
  return yoyToComparativo(scaleYoYForDisplay(yoy));
}

/**
 * Alinea el dashboard a la realidad del calendario: ignora filas mensuales con cierre posterior a `asOf`.
 * Así no se muestra nov-2026 si “hoy” es may-2026.
 */
export function getExecutiveViewModel(data: ExecutiveData, asOf: Date = new Date()): ExecutiveViewModel {
  const asOfDay = format(asOf, 'yyyy-MM-dd');

  const sorted = [...data.monthly]
    .filter((m) => m.yyyymm && m.fecha_cierre)
    .sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));

  const eligible = sorted.filter((m) => (m.fecha_cierre as string) <= asOfDay);

  const rawLast = data.executive.last_month;
  let dataNote: string | null = null;
  if (rawLast.fecha_cierre > asOfDay) {
    dataNote = `El archivo traía corte ${rawLast.fecha_cierre} (posterior a hoy ${asOfDay}). Se usa el último mes con cierre disponible hasta hoy.`;
  }

  if (eligible.length === 0) {
    const yoy = scaleYoYForDisplay({ ...rawLast.yoy });
    const comparativo =
      'kpis' in (data.executive.ytd.comparativo as object) &&
      'yoy' in (data.executive.ytd.comparativo as object)
        ? yoyToComparativo(scaleYoYForDisplay({ ...(data.executive.ytd.comparativo as ExecutiveYtdComparativoNormalized).yoy }))
        : normalizeYtdComparativoFromFile(data.executive.ytd.comparativo as Record<string, unknown>);
    return {
      asOfDay,
      dataNote:
        dataNote ||
        'No hay filas mensuales con fecha de cierre hasta hoy; se muestran los datos del bloque executive del archivo.',
      lastMonth: { ...rawLast, yoy },
      ytd: {
        current_year: String(data.executive.ytd.current_year),
        previous_year: String(data.executive.ytd.previous_year),
        fecha_corte: data.executive.ytd.fecha_corte,
        comparativo,
      },
      series12m: data.executive.series_12m ?? [],
    };
  }

  const last = eligible[eligible.length - 1]!;
  const yoyEntry = data.yoy_months.find((x) => x.yyyymm === last.yyyymm);
  const yoyBase = yoyEntry?.yoy ?? rawLast.yoy;
  const yoy = scaleYoYForDisplay({ ...yoyBase });

  const lastMonth: ExecutiveData['executive']['last_month'] = {
    yyyymm: last.yyyymm,
    fecha_cierre: last.fecha_cierre as string,
    kpis: { ...last },
    yoy,
    hasYoY: yoyEntry?.hasYoY ?? Object.keys(yoy).length > 0,
  };

  const series12m = eligible.slice(-12);

  const fileYtd = data.executive.ytd;
  const fileCut = fileYtd.fecha_corte;
  const useFileYtd = fileCut <= asOfDay && fileCut === last.fecha_cierre;

  let comparativo: ExecutiveYtdComparativoNormalized;
  if (useFileYtd) {
    const c = fileYtd.comparativo;
    comparativo =
      'kpis' in (c as object) && 'yoy' in (c as object)
        ? yoyToComparativo(scaleYoYForDisplay({ ...(c as ExecutiveYtdComparativoNormalized).yoy }))
        : normalizeYtdComparativoFromFile(c as Record<string, unknown>);
  } else {
    comparativo = yoyToComparativo(yoy);
    if (fileCut > asOfDay) {
      dataNote =
        (dataNote ? dataNote + ' ' : '') +
        `YTD del archivo era hasta ${fileCut}; se muestra el comparativo al corte ${last.fecha_cierre}.`;
    }
  }

  const cy = last.yyyymm.slice(0, 4);
  const py = String(Number(cy) - 1);

  return {
    asOfDay,
    dataNote,
    lastMonth,
    ytd: {
      current_year: cy,
      previous_year: py,
      fecha_corte: last.fecha_cierre as string,
      comparativo,
    },
    series12m,
  };
}

export function getPolarity(kpiKey: string): Polarity {
  if (kpiKey === 'tc') return 'neutral';
  if (kpiKey.startsWith('cxp')) return 'negative';
  if (
    kpiKey === 'facturacion_amadeus_ytd' ||
    kpiKey === 'facturacion_sadama_ytd' ||
    kpiKey === 'facturacion_total_ytd'
  ) {
    return 'positive';
  }
  if (kpiKey.startsWith('flujo')) return 'positive';
  if (kpiKey.includes('bancos')) return 'positive';
  /* Menos inventario suele ser mejor (capital, obsolescencia); ↑% YoY → malo (rojo). */
  if (kpiKey.includes('inventario')) return 'negative';
  if (kpiKey.includes('cxc')) return 'positive';
  return 'neutral';
}

export function getSemaforo(deltaPct: number | null | undefined) {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return 'neutral' as const;
  if (deltaPct >= 5) return 'pos' as const;
  if (deltaPct <= -5) return 'neg' as const;
  return 'stable' as const;
}

export function getDeltaDirection(polarity: Polarity, deltaPct: number | null | undefined) {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return 'neutral' as const;
  if (deltaPct === 0) return 'neutral' as const;
  if (polarity === 'neutral') return 'neutral' as const;
  const isGoodUp = polarity === 'positive';
  const isUp = deltaPct > 0;
  const isGood = isGoodUp ? isUp : !isUp;
  return isGood ? ('good' as const) : ('bad' as const);
}

