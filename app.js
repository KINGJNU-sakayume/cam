// 무대 서랍 보기 화면: 데이터 로드 → 색인 → 해시 라우팅 → 렌더
import { html, debounce, norm } from './js/util.js';
import { loadData, inflate, LoadError } from './js/data.js';
import { buildIndex } from './js/indexer.js';
import { initRouter, parseHash, toHash, baseOf, go, href } from './js/router.js';
import { themeButton, applyAccent } from './js/theme.js';
import { app, loadPrefs, savePrefs, saveFilters, filtersOf, filterCount, sortEvents, adminHref } from './js/state.js';
import { GROUP_KEY } from './js/model.js';
import { ICON } from './js/components.js';
import { lineupHTML, mountLineup, setRowSong, setOpen, lineupLoadMore, scrollCarousel } from './js/views/lineup.js';
import { folderHTML, mountFolder, toggleFolderCell } from './js/views/folder.js';
import { songListHTML, songPageHTML } from './js/views/song.js';
import { memberListHTML, memberPageHTML } from './js/views/member.js';
import { clipGridHTML } from './js/views/clips.js';
import { eventGridHTML } from './js/views/events.js';
import { searchHTML, PAGE } from './js/views/search.js';
import { loadErrorHTML, emptyDataHTML, noResultHTML } from './js/views/states.js';
import { openPlayer, playerNav } from './js/views/player.js';
import { openClipDetail } from './js/views/clipdetail.js';
import { attachClipPlayback } from './js/clipplay.js';

const main = document.getElementById('main');
const tabsEl = document.getElementById('tabs');
const overlayRoot = document.getElementById('overlay-root');
const qInput = document.getElementById('q');
const LAST_KEY = 'sd.last';
const VIEWS = ['event', 'song', 'member', 'clip'];
const SONG_TOP = 8; // 필터에 바로 보이는 곡 수

let lastBaseKey = null;
let lastBase = null;
let overlayKey = null;
let overlayFromBase = false;
let returnFocus = null;
const scrollMem = new Map();

// ---------- 시작 ----------
async function start() {
  loadPrefs();
  app.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mq = matchMedia('(max-width: 719px)');
  app.mobile = mq.matches;
  mq.addEventListener('change', () => { app.mobile = mq.matches; lastBaseKey = null; render(); });
  themeButton(document.getElementById('theme-btn'), () => applyAccent(currentGroup()?.hue));
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--topbar-h', `${document.getElementById('topbar').offsetHeight}px`);
  }).observe(document.getElementById('topbar'));
  bindGlobal();

  main.innerHTML = '<p class="loading">불러오는 중이에요</p>';
  let data;
  try {
    data = await loadData();
  } catch (e) {
    main.innerHTML = String(loadErrorHTML(e instanceof LoadError ? e : new LoadError('network', { message: e.message })));
    tabsEl.hidden = true;
    return;
  }
  app.stress = new URLSearchParams(location.search).get('stress') === '1';
  if (app.stress) data = inflate(data);
  const t0 = performance.now();
  app.ix = buildIndex(data);
  app.indexMs = performance.now() - t0;
  initRouter(() => render());
  render();
}

function currentGroup() {
  const ix = app.ix;
  if (!ix) return null;
  return ix.group.get(app.state.g) || null;
}

