// 전역 검색: 모든 그룹, 공백으로 나눈 단어가 모두 맞아야 결과. 공연 단위 카드로 묶는다.
import { html, norm, fmtMD } from '../util.js';
import { NOSONG } from '../model.js';
import { app, playHref } from '../state.js';
import { href } from '../router.js';
import { videoThumb, clipThumb, dowPill, srcTags, whoText } from '../components.js';

export const PAGE = 20;
const PER_CARD = 8;

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

// 좁히기 상태: 그룹·멤버·종류·월. 검색어를 바꿔도 유지하고, 검색을 닫으면 비운다
export const sf = { g: '', m: '', t: '', mo: '' };
export const resetSf = () => { sf.g = ''; sf.m = ''; sf.t = ''; sf.mo = ''; };
export const sfActive = () => !!(sf.g || sf.m || sf.t || sf.mo);

const TYPES = [['fancam', '직캠'], ['full', '풀캠'], ['clip', '움짤']];
const typeOf = (x) => (x.kind === 'clip' ? 'clip' : x.obj.type === 'full' ? 'full' : 'fancam');
const membersOfItem = (x) => (x.kind === 'clip' ? x.obj.memberIds : x.obj.type === 'full' ? [] : x.obj.memberIds) || [];

// 단어로 맞은 영상·움짤 전부(좁히기 전)
function matchAll(q) {
  const tokens = norm(q).split(' ').filter(Boolean);
  const items = [];
  if (!tokens.length) return { tokens, items };
  for (const it of app.ix.searchItems) {
    if (!tokens.every((t) => it.text.includes(t))) continue;
    items.push({ kind: it.kind, E: it.E, obj: it.kind === 'video' ? app.ix.video.get(it.id) : app.ix.C.get(it.id) });
  }
  return { tokens, items };
}
// skip: 그 칸의 개수를 셀 때는 그 칸 자신의 선택을 빼고 센다(다른 선택은 그대로)
const passes = (x, skip) => (skip === 'g' || !sf.g || x.E.group.id === sf.g)
  && (skip === 'm' || !sf.m || membersOfItem(x).includes(sf.m))
  && (skip === 't' || !sf.t || typeOf(x) === sf.t)
  && (skip === 'mo' || !sf.mo || x.E.date.startsWith(sf.mo));

export function runSearch(q) {
  const { tokens, items } = matchAll(q);
  const kept = items.filter((x) => passes(x));
  const byE = new Map();
  let videos = 0, clips = 0;
  for (const x of kept) {
    if (!byE.has(x.E.id)) byE.set(x.E.id, { E: x.E, videos: [], clips: [] });
    if (x.kind === 'video') { byE.get(x.E.id).videos.push(x.obj); videos++; } else { byE.get(x.E.id).clips.push(x.obj); clips++; }
  }
  const groups = [...byE.values()].sort((a, b) => (a.E.date === b.E.date ? 0 : a.E.date < b.E.date ? 1 : -1));
  return { tokens, groups, videos, clips, items };
}

function facets(items) {
  const count = (skip, key) => {
    const m = new Map();
    for (const x of items) if (passes(x, skip)) for (const k of key(x)) m.set(k, (m.get(k) || 0) + 1);
    return m;
  };
  const gm = count('g', (x) => [x.E.group.id]);
  const groups = [...gm].map(([id, n]) => ({ id, n, g: app.ix.group.get(id) })).filter((c) => c.g).sort((a, b) => b.n - a.n);
  // 멤버: 그룹이 하나로 정해졌을 때만(다른 그룹의 같은 이름이 섞이지 않게)
  const gid = sf.g || (groups.length === 1 ? groups[0].id : '');
  const mm = gid ? count('m', (x) => (x.E.group.id === gid ? membersOfItem(x) : [])) : new Map();
  const members = gid ? (app.ix.group.get(gid)?._members || []).map((m) => ({ id: m.id, n: mm.get(m.id) || 0, m })).filter((c) => c.n || c.id === sf.m) : [];
  const tm = count('t', (x) => [typeOf(x)]);
  const types = TYPES.map(([id, label]) => ({ id, label, n: tm.get(id) || 0 })).filter((c) => c.n || c.id === sf.t);
  const mo = count('mo', (x) => [x.E.date.slice(0, 7)]);
  const months = [...mo].map(([id, n]) => ({ id, n })).sort((a, b) => (a.id < b.id ? 1 : -1));
  return { groups, gid, members, types, months };
}

const chip = (k, v, label, n, on, dot) => html`<button type="button" class="chip" data-act="sf" data-k="${k}" data-v="${v}" aria-pressed="${String(on)}">${dot ? html`<span class="dot" style="${`background:hsl(${Number(dot.hue) || 0} 55% 45%)`}"></span>` : ''}${label}<span class="n">${n}</span></button>`;

function filterBar(items) {
  const f = facets(items);
  const row = (name, chips) => (chips.length ? html`<div class="sf-row"><span class="sf-l">${name}</span><div class="sf-chips">${chips}</div></div>` : '');
  return html`<div class="sfilter" role="group" aria-label="검색 결과 좁히기">
    ${f.groups.length > 1 || sf.g ? row('그룹', f.groups.map((c) => chip('g', c.id, c.g.name, c.n, sf.g === c.id, c.g))) : ''}
    ${f.members.length > 1 || sf.m ? row('멤버', f.members.map((c) => chip('m', c.id, c.m.name, c.n, sf.m === c.id))) : ''}
    ${!f.gid && f.groups.length > 1 ? html`<div class="sf-row"><span class="sf-l">멤버</span><span class="hint">그룹을 고르면 멤버로 좁힐 수 있어요</span></div>` : ''}
    ${f.types.length > 1 || sf.t ? row('종류', f.types.map((c) => chip('t', c.id, c.label, c.n, sf.t === c.id))) : ''}
    ${f.months.length > 1 || sf.mo ? row('월', f.months.map((c) => chip('mo', c.id, c.id.replace('-', '.'), c.n, sf.mo === c.id))) : ''}
    ${sfActive() ? html`<div class="sf-row"><button type="button" class="btn btn-sm" data-act="sfClear">좁히기 모두 풀기</button></div>` : ''}
  </div>`;
}

const songsText = (v) => (v.songs && v.songs.length ? v.songs.map((s) => app.ix.song.get(s.songId)?.title).join(' + ') : '전체 공연');

export function searchHTML(q) {
  const t0 = performance.now();
  const r = runSearch(q);
  const total = app.ix.data.videos.length;
  app.lastSearchMs = performance.now() - t0;
  if (!r.items.length) {
    return html`<div class="state" role="status"><h2>담아 둔 영상에는 없어요</h2>
      <p>“${q.trim()}”와 맞는 영상·움짤이 없어요. 띄어 쓴 단어가 모두 들어 있어야 나와요.</p>
      </div>`;
  }
  const bar = filterBar(r.items);
  if (!r.groups.length) {
    return html`${bar}<div class="state" role="status"><h2>이 조건에 맞는 영상이 없어요</h2><p>좁히기를 바꾸거나 풀어 보세요.</p></div>`;
  }
  const limit = app.searchLimit || PAGE;
  const shown = r.groups.slice(0, limit);
  return html`${bar}<p class="sres-top" role="status">담아 둔 영상 ${total}개 중 ${r.videos}개${r.clips ? ` · 움짤 ${r.clips}개` : ''} · 공연 ${r.groups.length}곳</p>
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
