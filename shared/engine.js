// 公司估值盲點掃描器 — 計算引擎（純函式，不儲存任何資料）
// 後端 API 與單元測試共用；前端正式版不直接呼叫，只顯示後端結果。
import INDUSTRY_DATA from './data/industries.json' with { type: 'json' };
import BLIND_SPOTS from './data/blindspots.json' with { type: 'json' };
import BUYERS from './data/buyers.json' with { type: 'json' };

export const META = INDUSTRY_DATA._meta;
export const INDUSTRIES = INDUSTRY_DATA.industries;
export const TOP_TIER = INDUSTRY_DATA.topTier;
export { BLIND_SPOTS, BUYERS };

export class InputError extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function num(value, field, { min = -Infinity, max = Infinity, optional = false, label = field } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw new InputError(`請輸入${label}`, field);
  }
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;
  if (!isNum(n)) throw new InputError(`${label}必須是數字`, field);
  if (n < min || n > max) {
    const msg = max >= 1e12 ? `${label}必須大於 ${min >= 1 ? 0 : min}` : `${label}需介於 ${min} 至 ${max}`;
    throw new InputError(msg, field);
  }
  return n;
}

function industryOf(key) {
  if (!INDUSTRIES[key]) throw new InputError('請選擇有效的行業', 'industry');
  return INDUSTRIES[key];
}

// ───────────────────────── 模組 1：快速估值掃描器 ─────────────────────────
export function growthAdjustment(g) {
  if (g > 50) return 1.25;
  if (g > 30) return 1.15;
  if (g > 15) return 1.05;
  return 1.0;
}
export function concentrationDiscount(c) {
  if (c === null) return 1.0;
  if (c > 30) return 0.75;
  if (c > 20) return 0.85;
  return 1.0;
}
export function recurringPremium(r) {
  if (r === null) return 1.0;
  if (r > 70) return 1.15;
  if (r > 50) return 1.08;
  return 1.0;
}

