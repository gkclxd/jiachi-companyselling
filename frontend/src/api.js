// 前端資料層。正式版：所有計算呼叫後端 API。
// demo 模式（VITE_LOCAL_ENGINE=true）：為離線預覽，直接在瀏覽器執行同一份計算引擎。
const LOCAL = import.meta.env.VITE_LOCAL_ENGINE === 'true';
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const IS_DEMO = LOCAL;

let enginePromise;
const engine = () => (enginePromise ||= import('../../shared/engine.js'));
const LOCAL_ROUTES = { scan: 'scan', compare: 'compare', diagnose: 'diagnose', exit: 'exitSim', buyers: 'buyerView' };

export class ApiError extends Error {
  constructor(message, field) { super(message); this.field = field; }
}

export async function post(route, body) {
  if (LOCAL) {
    const e = await engine();
    try {
      return structuredClone(e[LOCAL_ROUTES[route]](structuredClone(body)));
    } catch (err) {
      throw new ApiError(err.message, err.field);
    }
  }
  let res;
  try {
    res = await fetch(`${BASE}/api/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('無法連線到計算服務，請確認網路後再試一次。');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || '計算服務暫時無法使用。', data.field);
  return data;
}

export async function getReference() {
  if (LOCAL) return (await engine()).referenceData();
  const res = await fetch(`${BASE}/api/reference`);
  if (!res.ok) throw new ApiError('無法載入基準資料。');
  return res.json();
}
