'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  amountToInputString,
  buildDatosRowFromCapture,
  captureStringsFromDatosRow,
  nextDatosRowNumber,
  parseMoney,
  suggestTcForFecha,
} from '@/lib/captureHelpers';
import type { CaptureSaveAnalysis } from '@/lib/captureSaveAnalysis';
import { flujoTotalFromDatosRow } from '@/lib/flujoFromRow';
import { cn } from '@/lib/utils';
import type { DatosRow } from '@/lib/types';

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
  const onBlurNormalize = () => {
    if (value.trim() === '') return;
    const n = parseMoney(value);
    const next = n === 0 ? '' : String(n);
    if (next !== value) onChange(next);
  };

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
        onBlur={onBlurNormalize}
        className={inputClass}
      />
    </div>
  );
}

function TextField({
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
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}

const emptyOtrosLines = (): { monto: string; proveedor: string }[] => [
  { monto: '', proveedor: '' },
  { monto: '', proveedor: '' },
  { monto: '', proveedor: '' },
];

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
  probadores_sadama: '',
  otros_lineas: emptyOtrosLines(),
  bajio_usd: '',
  bajio_mxn: '',
  hsbc: '',
};

function fmtMx(n: number) {
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(n);
}

export function CaptureClient({ initialRows }: { initialRows: unknown[] }) {
  const router = useRouter();
  const [fecha, setFecha] = useState('');
  const [tc, setTc] = useState('');
  const [sadama, setSadama] = useState(emptySadama);
  const [amadeus, setAmadeus] = useState(emptyAmadeus);
  const [copied, setCopied] = useState(false);
  const [editingOriginalFecha, setEditingOriginalFecha] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [postSaveAnalysis, setPostSaveAnalysis] = useState<CaptureSaveAnalysis | null>(null);

  const nextRow = useMemo(() => nextDatosRowNumber(initialRows), [initialRows]);

  const targetRowNum = useMemo(() => {
    if (!editingOriginalFecha) return nextRow;
    const r = initialRows.find((x) => (x as DatosRow).fecha === editingOriginalFecha) as DatosRow | undefined;
    return typeof r?._row === 'number' ? r._row : nextRow;
  }, [editingOriginalFecha, initialRows, nextRow]);

  const recentRows = useMemo(() => {
    const map = new Map<string, DatosRow>();
    for (const raw of initialRows) {
      const r = raw as DatosRow;
      if (!r.fecha) continue;
      const prev = map.get(r.fecha);
      const rn = typeof r._row === 'number' ? r._row : 0;
      const pn = prev && typeof prev._row === 'number' ? prev._row : -1;
      if (!prev || rn >= pn) map.set(r.fecha, r);
    }
    return [...map.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 120);
  }, [initialRows]);

  useEffect(() => {
    setFecha(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  useEffect(() => {
    if (!fecha) return;
    const s = suggestTcForFecha(initialRows, fecha);
    if (s != null) setTc(amountToInputString(s));
  }, [fecha, initialRows]);

  const built = useMemo(() => {
    if (!fecha) return null;
    return buildDatosRowFromCapture({
      _row: targetRowNum,
      fecha,
      tc,
      sadama,
      amadeus,
    });
  }, [fecha, tc, sadama, amadeus, targetRowNum]);

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

  const onNuevoRegistro = () => {
    setEditingOriginalFecha(null);
    setSaveError(null);
    setPostSaveAnalysis(null);
    const hoy = format(new Date(), 'yyyy-MM-dd');
    setFecha(hoy);
    const s = suggestTcForFecha(initialRows, hoy);
    setTc(s != null ? amountToInputString(s) : '');
    setSadama(emptySadama);
    setAmadeus(emptyAmadeus);
  };

  const onEditar = (row: DatosRow) => {
    setSaveError(null);
    setPostSaveAnalysis(null);
    setEditingOriginalFecha(row.fecha);
    const s = captureStringsFromDatosRow(row);
    setFecha(s.fecha);
    setTc(s.tc);
    setSadama(s.sadama);
    setAmadeus(s.amadeus);
  };

  const onGuardar = async () => {
    if (!built) return;
    setSaving(true);
    setSaveError(null);
    setPostSaveAnalysis(null);
    try {
      const removeFecha =
        editingOriginalFecha && editingOriginalFecha !== built.fecha ? editingOriginalFecha : undefined;
      const res = await fetch('/api/capture/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row: built, removeFecha }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string | Record<string, unknown>;
        analysis?: CaptureSaveAnalysis;
      };
      if (!res.ok || !data.ok) {
        const errRaw = data.error;
        const errText =
          typeof errRaw === 'string'
            ? errRaw
            : errRaw != null && typeof errRaw === 'object'
              ? JSON.stringify(errRaw)
              : 'No se pudo guardar';
        throw new Error(errText);
      }
      if (data.analysis) setPostSaveAnalysis(data.analysis);
      setEditingOriginalFecha(null);
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
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
          <div className="flex flex-wrap items-center gap-2 text-xs lg:ml-auto">
            {editingOriginalFecha ? (
              <span className="rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
                Editando registro del {editingOriginalFecha}
              </span>
            ) : null}
            <span className="text-zinc-500 dark:text-zinc-400">
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">_row</code>{' '}
              <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">{targetRowNum}</span>
              {editingOriginalFecha ? ' (existente)' : ' (nuevo)'}
            </span>
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
            <NumField
              id="s-cxp"
              label="CXP (Sadama)"
              value={sadama.cxp}
              onChange={(v) => setSadama((p) => ({ ...p, cxp: v }))}
            />
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
          <p className="mb-2 mt-4 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            CXP (proveedores Amadeus; Sadama va en su tarjeta y suma al mismo total)
          </p>
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
              id="a-sadama-cxp-line"
              label="Sadama"
              value={amadeus.probadores_sadama}
              onChange={(v) => setAmadeus((p) => ({ ...p, probadores_sadama: v }))}
            />
          </div>
          <p className="mb-2 mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            Otros: hasta tres proveedores (monto + nombre). En reportes se suman los importes de las líneas con valor.
          </p>
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-2">
                <NumField
                  id={`a-otr-${i}-monto`}
                  label={`Otros ${i + 1} · monto`}
                  value={amadeus.otros_lineas[i]!.monto}
                  onChange={(v) =>
                    setAmadeus((p) => ({
                      ...p,
                      otros_lineas: p.otros_lineas.map((line, j) => (j === i ? { ...line, monto: v } : line)),
                    }))
                  }
                />
                <TextField
                  id={`a-otr-${i}-prov`}
                  label={`Otros ${i + 1} · proveedor`}
                  value={amadeus.otros_lineas[i]!.proveedor}
                  onChange={(v) =>
                    setAmadeus((p) => ({
                      ...p,
                      otros_lineas: p.otros_lineas.map((line, j) => (j === i ? { ...line, proveedor: v } : line)),
                    }))
                  }
                />
              </div>
            ))}
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
              onBlur={() => {
                if (tc.trim() === '') return;
                const n = parseMoney(tc);
                const next = n === 0 ? '' : String(n);
                if (next !== tc) setTc(next);
              }}
              className={inputClass}
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Puedes corregir el valor si el sugerido no coincide con tu fuente oficial del día.
            </p>
          </div>
        </section>
      </div>

      <p className="rounded-lg border border-zinc-200/80 bg-zinc-50/90 px-3 py-2 text-[11px] leading-snug text-zinc-600 dark:border-zinc-600/60 dark:bg-zinc-900/45 dark:text-zinc-400">
        <span className="font-medium text-zinc-800 dark:text-zinc-300">Fact. día mes (Sadama) y Fact. día / mes (Amadeus):</span>{' '}
        son la facturación <span className="font-medium">acumulada del mes en curso</span> (MTD) a la fecha de este registro. En el
        dashboard ejecutivo, los comparativos de facturación usan, para cada mes calendario, el valor del{' '}
        <span className="font-medium">último registro guardado en ese mes</span> (última fecha con datos hasta el corte), no la suma
        de todos los días del mes.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onGuardar} disabled={!json || saving}>
          {saving ? 'Guardando…' : 'Guardar en datos'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onNuevoRegistro}>
          Nuevo registro
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onLimpiarMontos}>
          Limpiar montos
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCopy} disabled={!json}>
          {copied ? 'Copiado' : 'Copiar JSON'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDownload} disabled={!json}>
          Descargar .json
        </Button>
      </div>
      {saveError ? <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p> : null}

      {postSaveAnalysis ? (
        <div
          className={cn(
            'rounded-xl border p-4 shadow-sm',
            postSaveAnalysis.level === 'ok' &&
              'border-emerald-200/90 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/25',
            postSaveAnalysis.level === 'info' &&
              'border-sky-200/90 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-950/25',
            postSaveAnalysis.level === 'caution' &&
              'border-amber-300/90 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/25',
            postSaveAnalysis.level === 'attention' &&
              'border-red-300/90 bg-red-50/80 dark:border-red-900/45 dark:bg-red-950/25',
          )}
          role="region"
          aria-label="Análisis tras guardar"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Análisis tras guardar</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => setPostSaveAnalysis(null)}>
              Cerrar
            </Button>
          </div>
          <p className="mb-3 text-sm font-medium leading-snug text-zinc-800 dark:text-zinc-100">
            {postSaveAnalysis.headline}
          </p>
          <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Notas importantes
              </p>
              <ul className="list-inside list-disc space-y-1.5 leading-relaxed">
                {postSaveAnalysis.importantNotes.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
            {postSaveAnalysis.actionPlan.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Plan de acción sugerido
                </p>
                <ol className="list-inside list-decimal space-y-1.5 leading-relaxed">
                  {postSaveAnalysis.actionPlan.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              </div>
            ) : postSaveAnalysis.level === 'ok' || postSaveAnalysis.level === 'info' ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No se generaron pasos obligatorios; las variaciones están dentro de rangos habituales.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-zinc-50/80 p-3 dark:border-white/[0.08] dark:bg-zinc-950/50">
        <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Registros recientes (últimos 120 días únicos por fecha)
        </p>
        <div className="max-h-64 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[420px] border-collapse text-left text-[11px]">
            <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="border-b border-zinc-200 px-2 py-1.5 font-medium dark:border-zinc-700">Fecha</th>
                <th className="border-b border-zinc-200 px-2 py-1.5 font-medium tabular-nums dark:border-zinc-700">
                  Flujo total (MXN)
                </th>
                <th className="border-b border-zinc-200 px-2 py-1.5 font-medium dark:border-zinc-700"> </th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((r) => {
                const ft = flujoTotalFromDatosRow(r);
                return (
                  <tr key={r.fecha} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-2 py-1.5 tabular-nums">{r.fecha}</td>
                    <td className="px-2 py-1.5 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {ft != null ? fmtMx(ft) : '—'}
                    </td>
                    <td className="px-2 py-1.5">
                      <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => onEditar(r)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
