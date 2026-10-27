// 썸네일: 왼쪽은 실제 썸네일이 보이는 목록(그룹·종류·검색), 오른쪽은 붙어 있는 편집기.
// 편집기: 후보(지금 쓰는 유튜브 기본·큰 기본·자동 장면·움짤·업로드) → 틀 끌기 → 편안·조밀 미리 보기 → 정하기(·다음)
//   직캠: 2:3 틀의 가로 위치(thumbPos "x% 35%"). 조밀 모드 1:2.2 띠는 같은 값에서 계산(model.js stripPosFrom)
//   풀캠: 3:1 띠의 세로 위치(thumbPos "50% y%"). 편안 모드 16:9에서는 잘리지 않는다
//   유튜브 기본 그대로면 위치만 저장, 다른 유튜브 그림은 주소+위치, 업로드·움짤은 파일(thumbs/<id>.jpg)로
import { html, norm } from '../util.js';
import { isSampleYt, stripPosFrom, isYtThumb, DEFAULT_THUMB_POS } from '../model.js';
import {
  store, commit, videoById, memberById, eventById, songById, groupById, putFile, fileURL, eventLabel, membersOf,
} from './store.js';
import { paint, toast } from './ui.js';

const PAGE = 48;
const st = {
  target: null, cand: null, pos: null, upload: null, prefillKey: null,
  g: '', kind: 'fancam', q: '', onlyChanged: false, limit: PAGE,
};
let host = null;

const SIZE = { fancam: [400, 600], full: [640, 360] };
const BAND_DEF = '50% 40%';
const ytImg = (ytId, k) => `https://i.ytimg.com/vi/${ytId}/${k}.jpg`;
const isWide = (k) => /^(hqdefault|hq[123])$/.test(k); // 4:3 그림(16:9 영상이면 위아래 검은 띠) → 가운데 16:9만 쓴다

// ---------- 대상 ----------
const whoOf = (v) => (v.type === 'full' ? '풀캠' : v.memberIds.length ? v.memberIds.map((m) => memberById(m)?.name).join('·') : '단체');
const songsOfV = (v) => v.songs.map((s) => songById(s.songId)?.title).filter(Boolean).join(' + ') || '전체 공연';

function targetInfo() {
  if (!st.target) return null;
  const [kind, id] = st.target.split(':');
  if (kind === 'video') {
    const v = videoById(id);
    if (!v) return null;
    const e = eventById(v.eventId);
    const full = v.type === 'full';
    return {
      kind, id, obj: v, full, shape: full ? 'band' : '23', ratio: full ? 3 : 2 / 3, size: SIZE[full ? 'full' : 'fancam'],
      title: `${e ? eventLabel(e) : ''}`, sub: `${songsOfV(v)} · ${whoOf(v)}`, defPos: full ? BAND_DEF : DEFAULT_THUMB_POS,
      view: e ? `index.html#g=${e.groupId}&e=${e.id}&play=${v.id}` : 'index.html',
    };
  }
  const m = memberById(id);
  if (!m) return null;
  const g = store.data.groups.find((x) => x.members.includes(m));
  return { kind, id, obj: m, full: false, shape: '23', ratio: 2 / 3, size: SIZE.fancam, title: `${g?.name || ''} ${m.name}`, sub: '멤버 보기 타일', defPos: DEFAULT_THUMB_POS, view: g ? `index.html#g=${g.id}&v=member&m=${m.id}` : 'index.html' };
}

// 목록·미리 보기에 쓰는 지금 그림
function currentSrc(o, full) {
  if (o.thumb) return fileURL(o.thumb);
  if (o.ytId && !isSampleYt(o.ytId)) return ytImg(o.ytId, full ? 'mqdefault' : 'hq720');
  return '';
}

