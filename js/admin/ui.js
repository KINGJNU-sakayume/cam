// 관리 화면 공용 조각
import { html } from '../util.js';
import { DEFAULT_COLORS, GROUP_KEY } from '../model.js';
import { membersOf, songsOf } from './store.js';

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

export function paint(el, tpl) { el.innerHTML = String(tpl); }

// 멤버 칩(복수 선택). selected: Set of memberId 또는 GROUP_KEY
export function memberChips(group, selected, { name = 'm', withGroup = true, row = '' } = {}) {
  return html`<div class="mchips" role="group" aria-label="멤버">${membersOf(group).map((m) => html`<button type="button" class="chip" data-chip="${name}" data-row="${row}" data-v="${m.id}" aria-pressed="${String(selected.has(m.id))}"><span class="dot" style="${`background:${m.color || DEFAULT_COLORS[0]}`}"></span>${m.name}${m.active === false ? '(종료)' : ''}</button>`)}
    ${withGroup ? html`<button type="button" class="chip" data-chip="${name}" data-row="${row}" data-v="${GROUP_KEY}" aria-pressed="${String(selected.has(GROUP_KEY))}"><span class="dot ring"></span>단체</button>` : ''}</div>`;
}

// 멤버 칩 토글: 단체와 멤버는 함께 고를 수 없다
export function toggleMemberChip(set, v) {
  if (set.has(v)) { set.delete(v); return; }
  if (v === GROUP_KEY) set.clear();
  else set.delete(GROUP_KEY);
  set.add(v);
}

export function songOptions(group, selected, { none = '곡 구분 없음(전체 공연)', only = null } = {}) {
  const songs = songsOf(group).filter((s) => !only || only.includes(s.id));
  return html`<option value="" ${!selected ? html`selected` : ''}>${none}</option>${songs.map((s) => html`<option value="${s.id}" ${selected === s.id ? html`selected` : ''}>${s.title}</option>`)}`;
}

// 두 번 눌러야 확정되는 삭제
export function armDelete(btn, fn) {
  if (btn.classList.contains('armed')) { btn.classList.remove('armed'); fn(); return; }
  const orig = btn.textContent;
  btn.classList.add('armed');
  btn.textContent = '한 번 더 누르면 삭제';
  setTimeout(() => { if (btn.isConnected && btn.classList.contains('armed')) { btn.classList.remove('armed'); btn.textContent = orig; } }, 4000);
}

export function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export const tagsToText = (tags) => (tags || []).join(', ');
export const textToTags = (s) => [...new Set(String(s || '').split(/[,，]/).map((x) => x.trim()).filter(Boolean))];

// 정렬 가능한 목록: 드래그 + 위/아래 버튼. onMove(from, to)
export function bindSortable(listEl, onMove) {
  let dragIdx = null;
  listEl.addEventListener('dragstart', (e) => {
    const li = e.target.closest('[data-idx]');
    if (!li) return;
    dragIdx = +li.dataset.idx;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragIdx));
  });
  listEl.addEventListener('dragend', (e) => { e.target.closest('[data-idx]')?.classList.remove('dragging'); });
  listEl.addEventListener('dragover', (e) => {
    const li = e.target.closest('[data-idx]');
    if (!li || dragIdx == null) return;
    e.preventDefault();
    listEl.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
    li.classList.add('drop');
  });
  listEl.addEventListener('drop', (e) => {
    const li = e.target.closest('[data-idx]');
    if (!li || dragIdx == null) return;
    e.preventDefault();
    const to = +li.dataset.idx;
    const from = dragIdx;
    dragIdx = null;
    if (from !== to) onMove(from, to);
  });
  listEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-move]');
    if (!b) return;
    const i = +b.closest('[data-idx]').dataset.idx;
    const to = b.dataset.move === 'up' ? i - 1 : i + 1;
    onMove(i, to, b.dataset.move);
  });
}

export function moveItem(arr, from, to) {
  if (to < 0 || to >= arr.length) return false;
  const [x] = arr.splice(from, 1);
  arr.splice(to, 0, x);
  return true;
}

export const ICON = {
  up: html`<svg class="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15l7-7 7 7"/></svg>`,
  down: html`<svg class="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>`,
  grip: html`<svg class="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3"/></svg>`,
};