// 상태 보정: 그룹이 없으면 마지막으로 본 그룹 → 첫 그룹. 오버레이만 있으면 배경을 그 영상의 공연 폴더로.
function resolveState(s) {
  const ix = app.ix;
  const out = { ...s };
  if (out.play && !ix.video.has(out.play)) { delete out.play; delete out.ps; delete out.pt; }
  if (out.clip && !ix.clip.has(out.clip)) delete out.clip;
  if (!out.g) {
    const ov = out.play ? ix.video.get(out.play) : out.clip ? ix.C.get(out.clip)?.E : null;
    const E = ov ? (ov.eventId ? ix.E.get(ov.eventId) : ov) : null;
    if (E) { out.g = E.group.id; out.e = E.id; }
  }
  if (!out.g || !ix.group.has(out.g)) {
    let last = null;
    try { last = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch { /* 없음 */ }
    if (last && ix.group.has(last.g)) { out.g = last.g; if (!out.v && !out.e && VIEWS.includes(last.v)) out.v = last.v; }
    else if (ix.groups[0]) out.g = ix.groups[0].id;
  }
  if (out.v && !VIEWS.includes(out.v)) delete out.v;
  if (out.e && (!ix.E.has(out.e) || ix.E.get(out.e).group.id !== out.g)) delete out.e;
  if (out.s && !ix.song.has(out.s)) delete out.s;
  if (out.m && !ix.member.has(out.m)) delete out.m;
  return out;
}

// ---------- 렌더 ----------
function render() {
  const ix = app.ix;
  if (!ix) return;
  const raw = parseHash();
  const s = resolveState(raw);
  app.state = s;
  if (toHash(s) !== toHash(raw)) history.replaceState(history.state, '', toHash(s));

  const g = currentGroup();
  if (g) {
    applyAccent(g.hue);
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ g: g.id, v: s.v || '' })); } catch { /* 저장 불가 */ }
  }
  renderTabs();

  const base = baseOf(s);
  const key = `${toHash(base)}|${app.query}|${app.mobile ? 'm' : 'd'}`;
  if (key !== lastBaseKey) {
    const onlyOpen = lastBaseKey && lastBase && !app.query && lastBase.open !== base.open && sameExcept(lastBase, base, 'open') && !base.e && !base.v;
    if (lastBaseKey) scrollMem.set(lastBaseKey, scrollY);
    if (!(onlyOpen && setOpen(main, base.open))) {
      renderBase(s);
      const y = scrollMem.get(key);
      restoreScroll(y);
    }
    lastBaseKey = key;
    lastBase = base;
  }
  renderOverlay(s);
}

function sameExcept(a, b, k) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete(k);
  for (const x of keys) if (a[x] !== b[x]) return false;
  return true;
}

function restoreScroll(y) {
  if (y == null) { scrollTo(0, 0); return; }
  // 지연 렌더된 라인업은 높이가 모자라면 더 그린 뒤 스크롤
  let guard = 0;
  while (document.documentElement.scrollHeight < y + innerHeight && main.querySelector('[data-more]') && guard++ < 40) {
    lineupLoadMore(main);
  }
  scrollTo(0, y);
}

function renderTabs() {
  const ix = app.ix;
  if (!ix.groups.length) { tabsEl.hidden = true; return; }
  tabsEl.hidden = false;
  const cur = app.state.g;
  tabsEl.innerHTML = String(html`${ix.groups.map((g) => html`<a class="tab" href="${href({ g: g.id })}" ${cur === g.id && !app.query ? html`aria-current="page"` : ''} data-g="${g.id}">
    <span class="dot" style="${`background:hsl(${Number(g.hue) || 0} 55% 45%)`}"></span>${g.name}<span class="cnt">${ix.groupStats.get(g.id).videos}</span></a>`)}`);
  const active = tabsEl.querySelector('[aria-current="page"]');
  if (active) {
    const r = active.getBoundingClientRect(), tr = tabsEl.getBoundingClientRect();
    if (r.right > tr.right || r.left < tr.left) tabsEl.scrollLeft += r.left - tr.left - 16;
  }
  document.getElementById('add-btn').href = adminHref({ g: cur });
}

