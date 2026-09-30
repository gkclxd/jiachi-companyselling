import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store.jsx';
import { IS_DEMO } from './api.js';
import { buildShareUrl } from './share.js';
import { Button } from './components/ui.jsx';
import Scanner from './modules/Scanner.jsx';
import Comparator from './modules/Comparator.jsx';
import Diagnostic from './modules/Diagnostic.jsx';
import ExitSim from './modules/ExitSim.jsx';
import BuyerView from './modules/BuyerView.jsx';

const TABS = [
  { id: 'scan', label: '估值掃描', C: Scanner },
  { id: 'compare', label: '倍數比較', C: Comparator },
  { id: 'diagnose', label: '盲點診斷', C: Diagnostic },
  { id: 'exit', label: '退出情境', C: ExitSim },
  { id: 'buyers', label: '買方視角', C: BuyerView },
];
const readTab = () => {
  const h = window.location.hash.replace('#', '');
  return TABS.some((t) => t.id === h) ? h : 'scan';
};

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const [tab, setTab] = useState(readTab);
  const { isSample, loadSample, clearAll, snapshot, refError } = useStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const on = () => setTab(readTab());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (id) => {
    setTab(id);
    try { history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`); } catch { /* 預覽環境可能禁止 */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const share = async () => {
    const url = buildShareUrl(snapshot());
    try { await navigator.clipboard.writeText(url); } catch { window.prompt?.('複製此連結', url); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const Active = TABS.find((t) => t.id === tab).C;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 pb-6 pt-8 sm:px-6 sm:pt-12">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Valuation Blind-Spot Scanner</p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-fg sm:text-4xl">公司估值盲點掃描器</h1>
            <p className="mt-2 text-sm text-muted">公司到底值多少？用數據驗證盲區。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isSample ? (
              <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] text-warning">目前顯示範例數據</span>
            ) : (
              <Button variant="ghost" onClick={loadSample} className="py-1.5 text-[13px]">載入範例</Button>
            )}
            <Button variant="ghost" onClick={clearAll} className="py-1.5 text-[13px]">清空重填</Button>
            {!IS_DEMO && <Button onClick={share} className="py-1.5 text-[13px]">{copied ? '已複製連結' : '複製分享連結'}</Button>}
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-20 border-b border-line/70 bg-ink/90 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }} aria-label="功能模組">
        <div className="scroll-x mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex gap-1">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`relative whitespace-nowrap px-3 py-3.5 text-sm transition ${tab === t.id ? 'text-fg' : 'text-muted hover:text-fg'}`}
              >
                <span className="num mr-1.5 text-xs text-faint">{i + 1}</span>
                {t.label}
                {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {refError && <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{refError}</div>}
        <Active />
        <div className="mt-10 flex flex-wrap justify-between gap-3 border-t border-line/70 pt-6">
          {TABS.findIndex((t) => t.id === tab) > 0 ? (
            <Button variant="ghost" onClick={() => go(TABS[TABS.findIndex((t) => t.id === tab) - 1].id)}>← {TABS[TABS.findIndex((t) => t.id === tab) - 1].label}</Button>
          ) : <span />}
          {TABS.findIndex((t) => t.id === tab) < TABS.length - 1 && (
            <Button onClick={() => go(TABS[TABS.findIndex((t) => t.id === tab) + 1].id)}>下一步：{TABS[TABS.findIndex((t) => t.id === tab) + 1].label} →</Button>
          )}
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}

function Disclaimer() {
  return (
    <footer className="border-t border-line/70 bg-panel-2">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-[13px] leading-relaxed sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="font-medium text-fg">⚠️ 重要聲明</p>
          <p className="mt-2 text-muted">
            本工具僅供觀念參考，不構成財務、法律或稅務建議。數據來源為公開行業基準，可能與您的實際情況有差異。
            實際交易價格受市場條件、談判能力、盡職調查結果等多重因素影響。建議諮詢您的財務顧問、會計師或律師進行完整分析。
          </p>
          <p className="mt-3 text-muted">📌 本工具創作者不賣產品、不接個案、不提供諮詢服務。完全免費開放，僅供獨立研究者與企業主參考。</p>
          <p className="mt-3 text-xs text-faint">隱私：輸入資料僅用於即時計算，伺服器不儲存、不追蹤、不使用分析工具。行業倍數基準：2026 Q3 參考值。</p>
        </div>
        <p className="self-end whitespace-nowrap text-xs text-faint md:text-right">本工具僅供觀念參考，不構成財務建議。<br />不賣產品，不接個案。</p>
      </div>
    </footer>
  );
}
