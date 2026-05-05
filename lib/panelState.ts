import type { ExecutiveData } from './executive';
import { getSupabaseAdmin } from './supabaseAdmin';
import type { SadamaAmadeusV1 } from './types';

export const PANELSDM_STATE_ID = 'default';

export type PanelStateRow = {
  id: string;
  v1_json: SadamaAmadeusV1;
  executive_json: ExecutiveData;
  updated_at: string;
};

export async function loadPanelStateFromDb(): Promise<PanelStateRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('panelsdm_state')
    .select('id,v1_json,executive_json,updated_at')
    .eq('id', PANELSDM_STATE_ID)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data as unknown as PanelStateRow;
}

export async function upsertPanelStateToDb(v1: SadamaAmadeusV1, executive: ExecutiveData) {
  const supabase = getSupabaseAdmin();
  const payload = {
    id: PANELSDM_STATE_ID,
    v1_json: v1,
    executive_json: executive,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('panelsdm_state').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}
