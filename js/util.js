// 공용 유틸: 이스케이프 템플릿, 날짜·시간 형식, 해시
// DOM에 의존하지 않는 함수만 둔다(Node 검증 스크립트에서도 import).

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

class Safe {
  constructor(s) { this.__html = s; }
  toString() { return this.__html; }
}
export const isSafe = (v) => v instanceof Safe;
// 코드 안의 상수(아이콘 SVG 등)에만 쓴다. 데이터 값에는 쓰지 않는다.
export const raw = (s) => new Safe(String(s));

function part(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Safe) return v.__html;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

// 모든 보간값을 이스케이프하는 템플릿 태그. 중첩된 html``과 raw()만 그대로 통과한다.
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Safe(out);
}

export const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d, dow: dt.getUTCDay() };
}
export const isRealDate = (s) => parseDate(s) !== null;
const p2 = (n) => String(n).padStart(2, '0');
export function fmtMD(s) { const p = parseDate(s); return p ? `${p2(p.m)}.${p2(p.d)}` : s; }
export function fmtShortMD(s) { const p = parseDate(s); return p ? `${p.m}.${p2(p.d)}` : s; }
export function fmtDow(s) { const p = parseDate(s); return p ? DOW[p.dow] : ''; }
export function fmtFull(s) { const p = parseDate(s); return p ? `${p.y}.${p2(p.m)}.${p2(p.d)} (${DOW[p.dow]})` : s; }
export function fmtYear(s) { const p = parseDate(s); return p ? p.y : ''; }

// 검색용 날짜 표기들
export function dateForms(s) {
  const p = parseDate(s);
  if (!p) return [];
  const yy = p2(p.y % 100), mm = p2(p.m), dd = p2(p.d);
  return [
    s, `${yy}.${mm}.${dd}`, `${yy}${mm}${dd}`, `${p.y}${mm}${dd}`,
    `${p.m}/${p.d}`, `${mm}/${dd}`, `${p.m}월 ${p.d}일`, `${p.m}월${p.d}일`,
    `${mm}.${dd}`, `${p.m}.${dd}`, `${p.m}.${p.d}`, `${p.y}.${mm}.${dd}`,
  ];
}

export function fmtTime(sec) {
  if (sec == null || isNaN(sec)) return '';
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${p2(m)}:${p2(s)}` : `${m}:${p2(s)}`;
}
export function parseTime(str) {
  if (str == null) return null;
  str = String(str).trim();
  if (!str) return null;
  if (/^\d+$/.test(str)) return +str;
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(str);
  if (m) return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]);
  const y = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(str);
  if (y && (y[1] || y[2] || y[3])) return (+(y[1] || 0)) * 3600 + (+(y[2] || 0)) * 60 + (+(y[3] || 0));
  return NaN;
}

export function fmtBytes(n) {
  if (n == null) return '';
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

// 문자열 해시(FNV-1a 32bit)
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// 검색 정규화: 소문자, 공백 하나로
export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const byNum = (k) => (a, b) => (a[k] ?? 0) - (b[k] ?? 0);