export function scan(input = {}) {
  const revenue = num(input.revenue, 'revenue', { min: 1, max: 1e12, label: '年營收' });
  const margin = num(input.ebitdaMargin, 'ebitdaMargin', { min: -100, max: 100, label: 'EBITDA 利潤率' });
  const growth = num(input.growthRate, 'growthRate', { min: -100, max: 1000, label: '年成長率' });
  const conc = num(input.customerConcentration, 'customerConcentration', { min: 0, max: 100, optional: true, label: '最大客戶集中度' });
  const recur = num(input.recurringRevenue, 'recurringRevenue', { min: 0, max: 100, optional: true, label: '重複性收入比例' });
  const ind = industryOf(input.industry);

  const ebitda = revenue * (margin / 100);
  const fGrowth = growthAdjustment(growth);
  const fConc = concentrationDiscount(conc);
  const fRecur = recurringPremium(recur);
  const combined = fGrowth * fConc * fRecur;

  const hints = [];
  if (ebitda <= 0) {
    hints.push({ level: 'high', title: 'EBITDA 為負或為零', text: 'EBITDA 倍數法不適用。買方多半改用營收倍數、資產價值或策略價值評估，估值彈性與不確定性都更大。' });
    return {
      valid: false,
      inputs: { revenue, ebitdaMargin: margin, growthRate: growth, customerConcentration: conc, recurringRevenue: recur, industry: input.industry },
      ebitda,
      industry: { key: input.industry, ...ind },
      hints,
    };
  }

  const ev = {
    min: ebitda * ind.min * combined,
    median: ebitda * ind.median * combined,
    max: ebitda * ind.max * combined,
  };

  // 盲點提示
  if (conc === null) hints.push({ level: 'medium', title: '未提供客戶集中度', text: '這是買方盡職調查的第一批問題之一。若最大客戶超過 20%，估值可能被折價 15-25%。' });
  else if (conc > 30) hints.push({ level: 'high', title: `最大客戶佔 ${conc}%`, text: '已套用 25% 折價。買方通常會要求 Earn-out 或以該客戶續約為交割條件。' });
  else if (conc > 20) hints.push({ level: 'medium', title: `最大客戶佔 ${conc}%`, text: '已套用 15% 折價。降至 20% 以下即可移除此折價，理想目標 < 15%。' });
  else hints.push({ level: 'low', title: `客戶集中度 ${conc}%`, text: '在買方可接受範圍內。' });

  if (recur === null) hints.push({ level: 'medium', title: '未提供重複性收入比例', text: '重複性收入超過 70% 可帶來約 15% 溢價，是最直接的倍數槓桿之一。' });
  else if (recur <= 50) hints.push({ level: 'high', title: `重複性收入僅 ${recur}%`, text: '收入可預測性不足，買方會以較低倍數計價。提升至 50% 以上可取得 8% 溢價，70% 以上 15%。' });
  else if (recur <= 70) hints.push({ level: 'medium', title: `重複性收入 ${recur}%`, text: '已套用 8% 溢價；突破 70% 可提升至 15%。' });
  else hints.push({ level: 'low', title: `重複性收入 ${recur}%`, text: '已套用 15% 溢價。買方會進一步檢視合約期限與續約率。' });

  if (growth > 50) hints.push({ level: 'medium', title: `成長率 ${growth}%`, text: '高成長帶來 25% 溢價，但買方會要求驗證可持續性（在手訂單、同期群數據）。若為單年跳升，溢價可能不被承認。' });
  else if (growth < 0) hints.push({ level: 'high', title: '營收衰退', text: '負成長會使買方改以下緣倍數計價，並加強檢視客戶流失原因。' });
  else if (growth <= 15) hints.push({ level: 'low', title: `成長率 ${growth}%`, text: '未達成長溢價門檻（> 15%）。穩定成長對 PE 與家族辦公室仍具吸引力。' });

  if (margin > 40) hints.push({ level: 'medium', title: `EBITDA 利潤率 ${margin}%`, text: '利潤率偏高，買方會逐項檢視加回項目與所有者薪資是否合理。' });
  else if (margin < 10) hints.push({ level: 'medium', title: `EBITDA 利潤率 ${margin}%`, text: '利潤率偏低，請確認是否有未加回的一次性費用或所有者薪資高於市場水準。' });

  return {
    valid: true,
    inputs: { revenue, ebitdaMargin: margin, growthRate: growth, customerConcentration: conc, recurringRevenue: recur, industry: input.industry },
    ebitda,
    industry: { key: input.industry, ...ind },
    factors: { growth: fGrowth, concentration: fConc, recurring: fRecur, combined: round(combined, 4) },
    effectiveMultiple: { min: round(ind.min * combined), median: round(ind.median * combined), max: round(ind.max * combined) },
    ev,
    hints,
  };
}

// ───────────────────────── 模組 2：行業倍數比較器 ─────────────────────────
const METRIC_DEFS = [
  { key: 'NRR', label: '淨收入留存率（NRR）', unit: '%', better: 'higher' },
  { key: 'rule_of_40', label: 'Rule of 40（成長率 + 利潤率）', unit: '', better: 'higher' },
  { key: 'customer_concentration', label: '最大客戶集中度', unit: '%', better: 'lower' },
  { key: 'contract_term', label: '平均合約期限', unit: '個月', better: 'higher' },
  { key: 'gross_margin', label: '毛利率', unit: '%', better: 'higher' },
];
export { METRIC_DEFS };

export function positionOf(multiple, r) {
  if (multiple >= r.max) return { band: 'top20', label: '前 20%', text: '已達行業上緣，接近頂級公司定價區間。' };
  if (multiple >= (r.median + r.max) / 2) return { band: 'top40', label: '前 40%', text: '高於中位數，具備溢價條件。' };
  if (multiple >= (r.min + r.median) / 2) return { band: 'median', label: '中位數區間', text: '與一般同業定價相當。' };
  return { band: 'bottom', label: '後段', text: '低於多數同業，買方可能已在價格中反映風險。' };
}

