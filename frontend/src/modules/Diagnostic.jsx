import { useMemo } from 'react';
import { useStore, useComputed, useBaseValuation } from '../store.jsx';
import { Card, ModuleHeader, Eyebrow, Segmented, Pill, Button, ErrorBox, Empty, toneOf } from '../components/ui.jsx';
import { usd, pct } from '../format.js';

const OPTIONS = [
  { value: 'yes', label: '是' },
  { value: 'unsure', label: '不確定' },
  { value: 'no', label: '否' },
];
const GROUPS = [
  { key: 'high', title: '高優先級', when: '立即關注' },
  { key: 'medium', title: '中優先級', when: '6-12 個月內關注' },
  { key: 'low', title: '低優先級', when: '長期關注' },
];
const TONE_TEXT = { success: 'text-success', accent: 'text-accent', warning: 'text-warning', danger: 'text-danger' };
const TONE_STROKE = { success: 'stroke-success', accent: 'stroke-accent', warning: 'stroke-warning', danger: 'stroke-danger' };

export default function Diagnostic() {
  const { ref, answers, setAnswers, scanRes } = useStore();
  const base = useBaseValuation();
  const body = useMemo(() => ({ answers, valuation: base?.value ?? null }), [answers, base?.value]);
  const res = useComputed('diagnose', body, { enabled: !!ref });
  const s = scanRes.data?.inputs;

  const prefill = () => {
    if (!s) return;
    const next = { ...answers };
    if (s.customerConcentration !== null) next[4] = s.customerConcentration > 20 ? 'yes' : 'no';
    if (s.recurringRevenue !== null) next[5] = s.recurringRevenue < 50 ? 'yes' : 'no';
    if (s.growthRate > 50) next[11] = 'unsure';
    setAnswers(next);
  };

  const categories = useMemo(() => {
    if (!ref) return [];
    const m = new Map();
    ref.blindSpots.forEach((b) => { if (!m.has(b.category)) m.set(b.category, []); m.get(b.category).push(b); });
    return [...m.entries()];
  }, [ref]);
  const answered = Object.keys(answers).length;

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader index="3" title="估值盲點診斷儀" lead="15 項買方盡職調查時最常壓價的問題。回答「是」代表您的公司目前有這個情況；不確定就選「不確定」，會以一半權重計算。" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="num text-sm text-muted">已回答 {answered} / 15</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={prefill} disabled={!s} className="py-1.5 text-[13px]">依模組 1 自動判斷</Button>
              <Button variant="ghost" onClick={() => setAnswers({})} className="py-1.5 text-[13px]">清除</Button>
            </div>
          </div>
          {categories.map(([cat, items]) => (
            <Card key={cat} className="p-5">
              <Eyebrow>{cat}</Eyebrow>
              <ol className="mt-3 flex flex-col divide-y divide-line/60">
                {items.map((b) => (
                  <li key={b.id} className="flex flex-col gap-3 py-3.5 first:pt-1 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="num text-xs text-faint">{String(b.id).padStart(2, '0')}</span>
                        <span className="text-sm font-medium text-fg">{b.name}</span>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted">{b.question}</p>
                    </div>
                    <div className="shrink-0 sm:w-52">
                      <Segmented label={b.name} value={answers[b.id]} options={OPTIONS} onChange={(v) => setAnswers({ ...answers, [b.id]: v })} />
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          <div className="flex flex-col gap-4 lg:sticky lg:top-24">
            {res.error && <ErrorBox error={res.error.message} />}
            {!res.data && !res.error && <Empty>正在計算…</Empty>}
            {res.data && <DiagnoseResult d={res.data} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score, tone }) {
  const r = 42, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-ink" />
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round" className={`${TONE_STROKE[tone]} transition-[stroke-dashoffset] duration-500`} strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
    </svg>
  );
}

function DiagnoseResult({ d }) {
  const imp = d.impact;
  return (
    <>
      <Card className="p-5">
        <div className="flex items-center gap-5">
          <div className="relative">
            <ScoreRing score={d.score} tone={d.grade.tone} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="num text-3xl font-semibold">{d.score}</span>
              <span className="text-[10px] text-faint">/ 100</span>
            </div>
          </div>
          <div className="min-w-0">
            <Eyebrow>交易準備度評分</Eyebrow>
            <div className={`mt-1 text-lg font-medium ${TONE_TEXT[d.grade.tone]}`}>{d.grade.label}</div>
            <p className="mt-1 text-xs text-muted">發現 {d.flaggedCount} 項盲點（含「不確定」）</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <Eyebrow>盲點總體影響</Eyebrow>
        {imp.currentValuation ? (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted">目前估值（模組 1）</div>
              <div className="num mt-1 text-xl font-semibold">{usd(imp.currentValuation)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">修復後估值</div>
              <div className="num mt-1 text-xl font-semibold text-success">{usd(imp.repairedValuation)}</div>
              <div className="num text-xs text-success">{pct(imp.upliftPct / 100, 0, true)}</div>
            </div>
          </div>
        ) : (
          <p className="num mt-2 text-sm text-muted">修復全部已標示盲點，估值潛在提升 <span className="font-semibold text-success">{pct(imp.upliftPct / 100, 0, true)}</span>。完成模組 1 可換算成金額。</p>
        )}
        {(imp.proceedsLossPct > 0 || imp.accuracyWarnings.length > 0) && (
          <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-3 text-[13px] text-muted">
            {imp.proceedsLossPct > 0 && <li>稅務規劃未整合：稅後實收可能再減少約 <span className="num text-warning">{imp.proceedsLossPct}%</span>，不反映在企業價值上。</li>}
            {imp.accuracyWarnings.map((a) => (
              <li key={a.id}>「{a.name}」會讓您心中的估值偏離事實（{a.impact.replace('估值', '')}），修正的是預期，不是公司價值。</li>
            ))}
          </ul>
        )}
      </Card>

      {GROUPS.map((g) => {
        const items = d.groups[g.key];
        if (!items.length) return null;
        const t = toneOf(g.key);
        return (
          <Card key={g.key} className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                <span className="text-sm font-medium">{g.title}</span>
                <span className="text-xs text-faint">{g.when}</span>
              </div>
              <span className="num text-xs text-muted">{items.length} 項</span>
            </div>
            <ul className="mt-3 flex flex-col gap-3">
              {items.map((i) => (
                <li key={i.id} className={`rounded-lg border-l-2 bg-panel-2 px-3 py-2.5 ${t.ring}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-fg">{i.name}</span>
                    {i.answer === 'unsure' && <span className="text-[11px] text-faint">（不確定）</span>}
                  </div>
                  <p className="mt-1 text-[13px] text-muted">{i.description}</p>
                  <p className={`mt-1 text-[13px] ${t.text}`}>影響：{i.impact}</p>
                  <p className="mt-0.5 text-[13px] text-fg/85">建議：{i.recommendation}</p>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      <Card className="p-5">
        <Eyebrow>同儕比較</Eyebrow>
        <p className="mt-2 text-sm text-fg">
          您標示了 <span className="num font-semibold">{d.flaggedCount}</span> 項盲點，{d.peer.exceeds ? '與多數創始人的情況相近。' : '少於常見的 3 項門檻。'}
        </p>
        <p className="mt-1 text-xs text-faint">{d.peer.note}</p>
      </Card>
    </>
  );
}