function candidates(t) {
  const out = [];
  const o = t.obj;
  if (t.kind === 'video') {
    const v = o;
    if (v.thumb) out.push({ key: 'current', src: fileURL(v.thumb), label: '지금 지정한 그림', yt: isYtThumb(v.thumb) });
    if (v.ytId && !isSampleYt(v.ytId)) {
      out.push({ key: 'default', src: ytImg(v.ytId, 'hq720'), fb: ytImg(v.ytId, 'hqdefault'), label: '유튜브 기본', yt: true });
      for (const [k, l] of [['maxresdefault', '큰 기본'], ['hq1', '자동 장면 1'], ['hq2', '자동 장면 2'], ['hq3', '자동 장면 3']]) {
        out.push({ key: k, src: ytImg(v.ytId, k), label: l, yt: true, wide: isWide(k) });
      }
    }
    for (const c of store.data.clips.filter((x) => x.videoId === v.id)) out.push({ key: `clip:${c.id}`, src: fileURL(c.poster || c.file), label: `움짤 ${c.note || c.id}` });
  } else {
    const m = o;
    if (m.thumb) out.push({ key: 'current', src: fileURL(m.thumb), label: '지금 지정한 그림', yt: isYtThumb(m.thumb) });
    const cams = store.data.videos.filter((v) => v.memberIds.length === 1 && v.memberIds[0] === m.id && !isSampleYt(v.ytId))
      .sort((a, b) => (eventById(b.eventId)?.date || '').localeCompare(eventById(a.eventId)?.date || '')).slice(0, 6);
    for (const v of cams) out.push({ key: `yt:${v.id}`, src: ytImg(v.ytId, 'hq720'), fb: ytImg(v.ytId, 'hqdefault'), label: `${eventById(v.eventId)?.date.slice(5).replace('-', '.')} 직캠`, yt: true, pos: v.thumbPos });
  }
  if (st.upload) out.push({ key: 'upload', src: st.upload.url, label: `업로드 · ${st.upload.name}` });
  return out;
}

function parsePos(s, def) {
  const m = /^\s*([\d.]+)%\s+([\d.]+)%\s*$/.exec(s || def);
  return m ? { x: +m[1], y: +m[2] } : { x: 50, y: 35 };
}
const posStr = (p) => `${Math.round(p.x)}% ${Math.round(p.y)}%`;

// ---------- 목록 ----------
function rows() {
  const toks = norm(st.q).split(' ').filter(Boolean);
  if (st.kind === 'member') {
    return store.data.groups.filter((g) => !st.g || g.id === st.g).flatMap((g) => membersOf(g).map((m) => ({ key: `member:${m.id}`, m, g, text: `${g.name} ${m.name} ${(m.aliases || []).join(' ')}` })))
      .filter((x) => (!st.onlyChanged || x.m.thumb) && toks.every((k) => norm(x.text).includes(k)));
  }
  const evs = new Map(store.data.events.map((e) => [e.id, e]));
  return store.data.videos.filter((v) => v.type === st.kind && !v.gone)
    .map((v) => ({ v, e: evs.get(v.eventId) }))
    .filter(({ v, e }) => e && (!st.g || e.groupId === st.g) && (!st.onlyChanged || v.thumb))
    .map((x) => ({ ...x, key: `video:${x.v.id}`, text: `${eventLabel(x.e)} ${x.e.date.replaceAll('-', '')} ${songsOfV(x.v)} ${whoOf(x.v)} ${x.v.title || ''} ${x.v.channel || ''} ${x.v.id}` }))
    .filter((x) => toks.every((k) => norm(x.text).includes(k)))
    .sort((a, b) => (a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : 0));
}

