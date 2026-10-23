// 공연 단위 일괄 담기: 공연 정보 → setlist → 링크 여러 줄 → 행마다 확인 → 담기
import { html, isRealDate, debounce, fmtFull } from '../util.js';
import { GROUP_KEY } from '../model.js';
import {
  store, commit, groupById, songsOf, eventById, eventLabel, newEventId, newVideoId, newSongId,
} from './store.js';
import { extractYt, parseTitle, fetchOEmbed } from './parse.js';
import { memberChips, toggleMemberChip, songOptions, toast, paint, tagsToText, textToTags } from './ui.js';

const st = {
  gid: null, date: '', show: '', label: '', note: '', setlist: [], text: '', rows: [],
  defM: null, defS: null, prefillKey: null, newSong: '',
};
let host = null;
const paintSoon = debounce(() => paintTable(), 400);

function findEvent() {
  const show = st.show.trim(), label = st.label.trim();
  return store.data.events.find((e) => e.groupId === st.gid && e.date === st.date && (e.show || '').trim() === show && (e.label || '').trim() === label) || null;
}

function applyPrefill(p) {
  const key = `${p.g || ''}|${p.e || ''}|${p.m || ''}|${p.s || ''}`;
  if (key === st.prefillKey) return;
  st.prefillKey = key;
  const ev = p.e ? eventById(p.e) : null;
  const g = groupById(ev ? ev.groupId : p.g) || store.data.groups[0];
  if (!g) return;
  if (st.gid !== g.id) { st.gid = g.id; st.setlist = []; st.rows.forEach((r) => applyAuto(r)); }
  if (ev) {
    st.date = ev.date; st.show = ev.show; st.label = ev.label || ''; st.note = ev.note || '';
    st.setlist = [...(ev.setlist || [])];
  }
  st.defM = p.m && g.members.some((m) => m.id === p.m) ? p.m : null;
  st.defS = p.s && g.songs.some((s) => s.id === p.s) ? p.s : null;
  if (st.defS && !st.setlist.includes(st.defS)) st.setlist.push(st.defS);
}

// ---------- 행 ----------
function newRow(line) {
  const yt = extractYt(line);
  const r = {
    key: Math.random().toString(36).slice(2), line, id: yt ? yt.id : null, urlT: yt ? yt.t : null,
    title: '', channel: '', type: 'fancam', members: new Set(), songId: '', start: yt && yt.t != null ? String(yt.t) : '',
    source: '', tags: [], auto: new Set(), touched: new Set(), oembed: yt ? 'pending' : 'none', dateWarn: null,
  };
  applyAuto(r);
  if (yt) loadOEmbed(r);
  return r;
}

async function loadOEmbed(r) {
  const res = await fetchOEmbed(r.id);
  if (!st.rows.includes(r)) return;
  if (res.ok) {
    r.oembed = 'ok';
    if (!r.touched.has('title')) { r.title = res.title; r.auto.add('title'); }
    if (!r.touched.has('channel')) { r.channel = res.channel; r.auto.add('channel'); }
  } else {
    r.oembed = res.status === 401 || res.status === 404 ? 'gone' : 'fail';
  }
  applyAuto(r);
  paintTable();
}

// 제목 자동 해석으로 사람이 건드리지 않은 칸만 채운다
function applyAuto(r) {
  const g = groupById(st.gid);
  if (!g) return;
  const p = parseTitle(r.title, g, { channel: r.channel });
  const set = (f, v, isAuto = true) => {
    if (r.touched.has(f)) return;
    r[f] = v;
    if (isAuto) r.auto.add(f); else r.auto.delete(f);
  };
  if (p.type) set('type', p.type); else set('type', r.type || 'fancam', false);
  let mem = new Set();
  let memAuto = true;
  if (p.groupCam) mem.add(GROUP_KEY);
  else p.memberIds.forEach((id) => mem.add(id));
  if (!mem.size && st.defM) { mem.add(st.defM); memAuto = false; }
  if (r.type === 'full') mem = new Set();
  set('members', mem, memAuto && mem.size > 0);
  let song = p.songId && (!st.setlist.length || st.setlist.includes(p.songId)) ? p.songId : '';
  let songAuto = !!song;
  if (!song) { song = st.defS || (st.setlist.length === 1 ? st.setlist[0] : ''); songAuto = false; }
  set('songId', song, songAuto);
  if (p.source) set('source', p.source); else if (!r.touched.has('source') && !r.auto.has('source')) r.source = r.source || '';
  if (p.tags.length) set('tags', p.tags);
  r.dateWarn = p.date && st.date && p.date !== st.date ? p.date : null;
  if (p.date && !st.date) { st.date = p.date; st.dateAuto = true; }
}

