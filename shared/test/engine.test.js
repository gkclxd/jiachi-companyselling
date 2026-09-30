import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);

test('scan: 規格範例計算', () => {
  // 營收 1,000 萬、利潤率 20% → EBITDA 200 萬；B2B SaaS 中位 11x
  // 成長 35% → 1.15；集中度 25% → 0.85；重複性 80% → 1.15
  const r = E.scan({ revenue: 10_000_000, ebitdaMargin: 20, industry: 'B2B SaaS', growthRate: 35, customerConcentration: 25, recurringRevenue: 80 });
  assert.equal(r.valid, true);
  close(r.ebitda, 2_000_000);
  const f = 1.15 * 0.85 * 1.15;
  close(r.ev.min, 2e6 * 8 * f);
  close(r.ev.median, 2e6 * 11 * f);
  close(r.ev.max, 2e6 * 14 * f);
});

test('scan: 門檻邊界（嚴格大於）', () => {
  assert.equal(E.growthAdjustment(50), 1.15);
  assert.equal(E.growthAdjustment(50.01), 1.25);
  assert.equal(E.growthAdjustment(15), 1.0);
  assert.equal(E.concentrationDiscount(20), 1.0);
  assert.equal(E.concentrationDiscount(30), 0.85);
  assert.equal(E.recurringPremium(70), 1.08);
  assert.equal(E.recurringPremium(null), 1.0);
});

test('scan: 選填欄位空白不影響', () => {
  const r = E.scan({ revenue: '5,000,000', ebitdaMargin: 15, industry: 'Manufacturing', growthRate: 5 });
  close(r.ev.median, 750_000 * 5.5);
  assert.ok(r.hints.some((h) => h.title.includes('未提供客戶集中度')));
});

test('scan: EBITDA 為負', () => {
  const r = E.scan({ revenue: 1e6, ebitdaMargin: -5, industry: 'Other', growthRate: 10 });
  assert.equal(r.valid, false);
});

test('scan: 輸入驗證', () => {
  assert.throws(() => E.scan({ revenue: 0, ebitdaMargin: 10, industry: 'Other', growthRate: 1 }), E.InputError);
  assert.throws(() => E.scan({ revenue: 1e6, ebitdaMargin: 10, industry: 'X', growthRate: 1 }), /行業/);
  assert.throws(() => E.scan({ revenue: 1e6, ebitdaMargin: 'abc', industry: 'Other', growthRate: 1 }), /數字/);
});

test('compare: 位置與提升', () => {
  const r = E.compare({ industry: 'B2B SaaS', ebitda: 1e6, ev: 9e6, metrics: { NRR: 110, rule_of_40: 55, customer_concentration: 10, contract_term: 12, gross_margin: 70 } });
  assert.equal(r.currentMultiple, 9);
  assert.equal(r.position.band, 'bottom'); // (8+11)/2 = 9.5
  assert.equal(r.summary.met, 3);
  close(r.fullUplift, (18e6 - 9e6) / 9e6);
  assert.equal(r.metrics.find((m) => m.key === 'customer_concentration').status, 'meets');
  assert.equal(E.positionOf(14, E.INDUSTRIES['B2B SaaS']).band, 'top20');
  assert.equal(E.positionOf(12.5, E.INDUSTRIES['B2B SaaS']).band, 'top40');
});

test('diagnose: 全部為否 = 100 分；全部為是 = 0 分', () => {
  const no = Object.fromEntries(E.BLIND_SPOTS.map((b) => [b.id, 'no']));
  const yes = Object.fromEntries(E.BLIND_SPOTS.map((b) => [b.id, 'yes']));
  assert.equal(E.diagnose({ answers: no }).score, 100);
  const all = E.diagnose({ answers: yes, valuation: 10e6 });
  assert.equal(all.score, 0);
  assert.ok(all.impact.repairedValuation > 10e6);
  assert.equal(all.groups.high.length, 7);
});

test('diagnose: 權重總和 = 100', () => {
  const w = { high: 9, medium: 5, low: 4 };
  assert.equal(E.BLIND_SPOTS.reduce((s, b) => s + w[b.priority], 0), 100);
});

test('exit: 投影公式（依註解修正後）', () => {
  const r = E.exitSim({ currentValuation: 10e6, growthRate: 20, marginImprovement: 5, baseMultiple: 10, horizon: 3, buyerType: 'Strategic' });
  const expected = 10e6 * 1.2 ** 3 * ((10 + 0.5) / 10);
  close(r.timeline.find((t) => t.years === 3).base, expected);
  close(r.timeline[0].base, 10e6);
  close(r.chosenBuyer.value, expected * 1.35);
  assert.equal(r.sensitivity.length, 3);
});

test('buyerView: 差距倍數', () => {
  const r = E.buyerView({ valuation: 10e6 });
  close(r.spread.ratio, Math.round((1.35 / 0.65) * 100) / 100);
  assert.equal(r.buyers.length, 4);
});

test('fmtUSD', () => {
  assert.equal(E.fmtUSD(12_345_678), '$12.35M');
  assert.equal(E.fmtUSD(2.5e9), '$2.50B');
});
