// 라인업: 날짜 행 × 멤버 열. 그룹 첫 화면, 곡 페이지에서 같이 쓴다.
import { html, fmtMD, parseDate } from '../util.js';
import { GROUP_KEY, NOSONG } from '../model.js';
import { app, filteredSection, visibleSongKeys, adminHref, matchVideo } from '../state.js';
import { href } from '../router.js';
import {
  videoThumb, clipThumb, emptyCell, dowPill, srcTags, srcShort, tagLine, cellKeyLabel, memberDots, ICON,
} from '../components.js';
import { cellOrder } from '../indexer.js';

const CHUNK = 24;
let ctx = null; // 현재 그려진 라인업

// 보이는 멤버 열: 활동 멤버(order 순) + 범위 안에 직캠이 있는 활동 종료 멤버. 멤버 칩이 걸리면 그 멤버만.
export function lineupColumns(group, rows, f) {
  if (f.types.size === 1 && f.types.has('full')) return [];
  const picked = [...f.members].filter((k) => k !== GROUP_KEY);
  if (picked.length) return group._members.filter((m) => picked.includes(m.id));
  if (f.members.size && !picked.length) return [];
  const hasCam = new Set();
  for (const { E, keys } of rows) {
    for (const k of keys) {
      const S = E.sections.get(k);
      if (!S) continue;
      for (const [ck, list] of S.cells) if (!ck.includes('+') && ck !== GROUP_KEY && list.some((v) => matchVideo(v, f))) hasCam.add(ck);
    }
  }
  return group._members.filter((m) => m.active !== false || hasCam.has(m.id));
}

function selectedKey(E, keys) {
  const s = app.rowSong.get(E.id);
  return keys.includes(s) ? s : keys[0];
}

const songTitle = (k) => (k === NOSONG ? '전체 공연' : app.ix.song.get(k)?.title || k);

function summaryCounts(fs) {
  let gu = 0, multi = 0;
  for (const [k, l] of fs.cells) {
    if (k === GROUP_KEY || k.includes('+')) gu += l.length;
    else if (l.length > 1) multi++;
  }
  return { full: fs.full.length, gu, clips: fs.clips.length, multi };
}
function summaryText(c) {
  const parts = [];
  if (c.full) parts.push(`풀캠 ${c.full}`);
  if (c.gu) parts.push(`단체·유닛 ${c.gu}`);
  if (c.clips) parts.push(`움짤 ${c.clips}`);
  if (c.multi) parts.push(`여러 개 칸 ${c.multi}`);
  return parts.length ? parts.join(' · ') : '더 볼 영상 없음';
}

function songControl(E, keys, sel, forced) {
  if (keys.length === 1) {
    if (keys[0] === NOSONG) return html`<span class="wholetag">전체 공연</span>`;
    const no = E.songNo.get(keys[0]);
    return html`<span class="songfixed">${no && E.songOrder.length > 1 ? html`<span class="num">${String(no).padStart(2, '0')}</span> ` : ''}${songTitle(keys[0])}</span>`;
  }
  return html`<div class="songbtns" role="group" aria-label="곡 고르기">${keys.map((k) => {
    const no = E.songNo.get(k);
    return html`<button type="button" class="songbtn" data-act="rowsong" data-e="${E.id}" data-s="${k || 'none'}" aria-pressed="${String(!!(k === sel))}">${no ? html`<span class="no">${String(no).padStart(2, '0')}</span>` : ''}<span>${songTitle(k)}</span></button>`;
  })}</div>`;
}

function memberCell(E, fs, m, songKey) {
  const list = fs.cells.get(m.id) || [];
  if (!list.length) {
    if (app.prefs.hideEmpty) return html`<div class="lu-cell"></div>`;
    return html`<div class="lu-cell">${emptyCell({ member: m, g: E.group.id, e: E.id, s: songKey || undefined })}</div>`;
  }
  const v = list[0];
  const badges = [];
  if (list.length > 1) badges.push({ text: `+${list.length - 1}` });
  if (fs.clips.some((C) => C.key === m.id)) badges.push({ text: '움짤' });
  if ((v.tags || []).includes('세로')) badges.push({ text: '세로' });
  return html`<div class="lu-cell">${videoThumb(v, {
    ratio: '23', songKey, badges,
    label: `${m.name} 직캠 재생 (${srcTags(v)})`,
    stripExtra: srcShort(v),
  })}</div>`;
}

