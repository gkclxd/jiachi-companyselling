export function usd(n, { compact = true } = {}) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (!compact) return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${a.toFixed(0)}`;
}
export const x = (n, d = 1) => (Number.isFinite(n) ? `${n.toFixed(d)}x` : '—');
export const pct = (n, d = 0, sign = false) => (Number.isFinite(n) ? `${sign && n > 0 ? '+' : ''}${(n * 100).toFixed(d)}%` : '—');
export const toNum = (v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(/,/g, '')));
