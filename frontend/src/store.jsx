import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { post, getReference } from './api.js';
import { readSharedState } from './share.js';
import { toNum } from './format.js';

// 範例數據：首次開啟時顯示一個可運作的情境（非使用者數據）
export const SAMPLE = {
  scan: { revenue: '12000000', ebitdaMargin: '22', industry: 'B2B SaaS', growthRate: '28', customerConcentration: '24', recurringRevenue: '65' },
  metrics: { NRR: '108', customer_concentration: '', contract_term: '12', gross_margin: '72' },
  answers: { 1: 'yes', 7: 'yes', 13: 'unsure', 15: 'yes' },
  exit: { growthRate: '20', marginImprovement: '4', horizon: 3, buyerType: 'Strategic' },
};

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const shared = useMemo(() => readSharedState(), []);
  const [scan, setScan] = useState(shared?.scan ?? SAMPLE.scan);
  const [metrics, setMetrics] = useState(shared?.metrics ?? SAMPLE.metrics);
  const [answers, setAnswers] = useState(shared?.answers ?? SAMPLE.answers);
  const [exit, setExit] = useState(shared?.exit ?? SAMPLE.exit);
  const [isSample, setIsSample] = useState(!shared);
  const [ref, setRef] = useState(null);
  const [refError, setRefError] = useState(null);

  useEffect(() => {
    getReference().then(setRef).catch((e) => setRefError(e.message));
  }, []);

  const scanBody = useMemo(
    () => ({
      revenue: toNum(scan.revenue),
      ebitdaMargin: toNum(scan.ebitdaMargin),
      industry: scan.industry,
      growthRate: toNum(scan.growthRate),
      customerConcentration: toNum(scan.customerConcentration),
      recurringRevenue: toNum(scan.recurringRevenue),
    }),
    [scan]
  );
  const scanRes = useComputed('scan', scanBody);

  const touch = (fn) => (...a) => { setIsSample(false); fn(...a); };
  const value = {
    ref, refError,
    scan, setScan: touch(setScan), scanBody, scanRes,
    metrics, setMetrics: touch(setMetrics),
    answers, setAnswers: touch(setAnswers),
    exit, setExit: touch(setExit),
    isSample,
    clearAll: () => {
      setIsSample(false);
      setScan({ revenue: '', ebitdaMargin: '', industry: 'B2B SaaS', growthRate: '', customerConcentration: '', recurringRevenue: '' });
      setMetrics({ NRR: '', customer_concentration: '', contract_term: '', gross_margin: '' });
      setAnswers({});
      setExit({ growthRate: '', marginImprovement: '', horizon: 3, buyerType: 'PE' });
    },
    loadSample: () => { setScan(SAMPLE.scan); setMetrics(SAMPLE.metrics); setAnswers(SAMPLE.answers); setExit(SAMPLE.exit); setIsSample(true); },
    snapshot: () => ({ scan, metrics, answers, exit }),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

// 輸入變動後自動重算（去抖動），只採用最新一次回應
export function useComputed(route, body, { enabled = true, delay = 250 } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: false });
  const seq = useRef(0);
  const key = JSON.stringify(body);
  useEffect(() => {
    if (!enabled) { setState({ data: null, error: null, loading: false }); return; }
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(() => {
      post(route, body)
        .then((data) => id === seq.current && setState({ data, error: null, loading: false }))
        .catch((err) => id === seq.current && setState({ data: null, error: err, loading: false }));
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, key, enabled]);
  return state;
}

// 各模組共用的「目前估值」：取模組 1 中位數
export function useBaseValuation() {
  const { scanRes } = useStore();
  const d = scanRes.data;
  if (!d?.valid) return null;
  return { value: d.ev.median, multiple: d.effectiveMultiple.median, ebitda: d.ebitda, industry: d.industry.key };
}
