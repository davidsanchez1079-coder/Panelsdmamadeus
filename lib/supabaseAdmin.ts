import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** URL del proyecto: preferir SUPABASE_URL; muchos setups de Next ya tienen NEXT_PUBLIC_SUPABASE_URL. */
export function resolveSupabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = resolveSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
