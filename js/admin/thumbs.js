// 썸네일 고르기: 후보(유튜브 기본·자동 장면·움짤 첫 프레임·업로드) → 칸 비율 자르기 틀 → 저장
import { html, norm } from '../util.js';
import { isSampleYt } from '../model.js';
import {
  store, commit, videoById, memberById, eventById, songById, putFile, fileURL, eventLabel,
} from './store.js';
import { paint, toast } from './ui.js';

const st = { target: null, cand: null, pos: null, q: '', upload: null, prefillKey: null };
let host = null;

const SIZE = { fancam: [400, 600], full: [640, 360] };

function targetInfo() {
  if (!st.target) return null;
  const [kind, id] = st.target.split(':');
  if (kind === 'video') {
    const v = videoById(id);
    if (!v) return null;
    const e = eventById(v.eventId);
    const who = v.type === 'full' ? '풀캠' : v.memberIds.length ? v.memberIds.map((m) => memberById(m)?.name).join('·') : '단체';
    return { kind, id, obj: v, ratio: v.type === 'full' ? 16 / 9 : 2 / 3, size: SIZE[v.type === 'full' ? 'full' : 'fancam'], label: `${eventLabel(e)} · ${v.songs.map((s) => songById(s.songId)?.title).join(' + ') || '전체 공연'} · ${who}`, defPos: v.type === 'full' ? '50% 50%' : '50% 35%' };
  }
  const m = memberById(id);
  return m ? { kind, id, obj: m, ratio: 2 / 3, size: SIZE.fancam, label: `멤버 ${m.name}`, defPos: '50% 35%' } : null;
}

