// 멤버 보기: 멤버 목록 → 멤버 페이지(의상 타임라인)
import { html, fmtMD, fmtDow, parseDate } from '../util.js';
import { NOSONG, thumbSrc, thumbFallback } from '../model.js';
import { app, sortEvents, matchVideo, NO_FILTER } from '../state.js';
import { href } from '../router.js';
import { memberQueue } from '../indexer.js';
import { queueButton } from './lineup.js';
import { videoThumb, dowPill, srcTags, posOf, srcShort } from '../components.js';
import { silhouetteURL } from '../placeholder.js';

// 멤버의 칸 대표 목록: 공연 × 곡 단위
function memberItems(g, m, f) {
  const out = [];
  for (const E of sortEvents(app.ix.eventsByGroup.get(g.id))) {
    for (const k of E.sectionKeys) {
      const S = E.sections.get(k);
      if (!S) continue;
      if (f.songs.size && !f.songs.has(k)) continue;
      const list = (S.cells.get(m.id) || []).filter((v) => matchVideo(v, f));
      if (list.length) out.push({ E, k, v: list[0], n: list.length, clips: S.clips.filter((C) => C.key === m.id).length });
    }
  }
  return out;
}

function memberCount(g, m) {
  let n = 0;
  for (const E of app.ix.eventsByGroup.get(g.id)) {
    const seen = new Set();
    for (const S of E.sections.values()) for (const v of S.cells.get(m.id) || []) seen.add(v.id);
    n += seen.size;
  }
  return n;
}

function tile(g, m) {
  const items = memberItems(g, m, NO_FILTER);
  const latest = items[0] || null;
  const h = href({ g: g.id, v: 'member', m: m.id });
  let src, pos = '50% 35%';
  const ph = silhouetteURL({ eventId: latest ? latest.E.id : m.id, kind: 'fancam', order: m.order });
  if (m.thumb) { src = m.thumb; pos = posOf(m); }
  else if (latest) { src = thumbSrc(latest.v, '23') || ph; pos = posOf(latest.v); }
  else src = ph;
  return html`<div class="tile">
    <a class="thumb r23" href="${h}" aria-label="${`${m.name} 멤버 페이지`}">
      <img src="${src}" data-fb="${latest && !m.thumb ? thumbFallback(latest.v) : ''}" data-ph="${ph}" alt="" loading="lazy" decoding="async" style="${`object-position:${pos}`}">
      <span class="band"><i style="${`background:${m._color}`}"></i></span>
    </a>
    <a class="tname" href="${h}"><span class="dot" style="${`background:${m._color}`}"></span>${m.name}</a>
    <div class="tmeta">직캠 ${memberCount(g, m)}${latest ? ` · 최근 ${fmtMD(latest.E.date)}` : ''}</div>
  </div>`;
}

export function memberListHTML(g) {
  const act = g._members.filter((m) => m.active !== false);
  const ret = g._members.filter((m) => m.active === false);
  return html`<div class="pagehead"><h1>멤버</h1><span class="sub">${act.length}명${ret.length ? ` · 활동 종료 ${ret.length}` : ''}</span></div>
    <section class="sheet psheet"><div class="tiles m">${act.map((m) => tile(g, m))}</div></section>
    ${ret.length ? html`<section class="sheet psheet"><h2 class="sheet-h">활동 종료 <span class="cnt">${ret.length}</span></h2><div class="tiles m">${ret.map((m) => tile(g, m))}</div></section>` : ''}`;
}

const songName = (k) => (k === NOSONG ? '전체 공연' : app.ix.song.get(k)?.title || k);

function itemThumb(m, it) {
  const { E, k, v, n, clips } = it;
  const badges = [];
  if (n > 1) badges.push({ text: `+${n - 1}` });
  if (clips) badges.push({ text: '움짤' });
  return videoThumb(v, {
    ratio: '23', songKey: k, badges, stripText: `${fmtMD(E.date)} ${fmtDow(E.date)}`,
    label: `${fmtMD(E.date)} ${E.ev.show} ${songName(k)} ${m.name} 직캠 재생`,
    caption: html`<div class="lm" style="color:var(--text);font-weight:700">${E.ev.show}${E.ev.label ? ` ${E.ev.label}` : ''}</div>
      <div class="lm">${songName(k)}</div>
      <div class="lm">${srcTags(v)}</div>`,
  });
}

