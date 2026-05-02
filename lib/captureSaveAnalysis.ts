/**
 * Tras guardar un registro diario: reglas sobre montos y variaciones vs el día hábil anterior en serie.
 */
import { dailyKpisFromDatosRow } from './dailyKpisFromRow';
import type { DatosRowMinimal } from './flujoFromRow';
import { flujoTotalFromDatosRow } from './flujoFromRow';
import type { DatosRow } from './types';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Umbrales en MXN / fracciones — ajustables según escala del negocio. */
const FLUJO_JUMP_ATTENTION = 0.22;
const FLUJO_JUMP_CAUTION = 0.12;
const FLUJO_ABS_DELTA_ATTENTION = 350_000;
const FLUJO_NEGATIVE_ATTENTION = -750_000;
const CXP_TOTAL_JUMP_ATTENTION = 0.28;
const INV_JUMP_ATTENTION = 0.07;
const BANCOS_JUMP_ATTENTION = 0.2;
const TC_JUMP_ATTENTION = 0.035;

export type CaptureSaveAnalysisLevel = 'ok' | 'info' | 'caution' | 'attention';

export type CaptureSaveAnalysis = {
  level: CaptureSaveAnalysisLevel;
  headline: string;
  importantNotes: string[];
  actionPlan: string[];
};

function rankOrder(l: CaptureSaveAnalysisLevel): number {
  return { ok: 0, info: 1, caution: 2, attention: 3 }[l];
}

function pickLevel(current: CaptureSaveAnalysisLevel, next: CaptureSaveAnalysisLevel): CaptureSaveAnalysisLevel {
  return rankOrder(next) > rankOrder(current) ? next : current;
}

