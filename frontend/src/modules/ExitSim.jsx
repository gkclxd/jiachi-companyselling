import { useMemo, useState } from 'react';
import { useStore, useComputed, useBaseValuation } from '../store.jsx';
import { Card, ModuleHeader, NumberInput, Segmented, Eyebrow, ErrorBox, Empty, Field } from '../components/ui.jsx';
import { usd, x, pct, toNum } from '../format.js';

const HORIZONS = [
  { value: 0, label: '現在' },
  { value: 1, label: '1 年' },
  { value: 3, label: '3 年' },
  { value: 5, label: '5 年' },
];
const BUYER_OPTS = [
  { value: 'Strategic', label: '戰略' },
  { value: 'PE', label: 'PE' },
  { value: 'Family Office', label: '家族辦公室' },
  { value: 'Individual', label: '個人' },
  { value: 'Unsure', label: '不確定' },
];

export default function ExitSim() {
  const { exit, setExit, scanRes } = useStore();
  const base = useBaseValuation();
  const [manualVal, setManualVal] = useState('');
  const [manualMult, setManualMult] = useState('');
  const set = (k) => (v) => setExit({ ...exit, [k]: v });
  const autoGrowth = scanRes.data?.inputs?.growthRate;

  const body = useMemo(
    () => ({
      currentValuation: toNum(manualVal) ?? base?.value ?? null,
      growthRate: toNum(exit.growthRate) ?? autoGrowth ?? null,
      marginImprovement: toNum(exit.marginImprovement) ?? 0,
      baseMultiple: toNum(manualMult) ?? base?.multiple ?? null,
      horizon: exit.horizon,
      buyerType: exit.buyerType,
    }),
    [manualVal, manualMult, exit, base?.value, base?.multiple, autoGrowth]
  );
  const ready = body.currentValuation && body.growthRate !== null;
  const res = useComputed('exit', body, { enabled: !!ready });
  const d = res.data;

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader index="4" title="退出情境模擬器" lead="比較現在出售與 1、3、5 年後出售的估值，並以 20% 風險折現率折回今天，看等待是否真的划算。" />
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="flex flex-col gap-4 p-5 lg:col-span-5 lg:self-start">
          <div className="grid grid-cols-2 gap-4">
            <NumberInput id="exit-val" label="目前估值" prefix="$" value={manualVal} onChange={setManualVal} placeholder={base ? String(Math.round(base.value)) : ''} hint={!manualVal && base ? `自動帶入 ${usd(base.value)}` : null} />
            <NumberInput id="exit-mult" label="目前 EBITDA 倍數" suffix="x" optional value={manualMult} onChange={setManualMult} placeholder={base ? base.multiple.toFixed(1) : '6'} hint={!manualMult && base ? `自動：${x(base.multiple)}` : null} />
            <NumberInput id="exit-growth" label="預期年成長率" suffix="%" value={exit.growthRate} onChange={set('growthRate')} placeholder={autoGrowth !== undefined ? String(autoGrowth) : '15'} hint={!exit.growthRate && autoGrowth !== undefined ? `自動：${autoGrowth}%` : null} />
            <NumberInput id="exit-margin" label="利潤率提升" suffix="pt" value={exit.marginImprovement} onChange={set('marginImprovement')} placeholder="0" hint="每 +1pt，倍數 +0.1x" />
          </div>
          <Field label="計劃退出時間" id="exit-horizon">
            <Segmented label="計劃退出時間" value={exit.horizon} onChange={set('horizon')} options={HORIZONS} />
          </Field>
          <Field label="買方類型偏好" id="exit-buyer">
            <Segmented label="買方類型偏好" value={exit.buyerType} onChange={set('buyerType')} options={BUYER_OPTS} />
          </Field>
          {d?.inputs.buyerUnsure && <p className="text-xs text-faint">未指定買方時，以 PE 作為基準價。</p>}
        </Card>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          {res.error && <ErrorBox error={res.error.message} />}
          {!ready && <Empty>請先在模組 1 完成估值，或手動輸入目前估值與成長率。</Empty>}
          {d && ready && !res.error && <ExitResult d={d} />}
        </div>
      </div>
    </div>
  );
}

