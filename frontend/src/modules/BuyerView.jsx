import { useMemo, useState } from 'react';
import { useComputed, useBaseValuation } from '../store.jsx';
import { Card, ModuleHeader, NumberInput, Eyebrow, ErrorBox, Empty } from '../components/ui.jsx';
import { usd, toNum } from '../format.js';

export default function BuyerView() {
  const base = useBaseValuation();
  const [val, setVal] = useState('');
  const body = useMemo(() => ({ valuation: toNum(val) ?? base?.value ?? null }), [val, base?.value]);
  const res = useComputed('buyers', body, { enabled: !!body.valuation });
  const d = res.data;
  const [open, setOpen] = useState('Strategic');

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader index="5" title="買方視角評估器" lead="同一家公司，在四種買方眼中的價格、結構與審查重點都不同。選對買方，常比多做一年業績更影響成交價。" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-4">
          <Card className="p-5">
            <NumberInput id="buyer-val" label="基準估值（獨立價值）" prefix="$" value={val} onChange={setVal} placeholder={base ? String(Math.round(base.value)) : ''} hint={!val && base ? `自動帶入模組 1：${usd(base.value)}` : null} />
          </Card>
          {res.error && <ErrorBox error={res.error.message} />}
          {d && (
            <Card className="p-5">
              <Eyebrow>買方差異</Eyebrow>
              <div className="num mt-2 text-4xl font-semibold">{d.spread.ratio.toFixed(1)}x</div>
              <p className="mt-1 text-xs text-muted">戰略買家 vs 個人投資者（中位出價）</p>
              <div className="mt-4 border-t border-line pt-3 text-sm">
                <div className="text-xs text-muted">選錯買方可能少收</div>
                <div className="num mt-1 text-xl font-semibold text-warning">{usd(d.spread.gap)}</div>
              </div>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
          {!body.valuation && <Empty>請輸入基準估值，或先在模組 1 完成估值掃描。</Empty>}
          {d && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {d.buyers.map((b) => {
                  const on = open === b.key;
                  return (
                    <button key={b.key} type="button" onClick={() => setOpen(b.key)} aria-pressed={on} className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition ${on ? 'border-accent bg-accent/10' : 'border-line bg-panel hover:border-muted'}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-fg">{b.label}</span>
                        <span className="num text-xs text-faint">×{b.factor.toFixed(2)}</span>
                      </div>
                      <div className="num text-xl font-semibold text-fg">{usd(b.bid.low)} – {usd(b.bid.high)}</div>
                      <div className="text-xs text-muted">典型出價區間 · 現金 {b.structure.cash}</div>
                    </button>
                  );
                })}
              </div>
              {d.buyers.filter((b) => b.key === open).map((b) => (
                <Card key={b.key} className="p-5 sm:p-6">
                  <h3 className="font-display text-xl font-semibold">{b.label}</h3>
                  <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-fg/90">{b.logic}</p>
                  <div className="mt-5 grid gap-5 md:grid-cols-3">
                    <List title="關鍵驅動因素" items={b.drivers} />
                    <div>
                      <Eyebrow>典型交易結構</Eyebrow>
                      <div className="mt-2 flex flex-col gap-1 text-sm">
                        <div className="text-fg">現金 {b.structure.cash}</div>
                        <div className="text-muted">{b.structure.other}</div>
                        <p className="mt-1 text-xs text-faint">{b.structure.note}</p>
                      </div>
                    </div>
                    <List title="盡職調查重點" items={b.diligence} />
                  </div>
                </Card>
              ))}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-5">
                  <Eyebrow>關鍵洞察</Eyebrow>
                  <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-fg/90 marker:text-faint">
                    {d.insights.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </Card>
                <Card className="p-5">
                  <Eyebrow>競標流程建議</Eyebrow>
                  <ol className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-fg/90">
                    {d.process.map((t, i) => (
                      <li key={i} className="flex gap-3"><span className="num w-4 shrink-0 text-faint">{i + 1}</span><span>{t}</span></li>
                    ))}
                  </ol>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function List({ title, items }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm text-fg/90">
        {items.map((t) => (
          <li key={t} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" /><span>{t}</span></li>
        ))}
      </ul>
    </div>
  );
}