function syncRows() {
  const lines = st.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const old = st.rows;
  st.rows = lines.map((line) => {
    const i = old.findIndex((r) => r.line === line);
    if (i >= 0) return old.splice(i, 1)[0];
    return newRow(line);
  });
}

function rowStatus(r, i) {
  if (!r.id) return { cls: 'err', text: '형식 오류', ok: false };
  const ex = store.data.videos.find((v) => v.ytId === r.id);
  if (ex) return { cls: 'warn', text: `이미 담음 · ${eventLabel(eventById(ex.eventId))}`, ok: false };
  if (st.rows.findIndex((x) => x.id === r.id) < i) return { cls: 'warn', text: '표 안에 같은 영상', ok: false };
  if (r.type === 'fancam' && !r.members.size) return { cls: 'warn', text: '멤버 또는 단체를 고르세요', ok: false };
  if (r.start !== '' && !/^\d+$/.test(r.start)) return { cls: 'warn', text: '시작 초는 숫자', ok: false };
  if (r.dateWarn) return { cls: 'warn', text: `준비됨 · 제목 날짜 ${r.dateWarn}`, ok: true };
  return { cls: 'ok', text: r.oembed === 'pending' ? '준비됨 · 제목 불러오는 중' : '준비됨', ok: true };
}

// ---------- 그리기 ----------
function eventStatus() {
  if (!st.gid) return html``;
  if (!isRealDate(st.date)) return html`<p class="hint warn">날짜를 YYYY-MM-DD로 넣으세요.</p>`;
  if (!st.show.trim()) return html`<p class="hint warn">행사명을 넣으세요.</p>`;
  const ev = findEvent();
  if (ev) {
    const n = store.data.videos.filter((v) => v.eventId === ev.id).length;
    return html`<p class="hint ok">같은 공연이 있어요: ${eventLabel(ev)} (영상 ${n}개). 이 공연에 추가돼요.</p>`;
  }
  const sameDay = store.data.events.filter((e) => e.groupId === st.gid && e.date === st.date);
  return html`<p class="hint">새 공연으로 만들어요 · ${fmtFull(st.date)}${sameDay.length ? html` · 같은 날 다른 공연: ${sameDay.map((e) => eventLabel(e)).join(', ')} (행사명·label이 다르면 다른 공연이에요)` : ''}</p>`;
}

function setlistHTML(g) {
  const songs = songsOf(g);
  return html`<div class="setlist" role="group" aria-label="이날 부른 곡 (누른 순서가 무대 순서)">
    ${st.setlist.map((id, i) => {
      const s = songs.find((x) => x.id === id);
      return html`<button type="button" class="chip" data-act="unset" data-v="${id}" aria-pressed="true" aria-label="${`${i + 1}번째 ${s ? s.title : id}, 빼기`}"><span class="no">${String(i + 1).padStart(2, '0')}</span>${s ? s.title : id} ×</button>`;
    })}
    ${songs.filter((s) => !st.setlist.includes(s.id)).map((s) => html`<button type="button" class="chip" data-act="set" data-v="${s.id}" aria-pressed="false">+ ${s.title}</button>`)}
  </div>
  <div class="kv" style="margin-top:8px"><label class="sr" for="b-newsong">새 곡 이름</label><input class="input" id="b-newsong" style="max-width:240px" placeholder="새 곡 이름" value="${st.newSong}"><button type="button" class="btn btn-sm" data-act="addSong">곡 추가</button></div>`;
}

