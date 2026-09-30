import { useMemo, useState } from 'react';
import { useStore, useComputed } from '../store.jsx';
import { Card, ModuleHeader, NumberInput, Select, Eyebrow, RangeBar, ErrorBox, Empty, Pill } from '../components/ui.jsx';
import { usd, x, pct, toNum } from '../format.js';

const BAND_TONE = { top20: 'low', top40: 'low', median: 'medium', bottom: 'high' };

export default function Comparator() {
  const { ref, scan, scanRes, metrics, setMetrics } = useStore();
  const s = scanRes.data?.valid ? scanRes.data : null;
  const [industry, setIndustry] = useState('');
  const [ebitda, setEbitda] = useState('');
  const [ev, setEv] = useState('');

  const ind = industry || scan.industry;
  const autoEbitda = s ? Math.round(s.ebitda) : null;
  const autoEv = s && ind === s.industry.key ? Math.round(s.ev.median) : null;
  const autoR40 = s ? s.inputs.growthRate + s.inputs.ebitdaMargin : null;
  const autoConc = s?.inputs.customerConcentration ?? null;

  const body = useMemo(
    () => ({
      industry: ind,
      ebitda: toNum(ebitda) ?? autoEbitda,
      ev: toNum(ev) ?? autoEv,
      metrics: {
        NRR: toNum(metrics.NRR),
        rule_of_40: toNum(metrics.rule_of_40) ?? autoR40,
        customer_concentration: toNum(metrics.customer_concentration) ?? autoConc,
        contract_term: toNum(metrics.contract_term),
        gross_margin: toNum(metrics.gross_margin),
      },
    }),
    [ind, ebitda, ev, metrics, autoEbitda, autoEv, autoR40, autoConc]
  );
  const res = useComputed('compare', body, { enabled: !!body.ebitda && !!ref });
  const d = res.data;
  const industries = ref ? Object.entries(ref.industries).map(([value, i]) => ({ value, label: i.label })) : [];
  const setM = (k) => (v) => setMetrics({ ...metrics, [k]: v });

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader index="2" title="行業倍數比較器" lead="把目前的估值換算成 EBITDA 倍數，放進行業區間看位置；再用頂級公司的五項關鍵指標，檢查差距在哪裡。" />
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="flex flex-col gap-4 p-5 lg:col-span-5 lg:self-start">
          <Select id="cmp-industry" label="行業" value={ind} onChange={setIndustry} options={industries} hint={industry ? null : '預設沿用模組 1'} />
          <div className="grid grid-cols-2 gap-4">
            <NumberInput id="cmp-ebitda" label="EBITDA" prefix="$" value={ebitda} onChange={setEbitda} placeholder={autoEbitda ? String(autoEbitda) : ''} hint={!ebitda && autoEbitda ? `自動帶入 ${usd(autoEbitda)}` : null} />
            <NumberInput id="cmp-ev" label="目前估值（EV）" optional prefix="$" value={ev} onChange={setEv} placeholder={autoEv ? String(autoEv) : '行業中位數'} hint={!ev ? (autoEv ? `自動帶入 ${usd(autoEv)}` : '留空以行業中位數計') : null} />
          </div>
          <div className="border-t border-line pt-4">
            <Eyebrow>五項關鍵指標</Eyebrow>
            <p className="mt-1 text-xs text-faint">未填寫的指標會標示為「未知」，不計入差距分析。</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput id="m-nrr" label="淨收入留存率" suffix="%" value={metrics.NRR} onChange={setM('NRR')} placeholder="例：105" />
            <NumberInput id="m-r40" label="Rule of 40" value={metrics.rule_of_40 ?? ''} onChange={setM('rule_of_40')} placeholder={autoR40 !== null ? String(autoR40) : '成長率+利潤率'} hint={!metrics.rule_of_40 && autoR40 !== null ? `自動：${autoR40}` : null} />
            <NumberInput id="m-conc" label="最大客戶集中度" suffix="%" value={metrics.customer_concentration} onChange={setM('customer_concentration')} placeholder={autoConc !== null ? String(autoConc) : ''} hint={!metrics.customer_concentration && autoConc !== null ? `自動：${autoConc}%` : null} />
            <NumberInput id="m-term" label="平均合約期限" suffix="月" value={metrics.contract_term} onChange={setM('contract_term')} placeholder="例：12" />
            <NumberInput id="m-gm" label="毛利率" suffix="%" value={metrics.gross_margin} onChange={setM('gross_margin')} placeholder="例：70" />
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          {res.error && <ErrorBox error={res.error.message} />}
          {!body.ebitda && <Empty>請輸入 EBITDA，或先在模組 1 完成估值掃描。</Empty>}
          {d && !res.error && <CompareResult d={d} />}
        </div>
      </div>
    </div>
  );
}