function cardHTML(x) {
  const on = st.target === x.key;
  if (x.m) {
    const src = x.m.thumb ? fileURL(x.m.thumb) : '';
    return html`<button type="button" class="tb-card fancam" data-target="${x.key}" aria-pressed="${String(on)}">
      <span class="tb-img r23">${src ? html`<img src="${src}" alt="" loading="lazy" style="${`object-position:${x.m.thumbPos || DEFAULT_THUMB_POS}`}">` : html`<span class="tb-none">${x.m.name}</span>`}</span>
      <span class="tb-cap"><b>${x.m.name}</b><span>${x.g.name}${x.m.thumb ? ' · 지정됨' : ''}</span></span></button>`;
  }
  const { v, e } = x;
  const full = v.type === 'full';
  const src = currentSrc(v, full);
  // 위치(thumbPos)는 얼굴 인식이 자동으로 넣은 것도 많아서, 그림을 바꾼 영상만 표시한다
  const changed = !!v.thumb;
  return html`<button type="button" class="${`tb-card ${full ? 'full' : 'fancam'}`}" data-target="${x.key}" aria-pressed="${String(on)}">
    <span class="${`tb-img ${full ? 'r169' : 'r23'}`}">${src ? html`<img src="${src}" alt="" loading="lazy" referrerpolicy="no-referrer" style="${full ? '' : `object-position:${v.thumbPos || DEFAULT_THUMB_POS}`}">` : ''}${changed ? html`<span class="tb-flag" title="유튜브 기본이 아닌 그림">그림 바꿈</span>` : ''}</span>
    <span class="tb-cap"><b>${whoOf(v)}</b><span class="num">${e.date.slice(2).replaceAll('-', '.')}</span><span>${e.show}</span></span></button>`;
}

function listHTML() {
  const all = rows();
  const shown = all.slice(0, st.limit);
  return html`<div id="tb-list">
    <p class="hint tb-count">${all.length}개${all.length > shown.length ? ` · ${shown.length}개 보이는 중` : ''}</p>
    ${all.length ? html`<div class="${`tb-grid ${st.kind === 'full' ? 'full' : 'fancam'}`}">${shown.map(cardHTML)}</div>` : html`<p class="hint">맞는 ${st.kind === 'member' ? '멤버' : '영상'}가 없어요.</p>`}
    ${all.length > shown.length ? html`<button type="button" class="btn tb-more" data-act="more">${Math.min(PAGE, all.length - shown.length)}개 더 보기</button>` : ''}
  </div>`;
}

function filtersHTML() {
  return html`<div class="tb-filters">
    <label class="sr" for="tb-g">그룹</label>
    <select class="input" id="tb-g"><option value="">모든 그룹</option>${store.data.groups.map((g) => html`<option value="${g.id}" ${st.g === g.id ? html`selected` : ''}>${g.name}</option>`)}</select>
    <div class="seg" role="group" aria-label="종류">${[['fancam', '직캠'], ['full', '풀캠'], ['member', '멤버']].map(([k, t]) => html`<button type="button" data-kind="${k}" aria-pressed="${String(st.kind === k)}">${t}</button>`)}</div>
    <label class="sr" for="tb-q">찾기</label>
    <input class="input" id="tb-q" type="search" value="${st.q}" placeholder="${st.kind === 'member' ? '멤버 이름' : '날짜·행사·멤버·곡·채널 (예: 1024 안유진)'}" autocomplete="off">
    <label class="check"><input type="checkbox" id="tb-changed" ${st.onlyChanged ? html`checked` : ''}>그림 바꾼 것만</label>
  </div>`;
}

// ---------- 편집기 ----------
function previewsHTML(t, src) {
  const p = posStr(st.pos);
  if (t.full) {
    return html`<div class="tb-prevs full">
      <figure><div class="tb-prev r169"><img id="tb-p0" src="${src}" alt="" referrerpolicy="no-referrer"></div><figcaption>편안 16:9</figcaption></figure>
      <figure><div class="tb-prev rband"><img id="tb-p1" src="${src}" alt="" referrerpolicy="no-referrer" style="${`object-position:${p}`}"></div><figcaption>조밀 3:1</figcaption></figure></div>`;
  }
  return html`<div class="tb-prevs fancam">
    <figure><div class="tb-prev r23"><img id="tb-p0" src="${src}" alt="" referrerpolicy="no-referrer" style="${`object-position:${p}`}"></div><figcaption>편안 2:3</figcaption></figure>
    ${t.kind === 'video' ? html`<figure><div class="tb-prev rstrip"><img id="tb-p1" src="${src}" alt="" referrerpolicy="no-referrer" style="${`object-position:${stripPosFrom(p)}`}"></div><figcaption>조밀 1:2.2</figcaption></figure>` : ''}</div>`;
}