function rowHTML(r, i, g) {
  const s = rowStatus(r, i);
  const a = (f) => (r.auto.has(f) ? 'auto' : '');
  const songOnly = st.setlist.length ? st.setlist : null;
  return html`<tr data-key="${r.key}">
    <td>${r.id ? html`<img class="bthumb" src="${`https://i.ytimg.com/vi/${r.id}/mqdefault.jpg`}" alt="" loading="lazy">` : html`<span class="hint err">${r.line.slice(0, 40)}</span>`}</td>
    <td style="min-width:220px"><input class="${a('title')}" data-f="title" data-row="${i}" value="${r.title}" placeholder="${r.oembed === 'pending' ? '불러오는 중…' : '유튜브 제목 직접 입력'}" aria-label="제목">
      <input class="${a('channel')}" data-f="channel" data-row="${i}" value="${r.channel}" placeholder="채널" aria-label="채널" style="margin-top:4px">
      ${r.oembed === 'fail' ? html`<div class="hint">제목을 못 불러왔어요. 직접 넣어 주세요.</div>` : r.oembed === 'gone' ? html`<div class="hint err">삭제·비공개 영상일 수 있어요.</div>` : ''}
      ${r.id ? html`<div class="hint">${r.id}${r.urlT != null ? ` · t=${r.urlT}` : ''}</div>` : ''}</td>
    <td><select class="${a('type')}" data-f="type" data-row="${i}" aria-label="종류"><option value="fancam" ${r.type === 'fancam' ? html`selected` : ''}>직캠</option><option value="full" ${r.type === 'full' ? html`selected` : ''}>풀캠</option></select></td>
    <td class="${a('members')}" style="border-radius:8px">${r.type === 'fancam' ? memberChips(g, r.members, { name: 'row', row: String(i) }) : html`<span class="hint">풀캠은 멤버 없음</span>`}</td>
    <td><select class="${a('songId')}" data-f="songId" data-row="${i}" aria-label="곡">${songOptions(g, r.songId, { only: songOnly })}</select></td>
    <td style="width:80px"><input class="${a('start')}" data-f="start" data-row="${i}" value="${r.start}" inputmode="numeric" placeholder="0" aria-label="곡 시작 초"></td>
    <td><select class="${a('source')}" data-f="source" data-row="${i}" aria-label="출처">
      <option value="" ${!r.source ? html`selected` : ''}>모름</option><option value="official" ${r.source === 'official' ? html`selected` : ''}>공식</option><option value="fan" ${r.source === 'fan' ? html`selected` : ''}>팬</option></select></td>
    <td style="min-width:120px"><input class="${a('tags')}" data-f="tags" data-row="${i}" value="${tagsToText(r.tags)}" placeholder="4K, 세로" aria-label="태그(쉼표로 구분)"></td>
    <td><span class="status ${s.cls}" data-status="${i}">${s.text}</span></td>
    <td><button type="button" class="btn btn-sm" data-act="dropRow" data-row="${i}" aria-label="이 줄 빼기">빼기</button></td>
  </tr>`;
}

function tableHTML(g) {
  if (!st.rows.length) return html`<p class="hint" id="b-table">링크를 붙여 넣으면 한 줄에 한 행씩 표가 생겨요.</p>`;
  const ready = st.rows.filter((r, i) => rowStatus(r, i).ok).length;
  return html`<div id="b-table">
    <div class="kv" style="justify-content:space-between;margin-top:12px"><span class="auto-legend"><i></i>자동으로 채운 값 (바꿀 수 있어요)</span><span class="hint">${st.rows.length}줄 중 준비됨 ${ready}</span></div>
    <div class="btable-wrap"><table class="btable">
      <thead><tr><th>미리보기</th><th>제목 · 채널</th><th>종류</th><th>멤버</th><th>곡</th><th>시작(초)</th><th>출처</th><th>태그</th><th>상태</th><th></th></tr></thead>
      <tbody>${st.rows.map((r, i) => rowHTML(r, i, g))}</tbody>
    </table></div>
    <div class="row-actions"><button type="button" class="btn btn-fill" data-act="commit" ${ready ? '' : html`disabled`}>준비된 ${ready}개 담기</button>
      <span class="hint">형식 오류·이미 담음·멤버 미선택 행은 담지 않아요.</span></div>
  </div>`;
}

function paintTable() {
  if (!host || !host.isConnected) return;
  const g = groupById(st.gid);
  const el = host.querySelector('#b-table');
  if (!el || !g) return;
  const active = document.activeElement;
  const sel = active && active.dataset && active.dataset.f ? `[data-f="${active.dataset.f}"][data-row="${active.dataset.row}"]` : null;
  const caret = sel && 'selectionStart' in active ? active.selectionStart : null;
  el.outerHTML = String(tableHTML(g));
  if (sel) {
    const n = host.querySelector(sel);
    if (n) { n.focus(); if (caret != null && n.setSelectionRange) try { n.setSelectionRange(caret, caret); } catch { /* select */ } }
  }
  const es = host.querySelector('#b-evstatus');
  if (es) es.innerHTML = String(eventStatus());
}