function renderBase(s) {
  const ix = app.ix;
  if (!ix.groups.length || !ix.data.videos.length && !ix.data.events.length) {
    main.innerHTML = String(emptyDataHTML());
    return;
  }
  if (app.query.trim()) {
    main.innerHTML = String(searchHTML(app.query));
    afterRender();
    return;
  }
  const g = ix.group.get(s.g);
  let body;
  let crumbs = [];
  const f = filtersOf(g.id);
  if (s.e) {
    const E = ix.E.get(s.e);
    const m = s.m ? ix.member.get(s.m) : null;
    const evTitle = `${E.date.slice(5).replace('-', '.')} ${E.ev.show}${E.ev.label ? ` ${E.ev.label}` : ''}`;
    crumbs = [[g.name, href({ g: g.id })], ['공연', href({ g: g.id, v: 'event' })], [evTitle, m ? href({ g: g.id, e: E.id }) : null]];
    if (m) crumbs.push([m.name]);
    main.innerHTML = String(html`${crumbsHTML(crumbs)}${folderHTML(E, m && m._group === g ? m : null)}`);
    mountFolder(main);
    afterRender();
    document.title = `${E.date} ${E.ev.show} · ${g.name} · 무대 서랍`;
    return;
  }
  const view = s.v || 'lineup';
  const events = sortEvents(ix.eventsByGroup.get(g.id));
  if (view === 'lineup') {
    body = lineupHTML({ group: g, events, f, open: s.open || null });
    if (!body) body = noResultHTML(filterCount(f) > 0);
  } else if (view === 'song') {
    if (s.s) {
      const song = ix.song.get(s.s);
      crumbs = [[g.name, href({ g: g.id })], ['곡', href({ g: g.id, v: 'song' })], [song.title, s.m ? href({ g: g.id, v: 'song', s: s.s }) : null]];
      if (s.m) crumbs.push([ix.member.get(s.m).name]);
      body = songPageHTML(g, song, s.m ? ix.member.get(s.m) : null, f, s.open);
    } else {
      crumbs = [[g.name, href({ g: g.id })], ['곡']];
      body = songListHTML(g, f);
    }
  } else if (view === 'member') {
    if (s.m) {
      const m = ix.member.get(s.m);
      crumbs = [[g.name, href({ g: g.id })], ['멤버', href({ g: g.id, v: 'member' })], [m.name]];
      body = memberPageHTML(g, m, f);
    } else {
      crumbs = [[g.name, href({ g: g.id })], ['멤버']];
      body = memberListHTML(g, f);
    }
  } else if (view === 'event') {
    crumbs = [[g.name, href({ g: g.id })], ['공연']];
    body = eventGridHTML(g, f);
  } else if (view === 'clip') {
    crumbs = [[g.name, href({ g: g.id })], ['움짤']];
    body = clipGridHTML(g, f);
  }
  main.innerHTML = String(html`${crumbs.length ? crumbsHTML(crumbs) : ''}${viewbarHTML(g, view)}${filtersHTML(g, f, view)}<div id="view">${body}</div>`);
  mountLineup(main);
  afterRender();
  document.title = `${g.name} · 무대 서랍`;
}

function afterRender() {
  attachClipPlayback(main);
}

function crumbsHTML(list) {
  return html`<nav class="crumbs" aria-label="현재 위치">${list.map(([t, h], i) => html`${i ? html`<span class="sep" aria-hidden="true">›</span>` : ''}${h ? html`<a href="${h}">${t}</a>` : html`<span aria-current="page">${t}</span>`}`)}</nav>`;
}

function viewbarHTML(g, view) {
  const items = [['lineup', '라인업', href({ g: g.id })], ['event', '공연', href({ g: g.id, v: 'event' })], ['song', '곡', href({ g: g.id, v: 'song' })], ['member', '멤버', href({ g: g.id, v: 'member' })], ['clip', '움짤', href({ g: g.id, v: 'clip' })]];
  return html`<div class="viewbar">
    <nav class="seg" aria-label="보기">${items.map(([k, t, h]) => html`<a href="${h}" ${k === view ? html`aria-current="page"` : ''}>${t}</a>`)}</nav>
    <div class="viewopts">
      <div class="seg" role="group" aria-label="정렬">
        <button type="button" data-act="sort" data-v="desc" aria-pressed="${String(!!(app.prefs.sort === 'desc'))}">최신순</button>
        <button type="button" data-act="sort" data-v="asc" aria-pressed="${String(!!(app.prefs.sort === 'asc'))}">오래된순</button>
      </div>
    </div>
  </div>`;
}

