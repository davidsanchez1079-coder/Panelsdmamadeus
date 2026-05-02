/**
 * Identificador corto del despliegue (Vercel inyecta `VERCEL_GIT_COMMIT_SHA` al build).
 * Se muestra en el dashboard para comprobar que el navegador no sirve una versión cacheada.
 */
export function getExecutiveUiBuildStamp(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha && sha.length >= 7) return sha.slice(0, 7);
  return 'local';
}
