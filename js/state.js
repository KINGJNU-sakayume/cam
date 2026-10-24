// 보기 화면 공용 상태와 필터 판정
import { toHash, baseOf } from './router.js';
import { GROUP_KEY, NOSONG } from './model.js';

export const app = {
  ix: null,
  state: {},
  query: '',
  filters: new Map(), // gid → { songs, members, types, tags }
  rowSong: new Map(), // eventId → 곡 키 (라인업 행에서 고른 곡)
  songsOpen: false, // 필터의 "곡 N개 더" 펼침
  prefs: { sort: 'desc', showEmpty: false, songSort: 'order', bySong: false, autoNext: true },
  mobile: false,
  layout: 'compact', // rail(1500px 이상, 왼쪽 고정 패널) | compact(도구 막대 + 서랍) | mobile
  railOpen: false, // 좁은 창의 서랍
  reduced: false,
  stress: false,
};

const PREF_KEY = 'sd.prefs';
const FILTER_KEY = 'sd.filters';

export function loadPrefs() {
  try {
    Object.assign(app.prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}'));
  } catch { /* 기본값 사용 */ }
  try {
    const raw = JSON.parse(sessionStorage.getItem(FILTER_KEY) || '{}');
    for (const [gid, f] of Object.entries(raw)) {
      app.filters.set(gid, { songs: new Set(f.songs), members: new Set(f.members), types: new Set(f.types), tags: new Set(f.tags) });
    }
  } catch { /* 없음 */ }
}
export function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(app.prefs)); } catch { /* 저장 불가 */ }
}
export function saveFilters() {
  const o = {};
  for (const [gid, f] of app.filters) o[gid] = { songs: [...f.songs], members: [...f.members], types: [...f.types], tags: [...f.tags] };
  try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(o)); } catch { /* 저장 불가 */ }
}

export function filtersOf(gid) {
  if (!app.filters.has(gid)) app.filters.set(gid, { songs: new Set(), members: new Set(), types: new Set(), tags: new Set() });
  return app.filters.get(gid);
}
export const NO_FILTER = Object.freeze({ songs: new Set(), members: new Set(), types: new Set(), tags: new Set() });
export const filterCount = (f) => f.songs.size + f.members.size + f.types.size + f.tags.size;

// 같은 종류 안에서는 OR, 종류끼리는 AND. 멤버 칩은 직캠에만 적용하고 풀캠은 그대로 둔다.
export function matchVideo(v, f) {
  if (f.types.size && !f.types.has(v.type)) return false;
  if (f.songs.size && !(v.songs || []).some((s) => f.songs.has(s.songId))) return false;
  if (f.members.size && v.type === 'fancam') {
    if (!v.memberIds.length) { if (!f.members.has(GROUP_KEY)) return false; }
    else if (!v.memberIds.some((m) => f.members.has(m))) return false;
  }
  if (f.tags.size && !(v.tags || []).some((t) => f.tags.has(t))) return false;
  return true;
}
export function matchClip(C, f) {
  if (f.songs.size && !f.songs.has(C.songId)) return false;
  if (f.members.size && C.key !== 'full') {
    if (!C.memberIds.length) { if (!f.members.has(GROUP_KEY)) return false; }
    else if (!C.memberIds.some((m) => f.members.has(m))) return false;
  }
  if (f.types.size && C.video && !f.types.has(C.video.type)) return false;
  if (f.tags.size && !(C.video && (C.video.tags || []).some((t) => f.tags.has(t)))) return false;
  return true;
}

// 필터를 거친 공연 단면: 곡 키 → { full, cells(Map), clips }
export function filteredSection(S, f) {
  const full = S.full.filter((v) => matchVideo(v, f));
  const cells = new Map();
  for (const [k, list] of S.cells) {
    const l = list.filter((v) => matchVideo(v, f));
    if (l.length) cells.set(k, l);
  }
  const clips = S.clips.filter((C) => matchClip(C, f));
  return { key: S.key, songId: S.songId, full, cells, clips, count: full.length + [...cells.values()].reduce((a, l) => a + l.length, 0) };
}

// 공연에서 보여 줄 곡 키 목록(필터 반영)
export function visibleSongKeys(E, f, forceSong) {
  let keys = E.sectionKeys;
  if (forceSong) keys = keys.filter((k) => k === forceSong);
  else if (f.songs.size) keys = keys.filter((k) => k !== NOSONG && f.songs.has(k));
  if (filterCount(f) || forceSong) {
    keys = keys.filter((k) => {
      const S = E.sections.get(k);
      if (!S) return false;
      const fs = filteredSection(S, f);
      return fs.count > 0 || fs.clips.length > 0;
    });
  }
  return keys;
}

export function playHref(v, songKey, t) {
  const base = baseOf(app.state);
  return toHash({ ...base, play: v.id, ps: songKey || undefined, pt: t != null ? Math.floor(t) : undefined });
}
export function clipHref(id) {
  return toHash({ ...baseOf(app.state), clip: id });
}
export function adminHref({ g, e, m, s } = {}) {
  const parts = [];
  if (g) parts.push(`g=${g}`);
  if (e) parts.push(`e=${e}`);
  if (m) parts.push(`m=${m}`);
  if (s) parts.push(`s=${s}`);
  return `admin.html${parts.length ? `#${parts.join('&')}` : ''}`;
}

export function sortEvents(list) {
  return app.prefs.sort === 'asc' ? list : [...list].reverse();
}
