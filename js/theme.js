// 라이트·다크 전환과 그룹 강조색(대비 4.5:1 이상이 되도록 명도만 조정)
const KEY = 'sd.theme';

export function storedTheme() {
  try { const t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : null; } catch { return null; }
}
export function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
export function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(KEY, next); } catch { /* 저장 불가: 이번 방문에만 적용 */ }
  return next;
}

export function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const rgbStr = ([r, g, b]) => `rgb(${r} ${g} ${b})`;

// 배경들 모두에 대해 4.5:1 이상인 명도를 찾는다
function fit(h, s, l, bgs, step, extra) {
  for (let i = 0; i < 100; i++) {
    const c = hslToRgb(h, s, l);
    if (bgs.every((b) => contrast(c, b) >= 4.5) && (!extra || extra(c))) return c;
    l += step;
    if (l <= 0 || l >= 100) break;
  }
  return hslToRgb(h, s, Math.max(0, Math.min(100, l)));
}

// B안(포토카드 바인더): 강조색을 그룹 hue로 계산하지 않고 먹색 하나로 쓴다. 그룹 색은 탭의 작은 표시에만.
export function accentVars(hue, dark) {
  if (!dark) return { '--accent': '#1a1b1e', '--accent-ink': '#1a1b1e', '--accent-soft': '#dfe1e5', '--on-accent': '#fafafa', '--accent-dark': '#ecedef' };
  return { '--accent': '#ecedef', '--accent-ink': '#ecedef', '--accent-soft': '#2c2f35', '--on-accent': '#141518', '--accent-dark': '#ecedef' };
}
// 예전 계산식(그룹 hue로 대비 4.5:1 강조색). 다시 쓰려면 accentVars를 이것으로 바꾼다
export function hueAccentVars(hue, dark) {
  const h = Number.isFinite(hue) ? hue : 200;
  if (!dark) {
    const soft = hslToRgb(h, 60, 92);
    const white = [255, 255, 255];
    const accent = fit(h, 70, 33, [hexToRgb('#f6f3ee'), hexToRgb('#fffdf9'), soft], -1, (c) => contrast(c, white) >= 4.5);
    return { '--accent': rgbStr(accent), '--accent-ink': rgbStr(accent), '--accent-soft': rgbStr(soft), '--on-accent': '#fff', '--accent-dark': rgbStr(darkAccent(h)) };
  }
  const soft = hslToRgb(h, 35, 22);
  const ink = hexToRgb('#141311');
  const accent = fit(h, 70, 68, [hexToRgb('#141311'), hexToRgb('#1c1a17'), soft], 1, (c) => contrast(c, ink) >= 4.5);
  return { '--accent': rgbStr(accent), '--accent-ink': rgbStr(accent), '--accent-soft': rgbStr(soft), '--on-accent': '#141311', '--accent-dark': rgbStr(darkAccent(h)) };
}
// 플레이어·움짤 상세(항상 어두움)용
function darkAccent(h) {
  return fit(h, 70, 68, [hexToRgb('#0e0e0f'), hexToRgb('#18181a'), hexToRgb('#24303a')], 1, (c) => contrast(c, hexToRgb('#0e0e0f')) >= 4.5);
}

export function applyAccent(hue) {
  const vars = accentVars(hue, isDark());
  const st = document.documentElement.style;
  for (const [k, v] of Object.entries(vars)) st.setProperty(k, v);
}

const SUN = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
const MOON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/></svg>';
export function themeButton(btn, onToggle) {
  const paint = () => {
    const d = isDark();
    btn.innerHTML = d ? SUN : MOON;
    btn.setAttribute('aria-label', d ? '라이트 모드로 전환' : '다크 모드로 전환');
    btn.title = btn.getAttribute('aria-label');
  };
  paint();
  btn.addEventListener('click', () => { toggleTheme(); paint(); onToggle && onToggle(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { paint(); onToggle && onToggle(); });
}