function filtersHTML(g, f, view) {
  const ix = app.ix;
  const n = filterCount(f);
  const chip = (k, v, label, dot) => html`<button type="button" class="chip" data-act="filter" data-k="${k}" data-v="${v}" aria-pressed="${String(!!(f[k].has(v)))}">${dot || ''}${label}</button>`;
  const tags = [...ix.groupStats.get(g.id).tags].sort((a, b) => a.localeCompare(b, 'ko'));
  const desc = [];
  for (const id of f.songs) desc.push(ix.song.get(id)?.title);
  for (const id of f.members) desc.push(id === GROUP_KEY ? '단체' : ix.member.get(id)?.name);
  for (const t of f.types) desc.push(t === 'full' ? '풀캠' : '직캠');
  for (const t of f.tags) desc.push(t);
  const open = !app.mobile;
  // 곡: 영상 있는 곡만, 많이 담긴 순 상위 SONG_TOP개 + 고른 곡. 나머지(커버 포함)는 "곡 N개 더"로 접고 이름으로 찾는다
  const counts = ix.groupStats.get(g.id).songs;
  const cnt = (s) => counts.get(s.id) || 0;
  const pool = g._songs.filter((s) => s.kind !== 'other' && (cnt(s) || f.songs.has(s.id))).sort((a, b) => cnt(b) - cnt(a));
  const own = pool.filter((s) => s.kind !== 'cover');
  const top = own.slice(0, SONG_TOP);
  const shown = [...top, ...pool.filter((s) => f.songs.has(s.id) && !top.includes(s))];
  const rest = pool.filter((s) => !shown.includes(s));
  const songChip = (s) => html`<button type="button" class="chip" data-act="filter" data-k="songs" data-v="${s.id}" data-name="${norm([s.title, ...(s.aliases || [])].join(' '))}" aria-pressed="${String(f.songs.has(s.id))}">${s.title}<span class="n">${cnt(s)}</span></button>`;
  const restOwn = rest.filter((s) => s.kind !== 'cover'), restCover = rest.filter((s) => s.kind === 'cover');
  return html`<details class="filters" ${open ? html`open` : ''} id="filters">
    <summary><span>필터</span>${n ? html`<span class="on">${desc.filter(Boolean).join(', ')}</span>` : html`<span class="hint">곡·멤버·종류·태그</span>`}<span style="margin-left:auto">${ICON.chev}</span></summary>
    <div class="fgroups">
      <div class="fgroup" role="group" aria-label="곡"><span class="flabel">곡</span>${shown.map(songChip)}
        ${rest.length ? html`<button type="button" class="chip chip-more" data-act="moreSongs" aria-expanded="${String(app.songsOpen)}" aria-controls="songmore">${app.songsOpen ? '접기' : `곡 ${rest.length}개 더`}</button>` : ''}
      </div>
      ${rest.length && app.songsOpen ? html`<div class="songmore" id="songmore">
        <input class="input songq" type="search" data-act="songq" placeholder="${`곡 이름으로 찾기 (${rest.length}곡)`}" aria-label="곡 이름으로 찾기" autocomplete="off" spellcheck="false">
        ${restOwn.length ? html`<div class="fgroup" role="group" aria-label="그 밖의 곡"><span class="flabel">그 밖</span>${restOwn.map(songChip)}</div>` : ''}
        ${restCover.length ? html`<div class="fgroup" role="group" aria-label="커버"><span class="flabel">커버</span>${restCover.map(songChip)}</div>` : ''}
        <p class="hint songq-none" hidden>접힌 곡 중에는 없어요</p>
      </div>` : ''}
      <div class="fgroup" role="group" aria-label="멤버"><span class="flabel">멤버</span>
        ${g._members.map((m) => chip('members', m.id, m.active === false ? `${m.name}(종료)` : m.name, html`<span class="dot" style="${`background:${m._color}`}"></span>`))}
        ${chip('members', GROUP_KEY, '단체', html`<span class="dot ring"></span>`)}
      </div>
      <div class="fgroup" role="group" aria-label="종류"><span class="flabel">종류</span>${chip('types', 'full', '풀캠')}${chip('types', 'fancam', '직캠')}</div>
      ${tags.length ? html`<div class="fgroup" role="group" aria-label="태그"><span class="flabel">태그</span>${tags.map((t) => chip('tags', t, t))}</div>` : ''}
      ${n ? html`<div class="fgroup"><span class="flabel"></span><button type="button" class="btn btn-sm" data-act="clearFilters">필터 모두 해제 (${n})</button></div>` : ''}
    </div>
  </details>`;
}

// ---------- 오버레이 ----------
function renderOverlay(s) {
  const key = s.play ? `p:${s.play}:${s.ps || ''}:${s.pt || ''}` : s.clip ? `c:${s.clip}` : null;
  if (key === overlayKey) return;
  const wasOpen = !!overlayKey;
  overlayKey = key;
  if (!key) {
    overlayRoot.innerHTML = '';
    document.body.classList.remove('overlay-open');
    document.body.style.overflow = '';
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
    return;
  }
  if (!wasOpen) {
    overlayFromBase = !!lastOverlayBaseMatch();
    if (!returnFocus) returnFocus = document.activeElement !== document.body ? document.activeElement : null;
  }
  document.body.classList.add('overlay-open');
  document.body.style.overflow = 'hidden';
  if (s.play) openPlayer(overlayRoot, s, closeOverlay);
  else openClipDetail(overlayRoot, s, closeOverlay);
}