export function memberPageHTML(g, m, f) {
  const items = memberItems(g, m, f);
  const usedSongs = new Set();
  for (const E of app.ix.eventsByGroup.get(g.id)) for (const [k, S] of E.sections) if (S.cells.has(m.id)) usedSongs.add(k);
  const songChips = g._songs.filter((s) => usedSongs.has(s.id));
  const head = html`<div class="pagehead">
    <h1><span class="big-dot" style="${`background:${m._color}`}"></span>${m.name}${m.active === false ? html` <span class="sub">활동 종료</span>` : ''}</h1>
    <span class="sub">${(m.aliases || []).join(' · ')}${(m.aliases || []).length ? ' · ' : ''}직캠 ${memberCount(g, m)}</span>
    <div class="tools"><label class="check"><input type="checkbox" data-act="bySong" ${app.prefs.bySong ? html`checked` : ''}>곡별로 묶기</label></div>
  </div>
  ${songChips.length > 1 ? html`<div class="fgroup" role="group" aria-label="곡으로 좁히기" style="margin:0 0 14px">${songChips.map((s) => html`<button type="button" class="chip" data-act="filter" data-k="songs" data-v="${s.id}" aria-pressed="${String(!!(f.songs.has(s.id)))}">${s.title}</button>`)}</div>` : ''}`;
  if (!items.length) {
    return html`${head}<div class="state"><h2>보여 줄 직캠이 없어요</h2><p>${f.songs.size || f.tags.size || f.types.size ? '걸린 필터를 풀면 더 보여요.' : '아직 이 멤버 직캠을 담지 않았어요.'}</p>
      <div class="row">${f.songs.size || f.tags.size || f.types.size ? html`<button type="button" class="btn" data-act="clearFilters">필터 해제</button>` : ''}<a class="btn btn-fill" href="${`admin.html#g=${g.id}&m=${m.id}`}">+ 담기</a></div></div>`;
  }
  if (app.prefs.bySong) {
    const bySong = new Map();
    for (const it of items) { if (!bySong.has(it.k)) bySong.set(it.k, []); bySong.get(it.k).push(it); }
    const order = [...g._songs.map((s) => s.id), NOSONG].filter((k) => bySong.has(k));
    return html`${head}${order.map((k) => html`<section class="songrow sheet"><h3>${songName(k)}<span class="cnt">${bySong.get(k).length}</span>
      ${k ? html`<a class="textlink" href="${href({ g: g.id, v: 'song', s: k, m: m.id })}">모아보기 →</a>` : ''}</h3>
      <div class="grid-23 big">${bySong.get(k).map((it) => itemThumb(m, it))}</div></section>`)}`;
  }
  // 공연마다 라인업 같은 낱장 한 줄: 왼쪽 날짜, 오른쪽 이 멤버의 곡별 직캠(곡 순서). 월 머리로 구분
  const rows = [];
  for (const E of sortEvents(app.ix.eventsByGroup.get(g.id))) {
    const q = memberQueue(E, m.id).filter((x) => (!f.songs.size || f.songs.has(x.songKey)) && matchVideo(x.v, f));
    if (q.length) rows.push({ E, q });
  }
  const counts = new Map();
  for (const { E } of rows) { const k = E.date.slice(0, 7); counts.set(k, (counts.get(k) || 0) + 1); }
  const out = [];
  let lastM = null;
  for (const r of rows) {
    const k = r.E.date.slice(0, 7);
    if (k !== lastM) {
      const p = parseDate(r.E.date);
      out.push(html`<div class="lu-month"><div class="month-head"><span class="m-big">${p.m}</span><span class="m-unit">월</span><span class="m-sub">${p.y} · 공연 ${counts.get(k)}</span></div></div>`);
      lastM = k;
    }
    out.push(app.mobile ? memberCard(g, m, r) : memberRow(g, m, r));
  }
  return html`${head}${app.mobile ? html`<div class="mcards">${out}</div>` : html`<div class="lu">${out}</div>`}`;
}

function rowCards(m, { E, q }) {
  return q.map(({ v, songKey }) => {
    const S = E.sections.get(songKey);
    const n = (S && S.cells.get(m.id) || []).length;
    const badges = [];
    if (n > 1) badges.push({ text: `+${n - 1}` });
    if (S && S.clips.some((C) => C.key === m.id)) badges.push({ text: '움짤' });
    if ((v.tags || []).includes('세로')) badges.push({ text: '세로' });
    return videoThumb(v, { ratio: '23', songKey, badges, stripText: songName(songKey), stripExtra: srcShort(v), label: `${fmtMD(E.date)} ${E.ev.show} ${songName(songKey)} ${m.name} 직캠 재생` });
  });
}

function rowHead(g, m, { E, q }) {
  const folder = href({ g: g.id, e: E.id, m: m.id });
  return html`<div class="dl"><a class="d-big" href="${folder}" aria-label="${`${fmtMD(E.date)} ${E.ev.show} 공연 폴더 (${m.name})`}">${fmtMD(E.date)}</a>${dowPill(E.date)}</div>
    <a class="show" href="${folder}">${E.ev.show}${E.ev.label ? html`<span class="lbl">${E.ev.label}</span>` : ''}</a>
    <span class="songfixed">${q.length === 1 ? songName(q[0].songKey) : `${q.length}곡`}</span>
    ${queueButton(E, m)}`;
}

function memberRow(g, m, r) {
  const cards = rowCards(m, r);
  return html`<div class="car-row mrow" data-row="${r.E.id}">
    <span class="lu-tab" aria-hidden="true">${fmtMD(r.E.date)}</span>
    <div class="lu-date">${rowHead(g, m, r)}</div>
    <div class="car wide" data-car>
      <button type="button" class="car-btn prev" data-act="car" data-d="-1" aria-label="이전 곡 직캠" disabled>‹</button>
      <div class="car-track" role="list" aria-label="${`${m.name} 곡별 직캠`}">${cards.map((x) => html`<div class="car-item" role="listitem">${x}</div>`)}</div>
      <button type="button" class="car-btn next" data-act="car" data-d="1" aria-label="다음 곡 직캠">›</button>
    </div>
  </div>`;
}

function memberCard(g, m, r) {
  return html`<article class="mcard" data-row="${r.E.id}">
    <div class="mcard-head">${rowHead(g, m, r)}</div>
    <div class="mstrip" role="list" aria-label="${`${m.name} 곡별 직캠`}">${rowCards(m, r).map((x) => html`<div class="mthumb" role="listitem">${x}</div>`)}</div>
  </article>`;
}