// 보이는 멤버 열에 직캠이 하나라도 있는지. 없으면 빈 칸을 멤버 수만큼 그리지 않는다
const hasCam = (fs) => ctx.cols.some((m) => (fs.cells.get(m.id) || []).length);
// 멤버 직캠이 없는 공연: 멤버 칸 자리를 풀캠·단체 사진으로 크게 채운다(멤버 두 칸에 사진 하나). 사진도 없으면 한 줄 안내
function noCamCell(E, fs, songKey) {
  if (!ctx.cols.length) return '';
  const span = `grid-column:span ${ctx.cols.length}`;
  const pics = [...fs.full, ...(fs.cells.get(GROUP_KEY) || [])];
  if (!pics.length) {
    return html`<div class="lu-nocam" style="${span}"><span>이 곡은 멤버 직캠이 아직 없어요</span>
      <a class="add" href="${adminHref({ g: E.group.id, e: E.id, s: songKey || undefined })}">+ 담기</a></div>`;
  }
  const n = Math.max(1, Math.ceil(ctx.cols.length / 2));
  const shown = pics.slice(0, n);
  return html`<div class="lu-wide" style="${`${span};--n:${n}`}">${shown.map((v, i) => videoThumb(v, {
    ratio: '169', songKey,
    badges: i === shown.length - 1 && pics.length > n ? [{ text: `+${pics.length - n}` }] : [],
    caption: html`<div class="clamp1">${v.title || '풀캠'}</div>`,
  }))}</div>`;
}

function lastCell(E, fs, songKey, open, wide) {
  // 멤버 칸에 풀캠을 크게 깔았으면 여기는 요약 버튼만
  const v = wide ? null : fs.full[0];
  const c = summaryCounts(fs);
  const top = wide ? '' : v
    ? videoThumb(v, { ratio: '169', songKey, badges: fs.full.length > 1 ? [{ text: `+${fs.full.length - 1}` }] : [], caption: html`<div class="clamp2">${v.title || '풀캠'}</div>` })
    : (app.prefs.hideEmpty ? '' : emptyCell({ g: E.group.id, e: E.id, s: songKey || undefined, ratio: '169', label: '풀캠 없음' }));
  return html`<div class="lu-last">${top}
    <button type="button" class="sumbtn" data-act="expand" data-e="${E.id}" aria-expanded="${String(!!(open))}" aria-controls="${`panel-${E.id}`}">${summaryText(c)}</button>
  </div>`;
}

function dateBlock(E, keys, sel, forced) {
  const folder = href({ g: E.group.id, e: E.id });
  return html`
    <div class="dl"><a class="d-big" href="${folder}" aria-label="${`${fmtMD(E.date)} ${E.ev.show} 공연 폴더`}">${fmtMD(E.date)}</a>${dowPill(E.date)}</div>
    <a class="show" href="${folder}">${E.ev.show}${E.ev.label ? html`<span class="lbl">${E.ev.label}</span>` : ''}</a>
    ${E.ev.note ? html`<p class="note">${E.ev.note}</p>` : ''}
    ${songControl(E, keys, sel, forced)}`;
}

function rowHTML(r) {
  const { E, keys } = r;
  const sel = selectedKey(E, keys);
  const S = E.sections.get(sel);
  const fs = S ? filteredSection(S, ctx.f) : { full: [], cells: new Map(), clips: [] };
  const open = ctx.open === E.id;
  const cam = hasCam(fs);
  const wide = !cam && !app.prefs.hideEmpty && ctx.cols.length > 0 && (fs.full.length + (fs.cells.get(GROUP_KEY) || []).length) > 0;
  return html`<div class="${`lu-row${cam ? '' : ' nocam'}`}" id="${`row-${E.id}`}" data-row="${E.id}">
    <span class="lu-tab" aria-hidden="true">${fmtMD(E.date)}</span>
    <div class="lu-date">${dateBlock(E, keys, sel, ctx.forceSong)}
      <button type="button" class="linkbtn expand-btn" data-act="expand" data-e="${E.id}" aria-expanded="${String(!!(open))}" aria-controls="${`panel-${E.id}`}">${open ? '접기 ↑' : '이 날 전체 보기 ↓'}</button>
    </div>
    ${cam || app.prefs.hideEmpty ? ctx.cols.map((m) => memberCell(E, fs, m, sel)) : noCamCell(E, fs, sel)}
    ${lastCell(E, fs, sel, open, wide)}
  </div>${open ? html`<div class="lu-panel" id="${`panel-${E.id}`}">${panelHTML(E, sel, fs)}</div>` : ''}`;
}

