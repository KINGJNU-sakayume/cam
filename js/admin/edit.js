// 수정·삭제: 영상·공연·움짤을 검색해 고친다. 칸 대표(pin), 공연 표지(cover), setlist 순서, 의상 메모.
import { html, norm, fmtTime, parseTime, isRealDate } from '../util.js';
import { GROUP_KEY, cellKey, isSampleYt } from '../model.js';
import {
  store, commit, groupById, eventById, videoById, clipById, memberById, songById, songsOf, eventsOf, eventLabel, removeFile, fileURL,
} from './store.js';
import { memberChips, toggleMemberChip, songOptions, toast, paint, armDelete, tagsToText, textToTags, bindSortable, moveItem, ICON } from './ui.js';

const st = { q: '', kind: 'all', sel: null, members: new Set(), askEvent: null, prefillKey: null };
let host = null;

const who = (v) => (v.type === 'full' ? '풀캠' : v.memberIds.length ? v.memberIds.map((id) => memberById(id)?.name || id).join('·') : '단체');
const songsText = (v) => (v.songs.length ? v.songs.map((s) => songById(s.songId)?.title || s.songId).join(' + ') : '전체 공연');

function items() {
  const out = [];
  const d = store.data;
  for (const v of d.videos) {
    const e = eventById(v.eventId);
    const img = v.thumb ? fileURL(v.thumb) : v.ytId && !isSampleYt(v.ytId) ? `https://i.ytimg.com/vi/${v.ytId}/mqdefault.jpg` : '';
    out.push({ kind: 'video', id: v.id, t1: `${e ? eventLabel(e) : '?'} · ${songsText(v)} · ${who(v)}`, t2: `${v.title || v.ytId} · ${v.channel || ''}`, extra: v.ytId, date: e?.date || '', img });
  }
  for (const e of d.events) {
    const n = d.videos.filter((v) => v.eventId === e.id).length;
    out.push({ kind: 'event', id: e.id, t1: `공연 · ${eventLabel(e)}`, t2: `${groupById(e.groupId)?.name || ''} · 영상 ${n}${e.note ? ` · ${e.note}` : ''}`, date: e.date });
  }
  for (const c of d.clips) {
    const v = c.videoId ? videoById(c.videoId) : null;
    const e = eventById(v ? v.eventId : c.eventId);
    out.push({ kind: 'clip', id: c.id, t1: `움짤 · ${e ? eventLabel(e) : '?'} · ${c.note || c.file}`, t2: v ? `원본: ${v.title || v.ytId}` : '원본 영상 없음', date: e?.date || '' });
  }
  return out;
}

function results() {
  const toks = norm(st.q).split(' ').filter(Boolean);
  let list = items().filter((x) => st.kind === 'all' || x.kind === st.kind);
  if (toks.length) list = list.filter((x) => { const t = norm(`${x.id} ${x.extra || ''} ${x.t1} ${x.t2} ${x.date.replaceAll('-', '')} ${x.date.slice(2).replaceAll('-', '')}`); return toks.every((k) => t.includes(k)); });
  list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return list;
}