let navCount = 0;
let baseAtNav = null;
function lastOverlayBaseMatch() {
  return navCount > 0 && baseAtNav === toHash(baseOf(app.state));
}

export function closeOverlay() {
  if (overlayFromBase) { overlayFromBase = false; history.back(); return; }
  go(baseOf(app.state), { replace: true });
}

// ---------- 이벤트 ----------
function bindGlobal() {
  // 썸네일 실패 → 실루엣
  // 썸네일 실패 → 다음 주소(data-fb) → 실루엣(data-ph)
  const fallback = (t) => {
    if (t.dataset.fb && t.getAttribute('src') !== t.dataset.fb) { const fb = t.dataset.fb; t.dataset.fb = ''; t.src = fb; return; }
    if (t.dataset.ph && t.getAttribute('src') !== t.dataset.ph) t.src = t.dataset.ph;
  };
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.dataset.ph) fallback(t);
  }, true);
  // 유튜브는 hq720이 없으면 오류 대신 120px 회색 그림을 준다
  document.addEventListener('load', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.dataset.fb && t.naturalWidth > 0 && t.naturalWidth <= 120) fallback(t);
  }, true);

  // 해시 링크를 누를 때 기억: 오버레이를 연 배경
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const next = parseHash(a.getAttribute('href'));
    const inOverlay = overlayRoot.contains(a);
    if (inOverlay && (next.play || next.clip)) {
      // 오버레이 안 이동은 기록을 쌓지 않는다
      e.preventDefault();
      go(next, { replace: true });
      return;
    }
    if (!inOverlay && (next.play || next.clip)) {
      navCount++;
      baseAtNav = toHash(baseOf(app.state));
      returnFocus = a;
    }
    if (app.query && !next.play && !next.clip) clearQuery(false);
  });

  main.addEventListener('click', onAction);
  // 곡 찾기: 다시 그리지 않고 칩만 숨긴다
  main.addEventListener('input', (e) => {
    const q = e.target.closest('[data-act="songq"]');
    if (!q) return;
    const box = q.closest('.songmore');
    const t = norm(q.value);
    let any = false;
    for (const c of box.querySelectorAll('.chip[data-name]')) { const hit = !t || c.dataset.name.includes(t); c.hidden = !hit; any ||= hit; }
    for (const grp of box.querySelectorAll('.fgroup')) grp.hidden = ![...grp.querySelectorAll('.chip[data-name]')].some((c) => !c.hidden);
    box.querySelector('.songq-none').hidden = any;
  });
  main.addEventListener('lu:more', () => attachClipPlayback(main));
  main.addEventListener('change', onAction);

  // 검색: 한글 조합 중에는 검색하지 않는다
  let composing = false;
  const run = debounce(() => {
    if (composing) return;
    if (app.query !== qInput.value) app.searchLimit = 0;
    app.query = qInput.value;
    lastBaseKey = null;
    render();
  }, 90);
  qInput.addEventListener('compositionstart', () => { composing = true; });
  qInput.addEventListener('compositionend', () => { composing = false; run(); });
  qInput.addEventListener('input', (e) => { if (!e.isComposing && !composing) run(); });
  qInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.isComposing) { e.preventDefault(); clearQuery(true); }
  });
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (app.query !== qInput.value) app.searchLimit = 0;
    app.query = qInput.value; lastBaseKey = null; render();
    main.querySelector('.scard a, .state a')?.focus();
  });
  document.getElementById('brand').addEventListener('click', () => { if (app.query) clearQuery(false); });

  document.addEventListener('keydown', (e) => {
    if (overlayKey) {
      if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); return; }
      // 이어보기: N 다음 곡, P 이전 곡
      if (overlayKey.startsWith('p:') && ['n', 'p', 'N', 'P'].includes(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        playerNav(e.key.toLowerCase() === 'n' ? 'qnext' : 'qprev');
        return;
      }
      if (overlayKey.startsWith('p:') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        playerNav(e.key.replace('Arrow', '').toLowerCase());
      }
      if (e.key === 'Tab') trapFocus(e);
      return;
    }
    if (e.key === '/' && document.activeElement === document.body) { e.preventDefault(); qInput.focus(); }
  });
}

