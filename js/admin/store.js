// 관리 화면 작업 상태: 데이터 사본 + 임시 저장(localStorage JSON, IndexedDB 파일)
import { emptyData, DATA_VERSION } from '../model.js';
import { DATA_URL } from '../data.js';

const DRAFT_KEY = 'sd.draft';
const DB_NAME = 'sd-admin';

export const store = {
  data: emptyData(),
  changes: 0,
  files: new Map(), // path → Blob (아직 저장소에 쓰지 않은 이미지·움짤)
  loadNote: '',
  baseOk: true,
};
const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

// ---------- IndexedDB ----------
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('files'); r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(storeName, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(storeName, mode);
    const st = t.objectStore(storeName);
    const out = fn(st);
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
export const kvGet = (k) => tx('kv', 'readonly', (s) => s.get(k));
export const kvSet = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k));
export const kvDel = (k) => tx('kv', 'readwrite', (s) => s.delete(k));

async function loadFiles() {
  try {
    const d = await db();
    await new Promise((res, rej) => {
      const t = d.transaction('files', 'readonly');
      const req = t.objectStore('files').openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) { store.files.set(c.key, c.value); c.continue(); } else res();
      };
      req.onerror = () => rej(req.error);
    });
  } catch { /* IndexedDB를 못 쓰면 이번 세션 메모리에만 둔다 */ }
}

export async function putFile(path, blob) {
  store.files.set(path, blob);
  revoke(path);
  try { await tx('files', 'readwrite', (s) => s.put(blob, path)); } catch { /* 메모리에만 */ }
  emit();
}
export async function removeFile(path) {
  store.files.delete(path);
  revoke(path);
  try { await tx('files', 'readwrite', (s) => s.delete(path)); } catch { /* 없음 */ }
  emit();
}
export async function clearFiles() {
  for (const p of [...store.files.keys()]) revoke(p);
  store.files.clear();
  try { await tx('files', 'readwrite', (s) => s.clear()); } catch { /* 없음 */ }
  emit();
}

// 저장 전 파일은 blob URL로, 나머지는 경로 그대로
const urls = new Map();
function revoke(p) { if (urls.has(p)) { URL.revokeObjectURL(urls.get(p)); urls.delete(p); } }
export function fileURL(path) {
  if (!path) return '';
  if (store.files.has(path)) {
    if (!urls.has(path)) urls.set(path, URL.createObjectURL(store.files.get(path)));
    return urls.get(path);
  }
  return path;
}

// ---------- 데이터 ----------
export async function initStore() {
  let base = null;
  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (res.ok) base = await res.json();
    else store.loadNote = `data/videos.json을 읽지 못했어요(${res.status}). 빈 목록에서 시작해요.`;
  } catch (e) {
    store.loadNote = location.protocol === 'file:'
      ? 'file://로 열어서 data/videos.json을 읽지 못했어요. python3 -m http.server로 연 뒤 다시 오세요.'
      : `data/videos.json을 읽지 못했어요(${e.message}). 빈 목록에서 시작해요.`;
  }
  if (base && base.version !== DATA_VERSION) {
    store.loadNote = `data/videos.json이 version ${base.version} 형식이에요. 가져오기 탭에서 변환할 수 있어요.`;
    store.baseRaw = base;
    base = null;
  }
  store.baseOk = !!base;
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { draft = null; }
  if (draft && draft.data && draft.data.version === DATA_VERSION && draft.changes > 0) {
    store.data = draft.data;
    store.changes = draft.changes;
    store.restored = true;
  } else {
    store.data = base || emptyData();
  }
  for (const k of ['groups', 'events', 'videos', 'clips']) if (!Array.isArray(store.data[k])) store.data[k] = [];
  await loadFiles();
}

function saveDraft() {
  try {
    if (store.changes > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: store.data, changes: store.changes, at: Date.now() }));
    else localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    store.draftError = '임시 저장 공간이 부족해요. 지금 저장하거나 내보내 주세요.';
  }
}

export function commit(n = 1) {
  store.changes += n;
  saveDraft();
  emit();
}
export function resetChanges() {
  store.changes = 0;
  saveDraft();
  emit();
}
export async function discardDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* 없음 */ }
  await clearFiles();
  location.reload();
}
export function replaceData(d) {
  store.data = d;
  commit(1);
}

// 영문·숫자만 쓰는 새 id. prefix 뒤 숫자 최댓값 + 1
export function nextId(prefix, ids) {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const id of ids) { const m = re.exec(id); if (m) max = Math.max(max, +m[1]); }
  return `${prefix}${max + 1}`;
}
export const newGroupId = () => nextId('g', store.data.groups.map((g) => g.id));
export const newMemberId = (g) => nextId(`${g.id}m`, store.data.groups.flatMap((x) => x.members.map((m) => m.id)));
export const newSongId = (g) => nextId(`${g.id}s`, store.data.groups.flatMap((x) => x.songs.map((s) => s.id)));
export const newEventId = () => nextId('e', store.data.events.map((e) => e.id));
export const newVideoId = () => nextId('v', store.data.videos.map((v) => v.id));
export const newClipId = () => nextId('c', store.data.clips.map((c) => c.id));

// 조회 도우미
export const groupById = (id) => store.data.groups.find((g) => g.id === id);
export const eventById = (id) => store.data.events.find((e) => e.id === id);
export const videoById = (id) => store.data.videos.find((v) => v.id === id);
export const clipById = (id) => store.data.clips.find((c) => c.id === id);
export const memberById = (id) => { for (const g of store.data.groups) { const m = g.members.find((x) => x.id === id); if (m) return m; } return null; };
export const songById = (id) => { for (const g of store.data.groups) { const s = g.songs.find((x) => x.id === id); if (s) return s; } return null; };
export const membersOf = (g) => [...(g?.members || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
export const songsOf = (g) => [...(g?.songs || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
export const eventsOf = (gid) => store.data.events.filter((e) => e.groupId === gid).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
export function eventLabel(e) {
  if (!e) return '';
  return `${e.date} ${e.show}${e.label ? ` ${e.label}` : ''}`;
}