function listHTML() {
  const list = results();
  return html`<div id="ed-results"><p class="hint" style="margin-bottom:8px">${list.length}개${list.length > 60 ? ' 중 최근 60개' : ''}</p>
    <div class="list">${list.slice(0, 60).map((x) => html`<button type="button" class="li ed-li" data-pick="${`${x.kind}:${x.id}`}" aria-pressed="${String(st.sel === `${x.kind}:${x.id}`)}">
      ${x.kind === 'video' ? html`<span class="mini r169">${x.img ? html`<img src="${x.img}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>` : ''}<span class="grow"><span class="t1" style="display:block">${x.t1}</span><span class="t2" style="display:block">${x.t2}</span></span><span class="hint">${x.id}</span></button>`)}</div></div>`;
}

// ---------- 영상 ----------
function videoForm(v) {
  const e = eventById(v.eventId);
  const g = groupById(e?.groupId);
  const evs = eventsOf(g?.id);
  const isCover = e && e.cover === v.id;
  return html`<form class="card" data-form="video" aria-labelledby="ed-h">
    <h2 id="ed-h">영상 ${v.id}</h2><p class="desc">${v.title || v.ytId}</p>
    <div class="form-grid">
      <label class="field"><span>공연</span><select name="eventId">${evs.map((x) => html`<option value="${x.id}" ${x.id === v.eventId ? html`selected` : ''}>${eventLabel(x)}</option>`)}</select></label>
      <label class="field"><span>유튜브 ID</span><input name="ytId" value="${v.ytId}" maxlength="11"></label>
      <label class="field"><span>종류</span><select name="type"><option value="fancam" ${v.type === 'fancam' ? html`selected` : ''}>직캠</option><option value="full" ${v.type === 'full' ? html`selected` : ''}>풀캠</option></select></label>
      <label class="field"><span>출처</span><select name="source"><option value="" ${!v.source ? html`selected` : ''}>모름</option><option value="official" ${v.source === 'official' ? html`selected` : ''}>공식</option><option value="fan" ${v.source === 'fan' ? html`selected` : ''}>팬</option></select></label>
      <div class="field wide"><span>멤버 (직캠)</span>${memberChips(g, st.members, { name: 'ed' })}</div>
      <div class="field wide"><span>곡과 시작 초</span>
        <div class="list" id="ed-songs">${v.songs.map((s, i) => html`<div class="kv"><select name="${`song${i}`}" aria-label="곡">${songOptions(g, s.songId, { none: '(빼기)' })}</select><input name="${`t${i}`}" value="${fmtTime(s.t || 0)}" style="width:90px" aria-label="시작 시각 (분:초)"></div>`)}
        <div class="kv"><select name="songNew" aria-label="곡 추가">${songOptions(g, '', { none: '+ 곡 추가' })}</select><input name="tNew" value="0:00" style="width:90px" aria-label="추가할 곡 시작 시각"></div></div>
        <span class="hint">곡이 없으면 곡 구분 없는 전체 공연 영상이에요. 두 곡이 든 영상은 곡마다 시작 시각을 넣어요.</span></div>
      <label class="field wide"><span>제목</span><input name="title" value="${v.title || ''}"></label>
      <label class="field"><span>채널</span><input name="channel" value="${v.channel || ''}"></label>
      <label class="field"><span>태그 (쉼표)</span><input name="tags" value="${tagsToText(v.tags)}"></label>
      <label class="field"><span>썸네일</span><input name="thumb" value="${v.thumb || ''}" placeholder="기본(유튜브)"></label>
      <label class="field"><span>썸네일 위치</span><input name="thumbPos" value="${v.thumbPos || ''}" placeholder="50% 35%"></label>
    </div>
    <div class="row-actions">
      <label class="check"><input type="checkbox" name="pin" ${v.pin ? html`checked` : ''}>이 칸의 대표</label>
      <label class="check"><input type="checkbox" name="gone" ${v.gone ? html`checked` : ''}>삭제·비공개됨</label>
      <button type="button" class="btn btn-sm" data-act="cover" ${isCover ? html`disabled` : ''}>${isCover ? '이 공연의 표지예요' : '이 공연 표지로'}</button>
      <a class="btn btn-sm" href="${`#tab=thumbs&v=${v.id}`}">썸네일 바꾸기</a>
    </div>
    <div class="row-actions"><button type="submit" class="btn btn-fill">변경 저장</button><button type="button" class="btn btn-danger" data-act="delVideo">삭제</button></div>
    ${st.askEvent ? askEventHTML() : ''}
  </form>`;
}

function askEventHTML() {
  const e = eventById(st.askEvent);
  if (!e) return '';
  const clips = store.data.clips.filter((c) => c.eventId === e.id).length;
  return html`<div class="notice warn" style="margin-top:12px" role="alert">${eventLabel(e)} 공연에 영상이 남지 않았어요. 공연도 지울까요?${clips ? ` (이 공연에 직접 연결된 움짤 ${clips}개도 함께 지워요)` : ''}
    <div class="row-actions"><button type="button" class="btn btn-sm btn-danger" data-act="delEmptyEvent">공연도 지우기</button><button type="button" class="btn btn-sm" data-act="keepEvent">공연은 남기기</button></div></div>`;
}

function saveVideo(form, v) {
  const f = new FormData(form);
  const e = eventById(f.get('eventId'));
  const g = groupById(e.groupId);
  const ytId = String(f.get('ytId')).trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(ytId)) return toast('유튜브 ID는 11자예요.');
  if (store.data.videos.some((x) => x !== v && x.ytId === ytId)) return toast('같은 유튜브 영상이 이미 있어요.');
  const songs = [];
  v.songs.forEach((s, i) => {
    const id = f.get(`song${i}`);
    if (id) songs.push({ songId: id, t: parseTime(f.get(`t${i}`)) || 0 });
  });
  if (f.get('songNew')) songs.push({ songId: f.get('songNew'), t: parseTime(f.get('tNew')) || 0 });
  const type = f.get('type');
  if (type === 'fancam' && !st.members.size) return toast('직캠은 멤버 또는 단체를 골라야 저장돼요.');
  const thumb = String(f.get('thumb')).trim();
  if (thumb && /^https?:/.test(thumb) && !thumb.startsWith('https://i.ytimg.com/')) return toast('썸네일 URL은 i.ytimg.com만 쓸 수 있어요.');
  Object.assign(v, {
    eventId: e.id, ytId, songs, type, source: f.get('source') || null,
    memberIds: type === 'fancam' && !st.members.has(GROUP_KEY) ? [...st.members].filter((id) => g.members.some((m) => m.id === id)) : [],
    title: String(f.get('title')).trim(), channel: String(f.get('channel')).trim(), tags: textToTags(f.get('tags')),
    pin: f.get('pin') === 'on', gone: f.get('gone') === 'on',
  });
  if (thumb) v.thumb = thumb; else delete v.thumb;
  const pos = String(f.get('thumbPos')).trim();
  if (pos) v.thumbPos = pos; else delete v.thumbPos;
  if (v.pin) {
    // 같은 칸의 다른 영상은 대표 해제
    const key = cellKey(v.memberIds);
    for (const o of store.data.videos) {
      if (o !== v && o.eventId === v.eventId && o.type === v.type && cellKey(o.memberIds) === key && o.songs.some((s) => v.songs.some((x) => x.songId === s.songId))) o.pin = false;
    }
  }
  commit();
  toast('영상을 고쳤어요.');
  paintEditor();
}

function deleteVideo(v) {
  const e = eventById(v.eventId);
  for (const c of store.data.clips) {
    if (c.videoId === v.id) {
      c.videoId = null; c.eventId = v.eventId; c.songId = v.songs[0]?.songId || null; c.memberIds = [...v.memberIds];
    }
  }
  if (e && e.cover === v.id) delete e.cover;
  store.data.videos = store.data.videos.filter((x) => x !== v);
  commit();
  toast('영상을 지웠어요. 연결된 움짤은 공연에 직접 연결해 두었어요.');
  if (e && !store.data.videos.some((x) => x.eventId === e.id)) { st.askEvent = e.id; st.sel = `event:${e.id}`; }
  else st.sel = null;
  paintAll();
}

// ---------- 공연 ----------
function eventForm(e) {
  const g = groupById(e.groupId);
  const vids = store.data.videos.filter((v) => v.eventId === e.id);
  const clips = store.data.clips.filter((c) => c.eventId === e.id || vids.some((v) => v.id === c.videoId));
  const songs = songsOf(g);
  return html`<form class="card" data-form="event" aria-labelledby="ed-h">
    <h2 id="ed-h">공연 ${e.id}</h2><p class="desc">${g?.name} · 영상 ${vids.length} · 움짤 ${clips.length}</p>
    ${st.askEvent === e.id ? askEventHTML() : ''}
    <div class="form-grid">
      <label class="field"><span>날짜</span><input type="date" name="date" value="${e.date}"></label>
      <label class="field"><span>행사</span><input name="show" value="${e.show}"></label>
      <label class="field"><span>label</span><input name="label" value="${e.label || ''}"></label>
      <label class="field wide"><span>의상 메모</span><input name="note" value="${e.note || ''}"></label>
      <label class="field wide"><span>표지 영상</span><select name="cover"><option value="">자동 (풀캠 → 단체 → 첫 직캠)</option>${vids.map((v) => html`<option value="${v.id}" ${e.cover === v.id ? html`selected` : ''}>${songsText(v)} · ${who(v)} · ${v.title || v.ytId}</option>`)}</select></label>
    </div>
    <h3>setlist 순서 <span class="hint">끌어서 옮기거나 위·아래 버튼을 쓰세요</span></h3>
    <ol class="list" id="ed-setlist">${(e.setlist || []).map((id, i) => html`<li class="li" draggable="true" data-idx="${i}">
      <span class="handle" aria-hidden="true">${ICON.grip}</span><span class="num" style="width:22px">${String(i + 1).padStart(2, '0')}</span><span class="grow t1">${songById(id)?.title || id}</span>
      <button type="button" class="iconbtn" data-move="up" aria-label="${`${songById(id)?.title} 위로`}" ${i === 0 ? html`disabled` : ''}>${ICON.up}</button>
      <button type="button" class="iconbtn" data-move="down" aria-label="${`${songById(id)?.title} 아래로`}" ${i === e.setlist.length - 1 ? html`disabled` : ''}>${ICON.down}</button>
      <button type="button" class="btn btn-sm" data-act="unset" data-v="${id}">빼기</button></li>`)}</ol>
    <div class="kv" style="margin-top:8px"><select class="input" style="max-width:260px" data-act-change="addSet" aria-label="setlist에 곡 추가"><option value="">+ 곡 추가</option>${songs.filter((s) => !(e.setlist || []).includes(s.id)).map((s) => html`<option value="${s.id}">${s.title}</option>`)}</select></div>
    <div class="row-actions"><button type="submit" class="btn btn-fill">변경 저장</button>

      <button type="button" class="btn btn-danger" data-act="delEvent">${vids.length || clips.length ? `공연 삭제 (영상 ${vids.length}·움짤 ${clips.length} 함께)` : '공연 삭제'}</button></div>
  </form>`;
}

function saveEvent(form, e) {
  const f = new FormData(form);
  const date = String(f.get('date'));
  if (!isRealDate(date)) return toast('날짜가 올바르지 않아요.');
  const show = String(f.get('show')).trim();
  if (!show) return toast('행사명이 비어 있어요.');
  const label = String(f.get('label')).trim();
  if (store.data.events.some((x) => x !== e && x.groupId === e.groupId && x.date === date && x.show.trim() === show && (x.label || '').trim() === label)) return toast('같은 그룹·날짜·행사·label 공연이 이미 있어요. label로 구분해 주세요.');
  Object.assign(e, { date, show, label, note: String(f.get('note')).trim() });
  const cover = f.get('cover');
  if (cover) e.cover = cover; else delete e.cover;
  commit();
  toast('공연을 고쳤어요.');
  paintEditor();
}

function deleteEvent(e) {
  const vids = new Set(store.data.videos.filter((v) => v.eventId === e.id).map((v) => v.id));
  const gone = store.data.clips.filter((c) => c.eventId === e.id || vids.has(c.videoId));
  for (const c of gone) { removeFile(c.file); if (c.poster) removeFile(c.poster); }
  store.data.clips = store.data.clips.filter((c) => !gone.includes(c));
  store.data.videos = store.data.videos.filter((v) => v.eventId !== e.id);
  store.data.events = store.data.events.filter((x) => x !== e);
  commit();
  st.sel = null; st.askEvent = null;
  toast(`${eventLabel(e)} 공연을 지웠어요.`);
  paintAll();
}

// ---------- 움짤 ----------
function clipForm(c) {
  const v = c.videoId ? videoById(c.videoId) : null;
  const e = eventById(v ? v.eventId : c.eventId);
  const g = groupById(e?.groupId) || store.data.groups[0];
  const vids = store.data.videos.filter((x) => eventById(x.eventId)?.groupId === g.id);
  return html`<form class="card" data-form="clip" aria-labelledby="ed-h">
    <h2 id="ed-h">움짤 ${c.id}</h2><p class="desc">${c.file}${store.files.has(c.file) ? ' · 아직 저장소에 쓰지 않은 파일' : ''}</p>
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
      <img src="${fileURL(c.poster) || fileURL(c.file)}" alt="" style="width:120px;aspect-ratio:2/3;object-fit:cover;border-radius:10px;background:var(--soft)">
      <div class="form-grid" style="flex:1;min-width:240px">
        <label class="field wide"><span>원본 영상</span><select name="videoId"><option value="">원본 영상 없음 (공연·곡·멤버 직접 지정)</option>${vids.map((x) => html`<option value="${x.id}" ${x.id === c.videoId ? html`selected` : ''}>${eventLabel(eventById(x.eventId))} · ${songsText(x)} · ${who(x)}</option>`)}</select></label>
        <label class="field"><span>시작 (0:42)</span><input name="t" value="${c.t != null ? fmtTime(c.t) : ''}"></label>
        <label class="field"><span>끝</span><input name="end" value="${c.end != null ? fmtTime(c.end) : ''}"></label>
        <label class="field"><span>공연 (원본 없을 때)</span><select name="eventId"><option value="">—</option>${eventsOf(g.id).map((x) => html`<option value="${x.id}" ${x.id === c.eventId ? html`selected` : ''}>${eventLabel(x)}</option>`)}</select></label>
        <label class="field"><span>곡 (원본 없을 때)</span><select name="songId">${songOptions(g, c.songId, { none: '—' })}</select></label>
        <div class="field wide"><span>멤버 (원본 없을 때)</span>${memberChips(g, st.members, { name: 'ed', withGroup: false })}</div>
        <label class="field wide"><span>메모</span><input name="note" value="${c.note || ''}"></label>
      </div>
    </div>
    <div class="row-actions"><button type="submit" class="btn btn-fill">변경 저장</button><button type="button" class="btn btn-danger" data-act="delClip">삭제</button></div>
  </form>`;
}

function saveClip(form, c) {
  const f = new FormData(form);
  const t = f.get('t') ? parseTime(f.get('t')) : null;
  const end = f.get('end') ? parseTime(f.get('end')) : null;
  if (Number.isNaN(t) || Number.isNaN(end)) return toast('시각은 0:42 형식으로 넣어 주세요.');
  if (t != null && end != null && t > end) return toast('시작이 끝보다 늦어요.');
  const videoId = f.get('videoId') || null;
  if (!videoId && !f.get('eventId')) return toast('원본 영상이나 공연 중 하나는 골라 주세요.');
  Object.assign(c, {
    videoId, t, end, note: String(f.get('note')).trim(),
    eventId: videoId ? null : f.get('eventId'), songId: videoId ? null : (f.get('songId') || null),
    memberIds: videoId ? [] : [...st.members].filter((x) => x !== GROUP_KEY),
  });
  commit();
  toast('움짤을 고쳤어요.');
  paintEditor();
}

// ---------- 그리기 ----------
function editorHTML() {
  if (!st.sel) return html`<div class="card"><p class="desc" style="margin:0">왼쪽(모바일은 위) 목록에서 고칠 항목을 고르세요.</p></div>`;
  const [kind, id] = st.sel.split(':');
  if (kind === 'video') { const v = videoById(id); return v ? videoForm(v) : ''; }
  if (kind === 'event') { const e = eventById(id); return e ? eventForm(e) : ''; }
  if (kind === 'clip') { const c = clipById(id); return c ? clipForm(c) : ''; }
  return '';
}

function selectItem(sel) {
  st.sel = sel;
  st.askEvent = null;
  const [kind, id] = sel.split(':');
  st.members = new Set();
  if (kind === 'video') { const v = videoById(id); if (v) { if (v.type === 'fancam' && !v.memberIds.length) st.members.add(GROUP_KEY); v.memberIds.forEach((m) => st.members.add(m)); } }
  if (kind === 'clip') { const c = clipById(id); if (c) (c.memberIds || []).forEach((m) => st.members.add(m)); }
}

function paintEditor() {
  const el = host.querySelector('#ed-editor');
  el.innerHTML = String(editorHTML());
  const r = host.querySelector('#ed-results');
  if (r) r.outerHTML = String(listHTML());
  const sl = el.querySelector('#ed-setlist');
  if (sl) {
    bindSortable(sl, (from, to, dir) => {
      const e = eventById(st.sel.split(':')[1]);
      if (moveItem(e.setlist, from, to)) {
        commit(); paintEditor();
        const target = host.querySelector(`#ed-setlist [data-idx="${to}"] [data-move="${dir || 'up'}"]`) || host.querySelector(`#ed-setlist [data-idx="${to}"] [data-move]`);
        target?.focus();
      }
    });
  }
}

