import fs from 'fs/promises';
import path from 'path';

import { rebuildAnalisisRowsFromDatos } from './analisisFromDatos';
import { rebuildExecutiveFromDatosRows } from './rebuildExecutiveFromDatos';
import type { ExecutiveData } from './executive';
import type { DatosRow, SadamaAmadeusV1 } from './types';

const V1_PATH = path.join(process.cwd(), 'data', 'sadama_amadeus_v1.json');
const EXEC_PATH = path.join(process.cwd(), 'data', 'sadama_amadeus_executive.json');

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function assertFsPersistAllowed() {
  // En Vercel (y en general en serverless), el filesystem del deploy es de solo lectura.
  // Guardar en `data/*.json` solo funciona en tu computadora (dev) o en un servidor con disco persistente.
  const onVercel = process.env.VERCEL === '1';
  const forced = process.env.CAPTURE_FS_PERSIST === '1';
  if (onVercel && !forced) {
    throw new Error(
      [
        'No se puede guardar en archivos dentro del deploy (filesystem de solo lectura en Vercel).',
        'Usa “Descargar .json” y súbelo al repo, o conecta una base de datos/almacenamiento (recomendado: Supabase Postgres o Vercel Blob).',
        'En local: `npm run dev` en tu Mac sí puede escribir en `data/` si el archivo existe en el proyecto.',
      ].join(' '),
    );
  }
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

/**
 * Inserta o sustituye por `fecha` y reescribe `sadama_amadeus_v1.json` y `sadama_amadeus_executive.json`.
 * @param fechaToRemove Si al editar cambiaste la fecha del registro, pásala aquí para quitar la fila antigua.
 */
export async function persistDatosRow(row: DatosRow, fechaToRemove?: string): Promise<DatosRow[]> {
  assertFsPersistAllowed();

  if (!row.fecha || !ISO_DAY.test(row.fecha)) {
    throw new Error('fecha inválida (use YYYY-MM-DD)');
  }
  if (fechaToRemove && (!ISO_DAY.test(fechaToRemove) || fechaToRemove === row.fecha)) {
    fechaToRemove = undefined;
  }

  const v1Raw = await fs.readFile(V1_PATH, 'utf8');
  const v1 = JSON.parse(v1Raw) as SadamaAmadeusV1;

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

  const execRaw = await fs.readFile(EXEC_PATH, 'utf8');
  const execExisting = JSON.parse(execRaw) as ExecutiveData;
  const rebuilt = rebuildExecutiveFromDatosRows(v1.datos.rows as DatosRow[]);
  const execOut: ExecutiveData = {
    meta: {
      ...execExisting.meta,
      generated: new Date().toISOString(),
    },
    monthly: rebuilt.monthly,
    yoy_months: rebuilt.yoy_months,
    executive: rebuilt.executive,
  };

  const jsonOpts = 2;
  await fs.writeFile(V1_PATH, `${JSON.stringify(v1, null, jsonOpts)}\n`);
  await fs.writeFile(EXEC_PATH, `${JSON.stringify(execOut, null, jsonOpts)}\n`);

  return sortDatosRows(rows);
}
