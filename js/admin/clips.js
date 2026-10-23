// 움짤 담기: 파일 여러 개를 끌어다 놓기 → 파일명 해석 → 영상에 연결하거나 공연·곡·멤버 직접 지정 → 포스터 추출 → 담기
import { html, fmtBytes, parseTime } from '../util.js';
import { GROUP_KEY, cellKey } from '../model.js';
import {
  store, commit, groupById, eventById, videoById, memberById, songById, eventsOf, eventLabel, newClipId, putFile,
} from './store.js';
import { parseFileName } from './parse.js';
import { paint, toast, memberChips, toggleMemberChip, songOptions } from './ui.js';

const WARN = 8 * 1024 * 1024, MAX = 25 * 1024 * 1024;
const st = { gid: null, items: [] };
let host = null;

const extOf = (name) => (name.split('.').pop() || '').toLowerCase();
const OK_EXT = ['webp', 'gif', 'mp4', 'webm'];

function guessVideo(g, p) {
  const vids = store.data.videos.filter((v) => eventById(v.eventId)?.groupId === g.id);
  let cands = vids;
  if (p.date) cands = cands.filter((v) => eventById(v.eventId)?.date === p.date);
  if (p.memberIds.length) cands = cands.filter((v) => cellKey(v.memberIds) === cellKey(p.memberIds));
  if (p.songId) cands = cands.filter((v) => v.songs.some((s) => s.songId === p.songId));
  return p.date && cands.length ? cands[0] : null;
}

function addFiles(files) {
  const g = groupById(st.gid);
  for (const f of files) {
    const ext = extOf(f.name);
    const it = { key: Math.random().toString(36).slice(2), file: f, name: f.name, ext, size: f.size, url: URL.createObjectURL(f), err: null, warn: null, note: '', t: '', end: '' };
    if (!OK_EXT.includes(ext)) it.err = 'webp·gif·mp4·webm만 담을 수 있어요.';
    else if (f.size > MAX) it.err = `${fmtBytes(f.size)}예요. 25MB를 넘는 파일은 담지 않아요. mp4나 webp로 변환해 줄여 주세요.`;
    else if (f.size > WARN) it.warn = `${fmtBytes(f.size)}로 커요. mp4·webp로 변환하면 빨라져요.`;
    const p = parseFileName(f.name, g);
    it.parsed = p;
    const v = guessVideo(g, p);
    it.mode = v ? 'video' : 'direct';
    it.videoId = v ? v.id : '';
    it.eventId = p.date ? (eventsOf(g.id).find((e) => e.date === p.date)?.id || '') : '';
    it.songId = p.songId || '';
    it.members = new Set(p.memberIds);
    it.auto = { video: !!v, event: !!it.eventId, song: !!p.songId, members: p.memberIds.length > 0 };
    st.items.push(it);
  }
  paintList();
}

function videoLabel(v) {
  const who = v.type === 'full' ? '풀캠' : v.memberIds.length ? v.memberIds.map((m) => memberById(m)?.name).join('·') : '단체';
  return `${eventLabel(eventById(v.eventId))} · ${v.songs.map((s) => songById(s.songId)?.title).join(' + ') || '전체 공연'} · ${who}`;
}

function itemStatus(it) {
  if (it.err) return { cls: 'err', text: it.err, ok: false };
  if (it.mode === 'video' && !it.videoId) return { cls: 'warn', text: '연결할 영상을 고르세요', ok: false };
  if (it.mode === 'direct' && !it.eventId) return { cls: 'warn', text: '공연을 고르세요', ok: false };
  const t = it.t ? parseTime(it.t) : null, end = it.end ? parseTime(it.end) : null;
  if (Number.isNaN(t) || Number.isNaN(end)) return { cls: 'warn', text: '시각은 0:42 형식', ok: false };
  if (t != null && end != null && t > end) return { cls: 'warn', text: '시작이 끝보다 늦어요', ok: false };
  return { cls: it.warn ? 'warn' : 'ok', text: it.warn || '준비됨', ok: true };
}

