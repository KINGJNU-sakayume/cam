// URL 해시 ↔ 상태. 해시에는 영문·숫자·=·&만 쓴다. 검색어는 넣지 않는다.
const KEYS = ['g', 'v', 's', 'm', 'e', 'open', 'play', 'ps', 'pt', 'clip'];
export const OVERLAY_KEYS = ['play', 'ps', 'pt', 'clip'];
const SAFE = /^[A-Za-z0-9]*$/;

export function parseHash(h = location.hash) {
  const s = {};
  for (const part of h.replace(/^#/, '').split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = i < 0 ? part : part.slice(0, i);
    const v = i < 0 ? '' : part.slice(i + 1);
    if (KEYS.includes(k) && SAFE.test(v) && v !== '') s[k] = v;
  }
  return s;
}

export function toHash(state) {
  const parts = [];
  for (const k of KEYS) {
    const v = state[k];
    if (v != null && v !== '' && SAFE.test(String(v))) parts.push(`${k}=${v}`);
  }
  return parts.length ? `#${parts.join('&')}` : '#';
}

export function baseOf(state) {
  const b = { ...state };
  for (const k of OVERLAY_KEYS) delete b[k];
  return b;
}

let onChange = () => {};
export function initRouter(cb) {
  onChange = cb;
  window.addEventListener('hashchange', () => onChange(parseHash()));
}

// push: 뒤로 가기로 돌아올 수 있는 이동. replace: 같은 화면 안의 상태 변경
export function go(state, { replace = false } = {}) {
  const h = toHash(state);
  if (h === (location.hash || '#')) return;
  if (replace) {
    history.replaceState(history.state, '', h === '#' ? location.pathname + location.search : h);
    onChange(parseHash());
  } else {
    location.hash = h;
  }
}

export const href = (state) => toHash(state);
