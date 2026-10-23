// 실루엣 플레이스홀더. 공연 id 해시로 무대 바탕색과 의상색을 고른다.
// 같은 공연은 같은 의상색 → 라인업에서 "그날 의상"이 구분된다.
import { hash } from './util.js';

export const STAGE = ['#1f2430', '#2a1f2b', '#1d2a26', '#2b2620', '#202838', '#2d2224', '#232b1f', '#26222f'];
export const COSTUME = ['#e8d9c4', '#c94f3d', '#3f7fbf', '#e0b84a', '#5fa37d', '#d9d4cf', '#9a7bc4', '#d77a9a', '#4fb3b0', '#b8865a'];

export function pickColors(eventId) {
  const h = hash(String(eventId || 'none'));
  return { bg: STAGE[h % STAGE.length], costume: COSTUME[(h >>> 8) % COSTUME.length] };
}

export function darken(hex, amt = 0.2) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * (1 - amt)).toString(16).padStart(2, '0');
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

// 한 사람 실루엣(200×300 기준 좌표)
function figure(x, y, s, color) {
  const t = (px, py) => `${(x + px * s).toFixed(1)},${(y + py * s).toFixed(1)}`;
  return `<g fill="${color}">`
    + `<circle cx="${x}" cy="${(y + 78 * s).toFixed(1)}" r="${(19 * s).toFixed(1)}"/>`
    + `<path d="M${t(-14, 102)} L${t(14, 102)} L${t(22, 140)} L${t(42, 212)} L${t(-42, 212)} L${t(-22, 140)} Z"/>`
    + `<path d="M${t(-14, 104)} L${t(-30, 160)} L${t(-24, 162)} L${t(-8, 112)} Z"/>`
    + `<path d="M${t(14, 104)} L${t(30, 160)} L${t(24, 162)} L${t(8, 112)} Z"/>`
    + `<rect x="${(x - 16 * s).toFixed(1)}" y="${(y + 210 * s).toFixed(1)}" width="${(10 * s).toFixed(1)}" height="${(62 * s).toFixed(1)}" rx="${(4 * s).toFixed(1)}"/>`
    + `<rect x="${(x + 6 * s).toFixed(1)}" y="${(y + 210 * s).toFixed(1)}" width="${(10 * s).toFixed(1)}" height="${(62 * s).toFixed(1)}" rx="${(4 * s).toFixed(1)}"/>`
    + `</g>`;
}

const cache = new Map();

// kind: 'fancam' (2:3, 한 명) | 'full' (16:9, 다섯 명)
// order: 멤버 order. 홀수면 의상색을 조금 어둡게. 단체·유닛은 0.
export function silhouetteSVG({ eventId, kind = 'fancam', order = 0 }) {
  const key = `${eventId}|${kind}|${order}`;
  if (cache.has(key)) return cache.get(key);
  const { bg, costume } = pickColors(eventId);
  let svg;
  if (kind === 'full') {
    let figs = '';
    for (let i = 0; i < 5; i++) {
      const c = i % 2 === 0 ? darken(costume, 0.2) : costume;
      figs += figure(80 + i * 40, 20, 0.5, c);
    }
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">`
      + `<rect width="320" height="180" fill="${bg}"/>`
      + `<ellipse cx="160" cy="158" rx="130" ry="14" fill="#fff" fill-opacity="0.07"/>${figs}</svg>`;
  } else {
    const c = order % 2 === 1 ? darken(costume, 0.2) : costume;
    let figs;
    if (order === 0) figs = figure(70, 20, 0.85, darken(costume, 0.2)) + figure(130, 20, 0.85, costume);
    else figs = figure(100, 6, 1, c);
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice">`
      + `<rect width="200" height="300" fill="${bg}"/>`
      + `<ellipse cx="100" cy="276" rx="78" ry="16" fill="#fff" fill-opacity="0.07"/>${figs}</svg>`;
  }
  cache.set(key, svg);
  return svg;
}

export function silhouetteURL(opts) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(silhouetteSVG(opts));
}
