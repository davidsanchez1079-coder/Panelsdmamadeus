import fs from 'fs/promises';
import path from 'path';

export type PanelV1Datos = {
  rows: unknown[];
};

export type PanelV1File = {
  datos: PanelV1Datos;
};

const V1_JSON = path.join(process.cwd(), 'data', 'sadama_amadeus_v1.json');

export async function loadPanelV1(): Promise<PanelV1File> {
  const raw = await fs.readFile(V1_JSON, 'utf8');
  return JSON.parse(raw) as PanelV1File;
}