function candidates(t) {
  const out = [];
  const yt = (ytId, label) => {
    if (!ytId || isSampleYt(ytId)) return;
    for (const [k, l] of [['maxresdefault', '유튜브 큰 기본'], ['hqdefault', '유튜브 기본'], ['hq1', '자동 장면 1'], ['hq2', '자동 장면 2'], ['hq3', '자동 장면 3']]) {
      out.push({ key: `${ytId}:${k}`, src: `https://i.ytimg.com/vi/${ytId}/${k}.jpg`, label: label ? `${label} · ${l}` : l, yt: true });
    }
  };
  if (t.kind === 'video') {
    const v = t.obj;
    if (v.thumb) out.push({ key: 'current', src: fileURL(v.thumb), label: '지금 썸네일', yt: /^https:\/\/i\.ytimg\.com\//.test(v.thumb) });
    yt(v.ytId);
    for (const c of store.data.clips.filter((x) => x.videoId === v.id)) out.push({ key: `clip:${c.id}`, src: fileURL(c.poster || c.file), label: `움짤 ${c.note || c.id} 첫 프레임` });
  } else {
    const m = t.obj;
    if (m.thumb) out.push({ key: 'current', src: fileURL(m.thumb), label: '지금 썸네일', yt: /^https:\/\/i\.ytimg\.com\//.test(m.thumb) });
    const cams = store.data.videos.filter((v) => v.memberIds.length === 1 && v.memberIds[0] === m.id)
      .sort((a, b) => (eventById(b.eventId)?.date || '').localeCompare(eventById(a.eventId)?.date || '')).slice(0, 3);
    for (const v of cams) {
      if (!isSampleYt(v.ytId)) out.push({ key: `${v.ytId}:hqdefault`, src: `https://i.ytimg.com/vi/${v.ytId}/hqdefault.jpg`, label: `${eventById(v.eventId)?.date} 직캠`, yt: true });
    }
    for (const c of store.data.clips.filter((x) => (x.memberIds || []).includes(m.id) || (x.videoId && videoById(x.videoId)?.memberIds.join() === m.id))) {
      out.push({ key: `clip:${c.id}`, src: fileURL(c.poster || c.file), label: `움짤 ${c.note || c.id}` });
    }
  }
  if (st.upload) out.push({ key: 'upload', src: st.upload.url, label: `업로드 · ${st.upload.name}` });
  return out;
}

function parsePos(s, def) {
  const m = /^\s*([\d.]+)%\s+([\d.]+)%\s*$/.exec(s || def);
  return m ? { x: +m[1], y: +m[2] } : { x: 50, y: 35 };
}
const posStr = (p) => `${Math.round(p.x)}% ${Math.round(p.y)}%`;

function pickerHTML() {
  const toks = norm(st.q).split(' ').filter(Boolean);
  const vids = store.data.videos.map((v) => {
    const e = eventById(v.eventId);
    const who = v.type === 'full' ? '풀캠' : v.memberIds.length ? v.memberIds.map((m) => memberById(m)?.name).join('·') : '단체';
    return { v, text: `${e ? eventLabel(e) : ''} · ${v.songs.map((s) => songById(s.songId)?.title).join(' + ') || '전체 공연'} · ${who}`, date: e?.date || '' };
  }).filter((x) => toks.every((k) => norm(`${x.text} ${x.v.title} ${x.v.id}`).includes(k)))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  return html`<section class="card" aria-labelledby="t-h0"><h2 id="t-h0">대상 고르기</h2>
    <p class="desc">영상이나 멤버를 고르세요. 직캠은 2:3, 풀캠은 16:9, 멤버는 2:3 틀로 잘라요.</p>
    <label class="sr" for="t-q">영상 찾기</label><input class="input" id="t-q" value="${st.q}" placeholder="날짜·행사·멤버·곡으로 영상 찾기" style="max-width:420px">
    <div class="list" style="margin-top:10px" id="t-vlist">${vids.map((x) => html`<button type="button" class="li" style="text-align:left;cursor:pointer" data-target="${`video:${x.v.id}`}" aria-pressed="${String(st.target === `video:${x.v.id}`)}"><span class="grow t1">${x.text}</span><span class="hint">${x.v.thumb ? '지정됨' : '기본'}</span></button>`)}</div>
    <h3>멤버</h3>
    <div class="kv">${store.data.groups.flatMap((g) => g.members.map((m) => html`<button type="button" class="chip" data-target="${`member:${m.id}`}" aria-pressed="${String(st.target === `member:${m.id}`)}"><span class="dot" style="${`background:${m.color || '#888'}`}"></span>${g.name} ${m.name}${m.thumb ? ' ✓' : ''}</button>`))}</div>
  </section>`;
}

function editorHTML(t) {
  const cands = candidates(t);
  const cur = cands.find((c) => c.key === st.cand);
  const ratioText = t.ratio > 1 ? '16:9' : '2:3';
  return html`<section class="card" aria-labelledby="t-h1"><h2 id="t-h1">${t.label}</h2>
    <p class="desc">후보를 고르고 ${ratioText} 틀을 끌어서(또는 화살표 키로) 위치를 정하세요.</p>
    <div class="cands" role="group" aria-label="후보">${cands.map((c) => html`<button type="button" class="cand" data-cand="${c.key}" aria-pressed="${String(st.cand === c.key)}"><img src="${c.src}" alt="" loading="lazy" ${c.yt ? html`referrerpolicy="no-referrer"` : ''}><span>${c.label}</span></button>`)}
      <label class="cand" style="place-items:center;text-align:center;min-height:90px;cursor:pointer"><input type="file" accept="image/*" id="t-upload" class="sr"><span>+ 직접 업로드</span></label>
    </div>
    ${!cands.length ? html`<p class="hint" style="margin-top:8px">샘플 영상은 유튜브 후보가 없어요. 움짤 첫 프레임이나 업로드를 쓰세요.</p>` : ''}
    ${cur ? html`<div class="cropper">
      <div class="crop-stage" id="t-stage"><img id="t-img" src="${cur.src}" alt="자르기 원본" ${cur.yt ? html`referrerpolicy="no-referrer"` : ''}><div class="crop-frame" id="t-frame" tabindex="0" role="slider" aria-label="자르기 위치 (화살표 키로 이동)" aria-valuemin="0" aria-valuemax="100"></div></div>
      <div><div class="crop-preview" style="${`aspect-ratio:${t.ratio > 1 ? '16/9' : '2/3'}`}"><img id="t-prev" src="${cur.src}" alt="미리 보기" style="${`object-position:${posStr(st.pos)}`}"></div>
        <p class="hint num" id="t-posv" style="margin-top:6px">위치 ${posStr(st.pos)}</p></div>
    </div>` : ''}
    <div class="row-actions">
      <button type="button" class="btn btn-fill" data-act="apply" ${cur ? '' : html`disabled`}>이 썸네일로 정하기</button>
      <button type="button" class="btn" data-act="reset" ${t.obj.thumb || t.obj.thumbPos ? '' : html`disabled`}>기본값으로 되돌리기</button>
      ${t.kind === 'video' ? html`<a class="btn btn-sm" href="${`#tab=edit&v=${t.id}`}">이 영상 수정</a>` : ''}
    </div>
    <p class="hint" style="margin-top:8px">업로드·움짤 이미지는 ${t.size[0]}×${t.size[1]} JPEG로 thumbs/${t.id}.jpg에 저장해요. 유튜브 이미지를 그릴 수 없으면 파일 없이 주소와 위치만 저장해요.</p>
  </section>`;
}

function paintAll() {
  const t = targetInfo();
  paint(host, html`<div style="display:grid;gap:16px">${pickerHTML()}<div id="t-editor">${t ? editorHTML(t) : ''}</div></div>`);
  mountCropper();
}
function paintEditor() {
  const t = targetInfo();
  host.querySelector('#t-editor').innerHTML = t ? String(editorHTML(t)) : '';
  mountCropper();
}

// ---------- 자르기 틀 ----------
let geo = null;
function mountCropper() {
  const img = host.querySelector('#t-img');
  const frame = host.querySelector('#t-frame');
  const t = targetInfo();
  if (!img || !frame || !t) return;
  const layout = () => {
    const W = img.clientWidth, H = img.clientHeight;
    if (!W || !H) return;
    const imgR = W / H;
    let fw, fh, axis;
    if (imgR > t.ratio) { fh = H; fw = H * t.ratio; axis = 'x'; } else { fw = W; fh = W / t.ratio; axis = 'y'; }
    geo = { W, H, fw, fh, axis };
    place();
  };
  const place = () => {
    if (!geo) return;
    const p = geo.axis === 'x' ? st.pos.x / 100 : st.pos.y / 100;
    const left = geo.axis === 'x' ? p * (geo.W - geo.fw) : 0;
    const top = geo.axis === 'y' ? p * (geo.H - geo.fh) : 0;
    Object.assign(frame.style, { left: `${left}px`, top: `${top}px`, width: `${geo.fw}px`, height: `${geo.fh}px` });
    frame.setAttribute('aria-valuenow', String(Math.round(geo.axis === 'x' ? st.pos.x : st.pos.y)));
    const prev = host.querySelector('#t-prev');
    if (prev) prev.style.objectPosition = posStr(st.pos);
    const pv = host.querySelector('#t-posv');
    if (pv) pv.textContent = `위치 ${posStr(st.pos)}`;
  };
  const setP = (v) => {
    v = Math.max(0, Math.min(100, v));
    if (geo.axis === 'x') st.pos.x = v; else st.pos.y = v;
    place();
  };
  if (img.complete && img.naturalWidth) layout(); else img.addEventListener('load', layout, { once: true });
  img.addEventListener('error', () => { toast('이미지를 불러오지 못했어요. 다른 후보를 고르세요.'); }, { once: true });
  new ResizeObserver(layout).observe(img);
  let drag = null;
  frame.addEventListener('pointerdown', (e) => {
    frame.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, p: geo.axis === 'x' ? st.pos.x : st.pos.y };
  });
  frame.addEventListener('pointermove', (e) => {
    if (!drag || !geo) return;
    const free = geo.axis === 'x' ? geo.W - geo.fw : geo.H - geo.fh;
    if (free <= 0) return;
    const d = geo.axis === 'x' ? e.clientX - drag.x : e.clientY - drag.y;
    setP(drag.p + (d / free) * 100);
  });
  frame.addEventListener('pointerup', () => { drag = null; });
  frame.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 2;
    const cur = geo.axis === 'x' ? st.pos.x : st.pos.y;
    const map = { ArrowLeft: -step, ArrowUp: -step, ArrowRight: step, ArrowDown: step };
    if (e.key in map) { e.preventDefault(); setP(cur + map[e.key]); }
    if (e.key === 'Home') { e.preventDefault(); setP(0); }
    if (e.key === 'End') { e.preventDefault(); setP(100); }
  });
}

// ---------- 저장 ----------
function loadImage(src, cors) {
  return new Promise((res, rej) => {
    const im = new Image();
    if (cors) im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('load'));
    im.src = src;
  });
}