function editorHTML(t) {
  if (!t) {
    return html`<div class="tb-empty"><h2>썸네일을 고르세요</h2><p class="desc">왼쪽 목록에서 바꿀 영상이나 멤버를 누르면 여기서 위치를 옮기거나 다른 그림으로 바꿀 수 있어요. 보기 화면 플레이어의 “썸네일 바꾸기”로 바로 올 수도 있어요.</p></div>`;
  }
  const cands = candidates(t);
  const cur = cands.find((c) => c.key === st.cand);
  const order = rows().map((x) => x.key);
  const i = order.indexOf(st.target);
  return html`<div class="tb-head">
      <div class="tb-title"><h2 id="tb-h" tabindex="-1">${t.title}</h2><p class="desc">${t.sub}</p></div>
      <div class="tb-nav">
        <button type="button" class="btn btn-sm" data-act="prev" ${i > 0 ? '' : html`disabled`} aria-label="이전 영상">‹ 이전</button>
        <button type="button" class="btn btn-sm" data-act="next" ${i >= 0 && i < order.length - 1 ? '' : html`disabled`} aria-label="다음 영상">다음 ›</button>
      </div>
    </div>
    <div class="tb-cands" role="group" aria-label="그림 후보">${cands.map((c) => html`<button type="button" class="tb-cand" data-cand="${c.key}" aria-pressed="${String(st.cand === c.key)}"><span class="ci"><img src="${c.src}" alt="" loading="lazy" referrerpolicy="no-referrer"></span><span class="cl">${c.label}</span></button>`)}
      <label class="tb-cand up"><input type="file" accept="image/*" id="tb-upload" class="sr"><span class="ci">＋</span><span class="cl">직접 올리기</span></label>
    </div>
    ${cur ? html`<div class="tb-stage-wrap">
        <div class="tb-stage" id="tb-stage" style="${cur.wide || cur.yt ? 'aspect-ratio:16/9' : ''}"><img id="tb-img" src="${cur.src}" ${cur.fb ? html`data-fb="${cur.fb}"` : ''} alt="자르기 원본" referrerpolicy="no-referrer"><div class="crop-frame" id="tb-frame" tabindex="0" role="slider" aria-label="${t.full ? '띠 세로 위치 (위·아래 화살표)' : '틀 가로 위치 (왼쪽·오른쪽 화살표)'}" aria-valuemin="0" aria-valuemax="100"></div></div>
        <p class="hint">${t.full ? '3:1 틀을 위아래로 끌어 얼굴이 띠 안에 들어오게 하세요.' : '2:3 틀을 좌우로 끌어 얼굴을 가운데에 두세요.'} 화살표 키로 2%, Shift와 함께 10%씩 옮겨요. <span class="num" id="tb-posv">${posStr(st.pos)}</span></p>
      </div>
      ${previewsHTML(t, cur.src)}` : html`<p class="hint">이 영상은 고를 그림 후보가 없어요. 직접 올리기를 쓰세요.</p>`}
    <div class="tb-actions">
      <button type="button" class="btn btn-fill" data-act="applyNext" ${cur && i < order.length - 1 ? '' : html`disabled`}>정하고 다음</button>
      <button type="button" class="btn" data-act="apply" ${cur ? '' : html`disabled`}>정하기</button>
      <button type="button" class="btn btn-sm" data-act="reset" ${t.obj.thumb || t.obj.thumbPos ? '' : html`disabled`}>유튜브 기본으로</button>
      <span class="spacer"></span>
      <a class="textlink" href="${t.view}" target="_blank" rel="noopener">보기 화면에서 열기 ↗</a>
      ${t.kind === 'video' ? html`<a class="textlink" href="${`#tab=edit&v=${t.id}`}">영상 정보 수정</a>` : ''}
    </div>
    <p class="hint tb-savehint" id="tb-savehint">${saveHint()}</p>`;
}
const saveHint = () => (store.changes ? html`저장하지 않은 변경 <b class="num">${store.changes}</b>개 · <a href="#tab=save">저장하러 가기 →</a>` : '바꾼 내용은 위쪽 저장 버튼으로 한 번에 올려요.');

