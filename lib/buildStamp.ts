import { execSync } from 'node:child_process';

/**
 * Identificador corto del despliegue (Vercel inyecta `VERCEL_GIT_COMMIT_SHA` al build).
 * En local se añade `git rev-parse --short HEAD` para distinguir carpetas/clones.
 */
export function getExecutiveUiBuildStamp(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha && sha.length >= 7) return sha.slice(0, 7);
  try {
    const head = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      cwd: process.cwd(),
    }).trim();
    if (head.length >= 4) return `local·${head}`;
  } catch {
    /* sin git o no es un repo */
  }
  return 'local';
}
