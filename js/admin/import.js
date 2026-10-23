// 가져오기: JSON 붙여넣기·파일 → (version 1·2면 3으로 변환) → 검증 → 확인 후 현재 목록 바꾸기
import { html } from '../util.js';
import { syntaxPos } from '../data.js';
import { validateData } from '../validate-core.js';
import { migrate, needsMigration } from '../migrate.js';
import { store, replaceData } from './store.js';
import { paint, toast } from './ui.js';

const st = { text: '', result: null };
let host = null;

function check() {
  const text = st.text.trim();
  if (!text) { st.result = null; return; }
  let data;
  try { data = JSON.parse(text); } catch (e) {
    const p = syntaxPos(text, e.message);
    st.result = { error: `JSON 문법 오류${p.line ? ` (${p.line}번째 줄 ${p.col}번째 글자)` : ''}: ${e.message}` };
    return;
  }
  const from = data && data.version;
  const migrated = needsMigration(data);
  if (migrated) data = migrate(data);
  const errors = validateData(data);
  st.result = { data, from, migrated, errors };
}

function resultHTML() {
  const r = st.result;
  if (!r) return '';
  if (r.error) return html`<p class="notice err" role="alert">${r.error}</p>`;
  const d = r.data;
  return html`<div class="notice ${r.errors.length ? 'warn' : ''}" role="status">
    ${r.migrated ? html`<p>version ${r.from ?? '(없음)'} 형식을 version 3으로 바꿨어요. 무대는 공연과 곡으로 나누고, rehearsal은 “리허설” 태그로, memberId는 memberIds로 옮겼어요.</p>` : ''}
    <p>그룹 ${d.groups.length} · 공연 ${d.events.length} · 영상 ${d.videos.length} · 움짤 ${d.clips.length}</p>
    ${r.errors.length ? html`<p><b>검증 오류 ${r.errors.length}개</b> — 바꿀 수는 있지만 저장 전에 고쳐야 해요.</p><div class="errlist">${r.errors.slice(0, 40).map((e) => html`<div>${e.text}</div>`)}</div>` : html`<p class="hint ok">검증 통과</p>`}
    <div class="row-actions"><button type="button" class="btn btn-fill" data-act="replace">현재 목록을 이것으로 바꾸기</button>
      <span class="hint">지금 목록(영상 ${store.data.videos.length}개)은 사라져요. 필요하면 먼저 저장 탭에서 내보내세요.</span></div>
  </div>`;
}

function paintAll() {
  paint(host, html`<section class="card" aria-labelledby="i-h"><h2 id="i-h">가져오기</h2>
    <p class="desc">videos.json 내용을 붙여 넣거나 파일을 올리세요. 검사한 뒤 확인을 받아 현재 목록을 바꿔요. version 1·2 형식은 version 3으로 바꿔 줘요.</p>
    ${store.baseRaw ? html`<p class="notice warn">저장소의 data/videos.json이 version ${store.baseRaw.version} 형식이에요. <button type="button" class="linkbtn" data-act="useBase">그 파일을 불러와 변환하기</button></p>` : ''}
    <label class="btn" style="margin-bottom:10px"><input type="file" id="i-file" class="sr" accept=".json,application/json">JSON 파일 고르기</label>
    <label class="sr" for="i-text">JSON 붙여넣기</label>
    <textarea class="input" id="i-text" rows="10" placeholder='{"version": 3, "groups": [...]}'>${st.text}</textarea>
    <div class="row-actions"><button type="button" class="btn" data-act="check">검사</button></div>
    <div id="i-result">${resultHTML()}</div>
  </section>`);
}

function bind() {
  host.addEventListener('input', (e) => { if (e.target.id === 'i-text') st.text = e.target.value; });
  host.addEventListener('change', async (e) => {
    if (e.target.id === 'i-file' && e.target.files[0]) {
      st.text = await e.target.files[0].text();
      check(); paintAll();
    }
  });
  host.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'check') { check(); host.querySelector('#i-result').innerHTML = String(resultHTML()); host.querySelector('#i-result [data-act="replace"]')?.focus(); }
    if (b.dataset.act === 'useBase') { st.text = JSON.stringify(store.baseRaw, null, 2); check(); paintAll(); }
    if (b.dataset.act === 'replace') {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 바꿔요'; b.classList.add('btn-danger', 'armed'); return; }
      replaceData(st.result.data);
      store.loadNote = '';
      st.text = ''; st.result = null;
      toast('목록을 바꿨어요. 저장 탭에서 저장하세요.');
      paintAll();
    }
  });
}

export function renderImport(el) {
  host = el;
  paintAll();
  bind();
}