export function compare(input = {}) {
  const ind = industryOf(input.industry);
  const ebitda = num(input.ebitda, 'ebitda', { min: 0.01, max: 1e12, label: 'EBITDA' });
  const ev = num(input.ev, 'ev', { min: 0, max: 1e14, optional: true, label: '企業價值' });
  const currentEV = ev ?? ebitda * ind.median;
  const currentMultiple = currentEV / ebitda;
  const top = TOP_TIER[input.industry];
  const m = input.metrics || {};

  const metrics = METRIC_DEFS.map((d) => {
    const user = num(m[d.key], d.key, { min: -1000, max: 1000, optional: true, label: d.label });
    const target = top[d.key];
    let status = 'unknown';
    let gap = null;
    if (user !== null) {
      gap = d.better === 'higher' ? user - target : target - user; // 正值 = 優於頂級標準
      status = gap >= 0 ? 'meets' : 'below';
    }
    return { ...d, user, target, gap, status };
  });

  const met = metrics.filter((x) => x.status === 'meets').length;
  const known = metrics.filter((x) => x.status !== 'unknown').length;
  const topEV = ebitda * ind.top;
  const fullUplift = currentEV > 0 ? (topEV - currentEV) / currentEV : null;
  // 每一項未達標指標，視為可貢獻（頂級倍數 − 目前倍數）的 1/5
  const perMetricMultiple = Math.max(0, ind.top - currentMultiple) / METRIC_DEFS.length;
  metrics.forEach((x) => {
    x.upliftIfFixed = x.status === 'below' && currentEV > 0 ? (perMetricMultiple * ebitda) / currentEV : 0;
  });

  return {
    industry: { key: input.industry, ...ind },
    ebitda,
    currentEV,
    evSource: ev === null ? 'industry-median' : 'user',
    currentMultiple: round(currentMultiple),
    position: positionOf(currentMultiple, ind),
    metrics,
    summary: { met, known, total: METRIC_DEFS.length },
    topEV,
    fullUplift: fullUplift === null ? null : Math.max(0, fullUplift),
  };
}

// ───────────────────────── 模組 3：估值盲點診斷儀 ─────────────────────────
const PRIORITY_WEIGHT = { high: 9, medium: 5, low: 4 }; // 7×9 + 5×5 + 3×4 = 100
const ANSWER_WEIGHT = { yes: 1, unsure: 0.5, no: 0 };

export function diagnose(input = {}) {
  const answers = input.answers || {};
  const valuation = num(input.valuation, 'valuation', { min: 0, max: 1e14, optional: true, label: '目前估值' });

  let penalty = 0;
  const items = BLIND_SPOTS.map((b) => {
    const a = answers[b.id] ?? answers[String(b.id)] ?? 'unanswered';
    const w = ANSWER_WEIGHT[a] ?? 0;
    penalty += PRIORITY_WEIGHT[b.priority] * w;
    return { ...b, answer: a, weight: w };
  });
  const answered = items.filter((i) => i.answer !== 'unanswered').length;
  const flagged = items.filter((i) => i.weight > 0);
  const score = Math.max(0, Math.round(100 - penalty));

  // 影響彙總：discount 類以乘法疊加折價；upside 類為低估的上修空間
  let discountKeep = 1;
  let upside = 1;
  let proceedsLoss = 0;
  const accuracy = [];
  for (const i of flagged) {
    const mid = ((i.low + i.high) / 2 / 100) * i.weight;
    if (i.kind === 'discount') discountKeep *= 1 - mid;
    else if (i.kind === 'upside') upside *= 1 + mid;
    else if (i.kind === 'proceeds') proceedsLoss = Math.max(proceedsLoss, mid);
    else if (i.kind === 'accuracy') accuracy.push(i);
  }
  discountKeep = Math.max(discountKeep, 0.4); // 避免疊加後失真
  const repairFactor = upside / discountKeep;

  const grade =
    score >= 85 ? { label: '交易準備度高', tone: 'success' } :
    score >= 65 ? { label: '有可改善空間', tone: 'accent' } :
    score >= 45 ? { label: '存在明顯盲點', tone: 'warning' } :
                  { label: '盲點集中，需優先處理', tone: 'danger' };

  return {
    score,
    grade,
    answered,
    total: BLIND_SPOTS.length,
    flaggedCount: flagged.length,
    groups: {
      high: flagged.filter((i) => i.priority === 'high'),
      medium: flagged.filter((i) => i.priority === 'medium'),
      low: flagged.filter((i) => i.priority === 'low'),
    },
    impact: {
      repairFactor: round(repairFactor, 4),
      upliftPct: round((repairFactor - 1) * 100, 1),
      currentValuation: valuation,
      repairedValuation: valuation === null ? null : valuation * repairFactor,
      proceedsLossPct: round(proceedsLoss * 100, 1),
      accuracyWarnings: accuracy.map((a) => ({ id: a.id, name: a.name, impact: a.impact })),
    },
    peer: {
      threshold: 3,
      exceeds: flagged.length >= 3,
      note: '業界常見觀察：約 70% 創始人至少忽略 3 項盲點（產業經驗說法，非本工具統計）。',
    },
  };
}