function itemHTML(it, i, g) {
  const s = itemStatus(it);
  const vids = store.data.videos.filter((v) => eventById(v.eventId)?.groupId === g.id)
    .sort((a, b) => (eventById(b.eventId)?.date || '').localeCompare(eventById(a.eventId)?.date || ''));
  const isVid = it.ext === 'mp4' || it.ext === 'webm';
  return html`<li class="card" style="margin:0" data-i="${i}">
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
      <div style="width:110px;flex:none">${isVid ? html`<video src="${it.url}" muted loop playsinline style="width:110px;aspect-ratio:2/3;object-fit:cover;border-radius:10px;background:#111"></video>` : html`<img src="${it.url}" alt="" style="width:110px;aspect-ratio:2/3;object-fit:cover;border-radius:10px;background:#111">`}
        <p class="hint" style="overflow-wrap:anywhere">${it.name}<br>${fmtBytes(it.size)}</p></div>
      <div style="flex:1;min-width:240px;display:grid;gap:10px">
        <div class="seg" role="group" aria-label="연결 방식"><button type="button" data-mode="video" aria-pressed="${String(it.mode === 'video')}">담은 영상에 연결</button><button type="button" data-mode="direct" aria-pressed="${String(it.mode === 'direct')}">영상 없이 지정</button></div>
        ${it.mode === 'video' ? html`<div class="form-grid">
          <label class="field wide"><span>원본 영상</span><select data-f="videoId" class="${it.auto.video ? 'auto' : ''}"><option value="">영상 고르기</option>${vids.map((v) => html`<option value="${v.id}" ${v.id === it.videoId ? html`selected` : ''}>${videoLabel(v)}</option>`)}</select></label>
          <label class="field"><span>시작 (0:42)</span><input data-f="t" value="${it.t}" placeholder="0:42"></label>
          <label class="field"><span>끝</span><input data-f="end" value="${it.end}" placeholder="0:48"></label>
        </div>` : html`<div class="form-grid">
          <label class="field"><span>공연</span><select data-f="eventId" class="${it.auto.event ? 'auto' : ''}"><option value="">공연 고르기</option>${eventsOf(g.id).map((e) => html`<option value="${e.id}" ${e.id === it.eventId ? html`selected` : ''}>${eventLabel(e)}</option>`)}</select></label>
          <label class="field"><span>곡</span><select data-f="songId" class="${it.auto.song ? 'auto' : ''}">${songOptions(g, it.songId, { none: '곡 구분 없음' })}</select></label>
          <div class="field wide ${it.auto.members ? 'auto' : ''}" style="border-radius:10px;padding:2px"><span>멤버 (비우면 단체)</span>${memberChips(g, it.members, { name: 'clip', row: String(i), withGroup: false })}</div>
        </div>`}
        <label class="field"><span>메모</span><input data-f="note" value="${it.note}" placeholder="엔딩 손하트"></label>
        <div class="kv"><span class="status ${s.cls}">${s.text}</span>${it.parsed.date ? html`<span class="hint">파일명 날짜 ${it.parsed.date}</span>` : ''}<button type="button" class="btn btn-sm" data-act="drop" style="margin-left:auto">빼기</button></div>
      </div>
    </div>
  </li>`;
}

function listHTML() {
  const g = groupById(st.gid);
  const ready = st.items.filter((it) => itemStatus(it).ok).length;
  return html`<div id="c-list">${st.items.length ? html`<ul class="list" style="gap:12px">${st.items.map((it, i) => itemHTML(it, i, g))}</ul>
    <div class="row-actions"><button type="button" class="btn btn-fill" data-act="commit" ${ready ? '' : html`disabled`}>준비된 움짤 ${ready}개 담기</button><span class="auto-legend"><i></i>파일명에서 자동으로 채운 값</span></div>` : ''}</div>`;
}

function paintList() {
  const el = host.querySelector('#c-list');
  if (el) el.outerHTML = String(listHTML());
}

function paintAll() {
  const groups = store.data.groups;
  if (!groups.length) { paint(host, html`<div class="card"><h2>먼저 그룹을 만들어요</h2><a class="btn btn-fill" href="#tab=roster">그룹·멤버·곡 관리로</a></div>`); return; }
  const g = groupById(st.gid) || groups[0];
  st.gid = g.id;
  paint(host, html`<section class="card" aria-labelledby="c-h1"><h2 id="c-h1">움짤 담기</h2>
    <p class="desc">webp·gif·mp4·webm 파일을 여러 개 끌어다 놓으세요. 파일명(예: 261023_yuna_paper-moon.webp)에서 날짜·멤버·곡을 읽어 미리 채워요. 8MB를 넘으면 경고하고 25MB를 넘으면 담지 않아요.</p>
    <label class="field" style="max-width:240px;margin-bottom:12px"><span>그룹</span><select data-f="gid">${groups.map((x) => html`<option value="${x.id}" ${x.id === g.id ? html`selected` : ''}>${x.name}</option>`)}</select></label>
    <div class="dropzone" id="c-drop"><b>파일을 여기에 끌어다 놓기</b><span>또는</span>
      <label class="btn"><input type="file" id="c-file" class="sr" multiple accept=".webp,.gif,.mp4,.webm,image/webp,image/gif,video/mp4,video/webm">파일 고르기</label></div>
    ${listHTML()}
  </section>`);
  const dz = host.querySelector('#c-drop');
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); addFiles([...e.dataTransfer.files]); });
}

