import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { analyzeCaptureSave } from '@/lib/captureSaveAnalysis';
import { formatErrorMessage } from '@/lib/formatErrorMessage';
import { persistDatosRow } from '@/lib/persistCapture';
import type { DatosRow } from '@/lib/types';

/** Código HTTP más fiel al tipo de fallo (logs y monitorización). */
function httpStatusForPersistError(message: string): number {
  const m = message.toLowerCase();
  if (
    message.includes('Para guardar capturas en Vercel') ||
    message.includes('hace falta Supabase') ||
    message.includes('Faltan variables de entorno') ||
    message.includes('EROFS') ||
    m.includes('read-only file system')
  ) {
    return 501;
  }
  if (
    /\bpgrst\d+/i.test(message) ||
    /\b42p\d{3}\b/i.test(message) ||
    /\b08\d{3}\b/.test(message) ||
    m.includes('fetch failed') ||
    m.includes('econnrefused') ||
    m.includes('enotfound') ||
    m.includes('socket hang up') ||
    m.includes('network error') ||
    m.includes('timeout')
  ) {
    return 502;
  }
  return 400;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const row = body?.row as DatosRow | undefined;
    if (!row || typeof row !== 'object') {
      return NextResponse.json({ ok: false, error: 'Falta `row` en el cuerpo JSON.' }, { status: 400 });
    }
    const removeFecha = typeof body?.removeFecha === 'string' ? body.removeFecha : undefined;
    const merged = await persistDatosRow(row, removeFecha);
    const analysis = analyzeCaptureSave(row, merged);
    revalidatePath('/executive');
    revalidatePath('/captura');
    return NextResponse.json({ ok: true, analysis });
  } catch (e) {
    const msg = formatErrorMessage(e);
    const status = httpStatusForPersistError(msg);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
