// 움짤 보기: 2:3 정지 포스터 격자. 아래에 날짜·행사·곡·멤버.
import { html, fmtMD, parseDate } from '../util.js';
import { NOSONG } from '../model.js';
import { app, matchClip, filterCount } from '../state.js';
import { clipThumb, dowPill, whoText } from '../components.js';
import { noResultHTML } from './states.js';

export function clipCaption(C) {
  const ix = app.ix;
  const song = C.songId === NOSONG ? '전체 공연' : ix.song.get(C.songId)?.title || '';
  return html`<div class="l1"><span class="num">${fmtMD(C.E.date)}</span>${dowPill(C.E.date)}</div>
    <div class="lm">${C.E.ev.show}${C.E.ev.label ? ` ${C.E.ev.label}` : ''}</div>
    <div class="lm" style="color:var(--text)">${song} · ${C.key === 'full' ? '풀캠' : whoText(ix, C.memberIds, 'fancam')}</div>
    ${C.clip.note ? html`<div class="lm">${C.clip.note}</div>` : ''}`;
}

export function clipGridHTML(g, f) {
  const all = [];
  for (const E of app.ix.eventsByGroup.get(g.id)) for (const C of E.clips) all.push(C);
  const list = all.filter((C) => matchClip(C, f));
  list.sort((a, b) => (a.E.date === b.E.date ? a.clip._i - b.clip._i : a.E.date < b.E.date ? -1 : 1));
  if (app.prefs.sort !== 'asc') list.reverse();
  const head = html`<div class="pagehead"><h1>움짤</h1><span class="sub">${list.length}개${app.reduced ? ' · 움직임 줄이기 설정: 눌러서 재생' : ''}</span></div>`;
  if (!list.length) {
    if (all.length) return html`${head}${noResultHTML(filterCount(f) > 0)}`;
    return html`${head}<div class="state"><h2>아직 움짤이 없어요</h2><p>관리 화면의 움짤 담기에서 파일을 끌어다 놓으면 여기에 모여요.</p><div class="row"><a class="btn btn-fill" href="${`admin.html#g=${g.id}&tab=clips`}">+ 담기</a></div></div>`;
  }
  // 월마다 낱장 하나
  const out = [];
  let lastM = null, buf = [];
  const flush = () => { if (buf.length) out.push(html`<section class="sheet psheet"><div class="grid-23 big">${buf}</div></section>`); buf = []; };
  for (const C of list) {
    const k = C.E.date.slice(0, 7);
    if (k !== lastM) {
      flush();
      const p = parseDate(C.E.date);
      out.push(html`<div class="month-head"><span class="m-big">${p.m}</span><span class="m-unit">월</span><span class="m-sub">${p.y}</span></div>`);
      lastM = k;
    }
    buf.push(clipThumb(C, { caption: clipCaption(C) }));
  }
  flush();
  return html`${head}${out}`;
}