function paintAll() {
  const groups = store.data.groups;
  if (!groups.length) {
    paint(host, html`<div class="card"><h2>먼저 그룹을 만들어요</h2><p class="desc">담기 전에 그룹과 멤버, 곡이 있어야 해요.</p><a class="btn btn-fill" href="#tab=roster">그룹·멤버·곡 관리로</a></div>`);
    return;
  }
  const g = groupById(st.gid) || groups[0];
  st.gid = g.id;
  const shows = [...new Set(store.data.events.map((e) => e.show))].sort();
  paint(host, html`
    <section class="card" aria-labelledby="b-h1">
      <h2 id="b-h1">공연</h2>
      <p class="desc">그룹·날짜·행사·label이 같으면 같은 공연이에요. 같은 날 행사가 둘이면 label로 나눠요(예: 사전녹화).</p>
      <div class="form-grid">
        <label class="field"><span>그룹</span><select data-ev="gid">${groups.map((x) => html`<option value="${x.id}" ${x.id === g.id ? html`selected` : ''}>${x.name}</option>`)}</select></label>
        <label class="field"><span>날짜</span><input type="date" data-ev="date" value="${st.date}" class="${st.dateAuto ? 'auto' : ''}"></label>
        <label class="field"><span>행사</span><input data-ev="show" value="${st.show}" list="b-shows" placeholder="뮤직뱅크"><datalist id="b-shows">${shows.map((s) => html`<option value="${s}"></option>`)}</datalist></label>
        <label class="field"><span>label (선택)</span><input data-ev="label" value="${st.label}" placeholder="사전녹화, 2부…"></label>
        <label class="field wide"><span>의상 메모 (선택)</span><input data-ev="note" value="${st.note}" placeholder="아이보리 셋업"></label>
      </div>
      <div id="b-evstatus" style="margin-top:8px">${eventStatus()}</div>
      <h3>이날 부른 곡 <span class="hint">무대 순서대로 누르세요</span></h3>
      <div id="b-setlist">${setlistHTML(g)}</div>
      ${st.defM ? html`<p class="hint" style="margin-top:8px">“+ 담기”에서 넘어와 멤버 ${g.members.find((m) => m.id === st.defM)?.name}을(를) 기본으로 골라 둘게요.</p>` : ''}
    </section>
    <section class="card" aria-labelledby="b-h2">
      <h2 id="b-h2">유튜브 링크</h2>
      <p class="desc">한 줄에 하나씩 붙여 넣으세요. watch·youtu.be·shorts·embed·live 주소 모두 돼요. 제목·채널은 자동으로 불러오고, 안 되면 직접 넣으면 돼요.</p>
      <label class="sr" for="b-links">유튜브 링크 (한 줄에 하나)</label>
      <textarea class="input" id="b-links" rows="5" placeholder="https://youtu.be/…&#10;https://www.youtube.com/shorts/…">${st.text}</textarea>
      ${tableHTML(g)}
    </section>`);
}

