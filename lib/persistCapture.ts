import fs from 'fs/promises';
import path from 'path';

import { loadBundledV1AndExecutive, mustUseBundledDataInsteadOfFs } from './bundledPanelSeed';
import { rebuildAnalisisRowsFromDatos } from './analisisFromDatos';
import { rebuildExecutiveFromDatosRows } from './rebuildExecutiveFromDatos';
import type { ExecutiveData } from './executive';
import { loadPanelStateFromDb, upsertPanelStateToDb } from './panelState';
import { isSupabasePersistenceConfigured } from './supabaseAdmin';
import type { DatosRow, SadamaAmadeusV1 } from './types';

const V1_PATH = path.join(process.cwd(), 'data', 'sadama_amadeus_v1.json');
const EXEC_PATH = path.join(process.cwd(), 'data', 'sadama_amadeus_executive.json');

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function throwSupabaseRequired() {
  throw new Error(
    [
      'Para guardar capturas en Vercel hace falta Supabase.',
      'Variables: SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL, y SUPABASE_SERVICE_ROLE_KEY.',
      'Crea la tabla `panelsdm_state` (archivo `supabase/migrations/` del repo) y redeploy.',
      'Comprueba que el nombre de las variables sea exacto y que redeployaste después de guardarlas.',
    ].join(' '),
  );
}

function sortDatosRows(rows: DatosRow[]): DatosRow[] {
  return [...rows].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function updateDatosMeta(datos: SadamaAmadeusV1['datos']) {
  const fechas = datos.rows.map((r) => r.fecha).filter((f) => typeof f === 'string' && ISO_DAY.test(f)).sort();
  datos.count = datos.rows.length;
  if (fechas.length) {
    datos.rango = { min: fechas[0]!, max: fechas[fechas.length - 1]! };
  }
}

async function loadBaselineV1AndExec(): Promise<{ v1: SadamaAmadeusV1; execExisting: ExecutiveData }> {
  if (isSupabasePersistenceConfigured()) {
    // Lectura estricta: si Supabase falla, no guardamos con semilla (evitar pisar datos en la nube).
    const row = await loadPanelStateFromDb();
    if (row?.v1_json && row?.executive_json) {
      return {
        v1: structuredClone(row.v1_json as SadamaAmadeusV1),
        execExisting: structuredClone(row.executive_json as ExecutiveData),
      };
    }
    if (row?.v1_json) {
      const seeded = await loadBundledV1AndExecutive();
      return {
        v1: structuredClone(row.v1_json as SadamaAmadeusV1),
        execExisting: seeded.executive,
      };
    }
    // Tabla vacía o sin fila `default`: primera captura desde semilla empaquetada.
    const seeded = await loadBundledV1AndExecutive();
    return { v1: seeded.v1, execExisting: seeded.executive };
  }

  if (mustUseBundledDataInsteadOfFs()) {
    const seeded = await loadBundledV1AndExecutive();
    return { v1: seeded.v1, execExisting: seeded.executive };
  }

  const [v1Raw, execRaw] = await Promise.all([fs.readFile(V1_PATH, 'utf8'), fs.readFile(EXEC_PATH, 'utf8')]);
  return {
    v1: JSON.parse(v1Raw) as SadamaAmadeusV1,
    execExisting: JSON.parse(execRaw) as ExecutiveData,
  };
}

function mergeRowIntoV1(v1: SadamaAmadeusV1, row: DatosRow, fechaToRemove?: string): DatosRow[] {
  let rows = (v1.datos.rows as DatosRow[]) ?? [];
  if (fechaToRemove) {
    rows = rows.filter((r) => r.fecha !== fechaToRemove);
  }
  const idx = rows.findIndex((r) => r.fecha === row.fecha);
  if (idx >= 0) {
    const prev = rows[idx]!;
    rows[idx] = {
      ...row,
      _row: typeof row._row === 'number' ? row._row : prev._row,
    };
  } else {
    rows.push(row);
  }

  v1.datos.rows = sortDatosRows(rows) as unknown as typeof v1.datos.rows;
  updateDatosMeta(v1.datos);
  if (v1.analisis) {
    const analisisRows = rebuildAnalisisRowsFromDatos(v1.datos.rows as DatosRow[]);
    v1.analisis.rows = analisisRows as unknown as typeof v1.analisis.rows;
    v1.analisis.count = analisisRows.length;
    const fechas = v1.datos.rows.map((r) => r.fecha).filter((f) => typeof f === 'string' && ISO_DAY.test(f)).sort();
    if (fechas.length) {
      v1.analisis.rango = { min: fechas[0]!, max: fechas[fechas.length - 1]! };
    }
  }
  if (v1.meta) {
    v1.meta.generated = new Date().toISOString();
  }

  return sortDatosRows(rows);
}

function buildExecutiveOutput(execExisting: ExecutiveData, rows: DatosRow[]): ExecutiveData {
  const rebuilt = rebuildExecutiveFromDatosRows(rows);
  return {
    meta: {
      ...execExisting.meta,
      generated: new Date().toISOString(),
    },
    monthly: rebuilt.monthly,
    yoy_months: rebuilt.yoy_months,
    executive: rebuilt.executive,
  };
}

/**
 * Inserta o sustituye por `fecha` y reescribe `sadama_amadeus_v1.json` y `sadama_amadeus_executive.json`.
 * @param fechaToRemove Si al editar cambiaste la fecha del registro, pásala aquí para quitar la fila antigua.
 */
export async function persistDatosRow(row: DatosRow, fechaToRemove?: string): Promise<DatosRow[]> {
  if (!row.fecha || !ISO_DAY.test(row.fecha)) {
    throw new Error('fecha inválida (use YYYY-MM-DD)');
  }
  if (fechaToRemove && (!ISO_DAY.test(fechaToRemove) || fechaToRemove === row.fecha)) {
    fechaToRemove = undefined;
  }

  const { v1, execExisting } = await loadBaselineV1AndExec();
  const sortedRows = mergeRowIntoV1(v1, row, fechaToRemove);
  const execOut = buildExecutiveOutput(execExisting, sortedRows);

  if (isSupabasePersistenceConfigured()) {
    await upsertPanelStateToDb(v1, execOut);
    return sortedRows;
  }

  if (mustUseBundledDataInsteadOfFs()) {
    throwSupabaseRequired();
  }

  const jsonOpts = 2;
  await fs.writeFile(V1_PATH, `${JSON.stringify(v1, null, jsonOpts)}\n`);
  await fs.writeFile(EXEC_PATH, `${JSON.stringify(execOut, null, jsonOpts)}\n`);

  return sortedRows;
}
