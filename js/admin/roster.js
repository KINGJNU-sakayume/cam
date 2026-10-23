// 그룹·멤버·곡 관리: 추가, 이름·별칭 수정, 순서(드래그 + 위/아래 버튼), 활동 종료, 그룹 hue와 멤버 color
import { html, isRealDate } from '../util.js';
import { DEFAULT_COLORS } from '../model.js';
import { store, commit, groupById, membersOf, songsOf, newGroupId, newMemberId, newSongId } from './store.js';
import { paint, toast, armDelete, bindSortable, moveItem, ICON } from './ui.js';
import { applyAccent } from '../theme.js';

const st = { gid: null };
let host = null;

const aliasText = (a) => (a || []).join(', ');
const aliasList = (s) => [...new Set(String(s || '').split(',').map((x) => x.trim()).filter(Boolean))];

function used(kind, id) {
  if (kind === 'member') return store.data.videos.some((v) => v.memberIds.includes(id)) || store.data.clips.some((c) => (c.memberIds || []).includes(id));
  if (kind === 'song') return store.data.videos.some((v) => v.songs.some((s) => s.songId === id)) || store.data.events.some((e) => (e.setlist || []).includes(id)) || store.data.clips.some((c) => c.songId === id);
  if (kind === 'group') return store.data.events.some((e) => e.groupId === id);
  return false;
}

