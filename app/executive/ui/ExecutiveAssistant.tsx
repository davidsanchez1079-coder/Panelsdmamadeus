'use client';

import { useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Msg = { role: 'user' | 'assistant'; content: string };

export function ExecutiveAssistant() {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Hola. Puedo analizar tu información del panel y darte observaciones financieras accionables. Prueba: “Dame un análisis del cierre y 3 acciones prioritarias”.',
    },
  ]);

  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const send = async (text: string) => {
    const userMsg: Msg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError(null);
    queueMicrotask(scrollToBottom);
    try {
      const res = await fetch('/api/executive/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: unknown };
      if (!res.ok || !data.ok || typeof data.message !== 'string') {
        const err =
          typeof data.error === 'string'
            ? data.error
            : data.error && typeof data.error === 'object'
              ? JSON.stringify(data.error)
              : 'No se pudo obtener respuesta del asistente.';
        throw new Error(err);
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message! }]);
      queueMicrotask(scrollToBottom);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-6">
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-zinc-950/60">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 px-4 py-3 dark:border-white/[0.08]">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Asistente IA (finanzas)</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Pregunta sobre el panel o pide “un análisis” y acciones.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
              {open ? 'Ocultar' : 'Mostrar'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                send('Dame un análisis ejecutivo del cierre: 3 riesgos, 3 oportunidades y 5 acciones prioritarias.')
              }
              disabled={loading}
              title="Genera un análisis guiado"
            >
              Pedir análisis
            </Button>
          </div>
        </div>

        {open ? (
          <div className="grid gap-3 px-4 py-3">
            <div
              ref={listRef}
              className="max-h-[360px] overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-white/[0.08] dark:bg-zinc-900/30"
            >
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      'whitespace-pre-wrap rounded-xl px-3 py-2 leading-relaxed',
                      m.role === 'user'
                        ? 'ml-auto w-fit max-w-[92%] bg-sky-600 text-white'
                        : 'mr-auto w-fit max-w-[92%] bg-white text-zinc-900 dark:bg-zinc-950/60 dark:text-zinc-100',
                    )}
                  >
                    {m.content}
                  </div>
                ))}
                {loading ? (
                  <div className="mr-auto w-fit max-w-[92%] rounded-xl bg-white px-3 py-2 text-zinc-600 dark:bg-zinc-950/60 dark:text-zinc-300">
                    Pensando…
                  </div>
                ) : null}
              </div>
            </div>

            {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && canSend) {
                    e.preventDefault();
                    send(input.trim());
                  }
                }}
                placeholder='Ej.: "¿Qué está presionando más mi flujo este mes?" o "Profundiza por día en los últimos 14 registros".'
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-offset-white focus:ring-2 focus:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-offset-zinc-950"
              />
              <Button type="button" onClick={() => send(input.trim())} disabled={!canSend} className="sm:w-32">
                Enviar
              </Button>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Nota: el asistente responde en base a los datos del panel. Si algo no está en los datos, lo dirá.
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

