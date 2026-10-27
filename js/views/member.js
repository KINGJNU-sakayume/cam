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
  ${songChips.length > 1 ? html`<details class="songpick" ${f.songs.size ? html`open` : ''}>
    <summary>곡으로 좁히기 <span class="n num">${f.songs.size ? `${f.songs.size}곡 고름` : `${songChips.length}곡`}</span></summary>
    <div class="fgroup" role="group" aria-label="곡으로 좁히기">${songChips.map((s) => html`<button type="button" class="chip" data-act="filter" data-k="songs" data-v="${s.id}" aria-pressed="${String(!!(f.songs.has(s.id)))}">${s.title}</button>`)}</div>
  </details>` : ''}`;
  if (!items.length) {
    return html`${head}<div class="state"><h2>보여 줄 직캠이 없어요</h2><p>${f.songs.size || f.tags.size || f.types.size ? '걸린 필터를 풀면 더 보여요.' : '아직 이 멤버 직캠을 담지 않았어요.'}</p>
      <div class="row">${f.songs.size || f.tags.size || f.types.size ? html`<button type="button" class="btn" data-act="clearFilters">필터 해제</button>` : ''}</div></div>`;
  }
  if (app.prefs.bySong) {
    const bySong = new Map();
    for (const it of items) { if (!bySong.has(it.k)) bySong.set(it.k, []); bySong.get(it.k).push(it); }
    const order = [...g._songs.map((s) => s.id), NOSONG].filter((k) => bySong.has(k));
    return html`${head}${order.map((k) => html`<section class="songrow sheet"><h3>${songName(k)}<span class="cnt">${bySong.get(k).length}</span>
      ${k ? html`<a class="textlink" href="${href({ g: g.id, v: 'song', s: k, m: m.id })}">모아보기 →</a>` : ''}</h3>
      <div class="grid-23 big">${bySong.get(k).map((it) => itemThumb(m, it))}</div></section>`)}`;
  }
  // 월별 포토카드 격자: 공연 × 곡 한 장씩, 카드 아래 날짜·행사·곡. 월 머리글(색인 탭)로 구분
  const rows = [];
  for (const E of sortEvents(app.ix.eventsByGroup.get(g.id))) {
    const q = memberQueue(E, m.id).filter((x) => (!f.songs.size || f.songs.has(x.songKey)) && matchVideo(x.v, f));
    if (q.length) rows.push({ E, q });
  }
  const counts = new Map();
  for (const { E } of rows) { const k = E.date.slice(0, 7); counts.set(k, (counts.get(k) || 0) + 1); }
  const out = [];
  let lastM = null, buf = [];
  const flush = () => { if (buf.length) out.push(html`<div class="mgrid" role="list">${buf}</div>`); buf = []; };
  for (const r of rows) {
    const k = r.E.date.slice(0, 7);
    if (k !== lastM) {
      flush();
      const p = parseDate(r.E.date);
      out.push(html`<div class="month-head"><span class="m-big">${p.m}</span><span class="m-unit">월</span><span class="m-sub">${p.y} · 공연 ${counts.get(k)}</span></div>`);
      lastM = k;
    }
    buf.push(...gridCards(g, m, r));
  }
  flush();
  return html`${head}<div class="mtimeline">${out}</div>`;
}

// 카드 한 장 = 공연 × 곡. 한 공연에 곡이 여럿이면 첫 카드 아래에 이어보기 버튼
function gridCards(g, m, r) {
  const { E, q } = r;
  const folder = href({ g: g.id, e: E.id, m: m.id });
  const thumbs = rowCards(m, r);
  return thumbs.map((t, i) => html`<div class="mcell" role="listitem">${t}
    <div class="mcap">
      <a class="mdate" href="${folder}" aria-label="${`${fmtMD(E.date)} ${E.ev.show} 공연 폴더 (${m.name})`}"><span class="num">${fmtMD(E.date)}</span> <span class="dow">${fmtDow(E.date)}</span></a>
      <a class="mshow" href="${folder}">${E.ev.show}${E.ev.label ? ` ${E.ev.label}` : ''}</a>
      ${i === 0 && q.length > 1 ? queueButton(E, m) : ''}
    </div></div>`);
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
