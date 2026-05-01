'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  buildDatosRowFromCapture,
  nextDatosRowNumber,
  suggestTcForFecha,
} from '@/lib/captureHelpers';

const inputClass =
  'w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100';

function NumField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}

const emptySadama = {
  banco: '',
  inventarios: '',
  cxc: '',
  cxp: '',
  fact_dia_mes: '',
};

const emptyAmadeus = {
  inventarios: '',
  cxc: '',
  fact_dia_mes: '',
  compras_mes: '',
  sandvik: '',
  vargus: '',
  mexicana: '',
  otros: '',
  bajio_usd: '',
  bajio_mxn: '',
  hsbc: '',
};

export function CaptureClient({ initialRows }: { initialRows: unknown[] }) {
  const [fecha, setFecha] = useState('');
  const [tc, setTc] = useState('');
  const [sadama, setSadama] = useState(emptySadama);
  const [amadeus, setAmadeus] = useState(emptyAmadeus);
  const [copied, setCopied] = useState(false);

  const nextRow = useMemo(() => nextDatosRowNumber(initialRows), [initialRows]);

  useEffect(() => {
    setFecha(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  useEffect(() => {
    if (!fecha) return;
    const s = suggestTcForFecha(initialRows, fecha);
    if (s != null) setTc(String(s));
  }, [fecha, initialRows]);

  const built = useMemo(() => {
    if (!fecha) return null;
    return buildDatosRowFromCapture({
      _row: nextRow,
      fecha,
      tc,
      sadama,
      amadeus,
    });
  }, [fecha, tc, sadama, amadeus, nextRow]);

  const json = built ? JSON.stringify(built, null, 2) : '';

  const onCopy = async () => {
    if (!json) return;
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onDownload = () => {
    if (!json || !fecha) return;
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `datos-row-${fecha}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onLimpiarMontos = () => {
    setSadama(emptySadama);
    setAmadeus(emptyAmadeus);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-background p-4 dark:border-white/[0.08]">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-[200px] space-y-1">
            <label htmlFor="cap-fecha" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Fecha de registro (editable)
            </label>
            <input
              id="cap-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={inputClass}
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              El tipo de cambio se rellena con el último TC conocido para esa fecha; si no hay dato exacto, con el
              registro más reciente con fecha ≤ a la elegida.
            </p>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 lg:ml-auto">
            Siguiente <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">_row</code> sugerido:{' '}
            <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">{nextRow}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_minmax(120px,160px)] lg:items-start">
        <section className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
            Sadama
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField id="s-banco" label="Banco" value={sadama.banco} onChange={(v) => setSadama((p) => ({ ...p, banco: v }))} />
            <NumField
              id="s-inv"
              label="Inventarios"
              value={sadama.inventarios}
              onChange={(v) => setSadama((p) => ({ ...p, inventarios: v }))}
            />
            <NumField id="s-cxc" label="CXC" value={sadama.cxc} onChange={(v) => setSadama((p) => ({ ...p, cxc: v }))} />
            <NumField id="s-cxp" label="CXP" value={sadama.cxp} onChange={(v) => setSadama((p) => ({ ...p, cxp: v }))} />
            <NumField
              id="s-fact"
              label="Fact. día mes"
              value={sadama.fact_dia_mes}
              onChange={(v) => setSadama((p) => ({ ...p, fact_dia_mes: v }))}
            />
          </div>
        </section>

        <section className="rounded-xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">
            Amadeus
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField
              id="a-inv"
              label="Inventarios"
              value={amadeus.inventarios}
              onChange={(v) => setAmadeus((p) => ({ ...p, inventarios: v }))}
            />
            <NumField id="a-cxc" label="CXC" value={amadeus.cxc} onChange={(v) => setAmadeus((p) => ({ ...p, cxc: v }))} />
            <NumField
              id="a-fact"
              label="Fact. día / mes"
              value={amadeus.fact_dia_mes}
              onChange={(v) => setAmadeus((p) => ({ ...p, fact_dia_mes: v }))}
            />
            <NumField
              id="a-comp"
              label="Compras mes"
              value={amadeus.compras_mes}
              onChange={(v) => setAmadeus((p) => ({ ...p, compras_mes: v }))}
            />
          </div>
          <p className="mb-2 mt-4 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">CXP (proveedores)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField
              id="a-sand"
              label="Sandvik"
              value={amadeus.sandvik}
              onChange={(v) => setAmadeus((p) => ({ ...p, sandvik: v }))}
            />
            <NumField
              id="a-varg"
              label="Vargus"
              value={amadeus.vargus}
              onChange={(v) => setAmadeus((p) => ({ ...p, vargus: v }))}
            />
            <NumField
              id="a-mex"
              label="Mexicana"
              value={amadeus.mexicana}
              onChange={(v) => setAmadeus((p) => ({ ...p, mexicana: v }))}
            />
            <NumField
              id="a-otr"
              label="Otros"
              value={amadeus.otros}
              onChange={(v) => setAmadeus((p) => ({ ...p, otros: v }))}
            />
          </div>
          <p className="mb-2 mt-4 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Bancos</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField
              id="a-usd"
              label="Bajío USD"
              value={amadeus.bajio_usd}
              onChange={(v) => setAmadeus((p) => ({ ...p, bajio_usd: v }))}
            />
            <NumField
              id="a-mxn"
              label="Bajío MXN"
              value={amadeus.bajio_mxn}
              onChange={(v) => setAmadeus((p) => ({ ...p, bajio_mxn: v }))}
            />
            <NumField id="a-hsbc" label="HSBC" value={amadeus.hsbc} onChange={(v) => setAmadeus((p) => ({ ...p, hsbc: v }))} />
          </div>
        </section>

        <section className="rounded-xl border border-sky-200/80 bg-sky-50/50 p-4 dark:border-sky-900/40 dark:bg-sky-950/25 lg:sticky lg:top-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">TC</h2>
          <div className="space-y-1">
            <label htmlFor="cap-tc" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Tipo de cambio (día de registro)
            </label>
            <input
              id="cap-tc"
              type="text"
              inputMode="decimal"
              value={tc}
              onChange={(e) => setTc(e.target.value)}
              className={inputClass}
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Puedes corregir el valor si el sugerido no coincide con tu fuente oficial del día.
            </p>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onLimpiarMontos}>
          Limpiar montos
        </Button>
        <Button type="button" size="sm" onClick={onCopy} disabled={!json}>
          {copied ? 'Copiado' : 'Copiar JSON'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDownload} disabled={!json}>
          Descargar .json
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-zinc-50/80 p-3 dark:border-white/[0.08] dark:bg-zinc-950/50">
        <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Vista previa (esquema datos.rows)</p>
        <pre className="max-h-80 overflow-auto rounded-md border border-zinc-200 bg-white p-3 text-[11px] leading-relaxed dark:border-zinc-800 dark:bg-zinc-950">
          {json || '—'}
        </pre>
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          Integra la fila en <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">data/sadama_amadeus_v1.json</code>{' '}
          dentro de <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">datos.rows</code> y vuelve a cargar el panel.
        </p>
      </div>
    </div>
  );
}