// 첫 프레임 → JPEG 포스터
export async function extractPoster(file) {
  const ext = extOf(file.name);
  const cv = document.createElement('canvas');
  const draw = (src, w, h) => { cv.width = w; cv.height = h; cv.getContext('2d').drawImage(src, 0, 0, w, h); };
  if (ext === 'mp4' || ext === 'webm') {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.src = URL.createObjectURL(file);
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('video')); });
    if (v.currentTime !== 0) { v.currentTime = 0; await new Promise((r) => { v.onseeked = r; }); }
    draw(v, v.videoWidth, v.videoHeight);
    URL.revokeObjectURL(v.src);
  } else if ('ImageDecoder' in window && await ImageDecoder.isTypeSupported(file.type || `image/${ext}`)) {
    const dec = new ImageDecoder({ data: await file.arrayBuffer(), type: file.type || `image/${ext}` });
    const { image } = await dec.decode({ frameIndex: 0 });
    draw(image, image.displayWidth, image.displayHeight);
    image.close(); dec.close();
  } else {
    const url = URL.createObjectURL(file);
    const im = new Image();
    await new Promise((res, rej) => { im.onload = res; im.onerror = () => rej(new Error('image')); im.src = url; });
    draw(im, im.naturalWidth, im.naturalHeight);
    URL.revokeObjectURL(url);
  }
  return new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.85));
}

async function doCommit() {
  const ready = st.items.filter((it) => itemStatus(it).ok);
  const btn = host.querySelector('[data-act="commit"]');
  if (btn) { btn.disabled = true; btn.textContent = '포스터 만드는 중…'; }
  let n = 0;
  for (const it of ready) {
    const id = newClipId();
    const file = `clips/${id}.${it.ext}`;
    let poster = `clips/posters/${id}.jpg`;
    await putFile(file, it.file);
    try { await putFile(poster, await extractPoster(it.file)); } catch { poster = ''; }
    const t = it.t ? parseTime(it.t) : null, end = it.end ? parseTime(it.end) : null;
    const isVideo = it.mode === 'video';
    store.data.clips.push({
      id, file, poster, videoId: isVideo ? it.videoId : null, t, end,
      eventId: isVideo ? null : it.eventId, songId: isVideo ? null : (it.songId || null),
      memberIds: isVideo ? [] : [...it.members].filter((x) => x !== GROUP_KEY), note: it.note.trim(),
    });
    URL.revokeObjectURL(it.url);
    n++;
  }
  st.items = st.items.filter((it) => !ready.includes(it));
  commit(n);
  paintList();
  toast(`움짤 ${n}개를 담았어요. 저장할 때 파일도 함께 써요.`);
}

function bind() {
  host.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'c-file') { addFiles([...t.files]); t.value = ''; return; }
    if (t.dataset.f === 'gid') { st.gid = t.value; paintAll(); return; }
    const li = t.closest('[data-i]');
    // 글자 입력칸은 input 이벤트에서 반영한다(여기서 다시 그리면 누르던 버튼이 사라진다)
    if (li && t.dataset.f && t.tagName === 'SELECT') {
      const it = st.items[+li.dataset.i];
      it[t.dataset.f] = t.value;
      if (t.dataset.f === 'videoId') it.auto.video = false;
      if (t.dataset.f === 'eventId') it.auto.event = false;
      if (t.dataset.f === 'songId') it.auto.song = false;
      paintList();
    }
  });
  host.addEventListener('input', (e) => {
    const t = e.target;
    const li = t.closest('[data-i]');
    if (li && t.tagName === 'INPUT' && t.dataset.f) {
      st.items[+li.dataset.i][t.dataset.f] = t.value;
      const it = st.items[+li.dataset.i];
      const s = itemStatus(it);
      const el = li.querySelector('.status'); el.className = `status ${s.cls}`; el.textContent = s.text;
      const btn = host.querySelector('[data-act="commit"]');
      const ready = st.items.filter((x) => itemStatus(x).ok).length;
      if (btn) { btn.disabled = !ready; btn.textContent = `준비된 움짤 ${ready}개 담기`; }
    }
  });
  host.addEventListener('click', (e) => {
    const li = e.target.closest('[data-i]');
    const mode = e.target.closest('[data-mode]');
    if (mode && li) { st.items[+li.dataset.i].mode = mode.dataset.mode; paintList(); host.querySelector(`[data-i="${li.dataset.i}"] [data-mode="${mode.dataset.mode}"]`)?.focus(); return; }
    const chip = e.target.closest('[data-chip="clip"]');
    if (chip) { const it = st.items[+chip.dataset.row]; toggleMemberChip(it.members, chip.dataset.v); it.auto.members = false; paintList(); host.querySelector(`[data-chip="clip"][data-row="${chip.dataset.row}"][data-v="${chip.dataset.v}"]`)?.focus(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'drop' && li) { URL.revokeObjectURL(st.items[+li.dataset.i].url); st.items.splice(+li.dataset.i, 1); paintList(); }
    if (b.dataset.act === 'commit') doCommit();
  });
}

export function renderClips(el, p) {
  host = el;
  if (p.g && groupById(p.g)) st.gid = p.g;
  paintAll();
  bind();
}

