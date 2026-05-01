const LOCALE = 'es-MX';

function formatNumber(n: number, opts: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(LOCALE, opts).format(n);
}

export function formatMXN(n: number | null | undefined) {
  if (n == null) return '—';
  if (Object.is(n, -0)) n = 0;
  if (n === 0) return '—';
  const abs = Math.abs(n);
  const s = '$' + formatNumber(abs, { maximumFractionDigits: 0 });
  return n < 0 ? `(${s})` : s;
}

export function formatUSD(n: number | null | undefined) {
  if (n == null) return '—';
  if (Object.is(n, -0)) n = 0;
  if (n === 0) return '—';
  const abs = Math.abs(n);
  const s = 'US$' + formatNumber(abs, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${s})` : s;
}

export function formatPct(n: number | null | undefined) {
  if (n == null) return '—';
  if (!Number.isFinite(n)) return '—';
  if (Object.is(n, -0)) n = 0;
  const sign = n > 0 ? '+' : '';
  const abs = Math.abs(n);
  const s = sign + formatNumber(abs, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  return n < 0 ? `(${s.replace('+', '')})` : s;
}