// 由模組 1 的輸入，預先判斷部分盲點
export function prefillAnswers(scanInputs = {}) {
  const out = {};
  const c = scanInputs.customerConcentration;
  const r = scanInputs.recurringRevenue;
  if (isNum(c)) out[4] = c > 20 ? 'yes' : 'no';
  if (isNum(r)) out[5] = r < 50 ? 'yes' : 'no';
  if (isNum(scanInputs.growthRate) && scanInputs.growthRate > 50) out[11] = 'unsure';
  return out;
}

// ───────────────────────── 模組 4：退出情境模擬器 ─────────────────────────
export const HORIZONS = [0, 1, 3, 5];
const DISCOUNT_RATE = 0.2; // 將未來價值折回今天的風險折現率（約 PE 門檻報酬）
const UNCERTAINTY_BASE = 0.1;
const UNCERTAINTY_PER_YEAR = 0.05;

// 規格修正：原式 1 + mi×0.1 會使利潤率 +5pt 即估值 ×1.5；依註解「每 1% 利潤率倍數 +0.1x」實作
export function marginMultipleBoost(marginImprovement, baseMultiple) {
  return (baseMultiple + 0.1 * marginImprovement) / baseMultiple;
}

export function projectValuation(current, growth, marginImprovement, years, baseMultiple) {
  if (years === 0) return current;
  return current * (1 + growth / 100) ** years * marginMultipleBoost(marginImprovement, baseMultiple);
}

export function exitSim(input = {}) {
  const current = num(input.currentValuation, 'currentValuation', { min: 1, max: 1e14, label: '目前估值' });
  const growth = num(input.growthRate, 'growthRate', { min: -90, max: 500, label: '預期成長率' });
  const mi = num(input.marginImprovement, 'marginImprovement', { min: -50, max: 50, label: '預期利潤率提升' });
  const baseMultiple = num(input.baseMultiple, 'baseMultiple', { min: 0.5, max: 100, optional: true, label: '目前 EBITDA 倍數' }) ?? 6;
  const horizon = HORIZONS.includes(Number(input.horizon)) ? Number(input.horizon) : 3;
  const buyerKey = BUYERS[input.buyerType] ? input.buyerType : 'PE';
  const buyerUnsure = !BUYERS[input.buyerType];

  const timeline = HORIZONS.map((y) => {
    const base = projectValuation(current, growth, mi, y, baseMultiple);
    const u = y === 0 ? UNCERTAINTY_BASE : UNCERTAINTY_BASE + UNCERTAINTY_PER_YEAR * y;
    const pv = base / (1 + DISCOUNT_RATE) ** y;
    return { years: y, base, low: base * (1 - u), high: base * (1 + u), uncertainty: u, presentValue: pv };
  });

  const at = timeline.find((t) => t.years === horizon);
  const buyers = Object.entries(BUYERS).map(([key, b]) => ({ key, label: b.label, factor: b.factor, value: at.base * b.factor }));

  const sens = (label, g, m, mult) => {
    const v = projectValuation(current, g, m, horizon, baseMultiple) * (mult / baseMultiple);
    return { label, value: v, delta: (v - at.base) / at.base };
  };
  const sensitivity = [
    { driver: '成長率 ±10pt', down: sens('-10pt', growth - 10, mi, baseMultiple), up: sens('+10pt', growth + 10, mi, baseMultiple) },
    { driver: '利潤率 ±5pt', down: sens('-5pt', growth, mi - 5, baseMultiple), up: sens('+5pt', growth, mi + 5, baseMultiple) },
    { driver: '倍數 ±2x', down: sens('-2x', growth, mi, Math.max(0.5, baseMultiple - 2)), up: sens('+2x', growth, mi, baseMultiple + 2) },
  ];

  const now = timeline[0];
  const insights = [];
  if (horizon > 0) {
    const gain = (at.base - now.base) / now.base;
    const pvGain = (at.presentValue - now.base) / now.base;
    insights.push(`延後 ${horizon} 年退出，名目估值 ${gain >= 0 ? '增加' : '減少'} ${Math.abs(gain * 100).toFixed(0)}%。`);
    insights.push(
      pvGain >= 0
        ? `以 ${DISCOUNT_RATE * 100}% 風險折現率折回今天，仍高出現在出售 ${(pvGain * 100).toFixed(0)}%，等待在數字上有其合理性。`
        : `以 ${DISCOUNT_RATE * 100}% 風險折現率折回今天，反而比現在出售低 ${Math.abs(pvGain * 100).toFixed(0)}%：預期成長不足以補償等待期間的執行與市場風險。`
    );
    insights.push(`${horizon} 年後估值區間的不確定性約 ±${(at.uncertainty * 100).toFixed(0)}%，期間任何客戶流失、利率或倍數變動都會直接反映在出售價格上。`);
  } else {
    insights.push('現在出售：價格確定性最高，但放棄了未來成長與利潤率改善的價值。');
  }
  const biggest = [...sensitivity].sort((a, b) => Math.abs(b.up.delta) + Math.abs(b.down.delta) - (Math.abs(a.up.delta) + Math.abs(a.down.delta)))[0];
  insights.push(`敏感度最高的變數是「${biggest.driver.split(' ')[0]}」，應優先驗證這項假設。`);

  const chosen = buyers.find((b) => b.key === buyerKey);
  return {
    inputs: { currentValuation: current, growthRate: growth, marginImprovement: mi, baseMultiple, horizon, buyerType: buyerKey, buyerUnsure },
    discountRate: DISCOUNT_RATE,
    timeline,
    buyers,
    chosenBuyer: chosen,
    sensitivity,
    insights,
    auction: { low: chosen.value * 1.25, high: chosen.value * 1.4, note: '引入 3-5 個有效買方進行競標，成交價常見提升 25-40%（產業經驗值）。' },
  };
}