function paintAll() {
  paint(host, html`<div class="tb">
    <section class="card tb-side" aria-labelledby="tb-lh"><h2 id="tb-lh" class="sr">썸네일 목록</h2>${filtersHTML()}${listHTML()}</section>
    <section class="card tb-editor" id="tb-editor" aria-label="썸네일 편집">${editorHTML(targetInfo())}</section>
  </div>`);
  mountCropper();
}
function paintList() {
  host.querySelector('#tb-list').outerHTML = String(listHTML());
}
function paintEditor(focus) {
  host.querySelector('#tb-editor').innerHTML = String(editorHTML(targetInfo()));
  mountCropper();
  if (focus) host.querySelector(focus)?.focus({ preventScroll: true });
}

// ---------- 자르기 틀 ----------
function mountCropper() {
  const stage = host.querySelector('#tb-stage');
  const img = host.querySelector('#tb-img');
  const frame = host.querySelector('#tb-frame');
  const t = targetInfo();
  if (!stage || !img || !frame || !t) return;
  let geo = null;
  const layout = () => {
    // 유튜브 그림은 16:9 상자에 cover로 채운다(4:3 그림의 검은 띠를 뺀 가운데). 업로드는 원래 비율
    if (!stage.style.aspectRatio && img.naturalWidth) stage.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    const r = W / H;
    let fw, fh, axis;
    if (r > t.ratio) { fh = H; fw = H * t.ratio; axis = 'x'; } else { fw = W; fh = W / t.ratio; axis = 'y'; }
    geo = { W, H, fw, fh, axis };
    place();
  };
  const place = () => {
    if (!geo) return;
    const p = (geo.axis === 'x' ? st.pos.x : st.pos.y) / 100;
    Object.assign(frame.style, { left: `${geo.axis === 'x' ? p * (geo.W - geo.fw) : 0}px`, top: `${geo.axis === 'y' ? p * (geo.H - geo.fh) : 0}px`, width: `${geo.fw}px`, height: `${geo.fh}px` });
    frame.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    const s = posStr(st.pos);
    const p0 = host.querySelector('#tb-p0'), p1 = host.querySelector('#tb-p1');
    if (t.full) { if (p1) p1.style.objectPosition = s; } else {
      if (p0) p0.style.objectPosition = s;
      if (p1) p1.style.objectPosition = stripPosFrom(s);
    }
    const pv = host.querySelector('#tb-posv');
    if (pv) pv.textContent = s;
  };
  const setP = (v) => {
    if (!geo) return;
    v = Math.max(0, Math.min(100, v));
    if (geo.axis === 'x') st.pos.x = v; else st.pos.y = v;
    place();
  };
  if (img.complete && img.naturalWidth) layout(); else img.addEventListener('load', layout, { once: true });
  img.addEventListener('error', () => {
    if (img.dataset.fb && img.getAttribute('src') !== img.dataset.fb) { img.src = img.dataset.fb; return; }
    toast('이 그림을 불러오지 못했어요. 다른 후보를 고르세요.');
  });
  new ResizeObserver(layout).observe(stage);
  // 틀 밖을 눌러도 그 자리로 옮긴다
  stage.addEventListener('pointerdown', (e) => {
    if (e.target === frame || !geo) return;
    const rc = stage.getBoundingClientRect();
    if (geo.axis === 'x') setP(((e.clientX - rc.left - geo.fw / 2) / (geo.W - geo.fw)) * 100);
    else setP(((e.clientY - rc.top - geo.fh / 2) / (geo.H - geo.fh)) * 100);
  });
  let drag = null;
  frame.addEventListener('pointerdown', (e) => {
    frame.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, p: geo.axis === 'x' ? st.pos.x : st.pos.y };
  });
  frame.addEventListener('pointermove', (e) => {
    if (!drag || !geo) return;
    const free = geo.axis === 'x' ? geo.W - geo.fw : geo.H - geo.fh;
    if (free <= 0) return;
    setP(drag.p + (((geo.axis === 'x' ? e.clientX - drag.x : e.clientY - drag.y) / free) * 100));
  });
  frame.addEventListener('pointerup', () => { drag = null; });
  frame.addEventListener('keydown', (e) => {
    if (!geo) return;
    const step = e.shiftKey ? 10 : 2;
    const cur = geo.axis === 'x' ? st.pos.x : st.pos.y;
    const map = { ArrowLeft: -step, ArrowUp: -step, ArrowRight: step, ArrowDown: step };
    if (e.key in map) { e.preventDefault(); setP(cur + map[e.key]); }
    if (e.key === 'Home') { e.preventDefault(); setP(0); }
    if (e.key === 'End') { e.preventDefault(); setP(100); }
  });
}

