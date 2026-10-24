// 영상 고르기: 제목에 날짜가 없는 영상(data/pending.json)마다 공연 후보를 고르고, 고른 결과를 JSON으로 복사해 채팅에 넘긴다
import { html } from '../util.js';
import { store, groupById, eventById, eventLabel } from './store.js';
import { paint, toast } from './ui.js';

const KEY = 'sd.pick.v1';
const st = { items: null, error: '', picks: {}, gid: '', onlyOpen: false, out: '' };
let host = null;

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(st.picks)); } catch (e) { /* 저장 못 해도 동작은 같다 */ } }

async function fetchItems() {
  try {
    const res = await fetch('data/pending.json', { cache: 'no-cache' });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).items || [];
  } catch (e) {
    st.error = `data/pending.json을 읽지 못했어요: ${e.message}`;
    return [];
  }
}

// 이미 담긴 영상은 목록에서 뺀다
const left = () => {
  const have = new Set(store.data.videos.map((v) => v.ytId));
  return (st.items || []).filter((it) => !have.has(it.id));
};
const isDone = (id) => !!st.picks[id];

function rowHTML(it, n) {
  const p = st.picks[it.id] || null;
  const g = groupById(it.g);
  const cands = it.c.map((eid) => eventById(eid)).filter(Boolean);
  const radio = (val, label, extra = '') => html`<label class="pk-opt"><input type="radio" name="${`pk-${it.id}`}" value="${val}" ${p && p.v === val ? html`checked` : ''}><span>${label}</span></label>${extra}`;
  return html`<article class="pk-row ${p ? 'is-done' : ''}" data-id="${it.id}">
    <a class="pk-thumb" href="${`https://www.youtube.com/watch?v=${it.id}`}" target="_blank" rel="noopener noreferrer" aria-label="새 탭에서 영상 보기"><img src="${`https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`}" alt="" loading="lazy" width="160" height="90"></a>
    <div class="pk-body">
      <p class="pk-title"><b>${n}</b> ${g ? g.name : ''} · ${it.title}</p>
      <p class="hint">${it.ch} · 올린 날 ${it.up}${it.views != null ? ` · 조회수 ${it.views.toLocaleString('ko-KR')}` : ''}</p>
      <div class="pk-opts" role="radiogroup" aria-label="공연 고르기">
        ${cands.map((e) => radio(e.id, eventLabel(e)))}
        ${radio('new', '새 공연', html`<span class="pk-new" ${p && p.v === 'new' ? '' : html`hidden`}><input class="input" type="date" data-f="date" value="${p && p.date || ''}" aria-label="공연 날짜"><input class="input" type="text" data-f="show" placeholder="행사 이름" value="${p && p.show || ''}" aria-label="행사 이름"></span>`)}
        ${radio('skip', '담지 않기')}
      </div>
    </div>
  </article>`;
}

function paintAll() {
  const all = left();
  const groups = [...new Set(all.map((it) => it.g))].map(groupById).filter(Boolean);
  let rows = all.filter((it) => !st.gid || it.g === st.gid);
  if (st.onlyOpen) rows = rows.filter((it) => !isDone(it.id));
  const done = all.filter((it) => isDone(it.id)).length;
  paint(host, html`<section class="card" aria-labelledby="pk-h"><h2 id="pk-h">영상 고르기</h2>
    <p class="desc">제목에 날짜가 없는 영상이에요. 올린 날 근처의 공연 후보 중에서 고르거나 새 공연을 만들거나 담지 않기를 고르세요. 다 고르면 아래 “선택 JSON 만들기”를 눌러 결과를 복사해서 채팅에 붙여 넣으세요. 고르지 않은 영상은 담지 않아요.</p>
    ${st.error ? html`<p class="notice err" role="alert">${st.error}</p>` : ''}
    ${all.length ? html`<div class="row-actions">
      <label class="field" style="max-width:220px"><span>그룹</span><select class="input" id="pk-g"><option value="">전체 (${all.length}개)</option>${groups.map((g) => html`<option value="${g.id}" ${st.gid === g.id ? html`selected` : ''}>${g.name} (${all.filter((it) => it.g === g.id).length}개)</option>`)}</select></label>
      <label class="pk-opt"><input type="checkbox" id="pk-open" ${st.onlyOpen ? html`checked` : ''}><span>고르지 않은 것만 보기</span></label>
      <span class="hint">고른 것 ${done} / ${all.length}</span>
    </div>` : html`<p class="notice">고를 영상이 없어요. 모두 담았거나 data/pending.json이 비어 있어요.</p>`}
    <div class="pk-list">${rows.map((it) => rowHTML(it, all.indexOf(it) + 1))}</div>
    ${all.length ? html`<div class="pk-bar"><button type="button" class="btn btn-fill" data-act="make">선택 JSON 만들기</button>
      <button type="button" class="btn" data-act="copy" ${st.out ? '' : html`disabled`}>복사</button>
      <button type="button" class="btn btn-danger" data-act="reset">선택 모두 지우기</button></div>
      <label class="sr" for="pk-out">선택 JSON</label>
      <textarea class="input" id="pk-out" rows="6" readonly placeholder="“선택 JSON 만들기”를 누르면 여기에 나와요">${st.out}</textarea>` : ''}
  </section>`);
}

function makeJSON() {
  const all = left();
  const picks = {};
  for (const it of all) {
    const p = st.picks[it.id];
    if (!p) continue;
    if (p.v === 'skip') picks[it.id] = 'skip';
    else if (p.v === 'new') { if (p.date && p.show) picks[it.id] = { date: p.date, show: p.show.trim() }; }
    else picks[it.id] = p.v;
  }
  const n = Object.keys(picks).length;
  st.out = JSON.stringify({ pick: 1, picks });
  return n;
}

function bind() {
  host.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'pk-g') { st.gid = t.value; paintAll(); return; }
    if (t.id === 'pk-open') { st.onlyOpen = t.checked; paintAll(); return; }
    if (t.type === 'radio') {
      const id = t.name.slice(3);
      const prev = st.picks[id];
      st.picks[id] = { v: t.value, date: prev?.date || '', show: prev?.show || '' };
      save();
      const row = t.closest('.pk-row');
      row.classList.add('is-done');
      row.querySelector('.pk-new').hidden = t.value !== 'new';
    }
  });
  host.addEventListener('input', (e) => {
    const t = e.target;
    const f = t.dataset.f;
    if (!f) return;
    const id = t.closest('.pk-row').dataset.id;
    st.picks[id] = { ...(st.picks[id] || { v: 'new' }), [f]: t.value };
    save();
  });
  host.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'make') {
      const n = makeJSON();
      paintAll();
      toast(n ? `${n}개를 JSON으로 만들었어요. 복사해서 채팅에 붙여 넣으세요.` : '아직 고른 영상이 없어요.');
    }
    if (b.dataset.act === 'copy') {
      const ta = host.querySelector('#pk-out');
      try { await navigator.clipboard.writeText(st.out); toast('복사했어요.'); } catch (err) { ta.select(); toast('복사하지 못했어요. 선택된 글자를 직접 복사하세요.'); }
    }
    if (b.dataset.act === 'reset') {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 지워요'; return; }
      st.picks = {}; st.out = ''; save(); paintAll();
    }
  });
}

export async function renderPick(el) {
  host = el;
  paint(host, html`<p class="loading">불러오는 중이에요</p>`);
  if (!st.items) { st.items = await fetchItems(); st.picks = load(); }
  paintAll();
  bind();
}