// 펼치기 패널: 현재 곡의 풀캠 전부, 단체·유닛, 여러 개 칸(멤버별), 움짤
export function panelHTML(E, sel, fs) {
  const ix = app.ix;
  const groupUnit = [...fs.cells.entries()].filter(([k]) => k === GROUP_KEY || k.includes('+'));
  const multi = cellOrder(E, { cells: fs.cells }, { includeEmpty: false }).filter((c) => c.kind === 'member' && c.videos.length > 1);
  const title = `${fmtMD(E.date)} ${E.ev.show}${E.ev.label ? ` ${E.ev.label}` : ''} · ${songTitle(sel)}`;
  const nothing = !fs.full.length && !groupUnit.length && !multi.length && !fs.clips.length;
  return html`<section class="panel" aria-label="${`${title} 전체`}">
    <div class="panel-head"><h3>${title}</h3><span class="spacer"></span>
      <a class="textlink" href="${href({ g: E.group.id, e: E.id })}">공연 폴더로 →</a>
      <button type="button" class="iconbtn" data-act="expand" data-e="${E.id}" aria-label="펼친 내용 닫기">${ICON.close}</button>
    </div>
    ${nothing ? html`<p class="note">이 곡은 풀캠·단체·유닛·움짤이 아직 없어요. <a href="${adminHref({ g: E.group.id, e: E.id, s: sel || undefined })}">+ 담기</a></p>` : ''}
    ${fs.full.length ? html`<div class="psec"><h4>풀캠 ${fs.full.length}</h4><div class="grid-169">${fs.full.map((v) => videoThumb(v, {
      ratio: '169', songKey: sel, caption: html`<div class="clamp2 l1">${v.title || '풀캠'}</div><div class="lm">${srcTags(v)}</div>`,
    }))}</div></div>` : ''}
    ${groupUnit.length ? html`<div class="psec"><h4>단체·유닛 ${groupUnit.reduce((a, [, l]) => a + l.length, 0)}</h4><div class="grid-23">${groupUnit.flatMap(([k, list]) => list.map((v) => videoThumb(v, {
      ratio: '23', songKey: sel,
      caption: html`<div class="l1">${memberDots(ix, v.memberIds)}<span>${cellKeyLabel(ix, k)}</span></div><div class="lm">${srcTags(v)}</div>`,
    })))}</div></div>` : ''}
    ${multi.length ? html`<div class="psec"><h4>한 칸에 여러 개</h4>${multi.map((c) => html`<div class="multi-group">
      <h4><span class="dot" style="${`background:${c.member._color}`}"></span>${c.member.name} · ${c.videos.length}개</h4>
      <div class="grid-23">${c.videos.map((v, i) => videoThumb(v, {
        ratio: '23', songKey: sel, badges: i === 0 ? [{ text: '대표' }] : [],
        caption: html`<div class="lm">${v.channel || '채널 모름'}</div><div class="lm">${tagLine(v)}</div>`,
      }))}</div></div>`)}</div>` : ''}
    ${fs.clips.length ? html`<div class="psec"><h4>움짤 ${fs.clips.length}</h4><div class="grid-23">${fs.clips.map((C) => clipThumb(C, {
      caption: html`<div class="l1">${memberDots(ix, C.memberIds)}<span>${C.key === 'full' ? '풀캠' : cellKeyLabel(ix, C.key)}</span></div><div class="lm">${C.clip.note || ''}</div>`,
    }))}</div></div>` : ''}
  </section>`;
}