function memberRow(g, m, i, n) {
  const color = m.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
  return html`<li class="li" draggable="true" data-idx="${i}" data-id="${m.id}">
    <span class="handle" title="끌어서 순서 바꾸기" aria-hidden="true">${ICON.grip}</span>
    <span class="initial" style="${`--mc:${color}`}" aria-hidden="true">${m.name.charAt(0)}</span>
    <label class="field" style="width:110px"><span>이름</span><input data-m="name" value="${m.name}"></label>
    <label class="field grow"><span>별칭 (쉼표)</span><input data-m="aliases" value="${aliasText(m.aliases)}" placeholder="영문명"></label>
    <div class="field"><span>색</span><div class="kv"><input type="color" data-m="color" value="${color}" aria-label="${`${m.name} 색 고르기`}" style="width:36px;height:30px;padding:0;border:0;background:none">
      <div class="swatches" role="group" aria-label="기본 팔레트">${DEFAULT_COLORS.map((c) => html`<button type="button" class="swatch" data-swatch="${c}" style="${`background:${c}`}" aria-label="${`색 ${c}`}" aria-pressed="${String(color.toLowerCase() === c)}"></button>`)}</div></div></div>
    <label class="check"><input type="checkbox" data-m="active" ${m.active === false ? '' : html`checked`}>활동 중</label>
    <a class="btn btn-sm" href="${`#tab=thumbs&m=${m.id}`}">썸네일</a>
    <button type="button" class="iconbtn" data-move="up" aria-label="${`${m.name} 위로`}" ${i === 0 ? html`disabled` : ''}>${ICON.up}</button>
    <button type="button" class="iconbtn" data-move="down" aria-label="${`${m.name} 아래로`}" ${i === n - 1 ? html`disabled` : ''}>${ICON.down}</button>
    <button type="button" class="btn btn-sm btn-danger" data-del="member" ${used('member', m.id) ? html`disabled title="영상에 쓰인 멤버는 지울 수 없어요. 활동 종료로 표시하세요."` : ''}>삭제</button>
  </li>`;
}

function songRow(g, s, i, n) {
  return html`<li class="li" draggable="true" data-idx="${i}" data-id="${s.id}">
    <span class="handle" aria-hidden="true">${ICON.grip}</span>
    <label class="field" style="min-width:160px;flex:1"><span>곡명</span><input data-s="title" value="${s.title}"></label>
    <label class="field grow"><span>별칭 (쉼표)</span><input data-s="aliases" value="${aliasText(s.aliases)}"></label>
    <label class="field" style="width:150px"><span>발매일</span><input type="date" data-s="release" value="${s.release || ''}"></label>
    <button type="button" class="iconbtn" data-move="up" aria-label="${`${s.title} 위로`}" ${i === 0 ? html`disabled` : ''}>${ICON.up}</button>
    <button type="button" class="iconbtn" data-move="down" aria-label="${`${s.title} 아래로`}" ${i === n - 1 ? html`disabled` : ''}>${ICON.down}</button>
    <button type="button" class="btn btn-sm btn-danger" data-del="song" ${used('song', s.id) ? html`disabled title="영상·setlist에 쓰인 곡은 지울 수 없어요."` : ''}>삭제</button>
  </li>`;
}

function paintAll() {
  const groups = store.data.groups;
  const g = groupById(st.gid) || groups[0];
  st.gid = g ? g.id : null;
  if (g) applyAccent(g.hue);
  const ms = g ? membersOf(g) : [], ss = g ? songsOf(g) : [];
  paint(host, html`
    <section class="card" aria-labelledby="r-h1"><h2 id="r-h1">그룹</h2>
      <div class="kv" style="margin:10px 0">${groups.map((x) => html`<button type="button" class="chip" data-group="${x.id}" aria-pressed="${String(x.id === st.gid)}"><span class="dot" style="${`background:hsl(${x.hue} 55% 45%)`}"></span>${x.name}</button>`)}</div>
      <div class="kv"><label class="sr" for="r-newg">새 그룹 이름</label><input class="input" id="r-newg" placeholder="새 그룹 이름" style="max-width:220px"><button type="button" class="btn btn-sm" data-act="addGroup">그룹 추가</button></div>
      ${g ? html`<div class="form-grid" style="margin-top:16px">
        <label class="field"><span>그룹명</span><input data-g="name" value="${g.name}"></label>
        <label class="field"><span>영문명</span><input data-g="en" value="${g.en || ''}"></label>
        <label class="field"><span>강조색 hue <b class="num" id="r-hue">${g.hue}</b></span><input type="range" min="0" max="360" data-g="hue" value="${g.hue}" style="accent-color:var(--accent)"></label>
        <div class="field"><span>미리 보기</span><div class="kv"><span class="tab" aria-current="page" style="pointer-events:none"><span class="dot" style="${`background:hsl(${g.hue} 55% 45%)`}"></span>${g.name}</span><span class="btn btn-fill btn-sm" style="pointer-events:none">+ 담기</span></div></div>
      </div>
      <div class="row-actions"><button type="button" class="btn btn-sm btn-danger" data-del="group" ${used('group', g.id) ? html`disabled title="공연이 있는 그룹은 지울 수 없어요."` : ''}>그룹 삭제</button></div>` : ''}
    </section>
    ${g ? html`<section class="card" aria-labelledby="r-h2"><h2 id="r-h2">멤버 <span class="hint">${ms.length}명 · 순서는 라인업 열 순서</span></h2>
      <ol class="list" id="r-members">${ms.map((m, i) => memberRow(g, m, i, ms.length))}</ol>
      <div class="kv" style="margin-top:10px"><label class="sr" for="r-newm">새 멤버 이름</label><input class="input" id="r-newm" placeholder="새 멤버 이름" style="max-width:200px"><button type="button" class="btn btn-sm" data-act="addMember">멤버 추가</button></div>
    </section>
    <section class="card" aria-labelledby="r-h3"><h2 id="r-h3">곡 <span class="hint">${ss.length}곡</span></h2>
      <ol class="list" id="r-songs">${ss.map((s, i) => songRow(g, s, i, ss.length))}</ol>
      <div class="kv" style="margin-top:10px"><label class="sr" for="r-news">새 곡 이름</label><input class="input" id="r-news" placeholder="새 곡 이름" style="max-width:200px"><button type="button" class="btn btn-sm" data-act="addSong">곡 추가</button></div>
    </section>` : ''}`);
  const ml = host.querySelector('#r-members');
  if (ml) bindSortable(ml, (from, to, dir) => reorder('members', from, to, dir));
  const sl = host.querySelector('#r-songs');
  if (sl) bindSortable(sl, (from, to, dir) => reorder('songs', from, to, dir));
}

function reorder(kind, from, to, dir) {
  const g = groupById(st.gid);
  const list = kind === 'members' ? membersOf(g) : songsOf(g);
  if (!moveItem(list, from, to)) return;
  list.forEach((x, i) => { x.order = i + 1; });
  commit();
  paintAll();
  const sel = `#r-${kind} [data-idx="${to}"] [data-move="${dir || 'up'}"]`;
  (host.querySelector(sel) && !host.querySelector(sel).disabled ? host.querySelector(sel) : host.querySelector(`#r-${kind} [data-idx="${to}"] input`))?.focus();
}

