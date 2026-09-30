import { useStore } from '../store.jsx';
import { Card, ModuleHeader, NumberInput, Select, Row, Pill, ErrorBox, Empty, Eyebrow, RangeBar, Notice } from '../components/ui.jsx';
import { usd, x } from '../format.js';

const factorText = (f) => (f === 1 ? '×1.00（無調整）' : `×${f.toFixed(2)}（${f > 1 ? '+' : ''}${Math.round((f - 1) * 100)}%）`);

export default function Scanner() {
  const { ref, scan, setScan, scanRes } = useStore();
  const set = (k) => (v) => setScan({ ...scan, [k]: v });
  const industries = ref ? Object.entries(ref.industries).map(([value, i]) => ({ value, label: i.label })) : [];
  const err = scanRes.error;
  const fieldErr = (f) => (err?.field === f ? err.message : null);
  const d = scanRes.data;

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader index="1" title="快速估值掃描器" lead="以行業 EBITDA 倍數為基礎，依成長率、客戶集中度與重複性收入調整，得出企業價值（EV）的參考區間。輸入後結果自動更新。" />
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="flex flex-col gap-4 p-5 lg:col-span-5 lg:self-start">
          <NumberInput id="revenue" label="年營收" prefix="$" value={scan.revenue} onChange={set('revenue')} placeholder="10000000" hint={scan.revenue ? usd(Number(scan.revenue), { compact: false }) + ' 美元' : '美元，最近 12 個月'} error={fieldErr('revenue')} />
          <div className="grid grid-cols-2 gap-4">
            <NumberInput id="ebitdaMargin" label="EBITDA 利潤率" suffix="%" value={scan.ebitdaMargin} onChange={set('ebitdaMargin')} placeholder="20" error={fieldErr('ebitdaMargin')} />
            <NumberInput id="growthRate" label="年成長率" suffix="%" value={scan.growthRate} onChange={set('growthRate')} placeholder="15" error={fieldErr('growthRate')} />
          </div>
          <Select id="industry" label="行業" value={scan.industry} onChange={set('industry')} options={industries} />
          <div className="grid grid-cols-2 gap-4">
            <NumberInput id="customerConcentration" label="最大客戶集中度" optional suffix="%" value={scan.customerConcentration} onChange={set('customerConcentration')} placeholder="例：18" error={fieldErr('customerConcentration')} />
            <NumberInput id="recurringRevenue" label="重複性收入比例" optional suffix="%" value={scan.recurringRevenue} onChange={set('recurringRevenue')} placeholder="例：60" error={fieldErr('recurringRevenue')} />
          </div>
          <p className="text-xs leading-relaxed text-faint">EBITDA 請使用「調整後」數字（加回一次性費用、所有者薪資標準化），否則請參考模組 3 的財務結構盲點。</p>
        </Card>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          {err && !err.field && <ErrorBox error={err.message} />}
          {!d && !err && <Empty>正在計算…</Empty>}
          {err?.field && <Empty>請修正左側標示的欄位。</Empty>}
          {d && !err && !d.valid && (
            <Card className="p-5">
              <Eyebrow>無法以 EBITDA 倍數估值</Eyebrow>
              <p className="mt-2 text-sm text-muted">{d.hints[0]?.text}</p>
            </Card>
          )}
          {d?.valid && !err && <ScanResult d={d} loading={scanRes.loading} />}
        </div>
      </div>
    </div>
  );
}

function ScanResult({ d, loading }) {
  const f = d.factors;
  return (
    <>
      <Card className={`p-5 sm:p-6 transition-opacity ${loading ? 'opacity-70' : ''}`}>
        <Eyebrow>企業價值區間（EV）</Eyebrow>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <div className="num text-4xl font-semibold text-fg sm:text-5xl">{usd(d.ev.median)}</div>
            <div className="mt-1 text-sm text-muted">中位數估值 · 有效倍數 {x(d.effectiveMultiple.median)} EBITDA</div>
          </div>
          <div className="num text-right text-lg text-fg/90">
            {usd(d.ev.min)} <span className="text-faint">–</span> {usd(d.ev.max)}
            <div className="text-xs text-muted">參考區間</div>
          </div>
        </div>
        <RangeBar
          min={d.ev.min * 0.85}
          max={d.ev.max * 1.08}
          bands={[{ from: d.ev.min, to: d.ev.max, className: 'bg-accent/35' }]}
          marks={[
            { value: d.ev.min, label: `下緣 ${x(d.effectiveMultiple.min)}`, below: true },
            { value: d.ev.median, className: 'bg-accent', label: '中位數', labelClass: 'text-accent' },
            { value: d.ev.max, label: `上緣 ${x(d.effectiveMultiple.max)}`, below: true },
          ]}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <Eyebrow>計算基礎</Eyebrow>
          <div className="mt-2">
            <Row label="年營收" value={usd(d.inputs.revenue)} />
            <Row label={`EBITDA（${d.inputs.ebitdaMargin}%）`} value={usd(d.ebitda)} strong />
            <Row label={`${d.industry.label} 倍數`} value={`${x(d.industry.min)} / ${x(d.industry.median)} / ${x(d.industry.max)}`} />
            <Row label="成長率調整" value={factorText(f.growth)} />
            <Row label="客戶集中度" value={factorText(f.concentration)} />
            <Row label="重複性收入" value={factorText(f.recurring)} />
            <Row label="綜合調整係數" value={`×${f.combined.toFixed(3)}`} strong />
          </div>
        </Card>
        <Card className="p-5">
          <Eyebrow>盲點提示</Eyebrow>
          <ul className="mt-3 flex flex-col gap-3">
            {d.hints.map((h, i) => (
              <li key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Pill level={h.level}>{{ high: '需關注', medium: '留意', low: '正常' }[h.level]}</Pill>
                  <span className="text-sm font-medium text-fg">{h.title}</span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted">{h.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Notice>此區間以行業基準倍數推算，未反映規模、地區、談判與盡職調查結果。實際成交價可能落在區間之外。</Notice>
    </>
  );
}