// ---------- 모바일 카드 ----------
function mobileCard(r) {
  const { E, keys } = r;
  const sel = selectedKey(E, keys);
  const S = E.sections.get(sel);
  const fs = S ? filteredSection(S, ctx.f) : { full: [], cells: new Map(), clips: [] };
  const open = ctx.open === E.id;
  const c = summaryCounts(fs);
  const cams = ctx.cols.map((m) => {
    const list = fs.cells.get(m.id) || [];
    if (!list.length) {
      if (app.prefs.hideEmpty) return '';
      return html`<div class="mthumb">${emptyCell({ member: m, g: E.group.id, e: E.id, s: sel || undefined, label: '없음' })}</div>`;
    }
    const v = list[0];
    const badges = list.length > 1 ? [{ text: `+${list.length - 1}` }] : [];
    if (fs.clips.some((C) => C.key === m.id)) badges.push({ text: '움짤' });
    return html`<div class="mthumb">${videoThumb(v, { ratio: '23', songKey: sel, badges, label: `${m.name} 직캠 재생`, stripExtra: srcShort(v) })}</div>`;
  });
  return html`<article class="mcard" id="${`row-${E.id}`}" data-row="${E.id}">
    <div class="mcard-head">${dateBlock(E, keys, sel, ctx.forceSong)}</div>
    ${ctx.cols.length && (hasCam(fs) || app.prefs.hideEmpty) ? html`<div class="mstrip" role="list" aria-label="멤버 직캠">${cams}</div>` : ''}
    ${ctx.cols.length && !hasCam(fs) && !app.prefs.hideEmpty ? html`<p class="mnocam">멤버 직캠이 아직 없어요</p>` : ''}
    <button type="button" class="sumbtn" data-act="expand" data-e="${E.id}" aria-expanded="${String(!!(open))}" aria-controls="${`panel-${E.id}`}"><span>${summaryText(c)}</span><span aria-hidden="true">${open ? '↑' : '↓'}</span></button>
    ${open ? html`<div id="${`panel-${E.id}`}">${panelHTML(E, sel, fs)}</div>` : ''}
  </article>`;
}

function monthHTML(item) {
  return html`<div class="lu-month"><div class="month-head"><span class="m-big">${item.m}</span><span class="m-unit">월</span><span class="m-sub">${item.y} · 공연 ${item.n}</span></div></div>`;
}

function itemHTML(item) {
  if (item.type === 'month') return monthHTML(item);
  return app.mobile ? mobileCard(item) : rowHTML(item);
}

// 라인업 전체 HTML. rows: [{E, keys}] (정렬·필터 끝난 것)
export function lineupHTML({ group, events, f, forceSong = null, open = null }) {
  const rows = events.map((E) => ({ E, keys: visibleSongKeys(E, f, forceSong) })).filter((r) => r.keys.length);
  const cols = lineupColumns(group, rows, f);
  const items = [];
  const monthCount = new Map();
  for (const r of rows) { const k = r.E.date.slice(0, 7); monthCount.set(k, (monthCount.get(k) || 0) + 1); }
  let lastM = null;
  for (const r of rows) {
    const k = r.E.date.slice(0, 7);
    if (k !== lastM) { const p = parseDate(r.E.date); items.push({ type: 'month', y: p.y, m: p.m, n: monthCount.get(k) }); lastM = k; }
    items.push({ type: 'row', ...r });
  }
  ctx = { group, f, forceSong, open, cols, items, rendered: 0 };
  if (!rows.length) return null;

  // 열 머리 직캠 수(보이는 범위의 멤버 단독 직캠)
  const camCount = new Map(cols.map((m) => [m.id, 0]));
  for (const { E, keys } of rows) {
    const seen = new Set();
    for (const k of keys) {
      const S = E.sections.get(k);
      if (!S) continue;
      for (const m of cols) for (const v of S.cells.get(m.id) || []) if (!seen.has(v.id) && matchVideo(v, f)) { seen.add(v.id); camCount.set(m.id, camCount.get(m.id) + 1); }
    }
  }

  // 열린 행이 있으면 그 행까지는 처음부터 그린다
  let first = CHUNK;
  if (open) { const i = items.findIndex((it) => it.type === 'row' && it.E.id === open); if (i >= 0) first = Math.max(first, i + 4); }
  ctx.rendered = Math.min(first, items.length);
  const body = items.slice(0, ctx.rendered).map(itemHTML);
  const more = ctx.rendered < items.length ? html`<div class="lu-more" data-more aria-hidden="true" style="height:1px"></div>` : '';

  if (app.mobile) return html`<div class="mcards" id="lu-body">${body}</div>${more}`;

  const head = html`<div class="lu-headrow">
    <div class="lu-hcell first">날짜 · 행사</div>
    ${cols.map((m) => html`<div class="${`lu-hcell${m.active === false ? ' retired' : ''}`}"><a href="${href({ g: group.id, v: 'member', m: m.id })}"><span class="dot" style="${`background:${m._color}`}"></span><span class="nm">${m.name}${m.active === false ? ' (활동 종료)' : ''}</span></a><span class="cnt">${camCount.get(m.id)}</span></div>`)}
    <div class="lu-hcell">풀캠 · 단체 · 움짤</div>
  </div>`;
  return html`<div class="lu" style="${`--ncols:${cols.length}`}">
    <div class="lu-head-wrap" aria-hidden="false"><div class="lu-grid">${head}</div></div>
    <div class="lu-scroll" tabindex="-1"><div class="lu-grid" id="lu-body">${body}${more}</div></div>
  </div>`;
}