// ---------- 동작 ----------
function bind() {
  const reparse = debounce(() => { syncRows(); paintTable(); }, 250);
  host.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'b-links') { st.text = t.value; reparse(); return; }
    if (t.id === 'b-newsong') { st.newSong = t.value; return; }
    if (t.dataset.ev && t.dataset.ev !== 'gid') {
      st[t.dataset.ev] = t.value;
      if (t.dataset.ev === 'date') { st.dateAuto = false; t.classList.remove('auto'); st.rows.forEach(applyAuto); }
      const es = host.querySelector('#b-evstatus');
      if (es) es.innerHTML = String(eventStatus());
      return;
    }
    if (t.dataset.f && t.tagName === 'INPUT') {
      const r = st.rows[+t.dataset.row];
      const f = t.dataset.f;
      r.touched.add(f); r.auto.delete(f); t.classList.remove('auto');
      if (f === 'tags') r.tags = textToTags(t.value); else r[f] = t.value.trim();
      if (f === 'title' || f === 'channel') { applyAuto(r); paintSoon(); }
      const s = host.querySelector(`[data-status="${t.dataset.row}"]`);
      if (s) { const x = rowStatus(r, +t.dataset.row); s.className = `status ${x.cls}`; s.textContent = x.text; }
    }
  });
  host.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.ev === 'gid') {
      st.gid = t.value; st.setlist = []; st.defM = null; st.defS = null;
      st.rows.forEach((r) => { r.touched.delete('members'); r.touched.delete('songId'); applyAuto(r); });
      paintAll();
      return;
    }
    if (t.dataset.f && t.tagName === 'SELECT') {
      const r = st.rows[+t.dataset.row];
      r.touched.add(t.dataset.f); r.auto.delete(t.dataset.f);
      r[t.dataset.f] = t.value;
      if (t.dataset.f === 'type' && t.value === 'full') r.members = new Set();
      paintTable();
    }
  });
  host.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip="row"]');
    if (chip) {
      const r = st.rows[+chip.dataset.row];
      toggleMemberChip(r.members, chip.dataset.v);
      r.touched.add('members'); r.auto.delete('members');
      paintTable();
      host.querySelector(`[data-chip="row"][data-row="${chip.dataset.row}"][data-v="${chip.dataset.v}"]`)?.focus();
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const g = groupById(st.gid);
    switch (b.dataset.act) {
      case 'set': st.setlist.push(b.dataset.v); refreshSetlist(); break;
      case 'unset': st.setlist = st.setlist.filter((x) => x !== b.dataset.v); refreshSetlist(); break;
      case 'addSong': {
        const title = st.newSong.trim();
        if (!title) { toast('곡 이름을 넣어 주세요.'); host.querySelector('#b-newsong')?.focus(); return; }
        let s = g.songs.find((x) => x.title === title);
        if (!s) {
          s = { id: newSongId(g), title, aliases: [], order: g.songs.length + 1, release: '' };
          g.songs.push(s);
          commit();
          toast(`${g.name}에 새 곡 “${title}”을 추가했어요.`);
        }
        if (!st.setlist.includes(s.id)) st.setlist.push(s.id);
        st.newSong = '';
        refreshSetlist();
        break;
      }
      case 'dropRow': {
        const r = st.rows[+b.dataset.row];
        st.text = st.text.split(/\r?\n/).filter((l) => l.trim() !== r.line).join('\n');
        host.querySelector('#b-links').value = st.text;
        syncRows(); paintTable();
        break;
      }
      case 'commit': doCommit(); break;
      default:
    }
  });
}

function refreshSetlist() {
  const g = groupById(st.gid);
  host.querySelector('#b-setlist').innerHTML = String(setlistHTML(g));
  st.rows.forEach((r) => applyAuto(r));
  paintTable();
}

function doCommit() {
  const g = groupById(st.gid);
  if (!isRealDate(st.date)) { toast('공연 날짜를 먼저 넣어 주세요.'); host.querySelector('[data-ev="date"]').focus(); return; }
  if (!st.show.trim()) { toast('행사명을 먼저 넣어 주세요.'); host.querySelector('[data-ev="show"]').focus(); return; }
  const ready = st.rows.filter((r, i) => rowStatus(r, i).ok);
  if (!ready.length) return;
  let ev = findEvent();
  if (!ev) {
    ev = { id: newEventId(), groupId: g.id, date: st.date, show: st.show.trim(), label: st.label.trim(), setlist: [...st.setlist], note: st.note.trim() };
    store.data.events.push(ev);
  } else {
    if (st.setlist.length) ev.setlist = [...st.setlist];
    if (st.note.trim()) ev.note = st.note.trim();
  }
  for (const r of ready) {
    const isGroup = r.members.has(GROUP_KEY);
    store.data.videos.push({
      id: newVideoId(), ytId: r.id, eventId: ev.id,
      songs: r.songId ? [{ songId: r.songId, t: r.start === '' ? 0 : +r.start }] : [],
      type: r.type, memberIds: r.type === 'fancam' && !isGroup ? [...r.members].sort((a, b) => (g.members.find((m) => m.id === a)?.order ?? 0) - (g.members.find((m) => m.id === b)?.order ?? 0)) : [],
      source: r.source || null, tags: r.tags, title: r.title, channel: r.channel, pin: false, gone: false,
    });
  }
  commit(ready.length);
  const done = new Set(ready.map((r) => r.line));
  st.text = st.text.split(/\r?\n/).filter((l) => !done.has(l.trim())).join('\n');
  syncRows();
  paintAll();
  toast(`${eventLabel(ev)}에 영상 ${ready.length}개를 담았어요.`);
}

export function renderBulk(el, p) {
  host = el;
  applyPrefill(p);
  if (!st.gid && store.data.groups[0]) st.gid = store.data.groups[0].id;
  paintAll();
  bind();
}