async function apply() {
  const t = targetInfo();
  const c = candidates(t).find((x) => x.key === st.cand);
  if (!c) return;
  const [ow, oh] = t.size;
  let blob = null;
  try {
    const im = await loadImage(c.src, c.yt);
    const nr = im.naturalWidth / im.naturalHeight;
    let sx = 0, sy = 0, sw = im.naturalWidth, sh = im.naturalHeight;
    if (nr > t.ratio) { sw = sh * t.ratio; sx = (im.naturalWidth - sw) * (st.pos.x / 100); } else { sh = sw / t.ratio; sy = (im.naturalHeight - sh) * (st.pos.y / 100); }
    const cv = document.createElement('canvas');
    cv.width = ow; cv.height = oh;
    cv.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, ow, oh);
    blob = await new Promise((res, rej) => { try { cv.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.85); } catch (e) { rej(e); } });
  } catch {
    blob = null;
  }
  const o = t.obj;
  if (blob) {
    const path = `thumbs/${t.id}.jpg`;
    await putFile(path, blob);
    o.thumb = path;
    delete o.thumbPos;
    toast(`썸네일을 ${path}로 만들었어요. 저장할 때 함께 써요.`);
  } else if (c.yt || /^https:\/\/i\.ytimg\.com\//.test(c.src)) {
    o.thumb = c.src;
    o.thumbPos = posStr(st.pos);
    toast('유튜브 이미지는 파일로 만들 수 없어 주소와 위치만 저장했어요.');
  } else {
    toast('이미지를 그리지 못했어요. 다른 후보를 고르세요.');
    return;
  }
  commit();
  paintEditor();
}