// 렌더 후 연결: 남은 행 지연 렌더, 가로 스크롤 동기화, 보이는 폭
export function mountLineup(root) {
  if (!ctx) return;
  const sc = root.querySelector('.lu-scroll');
  const headWrap = root.querySelector('.lu-head-wrap');
  if (sc && headWrap) {
    sc.addEventListener('scroll', () => { headWrap.scrollLeft = sc.scrollLeft; }, { passive: true });
    const setW = () => root.querySelector('.lu')?.style.setProperty('--vis-w', `${sc.clientWidth}px`);
    setW();
    new ResizeObserver(setW).observe(sc);
  }
  const sentinel = root.querySelector('[data-more]');
  if (sentinel) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) lineupLoadMore(root);
      if (!root.querySelector('[data-more]')) io.disconnect();
    }, { rootMargin: '1200px 0px' });
    io.observe(sentinel);
  }
}

// 다음 묶음을 그린다
export function lineupLoadMore(root) {
  const sentinel = root.querySelector('[data-more]');
  if (!ctx || !sentinel) return false;
  const next = ctx.items.slice(ctx.rendered, ctx.rendered + CHUNK);
  ctx.rendered += next.length;
  sentinel.insertAdjacentHTML('beforebegin', next.map(itemHTML).join(''));
  if (ctx.rendered >= ctx.items.length) sentinel.remove();
  root.dispatchEvent(new CustomEvent('lu:more'));
  return true;
}

function replaceRow(root, eid) {
  const item = ctx && ctx.items.find((it) => it.type === 'row' && it.E.id === eid);
  if (!item) return null;
  const el = root.querySelector(`[data-row="${CSS.escape(eid)}"]`);
  if (!el) return null;
  const oldPanel = !app.mobile ? el.nextElementSibling : null;
  if (oldPanel && oldPanel.classList.contains('lu-panel')) oldPanel.remove();
  el.insertAdjacentHTML('afterend', String(itemHTML(item)));
  const fresh = el.nextElementSibling;
  el.remove();
  return fresh;
}

export function setRowSong(root, eid, songKey) {
  app.rowSong.set(eid, songKey);
  const el = replaceRow(root, eid);
  if (el) el.querySelector(`[data-act="rowsong"][data-s="${CSS.escape(songKey || 'none')}"]`)?.focus();
}

// 펼치기 상태만 바뀐 경우 해당 행만 다시 그린다
export function setOpen(root, eid) {
  if (!ctx) return false;
  const prev = ctx.open;
  ctx.open = eid || null;
  if (prev && prev !== eid) replaceRow(root, prev);
  if (eid) {
    let el = root.querySelector(`[data-row="${CSS.escape(eid)}"]`);
    if (!el) return false;
    el = replaceRow(root, eid);
    const panel = root.querySelector(`#panel-${CSS.escape(eid)}`);
    if (panel) {
      const r = panel.getBoundingClientRect();
      if (r.bottom > innerHeight) panel.scrollIntoView({ block: 'nearest', behavior: app.reduced ? 'auto' : 'smooth' });
    }
  }
  return true;
}

export function lineupOpenId() { return ctx ? ctx.open : null; }
