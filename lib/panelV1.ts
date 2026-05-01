export type PanelV1Datos = {
  rows: unknown[];
};

export type PanelV1File = {
  datos: PanelV1Datos;
};

export async function loadPanelV1(): Promise<PanelV1File> {
  const data = (await import('../data/sadama_amadeus_v1.json')).default;
  return data as unknown as PanelV1File;
}
