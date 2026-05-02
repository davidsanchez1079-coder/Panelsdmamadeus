import fs from 'fs/promises';
import path from 'path';

import type { ExecutiveData } from './executive';

const EXEC_JSON = path.join(process.cwd(), 'data', 'sadama_amadeus_executive.json');

export async function loadExecutive(): Promise<ExecutiveData> {
  const raw = await fs.readFile(EXEC_JSON, 'utf8');
  return JSON.parse(raw) as ExecutiveData;
}
