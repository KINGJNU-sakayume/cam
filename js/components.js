// 공용 화면 조각: 썸네일, 빈 칸, 아이콘, 요일 알약
import { html, raw, fmtMD, fmtDow, parseDate } from './util.js';
import { thumbSrc, thumbFallback, DEFAULT_THUMB_POS, GROUP_KEY } from './model.js';
import { silhouetteURL } from './placeholder.js';
import { app, playHref, clipHref, adminHref } from './state.js';

const svg = (d, extra = '') => raw(`<svg class="ic${extra}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`);
export const ICON = {
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  left: svg('<path d="M15 5l-7 7 7 7"/>'),
  right: svg('<path d="M9 5l7 7-7 7"/>'),
  up: svg('<path d="M5 15l7-7 7 7"/>'),
  down: svg('<path d="M5 9l7 7 7-7"/>'),
  ext: svg('<path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  play: raw('<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>'),
  playLine: svg('<path d="M8 5.5v13l11-6.5z"/>'),
  folder: svg('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
  filter: svg('<path d="M4 6h16M7 12h10M10 18h4"/>'),
  chev: svg('<path d="M6 9l6 6 6-6"/>', ' ic-sm chev'),
};

export const dowPill = (date) => {
  const p = parseDate(date);
  const cls = p && p.dow === 6 ? 'sat' : p && p.dow === 0 ? 'sun' : '';
  return html`<span class="pill-dow ${cls}">${fmtDow(date)}</span>`;
};

export function sourceLabel(v) {
  return v.source === 'official' ? '공식' : v.source === 'fan' ? '팬' : '출처 모름';
}
// 이름띠 오른쪽에 붙이는 짧은 출처: 공식·팬, 모르면 채널 이름
export function srcShort(v) {
  return v.source ? sourceLabel(v) : (v.channel || '');
}
// 썸네일 아래 한 줄: 출처(모르면 채널 이름) · 태그
export function srcTags(v) {
  return [v.source ? sourceLabel(v) : (v.channel || '출처 모름'), ...(v.tags || [])].join(' · ');
}
// 채널을 따로 적는 곳에서 쓰는 한 줄: 아는 출처 · 태그
export function tagLine(v) {
  return [...(v.source ? [sourceLabel(v)] : []), ...(v.tags || [])].join(' · ');
}

const POS_RE = /^[0-9.%a-z\s-]{1,40}$/i;
export function posOf(v, fallback = DEFAULT_THUMB_POS) {
  return v && v.thumbPos && POS_RE.test(v.thumbPos) ? v.thumbPos : fallback;
}

// 썸네일 이미지 주소, 실패 시 다음 주소(fb), 마지막으로 대신할 실루엣(ph)
export function imgOf(v, ratio, small = false) {
  const ix = app.ix;
  const kind = v.type === 'full' || ratio === '169' ? 'full' : 'fancam';
  const order = v.memberIds && v.memberIds.length === 1 ? (ix.member.get(v.memberIds[0])?.order ?? 0) : 0;
  const ph = silhouetteURL({ eventId: v.eventId, kind, order });
  return { src: thumbSrc(v, ratio, small) || ph, fb: thumbFallback(v), ph };
}

export function memberBand(v) {
  if (v.type === 'full' || !v.memberIds.length) return null;
  const cols = v.memberIds.map((id) => app.ix.member.get(id)?._color).filter(Boolean);
  if (cols.length === 1) return cols[0];
  return null;
}
// 포토카드 이름띠: 멤버 한 명이면 그 멤버색(흰 글자가 읽히게 어둡게), 여럿·단체면 짙은 회색에 멤버색 점.
// stripText를 주면 이름 대신 그 글자(멤버 보기처럼 이름이 뻔한 곳은 날짜)
function stripHTML(v, stripText, extra) {
  if (v.type === 'full') return '';
  const ms = v.memberIds.map((id) => app.ix.member.get(id)).filter(Boolean);
  const text = stripText ?? (ms.length ? ms.map((m) => m.name).join('·') : '단체');
  const bg = ms.length === 1 ? ms[0]._strip : '';
  return html`<span class="pc-name" style="${bg ? `--pc:${bg}` : ''}">${ms.length > 1 ? html`<span class="pc-dots">${ms.map((m) => html`<i style="${`background:${m._color}`}"></i>`)}</span>` : ''}<span class="pc-t">${text}</span>${extra ? html`<span class="pc-x">${extra}</span>` : ''}</span>`;
}

// 영상 썸네일. caption: html 조각 또는 null. badges: [{text, cls}]
export function videoThumb(v, { ratio = v.type === 'full' ? '169' : '23', songKey, t, badges = [], caption = null, label, extraBadge = '', stripText, stripExtra } = {}) {
  const { src, fb, ph } = imgOf(v, ratio);
  const all = [...badges];
  if (v.gone) all.push({ text: '삭제됨', cls: 'danger' });
  const pos = ratio === '23' ? posOf(v) : posOf(v, '50% 50%');
  const aria = label || `${v.title || '영상'} 재생`;
  return html`<div class="tcell">
    <a class="thumb r${ratio}${v.gone ? ' gone' : ''}" href="${playHref(v, songKey, t)}" aria-label="${aria}">
      <img src="${src}" data-fb="${fb}" data-ph="${ph}" alt="" loading="lazy" decoding="async" style="${`object-position:${pos}`}">
      ${ratio === '23' ? stripHTML(v, stripText, stripExtra) : ''}
      <span class="play-ic">${ICON.play}</span>
      ${all.length ? html`<span class="badges">${all.map((b) => html`<span class="badge ${b.cls || ''}">${b.text}</span>`)}</span>` : ''}
    </a>${extraBadge}
    ${caption ? html`<div class="cap">${caption}</div>` : ''}
  </div>`;
}

export function clipThumb(C, { caption = null, ratio = '23' } = {}) {
  const c = C.clip;
  const order = C.memberIds.length === 1 ? (app.ix.member.get(C.memberIds[0])?.order ?? 0) : 0;
  const ph = silhouetteURL({ eventId: C.E.id, kind: 'fancam', order });
  const poster = c.poster || ph;
  const kind = /\.(mp4|webm)$/i.test(c.file) ? 'video' : 'image';
  return html`<div class="tcell">
    <a class="thumb r${ratio} clipthumb" href="${clipHref(c.id)}" data-clip="${c.id}" data-file="${c.file}" data-kind="${kind}" data-poster="${poster}" aria-label="${`움짤 ${c.note || c.id} 열기`}">
      <img src="${poster}" data-ph="${ph}" alt="" loading="lazy" decoding="async">
      <span class="badges"><span class="badge">움짤</span></span>
    </a>
    ${caption ? html`<div class="cap">${caption}</div>` : ''}
  </div>`;
}

export function initialOf(name) { return (name || '?').trim().charAt(0); }

// 빈 칸 = 빈 포켓: 안쪽 그림자에 멤버 이름만. "+ 담기"는 마우스를 올리거나 포커스가 갈 때
export function emptyCell({ member, g, e, s, ratio = '23', label = '아직 없음' }) {
  return html`<div class="empty-cell${ratio === '169' ? ' r169' : ''}">
    <a class="add" href="${adminHref({ g, e, m: member ? member.id : undefined, s: s || undefined })}" aria-label="${`${member ? `${member.name} ` : ''}${label}, 담기`}">+ 담기</a>
    <span class="pk-label">${label}</span>
    ${member ? html`<span class="pk-name"><span class="dot" style="${`background:${member._color}`}"></span>${member.name}</span>` : ''}
  </div>`;
}

export function whoText(ix, memberIds, type) {
  if (type === 'full') return '풀캠';
  if (!memberIds.length) return '단체';
  return memberIds.map((id) => ix.member.get(id)?.name || id).join('·');
}

export function memberDots(ix, memberIds) {
  return memberIds.map((id) => {
    const m = ix.member.get(id);
    return m ? html`<span class="dot" style="${`background:${m._color}`}"></span>` : '';
  });
}

export function cellKeyLabel(ix, key) {
  if (key === GROUP_KEY) return '단체';
  return key.split('+').map((id) => ix.member.get(id)?.name || id).join('·');
}

export function eventTitle(E) {
  return `${fmtMD(E.date)} ${E.ev.show}${E.ev.label ? ` ${E.ev.label}` : ''}`;
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