function reset() {
  const t = targetInfo();
  delete t.obj.thumb;
  delete t.obj.thumbPos;
  st.pos = parsePos(null, t.defPos);
  commit();
  toast('기본 썸네일로 되돌렸어요.');
  paintEditor();
}

function selectTarget(target) {
  if (st.target !== target && st.upload) { URL.revokeObjectURL(st.upload.url); st.upload = null; }
  st.target = target;
  const t = targetInfo();
  st.pos = parsePos(t?.obj.thumbPos, t?.defPos);
  const c = t ? candidates(t) : [];
  st.cand = c[0]?.key || null;
}

function bind() {
  host.addEventListener('input', (e) => {
    if (e.target.id === 't-q') {
      st.q = e.target.value;
      const tmp = document.createElement('div');
      tmp.innerHTML = String(pickerHTML());
      host.querySelector('#t-vlist').replaceWith(tmp.querySelector('#t-vlist'));
    }
  });
  host.addEventListener('change', (e) => {
    if (e.target.id === 't-upload' && e.target.files[0]) {
      const f = e.target.files[0];
      if (st.upload) URL.revokeObjectURL(st.upload.url);
      st.upload = { name: f.name, url: URL.createObjectURL(f) };
      st.cand = 'upload';
      paintEditor();
    }
  });
  host.addEventListener('click', (e) => {
    const tg = e.target.closest('[data-target]');
    if (tg) { selectTarget(tg.dataset.target); paintAll(); host.querySelector('#t-h1')?.setAttribute('tabindex', '-1'); host.querySelector('#t-h1')?.focus(); return; }
    const cd = e.target.closest('[data-cand]');
    if (cd) { st.cand = cd.dataset.cand; paintEditor(); host.querySelector(`[data-cand="${CSS.escape(st.cand)}"]`)?.focus(); return; }
    const b = e.target.closest('[data-act]');
    if (b && b.dataset.act === 'apply') apply();
    if (b && b.dataset.act === 'reset') reset();
  });
  // 실패한 후보 표시
  host.addEventListener('error', (e) => {
    const im = e.target;
    if (im.tagName === 'IMG' && im.closest('.cand')) { im.closest('.cand').classList.add('fail'); im.closest('.cand').querySelector('span').textContent += ' (못 불러옴)'; }
  }, true);
}

export function renderThumbs(el, p) {
  host = el;
  const key = `${p.v || ''}|${p.m || ''}`;
  if (key !== st.prefillKey) {
    st.prefillKey = key;
    if (p.v && videoById(p.v)) selectTarget(`video:${p.v}`);
    else if (p.m && memberById(p.m)) selectTarget(`member:${p.m}`);
  }
  paintAll();
  bind();
}
