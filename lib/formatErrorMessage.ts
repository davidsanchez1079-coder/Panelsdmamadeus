/** Convierte cualquier valor lanzado por APIs (p. ej. PostgrestError) en texto legible. */
export function formatErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e != null && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    const message = typeof o.message === 'string' ? o.message : '';
    const details = typeof o.details === 'string' ? o.details : '';
    const hint = typeof o.hint === 'string' ? o.hint : '';
    const code = typeof o.code === 'string' ? o.code : '';
    const parts = [message, details, hint, code ? `código ${code}` : ''].filter(Boolean);
    if (parts.length) {
      let out = parts.join(' — ');
      if (code === 'PGRST125') {
        out +=
          ' Revisa SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL: debe ser solo la URL base del proyecto (p. ej. https://xxxx.supabase.co), sin /rest/v1.';
      }
      if (code === 'PGRST205' || code === '42P01') {
        out +=
          ' La tabla `public.panelsdm_state` no existe o no está expuesta a la API. En Supabase → SQL Editor, ejecuta el script de `supabase/migrations/` del repo (crear tabla) y vuelve a intentar.';
      }
      if (code === 'PGRST301' || code === '42501') {
        out +=
          ' Clave o permisos: comprueba que `SUPABASE_SERVICE_ROLE_KEY` sea la clave **service_role** (Settings → API), no la anon/public, y que esté en Vercel para el entorno **Production** con redeploy.';
      }
      if (code === 'PGRST000' || code === 'PGRST001') {
        out += ' Problema de conexión con la base de datos en Supabase; revisa estado del proyecto o la URL.';
      }
      return out;
    }
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