// ───────────────────────── 模組 5：買方視角評估器 ─────────────────────────
export function buyerView(input = {}) {
  const valuation = num(input.valuation, 'valuation', { min: 1, max: 1e14, label: '基準估值' });
  const list = Object.entries(BUYERS).map(([key, b]) => {
    const mid = valuation * b.factor;
    return { key, ...b, bid: { low: mid * 0.9, mid, high: mid * 1.1 } };
  });
  const s = list.find((b) => b.key === 'Strategic');
  const i = list.find((b) => b.key === 'Individual');
  const ratio = s.factor / i.factor;
  const insights = [
    `以同一家公司計，戰略買家與個人投資者的中位出價差距約 ${ratio.toFixed(1)} 倍。`,
    `若只接觸個人投資者而錯過戰略買家，可能少收約 ${fmtUSD(s.bid.mid - i.bid.mid)}（以中位數計）。`,
    '最高出價不等於最佳交易：須同時比較現金比例、Earn-out 條件、賣方融資風險與交割確定性。',
  ];
  if (valuation > 20e6) insights.push('企業價值超過 2,000 萬美元時，個人投資者通常難以取得足夠融資，實務上較少成為主要競標者。');
  if (valuation < 3e6) insights.push('企業價值低於 300 萬美元時，戰略買家與 PE 的關注度通常較低，個人投資者與小型基金是更常見的買方。');
  return {
    valuation,
    buyers: list,
    spread: { ratio: round(ratio, 2), strategicMid: s.bid.mid, individualMid: i.bid.mid, gap: s.bid.mid - i.bid.mid },
    insights,
    process: [
      '同時接觸至少 2 種買方類型，建立真正的價格競爭',
      '設定明確的報價時程（IOI → LOI），避免被單一買方拖延',
      '先完成賣方盡職調查（QoE、法律、稅務），減少買方壓價空間',
      '比較「稅後、風險調整後」的實收金額，而非帳面價格',
      '由獨立顧問主導流程，創始人專注於維持營運表現',
    ],
  };
}

export function fmtUSD(n) {
  if (!isNum(n)) return '—';
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${a.toFixed(0)}`;
}

export function referenceData() {
  return { meta: META, industries: INDUSTRIES, topTier: TOP_TIER, blindSpots: BLIND_SPOTS, buyers: BUYERS, metricDefs: METRIC_DEFS, horizons: HORIZONS };
}