function fmtMx(n: number) {
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function fmtPct(fraction: number) {
  return `${(fraction * 100).toFixed(1)}%`;
}

function pctChange(prev: number, cur: number): number {
  if (!Number.isFinite(prev) || !Number.isFinite(cur)) return 0;
  if (Math.abs(prev) < 1e-9) return cur === 0 ? 0 : 1;
  return (cur - prev) / Math.abs(prev);
}

function dedupeDatosRows(rows: DatosRow[]): DatosRow[] {
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

function previousBusinessRow(sorted: DatosRow[], fecha: string): DatosRow | null {
  let best: DatosRow | null = null;
  for (const r of sorted) {
    if (r.fecha < fecha && (!best || r.fecha > best.fecha)) best = r;
  }
  return best;
}

/**
 * Analiza el registro guardado frente al histórico ya fusionado (incluye la fila nueva).
 */
export function analyzeCaptureSave(saved: DatosRow, mergedRows: DatosRow[]): CaptureSaveAnalysis {
  const rows = dedupeDatosRows(mergedRows);
  const prevRow = previousBusinessRow(rows, saved.fecha);

  const curK = dailyKpisFromDatosRow(saved as DatosRowMinimal);
  const prevK = prevRow ? dailyKpisFromDatosRow(prevRow as DatosRowMinimal) : null;

  const notes: string[] = [];
  const actions: string[] = [];
  let level: CaptureSaveAnalysisLevel = 'ok';

  const curFlujo = curK?.flujo_total ?? flujoTotalFromDatosRow(saved);
  const prevFlujo = prevK?.flujo_total ?? (prevRow ? flujoTotalFromDatosRow(prevRow) : null);

  if (curFlujo != null) {
    notes.push(`Flujo total del día (modelo panel): $${fmtMx(curFlujo)} MXN.`);
  }

  if (prevRow && prevK && curK && prevFlujo != null) {
    const deltaF = curFlujo! - prevFlujo!;
    const absPct = Math.abs(pctChange(prevFlujo!, curFlujo!));
    notes.push(
      `Respecto al día hábil anterior (${prevRow.fecha}): variación de flujo ${deltaF >= 0 ? '+' : ''}$${fmtMx(deltaF)} (${fmtPct(pctChange(prevFlujo!, curFlujo!))}).`,
    );

    if (Math.abs(deltaF) >= FLUJO_ABS_DELTA_ATTENTION && absPct >= FLUJO_JUMP_ATTENTION) {
      level = pickLevel(level, 'attention');
      notes.push(
        `Variación fuerte en flujo (${fmtPct(absPct)} y más de $${fmtMx(FLUJO_ABS_DELTA_ATTENTION)} vs el día anterior). Conviene validar captura y documentación soporte.`,
      );
      actions.push(
        'Revisar con tesorería y contabilidad los movimientos de CXC, CXP y bancos que expliquen el salto antes de consolidar el cierre.',
      );
    } else if (absPct >= FLUJO_JUMP_CAUTION && Math.abs(deltaF) >= 150_000) {
      level = pickLevel(level, 'caution');
      notes.push(`Movimiento relevante en flujo (${fmtPct(absPct)}) respecto al día anterior.`);
      actions.push('Contrastar contra extractos bancarios y posiciones de proveedores (CXP) para descartar duplicados o cortes de fecha.');
    }
  } else if (!prevRow) {
    notes.push('No hay un día hábil anterior en la serie para comparar variaciones (primer registro o fecha muy temprana).');
    level = pickLevel(level, 'info');
  }

  if (curFlujo != null && curFlujo <= FLUJO_NEGATIVE_ATTENTION) {
    level = pickLevel(level, 'attention');
    notes.push(`Flujo total muy negativo ($${fmtMx(curFlujo)}). Puede reflejar salida de efectivo o timing de pagos.`);
    actions.push('Validar que CXP y posición de bancos reflejan operación real; coordinar con compras si hubo concentración de pagos a proveedores.');
  }

  if (prevK && curK) {
    const pctCxp = pctChange(prevK.cxp_total, curK.cxp_total);
    if (Math.abs(pctCxp) >= CXP_TOTAL_JUMP_ATTENTION && Math.abs(curK.cxp_total - prevK.cxp_total) >= 400_000) {
      level = pickLevel(level, 'caution');
      notes.push(
        `CXP consolidada cambió ${fmtPct(Math.abs(pctCxp))} vs ayer (antes $${fmtMx(prevK.cxp_total)} → ahora $${fmtMx(curK.cxp_total)}).`,
      );
      actions.push('Revisar altas de facturas Sandvik/Vargus/Mexicana y cortes con cuentas por pagar.');
    }

    const pctInv = pctChange(prevK.inventario_total, curK.inventario_total);
    if (Math.abs(pctInv) >= INV_JUMP_ATTENTION && Math.abs(curK.inventario_total - prevK.inventario_total) >= 600_000) {
      level = pickLevel(level, 'caution');
      notes.push(`Inventario conjunto varió ${fmtPct(Math.abs(pctInv))} respecto al día anterior.`);
      actions.push('Confirmar recepciones / consumos y valuación; descartar error de captura en inventarios Sadama o Amadeus.');
    }

    const pctBan = pctChange(prevK.bancos_total, curK.bancos_total);
    if (Math.abs(pctBan) >= BANCOS_JUMP_ATTENTION && Math.abs(curK.bancos_total - prevK.bancos_total) >= 350_000) {
      level = pickLevel(level, 'caution');
      notes.push(`Posición bancaria total (Sadama + Amadeus a TC) varió ${fmtPct(Math.abs(pctBan))} vs ayer.`);
      actions.push('Cruzar con saldos reales en bancos y movimientos no conciliados.');
    }

    const pctTc = pctChange(prevRow!.tc, saved.tc);
    if (Math.abs(pctTc) >= TC_JUMP_ATTENTION) {
      level = pickLevel(level, 'info');
      notes.push(`Tipo de cambio distinto al día anterior (${fmtPct(Math.abs(pctTc))}). Impacta valuación Bajío USD y posiciones en MXN.`);
      actions.push('Verificar TC contra fuente oficial del día (Banxico / política interna).');
    }
  }

  const comprasPrev = prevRow?.amadeus?.compras_mes;
  const comprasCur = saved.amadeus?.compras_mes;
  if (
    typeof comprasPrev === 'number' &&
    typeof comprasCur === 'number' &&
    comprasPrev > 0 &&
    pctChange(comprasPrev, comprasCur) >= 0.5
  ) {
    level = pickLevel(level, 'info');
    notes.push(`Compras mes Amadeus subieron fuerte vs el registro anterior (${fmtPct(pctChange(comprasPrev, comprasCur))}).`);
    actions.push('Confirmar que el acumulado de compras del mes corresponde al periodo contable esperado.');
  }

  let headline = 'Guardado correcto; indicadores alineados con el histórico reciente.';
  if (level === 'attention') headline = 'Atención: hay señales fuertes en montos o variaciones que conviene revisar.';
  else if (level === 'caution') headline = 'Revisión recomendada: variaciones relevantes vs el día anterior.';
  else if (level === 'info') headline = 'Guardado correcto; hay notas informativas sobre la captura.';

  const dedupActions = [...new Set(actions)];

  return {
    level,
    headline,
    importantNotes: notes,
    actionPlan: dedupActions,
  };
}