function CompareResult({ d }) {
  const r = d.industry;
  return (
    <>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow>目前倍數</Eyebrow>
            <div className="num mt-2 text-4xl font-semibold">{x(d.currentMultiple)}</div>
            <div className="mt-1 text-sm text-muted">{usd(d.currentEV)} ÷ {usd(d.ebitda)}{d.evSource === 'industry-median' ? '（以行業中位數估算）' : ''}</div>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-right">
            <Pill level={BAND_TONE[d.position.band]}>{d.position.label}</Pill>
            <p className="max-w-[26ch] text-xs text-muted">{d.position.text}</p>
          </div>
        </div>
        <RangeBar
          min={Math.min(r.min, d.currentMultiple) - 1}
          max={Math.max(r.top, d.currentMultiple) + 1}
          bands={[
            { from: r.min, to: r.max, className: 'bg-accent/25' },
            { from: r.max, to: r.top, className: 'bg-success/25' },
          ]}
          marks={[
            { value: r.min, label: `最低 ${x(r.min)}`, below: true },
            { value: r.median, label: `中位 ${x(r.median)}`, below: true },
            { value: r.max, label: `上緣 ${x(r.max)}`, below: true },
            { value: r.top, label: `頂級 ${x(r.top)}`, below: true, labelClass: 'text-success' },
            { value: d.currentMultiple, className: 'bg-accent', label: '您', labelClass: 'text-accent font-medium' },
          ]}
        />
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Eyebrow>與頂級標準的差距</Eyebrow>
          <span className="text-xs text-muted">已達標 {d.summary.met} / {d.summary.total} 項</span>
        </div>
        <div className="scroll-x mt-3 -mx-5 px-5">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-faint">
                <th className="py-2 font-normal">指標</th>
                <th className="py-2 text-right font-normal">您</th>
                <th className="py-2 text-right font-normal">頂級</th>
                <th className="py-2 text-right font-normal">狀態</th>
                <th className="py-2 text-right font-normal">修正後估值提升</th>
              </tr>
            </thead>
            <tbody className="num">
              {d.metrics.map((m) => (
                <tr key={m.key} className="border-t border-line/60">
                  <td className="py-2.5 pr-2 text-fg">{m.label}</td>
                  <td className="py-2.5 text-right">{m.user === null ? '—' : `${m.user}${m.unit === '%' ? '%' : ''}`}</td>
                  <td className="py-2.5 text-right text-muted">{m.better === 'lower' ? '≤ ' : '≥ '}{m.target}{m.unit === '%' ? '%' : m.unit === '個月' ? ' 月' : ''}</td>
                  <td className="py-2.5 text-right">
                    {m.status === 'meets' && <Pill level="low">達標</Pill>}
                    {m.status === 'below' && <Pill level="high">差距 {Math.abs(m.gap).toFixed(0)}</Pill>}
                    {m.status === 'unknown' && <span className="text-xs text-faint">未知</span>}
                  </td>
                  <td className="py-2.5 text-right">{m.status === 'below' ? pct(m.upliftIfFixed, 0, true) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <Eyebrow>若優化至頂級標準</Eyebrow>
          <div className="num mt-2 text-3xl font-semibold text-success">{pct(d.fullUplift, 0, true)}</div>
          <p className="mt-1 text-xs text-muted">以頂級倍數 {x(r.top)} 計，EV 約 {usd(d.topEV)}</p>
        </div>
        <p className="text-[13px] leading-relaxed text-muted">
          頂級倍數是「五項指標同時達標」的公司才拿得到的價格。每項指標的提升值為簡化估計（差距平均分配），實際影響取決於買方最在意的項目，通常客戶集中度與留存率權重最高。
        </p>
      </Card>
    </>
  );
}