// ---------- 정하기 ----------
function loadImage(src, cors) {
  return new Promise((res, rej) => {
    const im = new Image();
    if (cors) im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('load'));
    im.src = src;
  });
}

// 그림 파일로 굽기: 유튜브 4:3 그림은 가운데 16:9만, 직캠은 2:3 틀, 풀캠은 16:9 전체
async function bake(t, c) {
  const im = await loadImage(c.src, c.yt);
  let sx = 0, sy = 0, sw = im.naturalWidth, sh = im.naturalHeight;
  if (c.wide || (c.yt && sw / sh < 1.7)) { const h = sw * 9 / 16; sy = (sh - h) / 2; sh = h; }
  const target = t.full ? 16 / 9 : t.ratio;
  const r = sw / sh;
  if (r > target) { const w = sh * target; sx += (sw - w) * (t.full ? 0.5 : st.pos.x / 100); sw = w; } else if (r < target) { const h = sw / target; sy += (sh - h) * (t.full ? 0.5 : st.pos.y / 100); sh = h; }
  const [ow, oh] = t.size;
  const cv = document.createElement('canvas');
  cv.width = ow; cv.height = oh;
  cv.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, ow, oh);
  return new Promise((res, rej) => { try { cv.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.85); } catch (e) { rej(e); } });
}

async function apply() {
  const t = targetInfo();
  const c = candidates(t).find((x) => x.key === st.cand);
  if (!c) return false;
  const o = t.obj;
  const pos = posStr(t.full ? { x: 50, y: st.pos.y } : st.pos);
  if (c.key === 'default') {
    delete o.thumb; o.thumbPos = pos;
    toast('위치를 바꿨어요.');
  } else if (c.key === 'current') {
    o.thumbPos = pos;
    toast('위치를 바꿨어요.');
  } else if (c.yt && !c.wide) {
    // 16:9 유튜브 그림: 파일을 만들지 않고 주소와 위치만(원본 비율이 남아 조밀 모드에서도 다시 잘린다)
    o.thumb = c.src; o.thumbPos = pos;
    toast(`${c.label}(으)로 바꿨어요.`);
  } else {
    let blob = null;
    try { blob = await bake(t, c); } catch { blob = null; }
    if (blob) {
      const path = `thumbs/${t.id}.jpg`;
      await putFile(path, blob);
      o.thumb = path;
      if (t.full) o.thumbPos = pos; else delete o.thumbPos;
      toast(`${c.label}(으)로 바꿨어요. 저장할 때 ${path} 파일도 함께 올려요.`);
    } else if (c.yt) {
      o.thumb = c.src; o.thumbPos = pos;
      toast('그림 파일을 만들 수 없어 주소와 위치만 저장했어요. 위아래 검은 띠가 보일 수 있어요.');
    } else {
      toast('그림을 그리지 못했어요. 다른 후보를 고르세요.');
      return false;
    }
  }
  commit();
  return true;
}

function reset() {
  const t = targetInfo();
  delete t.obj.thumb;
  delete t.obj.thumbPos;
  commit();
  selectTarget(st.target);
  toast('유튜브 기본 썸네일로 되돌렸어요.');
}

