import { NextResponse } from 'next/server';

import { formatErrorMessage } from '@/lib/formatErrorMessage';
import { resolveExecutiveAsOfDay } from '@/lib/executiveAsOf';
import { loadExecutive } from '@/lib/loadExecutive';
import { getExecutiveViewModel } from '@/lib/executive';
import { loadPanelV1 } from '@/lib/panelV1';
import type { DatosRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function mustDeepDive(userText: string): boolean {
  const s = userText.toLowerCase();
  return (
    s.includes('profund') ||
    s.includes('detalle') ||
    s.includes('desglos') ||
    s.includes('por día') ||
    s.includes('diario') ||
    s.includes('últimos') ||
    s.includes('ultimos') ||
    s.includes('captura') ||
    s.includes('filas') ||
    s.includes('rows')
  );
}

function requireOpenAiKey(): string {
  const k = (process.env.OPENAI_API_KEY || '').trim();
  if (!k) throw new Error('Falta la variable de entorno OPENAI_API_KEY (solo en servidor).');
  return k;
}

function getModel(): string {
  return (process.env.OPENAI_MODEL || '').trim() || 'gpt-4o-mini';
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { messages?: ChatMessage[] };
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const lastUser = [...messages].reverse().find((m) => m?.role === 'user')?.content ?? '';
    if (!lastUser.trim()) {
      return NextResponse.json({ ok: false, error: 'Falta el mensaje del usuario.' }, { status: 400 });
    }

    // Contexto del negocio (server-side).
    const [executive, v1] = await Promise.all([loadExecutive(), loadPanelV1()]);
    const asOfDay = resolveExecutiveAsOfDay(v1.datos.rows);
    const view = getExecutiveViewModel(executive);

    const deep = mustDeepDive(lastUser);
    const rows = (v1.datos.rows as DatosRow[])
      .filter((r) => typeof r.fecha === 'string' && r.fecha <= asOfDay)
      .slice(-40);

    const context = {
      asOfDay,
      viewModel: {
        asOfDay: view.asOfDay,
        dataNote: view.dataNote,
        lastMonth: view.lastMonth,
        ytd: view.ytd,
        series12m: view.series12m,
      },
      ...(deep
        ? {
            lastRows: rows.map((r) => ({
              fecha: r.fecha,
              tc: r.tc,
              sadama: r.sadama,
              amadeus: r.amadeus,
            })),
          }
        : {}),
    };

    const system = [
      'Eres un analista financiero senior (muy alto nivel) y asesor de negocio.',
      'Hablas SIEMPRE en español claro, con recomendaciones accionables.',
      'Reglas estrictas:',
      '- No inventes datos. Si un número no está en el CONTEXTO, dilo explícitamente.',
      '- Cita cifras con unidades (MXN, %, fecha) y especifica a qué corte aplican.',
      '- Si la pregunta requiere más detalle, pide el dato exacto que falta o sugiere activar "profundizar".',
      '- No des consejos legales o fiscales; si aplica, sugiere consultar un profesional.',
      '',
      'CONTEXTO (JSON):',
      JSON.stringify(context),
    ].join('\n');

    const apiKey = requireOpenAiKey();
    const model = getModel();

    const payload = {
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role, content: String(m.content || '') })),
      ],
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const j = (await resp.json()) as any;
    if (!resp.ok) {
      const msg = typeof j?.error?.message === 'string' ? j.error.message : JSON.stringify(j);
      throw new Error(`OpenAI: ${msg}`);
    }

    const text = j?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('La IA no devolvió contenido.');

    return NextResponse.json({ ok: true, message: text });
  } catch (e) {
    return NextResponse.json({ ok: false, error: formatErrorMessage(e) }, { status: 400 });
  }
}

