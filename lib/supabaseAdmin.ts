import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * La URL debe ser solo el origen del proyecto (Settings → API → Project URL), p. ej.
 * `https://abcd1234.supabase.co`. Si se pega la URL del REST (`.../rest/v1`), PostgREST
 * devuelve PGRST125 (ruta inválida) porque el cliente ya añade `/rest/v1`.
 */
export function normalizeSupabaseProjectUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '');
  if (!u) return '';
  const idx = u.toLowerCase().indexOf('/rest/v');
  if (idx !== -1) u = u.slice(0, idx);
  return u.replace(/\/+$/, '');
}

/** URL del proyecto: preferir SUPABASE_URL; muchos setups de Next ya tienen NEXT_PUBLIC_SUPABASE_URL. */
export function resolveSupabaseUrl() {
  return normalizeSupabaseProjectUrl(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  );
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = resolveSupabaseUrl();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Faltan variables de entorno: SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function isSupabasePersistenceConfigured() {
  return Boolean(resolveSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
