// 무대 서랍 관리 화면: 썸네일·수정·날짜 없는 영상·그룹 관리·움짤·저장(가져오기 포함)
// 영상 담기는 Claude에게 말로 부탁해요(CLAUDE.md). 공연 단위 담기 탭은 없앴어요.
import { html } from './js/util.js';
import { themeButton, applyAccent } from './js/theme.js';
import { store, initStore, onChange, discardDraft, groupById } from './js/admin/store.js';
import { renderEdit } from './js/admin/edit.js';
import { renderRoster } from './js/admin/roster.js';
import { renderThumbs, refreshThumbSaveHint } from './js/admin/thumbs.js';
import { renderClips } from './js/admin/clips.js';
import { renderSave } from './js/admin/save.js';
import { renderPick } from './js/admin/pick.js';

const TABS = [
  ['thumbs', '썸네일', renderThumbs],
  ['edit', '영상·공연 수정', renderEdit],
  ['pick', '날짜 없는 영상', renderPick],
  ['roster', '그룹·멤버·곡', renderRoster],
  ['clips', '움짤 담기', renderClips],
  ['save', '저장', renderSave],
];
// 예전 주소(#tab=bulk·#tab=import, 보기 화면의 "+ 담기")는 가까운 탭으로
const ALIAS = { bulk: 'thumbs', import: 'save' };
const main = document.getElementById('main');
const tabsEl = document.getElementById('adm-tabs');

export function parseAdminHash() {
  const o = {};
  for (const part of location.hash.replace(/^#/, '').split('&')) {
    const [k, v] = part.split('=');
    if (k && v && /^[A-Za-z0-9]+$/.test(v)) o[k] = v;
  }
  return o;
}

let curTab = null;
let curKey = null;
function render(force = false) {
  const p = parseAdminHash();
  const want = ALIAS[p.tab] || p.tab;
  const tab = TABS.some(([k]) => k === want) ? want : 'thumbs';
  const key = location.hash;
  if (!force && key === curKey) return;
  curKey = key;
  tabsEl.innerHTML = String(html`${TABS.map(([k, t]) => html`<a class="tab" href="${`#tab=${k}`}" ${k === tab ? html`aria-current="page"` : ''}>${t}${k === 'save' && store.changes ? html` <span class="cnt">${store.changes}</span>` : ''}</a>`)}`);
  const g = groupById(p.g) || store.data.groups[0];
  applyAccent(g ? g.hue : 200);
  const host = document.createElement('div');
  main.replaceChildren(host);
  if (curTab !== tab) scrollTo(0, 0);
  curTab = tab;
  const notes = [];
  if (store.loadNote) notes.push(html`<p class="notice warn">${store.loadNote}</p>`);
  if (store.restored) notes.push(html`<p class="notice">임시 저장한 변경 ${store.changes}개를 이어서 불러왔어요. <button type="button" class="linkbtn" id="discard">임시 저장 버리기</button></p>`);
  if (store.draftError) notes.push(html`<p class="notice err">${store.draftError}</p>`);
  if (notes.length) {
    const n = document.createElement('div');
    n.style.cssText = 'display:grid;gap:8px;margin-bottom:14px';
    n.innerHTML = String(html`${notes}`);
    main.prepend(n);
    n.querySelector('#discard')?.addEventListener('click', (e) => {
      const b = e.currentTarget;
      if (b.dataset.armed) discardDraft();
      else { b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 버려요'; }
    });
  }
  const fn = TABS.find(([k]) => k === tab)[2];
  fn(host, p);
  document.title = `${TABS.find(([k]) => k === tab)[1]} · 관리 · 무대 서랍`;
}

function updateCount() {
  document.getElementById('save-count').textContent = String(store.changes);
  const t = tabsEl.querySelector('a[href="#tab=save"]');
  if (t) t.innerHTML = String(html`저장${store.changes ? html` <span class="cnt">${store.changes}</span>` : ''}`);
}

async function start() {
  themeButton(document.getElementById('theme-btn'), () => applyAccent(groupById(parseAdminHash().g)?.hue ?? store.data.groups[0]?.hue));
  await initStore();
  onChange(updateCount);
  onChange(refreshThumbSaveHint);
  updateCount();
  window.addEventListener('hashchange', () => render());
  window.addEventListener('beforeunload', (e) => {
    if (store.changes > 0) { e.preventDefault(); e.returnValue = ''; }
  });
  render(true);
}

export const rerender = () => render(true);
start();
