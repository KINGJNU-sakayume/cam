// 라인업: 날짜 행 × 멤버 열. 그룹 첫 화면, 곡 페이지에서 같이 쓴다.
import { html, fmtMD, parseDate } from '../util.js';
import { GROUP_KEY, NOSONG } from '../model.js';
import { app, filteredSection, visibleSongKeys, matchVideo } from '../state.js';
import { href, baseOf } from '../router.js';
import {
  videoThumb, clipThumb, dowPill, srcTags, srcShort, tagLine, cellKeyLabel, memberDots, ICON,
} from '../components.js';
import { cellOrder, memberQueue } from '../indexer.js';

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

// 펼치기 버튼 하나: 무엇이 들어 있는지(개수)를 버튼 안에 보여 준다
function expandBtn(E, c, open) {
  return html`<button type="button" class="sumbtn expbtn" data-act="expand" data-e="${E.id}" aria-expanded="${String(!!(open))}" aria-controls="${`panel-${E.id}`}">
    <span class="t">${open ? '접기' : '전체 보기'}</span><span class="ar" aria-hidden="true">${open ? '▴' : '▾'}</span><span class="n">${summaryText(c)}</span></button>`;
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

// 보이는 멤버 열에 직캠이 하나라도 있는지
const hasCam = (fs) => ctx.cols.some((m) => (fs.cells.get(m.id) || []).length);
// 멤버 칩이 한 명만 걸려 있으면: 이 공연에서 그 멤버 직캠을 곡 순서대로 이어 보기
export function queueButton(E, m) {
  const q = memberQueue(E, m.id);
  if (q.length < 2) return '';
  const first = q.find((x) => !x.v.gone) || q[0];
  return html`<a class="qbtn" href="${href({ ...baseOf(app.state), play: first.v.id, ps: first.songKey || undefined })}" data-autoplay aria-label="${`${fmtMD(E.date)} ${E.ev.show} ${m.name} 직캠 ${q.length}곡 이어 보기`}">${ICON.play}<span>${m.name} 이어보기</span><span class="n">${q.length}곡</span></a>`;
}
function soloPick() {
  if (ctx.forceSong) return null;
  const picked = [...ctx.f.members].filter((k) => k !== GROUP_KEY);
  return picked.length === 1 && ctx.f.members.size === 1 ? app.ix.member.get(picked[0]) : null;
}

export function dateBlock(E, keys, sel, forced) {
  const folder = href({ g: E.group.id, e: E.id });
  return html`
    <div class="dl"><a class="d-big" href="${folder}" aria-label="${`${fmtMD(E.date)} ${E.ev.show} 공연 폴더`}">${fmtMD(E.date)}</a>${dowPill(E.date)}</div>
    <a class="show" href="${folder}">${E.ev.show}${E.ev.label ? html`<span class="lbl">${E.ev.label}</span>` : ''}</a>
    ${E.ev.note ? html`<p class="note">${E.ev.note}</p>` : ''}
    ${songControl(E, keys, sel, forced)}
    ${ctx && soloPick() ? queueButton(E, soloPick()) : ''}`;
}

// ---------- 공연 한 줄 = 바인더 낱장: 직캠 있는 멤버 카드를 < > 로 넘겨 보고, 풀캠은 오른쪽에 ----------
// 멤버 순서대로 직캠이 있는 멤버만, 그 뒤에 단체·유닛
function camCards(fs, sel) {
  const cards = [];
  for (const m of ctx.cols) {
    const list = fs.cells.get(m.id) || [];
    if (!list.length) continue;
    const badges = [];
    if (list.length > 1) badges.push({ text: `+${list.length - 1}` });
    if (fs.clips.some((C) => C.key === m.id)) badges.push({ text: '움짤' });
    if ((list[0].tags || []).includes('세로')) badges.push({ text: '세로' });
    cards.push(videoThumb(list[0], { ratio: camRatio(), songKey: sel, badges, label: `${m.name} 직캠 재생 (${srcTags(list[0])})`, stripExtra: dense() ? '' : srcShort(list[0]) }));
  }
  for (const [k, list] of fs.cells) {
    if (k !== GROUP_KEY && !k.includes('+')) continue;
    for (const v of list) cards.push(videoThumb(v, { ratio: camRatio(), songKey: sel, label: `${cellKeyLabel(app.ix, k)} 직캠 재생`, stripExtra: dense() ? '' : srcShort(v) }));
  }
  return cards;
}
const fullThumb = (v, sel, badges = []) => (dense()
  ? videoThumb(v, { ratio: 'band', songKey: sel, badges, label: `${v.title || '풀캠'} 재생` })
  : videoThumb(v, { ratio: '169', songKey: sel, badges, caption: html`<div class="clamp1">${v.title || '풀캠'}</div>` }));
// 조밀 모드: 직캠은 1:2.2 전신 띠, 풀캠은 3:1 띠(얼굴 기준 위치)
const dense = () => app.prefs.density === 'dense';
const camRatio = () => (dense() ? 'strip' : '23');

function rowHTML(r) {
  const { E, keys } = r;
  const sel = selectedKey(E, keys);
  const S = E.sections.get(sel);
  const fs = S ? filteredSection(S, ctx.f) : { full: [], cells: new Map(), clips: [] };
  const open = ctx.open === E.id;
  const cards = camCards(fs, sel);
  const full = fs.full;
  const c = summaryCounts(fs);
  let body;
  if (!cards.length) {
    // 직캠이 없으면 풀캠을 가로로 크게 늘어놓는다
    body = full.length
      ? (() => { const n = Math.min(full.length, dense() ? 2 : 3); return html`<div class="car-fulls" style="${`--n:${n}`}">${full.slice(0, n).map((v, i) => fullThumb(v, sel, i === n - 1 && full.length > n ? [{ text: `+${full.length - n}` }] : []))}</div>`; })()
      : html`<div class="lu-nocam car-none"><span>이 곡은 영상이 아직 없어요</span></div>`;
  } else if (app.layout === 'compact' && app.narrow && !dense()) {
    // (조밀 모드는 직캠 띠가 좁아 절반창에서도 풀캠 띠를 오른쪽에 둔다)
    // 절반창: 풀캠을 같은 넘기기 줄 끝에 16:9 카드로 붙여 한 줄 높이를 지킨다
    const fr = dense() ? 'band' : '169';
    const fulls = full.map((v) => html`<div class="${`car-item r${fr}`}" role="listitem">${videoThumb(v, { ratio: fr, songKey: sel, badges: [{ text: '풀캠' }] })}</div>`);
    body = html`<div class="car wide" data-car>
      <button type="button" class="car-btn prev" data-act="car" data-d="-1" aria-label="이전 영상" disabled>‹</button>
      <div class="car-track" role="list" aria-label="멤버 직캠과 풀캠">${cards.map((x) => html`<div class="car-item" role="listitem">${x}</div>`)}${fulls}</div>
      <button type="button" class="car-btn next" data-act="car" data-d="1" aria-label="다음 영상">›</button>
    </div>`;
  } else {
    // 풀캠은 카드 높이에 맞춰 두 개까지 위아래로
    // 풀캠: 편안은 16:9 두 장까지 위아래로, 조밀은 3:1 띠 한 장(카드 높이와 같음)
    const nf = dense() ? 1 : 2;
    const side = full.length
      ? html`<div class="car-full">${full.slice(0, nf).map((v, i) => fullThumb(v, sel, i === nf - 1 && full.length > nf ? [{ text: `+${full.length - nf}` }] : []))}</div>`
      : '';
    body = html`<div class="${`car${side ? '' : ' wide'}`}" data-car>
      <button type="button" class="car-btn prev" data-act="car" data-d="-1" aria-label="이전 직캠" disabled>‹</button>
      <div class="car-track" role="list" aria-label="멤버 직캠">${cards.map((x) => html`<div class="car-item" role="listitem">${x}</div>`)}</div>
      <button type="button" class="car-btn next" data-act="car" data-d="1" aria-label="다음 직캠">›</button>
    </div>${side}`;
  }
  return html`<div class="${`car-row${cards.length ? '' : ' nocam'}`}" id="${`row-${E.id}`}" data-row="${E.id}">
    <div class="lu-date">${dateBlock(E, keys, sel, ctx.forceSong)}
      ${expandBtn(E, c, open)}
    </div>
    ${body}
  </div>${open ? html`<div class="lu-panel" id="${`panel-${E.id}`}">${panelHTML(E, sel, fs)}</div>` : ''}`;
}

// < > 버튼: 넘칠 때만 켜고, 끝에 닿으면 끈다
export function updateCarousels(root) {
  for (const car of root.querySelectorAll('[data-car]')) {
    const t = car.querySelector('.car-track');
    const max = t.scrollWidth - t.clientWidth - 2;
    car.classList.toggle('overflow', max > 0);
    car.querySelector('.prev').disabled = t.scrollLeft <= 2;
    car.querySelector('.next').disabled = t.scrollLeft >= max;
  }
}
export function scrollCarousel(btn) {
  const t = btn.closest('[data-car]')?.querySelector('.car-track');
  if (!t) return;
  const item = t.querySelector('.car-item');
  const step = item ? item.getBoundingClientRect().width + 8 : t.clientWidth * 0.8;
  const n = Math.max(1, Math.floor(t.clientWidth / step) - 1);
  t.scrollBy({ left: Number(btn.dataset.d) * step * n, behavior: 'smooth' });
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
    ${nothing ? html`<p class="note">이 곡은 풀캠·단체·유닛·움짤이 아직 없어요.</p>` : ''}
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
      return ''; // 직캠이 없는 멤버는 보이지 않는다
    }
    const v = list[0];
    const badges = list.length > 1 ? [{ text: `+${list.length - 1}` }] : [];
    if (fs.clips.some((C) => C.key === m.id)) badges.push({ text: '움짤' });
    return html`<div class="mthumb">${videoThumb(v, { ratio: camRatio(), songKey: sel, badges, label: `${m.name} 직캠 재생`, stripExtra: dense() ? '' : srcShort(v) })}</div>`;
  });
  return html`<article class="mcard" id="${`row-${E.id}`}" data-row="${E.id}">
    <div class="mcard-head">${dateBlock(E, keys, sel, ctx.forceSong)}</div>
    ${ctx.cols.length && hasCam(fs) ? html`<div class="mstrip" role="list" aria-label="멤버 직캠">${cams}</div>` : ''}
    ${fs.full[0] ? html`<div class="mfull">${videoThumb(fs.full[0], { ratio: dense() ? 'band' : '169', songKey: sel, badges: fs.full.length > 1 ? [{ text: `+${fs.full.length - 1}` }] : [] })}</div>` : ''}
    ${!hasCam(fs) && !fs.full.length ? html`<p class="mnocam">영상이 아직 없어요</p>` : ''}
    ${expandBtn(E, c, open)}
    ${open ? html`<div id="${`panel-${E.id}`}">${panelHTML(E, sel, fs)}</div>` : ''}
  </article>`;
}

