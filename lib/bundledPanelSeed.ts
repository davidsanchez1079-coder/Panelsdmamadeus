import type { ExecutiveData } from './executive';
import type { SadamaAmadeusV1 } from './types';

/** Entornos donde no debemos usar fs sobre `data/` (Vercel/Lambda). */
export function isServerlessFilesystem(): boolean {
  const cwd = process.cwd();
  return (
    process.env.VERCEL === '1' ||
    Boolean(process.env.VERCEL_ENV) ||
    Boolean(process.env.VERCEL_URL) ||
    Boolean(process.env.LAMBDA_TASK_ROOT) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    cwd.startsWith('/var/task')
  );
}

/** Producción (p. ej. Vercel): nunca confiar solo en variables de entorno; Fluid a veces no expone VERCEL=1. */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function mustUseBundledDataInsteadOfFs(): boolean {
  return isServerlessFilesystem() || isProductionRuntime();
}

/** Semilla desde JSON empaquetado (sin leer disco en /var/task). */
export async function loadBundledV1AndExecutive(): Promise<{
  v1: SadamaAmadeusV1;
  executive: ExecutiveData;
}> {
  const [{ default: v1 }, { default: executive }] = await Promise.all([
    import('../data/sadama_amadeus_v1.json'),
    import('../data/sadama_amadeus_executive.json'),
  ]);
  return {
    v1: structuredClone(v1) as unknown as SadamaAmadeusV1,
    executive: structuredClone(executive) as unknown as ExecutiveData,
  };
}
