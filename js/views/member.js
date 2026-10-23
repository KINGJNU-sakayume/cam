// 멤버 보기: 멤버 목록 → 멤버 페이지(의상 타임라인)
import { html, fmtMD, parseDate } from '../util.js';
import { NOSONG, thumbSrc } from '../model.js';
import { app, sortEvents, matchVideo, NO_FILTER } from '../state.js';
import { href } from '../router.js';
import { videoThumb, dowPill, srcTags, posOf } from '../components.js';
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
  else if (latest) { src = thumbSrc(latest.v) || ph; pos = posOf(latest.v); }
  else src = ph;
  return html`<div class="tile">
    <a class="thumb r23" href="${h}" aria-label="${`${m.name} 멤버 페이지`}">
      <img src="${src}" data-ph="${ph}" alt="" loading="lazy" decoding="async" style="${`object-position:${pos}`}">
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
    <div class="tiles m">${act.map((m) => tile(g, m))}</div>
    ${ret.length ? html`<h2 class="subhead">활동 종료</h2><div class="tiles m">${ret.map((m) => tile(g, m))}</div>` : ''}`;
}

const songName = (k) => (k === NOSONG ? '전체 공연' : app.ix.song.get(k)?.title || k);

function itemThumb(m, it) {
  const { E, k, v, n, clips } = it;
  const badges = [];
  if (n > 1) badges.push({ text: `+${n - 1}` });
  if (clips) badges.push({ text: '움짤' });
  return videoThumb(v, {
    ratio: '23', songKey: k, badges,
    label: `${fmtMD(E.date)} ${E.ev.show} ${songName(k)} ${m.name} 직캠 재생`,
    caption: html`<div class="l1"><span class="num">${fmtMD(E.date)}</span>${dowPill(E.date)}</div>
      <div class="lm">${E.ev.show}${E.ev.label ? ` ${E.ev.label}` : ''}</div>
      <div class="lm" style="color:var(--text)">${songName(k)}</div>
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
    return html`${head}${order.map((k) => html`<section class="songrow"><h3>${songName(k)}<span class="cnt">${bySong.get(k).length}</span>
      ${k ? html`<a class="textlink" href="${href({ g: g.id, v: 'song', s: k, m: m.id })}">모아보기 →</a>` : ''}</h3>
      <div class="grid-23 big">${bySong.get(k).map((it) => itemThumb(m, it))}</div></section>`)}`;
  }
  // 월 머리로 구분
  const out = [];
  let lastM = null, buf = [];
  const flush = () => { if (buf.length) out.push(html`<div class="grid-23 big">${buf}</div>`); buf = []; };
  const counts = new Map();
  for (const it of items) { const k = it.E.date.slice(0, 7); counts.set(k, (counts.get(k) || 0) + 1); }
  for (const it of items) {
    const k = it.E.date.slice(0, 7);
    if (k !== lastM) {
      flush();
      const p = parseDate(it.E.date);
      out.push(html`<div class="month-head"><span class="m-big">${p.m}</span><span class="m-unit">월</span><span class="m-sub">${p.y} · 직캠 ${counts.get(k)}</span></div>`);
      lastM = k;
    }
    buf.push(itemThumb(m, it));
  }
  flush();
  return html`${head}${out}`;
}