function trapFocus(e) {
  const box = overlayRoot.querySelector('.ov-box');
  if (!box) return;
  const f = [...box.querySelectorAll('a[href], button:not([disabled]), iframe, video[controls], [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function clearQuery(focus) {
  qInput.value = '';
  if (!app.query) return;
  app.query = '';
  lastBaseKey = null;
  render();
  if (focus) qInput.focus();
}

function onAction(e) {
  const el = e.target.closest('[data-act]');
  if (!el || !main.contains(el)) return;
  const act = el.dataset.act;
  const isChange = e.type === 'change';
  if ((el.type === 'checkbox') !== isChange) return;
  const g = currentGroup();
  if (act === 'reload') { location.reload(); return; }
  if (act === 'searchMore') {
    const n = main.querySelectorAll('.scard').length;
    app.searchLimit = n + PAGE;
    rerenderKeepFocus(null);
    main.querySelectorAll('.scard')[n]?.querySelector('a')?.focus({ preventScroll: true });
    return;
  }
  if (!g) return;
  switch (act) {
    case 'rowsong': {
      const s = el.dataset.s === 'none' ? '' : el.dataset.s;
      setRowSong(main, el.dataset.e, s);
      attachClipPlayback(main);
      break;
    }
    case 'expand': {
      const eid = el.dataset.e;
      const next = app.state.open === eid ? undefined : eid;
      go({ ...baseOf(app.state), open: next }, { replace: true });
      const btn = main.querySelector(`[data-row="${CSS.escape(eid)}"] [data-act="expand"]`);
      if (btn) btn.focus({ preventScroll: true });
      attachClipPlayback(main);
      break;
    }
    case 'filter': {
      const f = filtersOf(g.id);
      const set = f[el.dataset.k];
      const v = el.dataset.v;
      if (set.has(v)) set.delete(v); else set.add(v);
      saveFilters();
      rerenderKeepFocus(el);
      break;
    }
    case 'moreSongs':
      app.songsOpen = !app.songsOpen;
      rerenderKeepFocus(el);
      if (app.songsOpen) main.querySelector('.songq')?.focus({ preventScroll: true });
      break;
    case 'clearFilters': {
      const f = filtersOf(g.id);
      f.songs.clear(); f.members.clear(); f.types.clear(); f.tags.clear();
      saveFilters();
      rerenderKeepFocus(null);
      document.getElementById('filters')?.querySelector('summary')?.focus();
      break;
    }
    case 'sort':
      app.prefs.sort = el.dataset.v; savePrefs(); rerenderKeepFocus(el);
      break;
    case 'car':
      scrollCarousel(el);
      break;
    case 'songSort':
      app.prefs.songSort = el.dataset.v; savePrefs(); rerenderKeepFocus(el);
      break;
    case 'showEmpty':
      app.prefs.showEmpty = el.checked; savePrefs(); rerenderKeepFocus(el);
      break;
    case 'bySong':
      app.prefs.bySong = el.checked; savePrefs(); rerenderKeepFocus(el);
      break;
    case 'cell':
      toggleFolderCell(main, el);
      attachClipPlayback(main);
      break;
    case 'jump': {
      const t = document.getElementById(`sec-${el.dataset.s}`);
      if (t) { t.scrollIntoView({ behavior: app.reduced ? 'auto' : 'smooth' }); t.querySelector('h2')?.focus({ preventScroll: true }); }
      break;
    }
    default:
  }
}

function rerenderKeepFocus(el) {
  const sel = el ? selectorFor(el) : null;
  const filtersOpen = document.getElementById('filters')?.open;
  const y = scrollY;
  lastBaseKey = null;
  render();
  const fd = document.getElementById('filters');
  if (fd && filtersOpen != null) fd.open = filtersOpen;
  scrollTo(0, y);
  if (sel) main.querySelector(sel)?.focus({ preventScroll: true });
}
function selectorFor(el) {
  const d = el.dataset;
  let s = `[data-act="${d.act}"]`;
  for (const k of ['k', 'v', 'e', 's']) if (d[k] != null) s += `[data-${k}="${CSS.escape(d[k])}"]`;
  return s;
}

start();
