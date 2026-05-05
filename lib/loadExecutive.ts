import fs from 'fs/promises';
import path from 'path';

import { isServerlessFilesystem, loadBundledV1AndExecutive } from './bundledPanelSeed';
import type { ExecutiveData } from './executive';
import { loadPanelStateFromDb } from './panelState';
import { isSupabasePersistenceConfigured } from './supabaseAdmin';

const EXEC_JSON = path.join(process.cwd(), 'data', 'sadama_amadeus_executive.json');

export async function loadExecutive(): Promise<ExecutiveData> {
  if (isSupabasePersistenceConfigured()) {
    const row = await loadPanelStateFromDb();
    if (row?.executive_json) return row.executive_json as ExecutiveData;
    const { executive } = await loadBundledV1AndExecutive();
    return executive;
  }

  if (isServerlessFilesystem()) {
    const { executive } = await loadBundledV1AndExecutive();
    return executive;
  }

  const raw = await fs.readFile(EXEC_JSON, 'utf8');
  return JSON.parse(raw) as ExecutiveData;
}
