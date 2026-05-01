import type { JsonMeta } from './types';

export type Polarity = 'positive' | 'negative' | 'neutral';

export interface YoYDelta {
  actual: number;
  anterior: number;
  delta: number;
  delta_pct: number; // 0-100
}

export interface ExecutiveKpis {
  flujo_total?: number;
  bancos_total?: number;
  inventario_total?: number;
  cxc_total?: number;
  cxp_total?: number;
  tc?: number;
  [k: string]: unknown;
}

export interface MonthlyAggregate {
  yyyymm: string; // YYYY-MM
  fecha_cierre?: string; // ISO YYYY-MM-DD
  kpis: ExecutiveKpis;
}

export interface MonthlyYoY {
  yyyymm: string;
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
      kpis: ExecutiveKpis;
      yoy: Record<string, YoYDelta>;
      hasYoY: boolean;
    };
    ytd: {
      current_year: number;
      previous_year: number;
      fecha_corte: string;
      comparativo: {
        kpis: ExecutiveKpis;
        yoy: Record<string, YoYDelta>;
      };
    };
    series_12m: MonthlyAggregate[];
  };
}

export function getPolarity(kpiKey: string): Polarity {
  if (kpiKey === 'tc') return 'neutral';
  if (kpiKey.startsWith('cxp')) return 'negative';
  if (kpiKey.startsWith('flujo')) return 'positive';
  if (kpiKey.includes('bancos')) return 'positive';
  if (kpiKey.includes('inventario')) return 'positive';
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

export async function loadExecutive(): Promise<ExecutiveData> {
  const data = (await import('../data/sadama_amadeus_executive.json')).default;
  return data as ExecutiveData;
}