function paintAll() {
  paint(host, html`<div class="ed-grid">
    <section class="card" aria-labelledby="ed-sh"><h2 id="ed-sh">찾기</h2>
      <div class="kv" style="margin:8px 0 12px"><label class="sr" for="ed-q">검색</label><input class="input" id="ed-q" value="${st.q}" placeholder="날짜·행사·멤버·곡·제목·id">
      <div class="seg" role="group" aria-label="종류">${[['all', '전체'], ['video', '영상'], ['event', '공연'], ['clip', '움짤']].map(([k, t]) => html`<button type="button" data-kind="${k}" aria-pressed="${String(st.kind === k)}">${t}</button>`)}</div></div>
      ${listHTML()}
    </section>
    <div id="ed-editor">${editorHTML()}</div>
  </div>`);
  paintEditor();
}

function bind() {
  host.addEventListener('input', (e) => {
    if (e.target.id === 'ed-q') { st.q = e.target.value; host.querySelector('#ed-results').outerHTML = String(listHTML()); }
  });
  host.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.actChange === 'addSet' && t.value) {
      const ev = eventById(st.sel.split(':')[1]);
      ev.setlist = [...(ev.setlist || []), t.value];
      commit(); paintEditor();
    }
    if (t.name === 'type' && t.value === 'full') { st.members.clear(); host.querySelectorAll('[data-chip="ed"]').forEach((c) => c.setAttribute('aria-pressed', 'false')); }
  });
  host.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const [, id] = st.sel.split(':');
    if (form.dataset.form === 'video') saveVideo(form, videoById(id));
    if (form.dataset.form === 'event') saveEvent(form, eventById(id));
    if (form.dataset.form === 'clip') saveClip(form, clipById(id));
  });
  host.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) { selectItem(pick.dataset.pick); paintEditor(); host.querySelector('#ed-editor h2')?.setAttribute('tabindex', '-1'); host.querySelector('#ed-editor h2')?.focus(); return; }
    const kind = e.target.closest('[data-kind]');
    if (kind) { st.kind = kind.dataset.kind; paintAll(); host.querySelector(`[data-kind="${st.kind}"]`)?.focus(); return; }
    const chip = e.target.closest('[data-chip="ed"]');
    if (chip) {
      toggleMemberChip(st.members, chip.dataset.v);
      host.querySelectorAll('[data-chip="ed"]').forEach((c) => c.setAttribute('aria-pressed', String(st.members.has(c.dataset.v))));
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const [kindSel, id] = (st.sel || ':').split(':');
    switch (b.dataset.act) {
      case 'cover': { const v = videoById(id); const ev = eventById(v.eventId); ev.cover = v.id; commit(); toast('공연 표지로 정했어요.'); paintEditor(); break; }
      case 'delVideo': armDelete(b, () => deleteVideo(videoById(id))); break;
      case 'delEvent': armDelete(b, () => deleteEvent(eventById(id))); break;
      case 'delEmptyEvent': deleteEvent(eventById(st.askEvent)); break;
      case 'keepEvent': st.askEvent = null; paintEditor(); break;
      case 'delClip': armDelete(b, () => {
        const c = clipById(id);
        removeFile(c.file); if (c.poster) removeFile(c.poster);
        store.data.clips = store.data.clips.filter((x) => x !== c);
        commit(); st.sel = null; toast('움짤을 지웠어요.'); paintAll();
      }); break;
      case 'unset': if (kindSel === 'event') { const ev = eventById(id); ev.setlist = ev.setlist.filter((x) => x !== b.dataset.v); commit(); paintEditor(); } break;
      default:
    }
  });
}

export function renderEdit(el, p) {
  host = el;
  const key = `${p.v || ''}|${p.e || ''}|${p.c || ''}`;
  if (key !== st.prefillKey) {
    st.prefillKey = key;
    if (p.v && videoById(p.v)) selectItem(`video:${p.v}`);
    else if (p.e && eventById(p.e)) selectItem(`event:${p.e}`);
    else if (p.c && clipById(p.c)) selectItem(`clip:${p.c}`);
  }
  paintAll();
  bind();
}
