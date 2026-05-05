import fs from 'fs/promises';
import path from 'path';

import { loadPanelStateFromDb } from './panelState';
import { isSupabasePersistenceConfigured } from './supabaseAdmin';

export type PanelV1Datos = {
  rows: unknown[];
};

export type PanelV1File = {
  datos: PanelV1Datos;
};

const V1_JSON = path.join(process.cwd(), 'data', 'sadama_amadeus_v1.json');

export async function loadPanelV1(): Promise<PanelV1File> {
  if (isSupabasePersistenceConfigured()) {
    const row = await loadPanelStateFromDb();
    if (row?.v1_json) return row.v1_json as unknown as PanelV1File;
  }

  const raw = await fs.readFile(V1_JSON, 'utf8');
  return JSON.parse(raw) as PanelV1File;
}