function bind() {
  // 글자 입력은 바로 반영하고, 칸을 벗어날 때 변경 수를 센다
  let dirty = false;
  host.addEventListener('input', (e) => {
    const t = e.target;
    const g = groupById(st.gid);
    if (t.dataset.g) {
      if (t.dataset.g === 'hue') { g.hue = +t.value; host.querySelector('#r-hue').textContent = t.value; applyAccent(g.hue); }
      else g[t.dataset.g] = t.value;
      dirty = true;
    }
    const li = t.closest('[data-id]');
    if (li && t.dataset.m) {
      const m = g.members.find((x) => x.id === li.dataset.id);
      if (t.dataset.m === 'name') m.name = t.value;
      if (t.dataset.m === 'aliases') m.aliases = aliasList(t.value);
      if (t.dataset.m === 'color') { m.color = t.value; li.querySelector('.initial').style.setProperty('--mc', t.value); }
      dirty = true;
    }
    if (li && t.dataset.s) {
      const s = g.songs.find((x) => x.id === li.dataset.id);
      if (t.dataset.s === 'title') s.title = t.value;
      if (t.dataset.s === 'aliases') s.aliases = aliasList(t.value);
      if (t.dataset.s === 'release') s.release = isRealDate(t.value) ? t.value : '';
      dirty = true;
    }
  });
  host.addEventListener('change', (e) => {
    const t = e.target;
    const li = t.closest('[data-id]');
    if (li && t.dataset.m === 'active') {
      const g = groupById(st.gid);
      g.members.find((x) => x.id === li.dataset.id).active = t.checked;
      dirty = true;
    }
    if (dirty) {
      const g = groupById(st.gid);
      if (g && !g.name.trim()) { toast('그룹명은 비울 수 없어요.'); return; }
      commit(); dirty = false;
      if (t.dataset.g === 'name') host.querySelectorAll(`[data-group="${st.gid}"]`).forEach((b) => { b.lastChild.textContent = g.name; });
    }
  });
  host.addEventListener('click', (e) => {
    const gb = e.target.closest('[data-group]');
    if (gb) { st.gid = gb.dataset.group; paintAll(); host.querySelector(`[data-group="${st.gid}"]`)?.focus(); return; }
    const sw = e.target.closest('[data-swatch]');
    if (sw) {
      const g = groupById(st.gid);
      const m = g.members.find((x) => x.id === sw.closest('[data-id]').dataset.id);
      m.color = sw.dataset.swatch;
      commit(); paintAll();
      host.querySelector(`[data-id="${m.id}"] [data-swatch="${m.color}"]`)?.focus();
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del && !del.disabled) {
      armDelete(del, () => {
        const g = groupById(st.gid);
        if (del.dataset.del === 'group') { store.data.groups = store.data.groups.filter((x) => x !== g); st.gid = null; toast('그룹을 지웠어요.'); }
        else {
          const id = del.closest('[data-id]').dataset.id;
          if (del.dataset.del === 'member') { g.members = g.members.filter((x) => x.id !== id); membersOf(g).forEach((x, i) => { x.order = i + 1; }); }
          else { g.songs = g.songs.filter((x) => x.id !== id); songsOf(g).forEach((x, i) => { x.order = i + 1; }); }
          toast('지웠어요.');
        }
        commit(); paintAll();
      });
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'addGroup') {
      const name = host.querySelector('#r-newg').value.trim();
      if (!name) { toast('그룹 이름을 넣어 주세요.'); return; }
      const g = { id: newGroupId(), name, en: '', hue: (store.data.groups.length * 67 + 200) % 360, members: [], songs: [] };
      store.data.groups.push(g);
      st.gid = g.id;
      commit(); paintAll();
      host.querySelector('#r-newm')?.focus();
      toast(`그룹 ${name}을 만들었어요. 멤버와 곡을 추가하세요.`);
    }
    if (b.dataset.act === 'addMember') {
      const g = groupById(st.gid);
      const name = host.querySelector('#r-newm').value.trim();
      if (!name) { toast('멤버 이름을 넣어 주세요.'); return; }
      const n = g.members.length;
      g.members.push({ id: newMemberId(g), name, aliases: [], order: n + 1, active: true, color: DEFAULT_COLORS[n % DEFAULT_COLORS.length] });
      commit(); paintAll();
      host.querySelector('#r-newm')?.focus();
    }
    if (b.dataset.act === 'addSong') {
      const g = groupById(st.gid);
      const title = host.querySelector('#r-news').value.trim();
      if (!title) { toast('곡 이름을 넣어 주세요.'); return; }
      g.songs.push({ id: newSongId(g), title, aliases: [], order: g.songs.length + 1, release: '' });
      commit(); paintAll();
      host.querySelector('#r-news')?.focus();
    }
  });
}

export function renderRoster(el, p) {
  host = el;
  if (p.g && groupById(p.g)) st.gid = p.g;
  paintAll();
  bind();
}