function selectTarget(target) {
  if (st.target !== target && st.upload) { URL.revokeObjectURL(st.upload.url); st.upload = null; }
  st.target = target;
  const t = targetInfo();
  if (!t) { st.cand = null; return; }
  st.pos = parsePos(t.obj.thumbPos, t.defPos);
  const c = candidates(t);
  st.cand = (c.find((x) => x.key === 'current') || c.find((x) => x.key === 'default') || c[0])?.key || null;
}

function go(delta) {
  const order = rows().map((x) => x.key);
  const i = order.indexOf(st.target);
  const next = order[i + delta];
  if (!next) return;
  if (order.indexOf(next) >= st.limit) st.limit = order.indexOf(next) + 1;
  selectTarget(next);
  paintList();
  paintEditor('#tb-frame');
  host.querySelector(`[data-target="${CSS.escape(next)}"]`)?.scrollIntoView({ block: 'nearest' });
}

function bind() {
  host.addEventListener('input', (e) => {
    if (e.target.id === 'tb-q') { st.q = e.target.value; st.limit = PAGE; paintList(); }
  });
  host.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'tb-g') { st.g = t.value; st.limit = PAGE; paintList(); }
    if (t.id === 'tb-changed') { st.onlyChanged = t.checked; st.limit = PAGE; paintList(); }
    if (t.id === 'tb-upload' && t.files[0]) {
      const f = t.files[0];
      if (st.upload) URL.revokeObjectURL(st.upload.url);
      st.upload = { name: f.name, url: URL.createObjectURL(f) };
      st.cand = 'upload';
      paintEditor('#tb-frame');
    }
  });
  host.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-kind]');
    if (k) { st.kind = k.dataset.kind; st.limit = PAGE; paintAll(); host.querySelector(`[data-kind="${st.kind}"]`)?.focus(); return; }
    const tg = e.target.closest('[data-target]');
    if (tg) {
      selectTarget(tg.dataset.target);
      host.querySelectorAll('[data-target]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.target === st.target)));
      paintEditor('#tb-h');
      if (matchMedia('(max-width: 959px)').matches) host.querySelector('#tb-editor')?.scrollIntoView({ block: 'start' });
      return;
    }
    const cd = e.target.closest('[data-cand]');
    if (cd) {
      st.cand = cd.dataset.cand;
      const c = candidates(targetInfo()).find((x) => x.key === st.cand);
      if (c && c.pos) st.pos = parsePos(c.pos, DEFAULT_THUMB_POS);
      paintEditor(`[data-cand="${CSS.escape(st.cand)}"]`);
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'more': st.limit += PAGE; paintList(); break;
      case 'prev': go(-1); break;
      case 'next': go(1); break;
      case 'apply': if (await apply()) { paintList(); paintEditor(); } break;
      case 'applyNext': if (await apply()) go(1); break;
      case 'reset': reset(); paintList(); paintEditor(); break;
      default:
    }
  });
  // 실패한 후보는 표시
  host.addEventListener('error', (e) => {
    const im = e.target;
    if (im.tagName === 'IMG' && im.closest('.tb-cand')) im.closest('.tb-cand').classList.add('fail');
  }, true);
}

export function renderThumbs(el, p) {
  host = el;
  const key = `${p.v || ''}|${p.m || ''}`;
  if (key !== st.prefillKey) {
    st.prefillKey = key;
    if (p.v && videoById(p.v)) {
      const v = videoById(p.v);
      st.kind = v.type; st.g = eventById(v.eventId)?.groupId || '';
      selectTarget(`video:${p.v}`);
      const i = rows().findIndex((x) => x.key === st.target);
      if (i >= st.limit) st.limit = i + 1;
    } else if (p.m && memberById(p.m)) {
      st.kind = 'member';
      selectTarget(`member:${p.m}`);
    } else if (p.g && groupById(p.g)) st.g = p.g;
  }
  paintAll();
  bind();
}

// 저장 버튼 옆 안내만 새로 그린다(다른 탭에서 바뀌어도 맞게)
export function refreshThumbSaveHint() {
  const el = host && host.isConnected && host.querySelector('#tb-savehint');
  if (el) el.innerHTML = String(saveHint());
}