function ExitResult({ d }) {
  const maxV = Math.max(...d.timeline.map((t) => t.high));
  const H = 180;
  const y = (v) => H - (v / maxV) * H;
  const maxBuyer = Math.max(...d.buyers.map((b) => b.value));
  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Eyebrow>不同退出時間的估值</Eyebrow>
          <div className="flex gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-accent" />名目估值</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-warning" />折回今天</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {d.timeline.map((t) => {
            const on = t.years === d.inputs.horizon;
            return (
              <div key={t.years} className="flex min-w-0 flex-col items-center gap-2">
                <div className="num text-center text-sm font-semibold text-fg">{usd(t.base)}</div>
                <div className="relative w-full" style={{ height: H }}>
                  {/* 不確定區間 */}
                  <div className="absolute left-1/2 w-px -translate-x-1/2 bg-muted/50" style={{ top: y(t.high), height: y(t.low) - y(t.high) }} />
                  <div className={`absolute bottom-0 left-1/2 w-3/5 max-w-14 -translate-x-1/2 rounded-t-md ${on ? 'bg-accent' : 'bg-accent/35'}`} style={{ top: y(t.base) }} />
                  {t.years > 0 && <div className="absolute left-1/2 h-0.5 w-4/5 max-w-20 -translate-x-1/2 bg-warning" style={{ top: y(t.presentValue) }} title={`折現值 ${usd(t.presentValue)}`} />}
                </div>
                <div className={`text-xs ${on ? 'font-medium text-fg' : 'text-muted'}`}>{t.years === 0 ? '現在' : `${t.years} 年後`}</div>
                <div className="num text-center text-[11px] leading-tight text-faint">{usd(t.low)}–{usd(t.high)}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <Eyebrow>{d.inputs.horizon === 0 ? '現在' : `${d.inputs.horizon} 年後`}・不同買方</Eyebrow>
          <ul className="mt-3 flex flex-col gap-3">
            {d.buyers.map((b) => {
              const on = b.key === d.chosenBuyer.key;
              return (
                <li key={b.key} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className={on ? 'font-medium text-fg' : 'text-muted'}>{b.label} <span className="num text-xs text-faint">×{b.factor}</span></span>
                    <span className="num text-fg">{usd(b.value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink">
                    <div className={`h-full rounded-full ${on ? 'bg-accent' : 'bg-muted/40'}`} style={{ width: `${(b.value / maxBuyer) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className="p-5">
          <Eyebrow>敏感性分析</Eyebrow>
          <div className="mt-3 flex flex-col gap-3">
            {d.sensitivity.map((s) => (
              <div key={s.driver} className="flex flex-col gap-1">
                <div className="text-[13px] text-muted">{s.driver}</div>
                <div className="num grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-danger/10 px-2 py-1.5 text-danger">{pct(s.down.delta, 0, true)}<span className="ml-1 text-xs text-muted">{usd(s.down.value)}</span></div>
                  <div className="rounded-md bg-success/10 px-2 py-1.5 text-success">{pct(s.up.delta, 0, true)}<span className="ml-1 text-xs text-muted">{usd(s.up.value)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <Eyebrow>關鍵洞察</Eyebrow>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-fg/90 marker:text-faint">
          {d.insights.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
        <div className="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3">
          <div className="text-sm font-medium text-fg">競標流程：{usd(d.auction.low)} – {usd(d.auction.high)}</div>
          <p className="mt-1 text-[13px] text-muted">{d.auction.note}以 {d.chosenBuyer.label} 基準價 {usd(d.chosenBuyer.value)} 計。</p>
        </div>
      </Card>
    </>
  );
}
