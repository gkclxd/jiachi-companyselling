import { useId } from 'react';

export function Card({ className = '', children, as: Tag = 'section' }) {
  return <Tag className={`rounded-xl border border-line bg-panel shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_12px_32px_-16px_rgba(0,0,0,0.6)] ${className}`}>{children}</Tag>;
}

export function Eyebrow({ children }) {
  return <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{children}</p>;
}

export function ModuleHeader({ index, title, lead }) {
  return (
    <header className="flex flex-col gap-2">
      <Eyebrow>模組 {index}</Eyebrow>
      <h2 className="font-display text-2xl font-semibold text-fg sm:text-[28px]">{title}</h2>
      {lead && <p className="max-w-[62ch] text-sm leading-relaxed text-muted">{lead}</p>}
    </header>
  );
}

export function Field({ label, hint, error, optional, children, id }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-fg">
        <span>{label}</span>
        {optional && <span className="text-[11px] font-normal text-faint">選填</span>}
      </label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

const inputBase =
  'w-full rounded-lg border bg-ink/70 px-3 py-2.5 text-[15px] text-fg placeholder:text-faint transition focus:outline-none focus:ring-4 focus:ring-accent/25 focus:border-accent';

export function NumberInput({ label, value, onChange, suffix, prefix, hint, error, optional, placeholder, id: idProp, step = 'any' }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <Field label={label} hint={hint} error={error} optional={optional} id={id}>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-faint">{prefix}</span>}
        <input
          id={id}
          inputMode="decimal"
          type="number"
          step={step}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputBase} num ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-10' : ''} ${error ? 'border-danger' : 'border-line'}`}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-faint">{suffix}</span>}
      </div>
    </Field>
  );
}

export function Select({ label, value, onChange, options, hint, id: idProp }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <Field label={label} hint={hint} id={id}>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputBase} appearance-none border-line pr-9`}>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-panel">{o.label}</option>
          ))}
        </select>
        <svg aria-hidden="true" viewBox="0 0 12 12" className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 fill-muted"><path d="M6 8 2 4h8z" /></svg>
      </div>
    </Field>
  );
}

export function Button({ children, variant = 'primary', className = '', ...rest }) {
  const styles = {
    primary: 'bg-accent text-white hover:bg-accent-deep disabled:opacity-50',
    ghost: 'border border-line text-fg hover:border-muted hover:bg-white/[0.03]',
    link: 'text-accent hover:text-fg px-0 py-0',
  };
  return (
    <button type="button" className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${styles[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-lg border border-line bg-ink/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] transition ${value === o.value ? 'bg-panel text-fg shadow ring-1 ring-line' : 'text-muted hover:text-fg'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const TONE = {
  high: { dot: 'bg-danger', text: 'text-danger', ring: 'border-danger/40', bg: 'bg-danger/10', label: '高優先' },
  medium: { dot: 'bg-warning', text: 'text-warning', ring: 'border-warning/40', bg: 'bg-warning/10', label: '中優先' },
  low: { dot: 'bg-success', text: 'text-success', ring: 'border-success/40', bg: 'bg-success/10', label: '低優先' },
};
export const toneOf = (level) => TONE[level] || TONE.low;

export function Pill({ level, children }) {
  const t = toneOf(level);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border ${t.ring} ${t.bg} px-2 py-0.5 text-[11px] font-medium ${t.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {children ?? t.label}
    </span>
  );
}

export function Stat({ label, value, sub, big }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className={`num font-semibold text-fg ${big ? 'text-3xl sm:text-4xl' : 'text-xl'}`}>{value}</span>
      {sub && <span className="text-xs text-faint">{sub}</span>}
    </div>
  );
}

export function Row({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className={`num text-right ${strong ? 'font-semibold text-fg' : 'text-fg/90'}`}>{value}</span>
    </div>
  );
}

export function Notice({ children, tone = 'warning' }) {
  if (tone === 'warning') {
    return (
      <div className="flex gap-3 rounded-lg bg-warning px-4 py-3 text-sm leading-relaxed text-ink">
        <span aria-hidden="true">⚠️</span>
        <div className="min-w-0">{children}</div>
      </div>
    );
  }
  return <div className="rounded-lg border border-line bg-panel-2 px-4 py-3 text-sm leading-relaxed text-muted">{children}</div>;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>;
}

export function Empty({ children }) {
  return <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">{children}</div>;
}

// 一條刻度軸上的區間 + 標記（用於倍數與估值區間）
export function RangeBar({ min, max, marks = [], bands = [], format = (v) => v }) {
  const span = max - min || 1;
  const pos = (v) => `${Math.min(100, Math.max(0, ((v - min) / span) * 100))}%`;
  return (
    <div className="pt-7 pb-6">
      <div className="relative h-2 rounded-full bg-ink">
        {bands.map((b, i) => (
          <div key={i} className={`absolute inset-y-0 rounded-full ${b.className}`} style={{ left: pos(b.from), width: `calc(${pos(b.to)} - ${pos(b.from)})` }} />
        ))}
        {marks.map((m, i) => (
          <div key={i} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pos(m.value) }}>
            <div className={`h-4 w-[3px] rounded-full ${m.className || 'bg-fg'}`} />
            <div className={`num absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] ${m.below ? 'top-5' : 'bottom-5'} ${m.labelClass || 'text-muted'}`}>
              {m.label ?? format(m.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
