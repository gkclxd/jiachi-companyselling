// 分享：把「輸入值」編碼進網址參數，伺服器不儲存任何資料
export function encodeState(state) {
  const json = JSON.stringify(state);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeState(s) {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return null;
  }
}
export function readSharedState() {
  try {
    const p = new URLSearchParams(window.location.search).get('d');
    return p ? decodeState(p) : null;
  } catch {
    return null;
  }
}
export function buildShareUrl(state) {
  const u = new URL(window.location.href);
  u.search = `?d=${encodeState(state)}`;
  return u.toString();
}
