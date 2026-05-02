import { NextResponse } from 'next/server';

import { analyzeCaptureSave } from '@/lib/captureSaveAnalysis';
import { persistDatosRow } from '@/lib/persistCapture';
import type { DatosRow } from '@/lib/types';

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
    return NextResponse.json({ ok: true, analysis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