function monthHTML(item) {
  // 감싸는 div 없이 행들과 같은 부모에 둬야 sticky 색인 탭이 다음 달까지 붙어 있는다
  return html`<div class="month-head"><span class="m-big">${item.m}</span><span class="m-unit">월</span><span class="m-sub">${item.y} · 공연 ${item.n}</span></div>`;
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

  // 열린 행이 있으면 그 행까지는 처음부터 그린다
  let first = CHUNK;
  if (open) { const i = items.findIndex((it) => it.type === 'row' && it.E.id === open); if (i >= 0) first = Math.max(first, i + 4); }
  ctx.rendered = Math.min(first, items.length);
  const body = items.slice(0, ctx.rendered).map(itemHTML);
  const more = ctx.rendered < items.length ? html`<div class="lu-more" data-more aria-hidden="true" style="height:1px"></div>` : '';

  const d = dense() ? ' dense' : '';
  if (app.mobile) return html`<div class="${`mcards${d}`}" id="lu-body">${body}</div>${more}`;
  return html`<div class="${`lu${d}`}"><div id="lu-body">${body}${more}</div></div>`;
}

// 렌더 후 연결: 남은 행 지연 렌더, < > 버튼 상태
export function mountLineup(root) {
  if (!app.mobile) {
    updateCarousels(root);
    // root는 다시 그려도 그대로라 한 번만 연결한다
    if (!root.dataset.carBound) {
      root.dataset.carBound = '1';
      root.addEventListener('scroll', (e) => { if (e.target.classList?.contains('car-track')) updateCarousels(e.target.closest('[data-car]').parentElement); }, { capture: true, passive: true });
      root.addEventListener('lu:more', () => updateCarousels(root));
      new ResizeObserver(() => updateCarousels(root)).observe(root);
    }
  }
  const sentinel = ctx && root.querySelector('[data-more]');
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
  if (fresh.querySelector('[data-car]')) updateCarousels(fresh);
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
