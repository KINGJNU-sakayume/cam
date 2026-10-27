// 전역 검색: 모든 그룹, 공백으로 나눈 단어가 모두 맞아야 결과. 공연 단위 카드로 묶는다.
import { html, norm, fmtMD } from '../util.js';
import { NOSONG } from '../model.js';
import { app, playHref } from '../state.js';
import { href } from '../router.js';
import { videoThumb, clipThumb, dowPill, srcTags, whoText } from '../components.js';

export const PAGE = 20;
const PER_CARD = 12;

// 일치 글자 하이라이트 (각 조각은 html``이 이스케이프)
export function hl(text, tokens) {
  text = String(text ?? '');
  if (!tokens.length || !text) return text;
  const lower = text.toLowerCase();
  const on = new Uint8Array(text.length);
  for (const t of tokens) {
    if (!t) continue;
    let i = 0;
    while ((i = lower.indexOf(t, i)) >= 0) { on.fill(1, i, i + t.length); i += t.length; }
  }
  const parts = [];
  let cur = '', state = 0;
  for (let i = 0; i < text.length; i++) {
    if (on[i] !== state) { if (cur) parts.push(state ? html`<mark>${cur}</mark>` : cur); cur = ''; state = on[i]; }
    cur += text[i];
  }
  if (cur) parts.push(state ? html`<mark>${cur}</mark>` : cur);
  return parts;
}

export function runSearch(q) {
  const tokens = norm(q).split(' ').filter(Boolean);
  if (!tokens.length) return { tokens, groups: [], videos: 0, clips: 0 };
  const byE = new Map();
  let videos = 0, clips = 0;
  for (const it of app.ix.searchItems) {
    if (!tokens.every((t) => it.text.includes(t))) continue;
    if (!byE.has(it.E.id)) byE.set(it.E.id, { E: it.E, videos: [], clips: [] });
    if (it.kind === 'video') { byE.get(it.E.id).videos.push(app.ix.video.get(it.id)); videos++; }
    else { byE.get(it.E.id).clips.push(app.ix.C.get(it.id)); clips++; }
  }
  const groups = [...byE.values()].sort((a, b) => (a.E.date === b.E.date ? 0 : a.E.date < b.E.date ? 1 : -1));
  return { tokens, groups, videos, clips };
}

const songsText = (v) => (v.songs && v.songs.length ? v.songs.map((s) => app.ix.song.get(s.songId)?.title).join(' + ') : '전체 공연');

export function searchHTML(q) {
  const t0 = performance.now();
  const r = runSearch(q);
  const total = app.ix.data.videos.length;
  app.lastSearchMs = performance.now() - t0;
  if (!r.groups.length) {
    return html`<div class="state" role="status"><h2>담아 둔 영상에는 없어요</h2>
      <p>“${q.trim()}”와 맞는 영상·움짤이 없어요. 띄어 쓴 단어가 모두 들어 있어야 나와요.</p>
      </div>`;
  }
  const limit = app.searchLimit || PAGE;
  const shown = r.groups.slice(0, limit);
  return html`<p class="sres-top" role="status">담아 둔 영상 ${total}개 중 ${r.videos}개${r.clips ? ` · 움짤 ${r.clips}개` : ''} · 공연 ${r.groups.length}곳</p>
    <div class="sres">${shown.map(({ E, videos, clips }) => card(E, videos, clips, r.tokens))}</div>
    ${r.groups.length > limit ? html`<div class="row-actions" style="justify-content:center;margin-top:16px"><button type="button" class="btn" data-act="searchMore">공연 ${Math.min(PAGE, r.groups.length - limit)}곳 더 보기 (${shown.length}/${r.groups.length})</button></div>` : ''}`;
}

function card(E, videos, clips, tokens) {
  const g = E.group, ix = app.ix;
  const full = videos.filter((v) => v.type === 'full').slice(0, 4);
  const cams = videos.filter((v) => v.type !== 'full').slice(0, PER_CARD);
  const hidden = videos.length - full.length - cams.length;
  const dateLine = `${fmtMD(E.date)} ${E.ev.show}${E.ev.label ? ` ${E.ev.label}` : ''}`;
  // 목록형: 작은 썸네일 + 글 세 줄. 날짜·행사는 머리에 있으니 줄마다 되풀이하지 않는다. 줄 전체가 재생 링크
  const row = (v) => {
    const songKey = v.songs?.[0]?.songId;
    return html`<li class="srow${v.type === 'full' ? ' full' : ''}">
      ${videoThumb(v, { ratio: v.type === 'full' ? '169' : '23', songKey })}
      <a class="stext" href="${playHref(v, songKey)}" tabindex="-1">
        <span class="s1">${hl(`${songsText(v)} · ${whoText(ix, v.memberIds, v.type)}`, tokens)}</span>
        <span class="s2">${hl([srcTags(v), v.channel].filter(Boolean).join(' · '), tokens)}</span>
        <span class="s3">${hl(v.title || '', tokens)}</span>
      </a></li>`;
  };
  return html`<section class="scard" aria-label="${dateLine}">
    <div class="scard-head">
      <span class="d-big">${hl(fmtMD(E.date), tokens)}</span>${dowPill(E.date)}
      <a class="show" href="${href({ g: g.id, e: E.id })}">${hl(E.ev.show, tokens)}${E.ev.label ? html`<span class="lbl">${hl(E.ev.label, tokens)}</span>` : ''}</a>
      <span class="grp"><span class="dot" style="${`background:hsl(${Number(g.hue) || 0} 55% 45%)`}"></span>${hl(g.name, tokens)}</span>
      ${E.ev.note ? html`<span class="note">${hl(E.ev.note, tokens)}</span>` : ''}
      <a class="open textlink" href="${href({ g: g.id, e: E.id })}">공연 폴더 →</a>
    </div>
    <ul class="slist">${[...full, ...cams].map(row)}</ul>
    ${clips.length ? html`<div class="grid-23" style="margin-top:12px">${clips.map((C) => clipThumb(C, {
      caption: html`<div class="l1"><span>${hl(`${C.songId === NOSONG ? '전체 공연' : ix.song.get(C.songId)?.title || ''} · ${C.key === 'full' ? '풀캠' : whoText(ix, C.memberIds, 'fancam')}`, tokens)}</span></div><div class="lm">${hl(C.clip.note || '', tokens)}</div>`,
    }))}</div>` : ''}
    ${hidden > 0 ? html`<p class="note" style="margin-top:10px"><a href="${href({ g: g.id, e: E.id })}">이 공연에서 맞은 영상 ${hidden}개 더 — 공연 폴더에서 보기 →</a></p>` : ''}
  </section>`;
}
