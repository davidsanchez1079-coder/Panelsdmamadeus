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
      return out;
    }
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
