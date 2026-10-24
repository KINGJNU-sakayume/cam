// 로드할 때 한 번 만드는 색인: 공연 → 곡 → 칸, 멤버·곡별 목록, 검색용 문자열
import { norm, dateForms, parseDate } from './util.js';
import {
  GROUP_KEY, NOSONG, cellKey, repCompare, eventSongOrder, sortedMembers, sortedSongs, memberColor, stripColor,
} from './model.js';

export function buildIndex(data) {
  const ix = {
    data,
    groups: data.groups,
    group: new Map(), member: new Map(), song: new Map(), event: new Map(), video: new Map(), clip: new Map(),
    eventsByGroup: new Map(), // gid → E[] (날짜 오름차순)
    groupStats: new Map(),
    E: new Map(), // eventId → E
    C: new Map(), // clipId → C
    clipsByVideo: new Map(),
    searchItems: [],
  };

  for (const g of data.groups) {
    ix.group.set(g.id, g);
    g._members = sortedMembers(g);
    g._songs = sortedSongs(g);
    for (const m of g._members) { ix.member.set(m.id, m); m._group = g; m._color = memberColor(g, m); m._strip = stripColor(m._color); }
    for (const s of g._songs) { ix.song.set(s.id, s); s._group = g; }
    ix.eventsByGroup.set(g.id, []);
    ix.groupStats.set(g.id, { videos: 0, clips: 0, events: 0, tags: new Set(), songs: new Map() });
  }

  for (const e of data.events) {
    ix.event.set(e.id, e);
    const g = ix.group.get(e.groupId);
    if (!g) continue;
    const E = {
      id: e.id, ev: e, group: g, date: e.date, p: parseDate(e.date),
      videos: [], clips: [], sections: new Map(), songOrder: [], memberSet: new Set(),
    };
    ix.E.set(e.id, E);
    ix.eventsByGroup.get(g.id).push(E);
  }

  data.videos.forEach((v, i) => {
    v._i = i;
    ix.video.set(v.id, v);
    const E = ix.E.get(v.eventId);
    if (!E) return;
    E.videos.push(v);
    const st = ix.groupStats.get(E.group.id);
    st.videos++;
    for (const t of v.tags || []) st.tags.add(t);
    for (const so of v.songs || []) st.songs.set(so.songId, (st.songs.get(so.songId) || 0) + 1);
  });

  data.clips.forEach((c, i) => {
    c._i = i;
    ix.clip.set(c.id, c);
    const v = c.videoId ? ix.video.get(c.videoId) : null;
    const E = ix.E.get(v ? v.eventId : c.eventId);
    if (!E) return;
    let songId = c.songId ?? null;
    if (!songId && v) songId = songAtTime(v, c.t);
    const memberIds = v ? v.memberIds : (c.memberIds || []);
    const C = { id: c.id, clip: c, video: v, E, songId: songId ?? NOSONG, memberIds, key: v && v.type === 'full' ? 'full' : cellKey(memberIds) };
    ix.C.set(c.id, C);
    E.clips.push(C);
    if (v) {
      if (!ix.clipsByVideo.has(v.id)) ix.clipsByVideo.set(v.id, []);
      ix.clipsByVideo.get(v.id).push(C);
    }
    ix.groupStats.get(E.group.id).clips++;
  });

  for (const [gid, list] of ix.eventsByGroup) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : labelRank(a.ev) - labelRank(b.ev) || a.ev.show.localeCompare(b.ev.show)));
    ix.groupStats.get(gid).events = list.length;
    list.forEach((E, i) => { E.seq = i; });
    for (const E of list) buildEvent(E);
  }

  buildSearch(ix);
  return ix;
}

// 같은 날 사전녹화가 본방보다 앞
function labelRank(e) {
  const l = e.label || '';
  if (!l) return 1;
  if (/사전|리허설|사녹/.test(l)) return 0;
  return 2;
}

export function songAtTime(v, t) {
  if (!v.songs || !v.songs.length) return null;
  if (v.songs.length === 1 || t == null) return v.songs[0].songId;
  let cur = v.songs[0].songId;
  for (const s of [...v.songs].sort((a, b) => (a.t ?? 0) - (b.t ?? 0))) if ((s.t ?? 0) <= t) cur = s.songId;
  return cur;
}

function section(E, key) {
  let S = E.sections.get(key);
  if (!S) { S = { key, songId: key, full: [], cells: new Map(), clips: [] }; E.sections.set(key, S); }
  return S;
}

function buildEvent(E) {
  const g = E.group;
  for (const v of E.videos) {
    const keys = v.songs && v.songs.length ? v.songs.map((s) => s.songId) : [NOSONG];
    for (const k of keys) {
      const S = section(E, k);
      if (v.type === 'full') S.full.push(v);
      else {
        const ck = cellKey(v.memberIds);
        if (!S.cells.has(ck)) S.cells.set(ck, []);
        S.cells.get(ck).push(v);
        for (const m of v.memberIds) E.memberSet.add(m);
      }
    }
  }
  for (const C of E.clips) section(E, C.songId).clips.push(C);
  for (const S of E.sections.values()) {
    S.full.sort(repCompare);
    for (const list of S.cells.values()) list.sort(repCompare);
    S.clips.sort((a, b) => a.clip._i - b.clip._i);
  }
  const order = eventSongOrder(E.ev, E.videos, g);
  for (const k of E.sections.keys()) if (k !== NOSONG && !order.includes(k)) order.push(k);
  E.songOrder = order;
  E.hasNoSong = E.sections.has(NOSONG);
  E.sectionKeys = [...order, ...(E.hasNoSong ? [NOSONG] : [])];
  E.songNo = new Map(order.map((k, i) => [k, i + 1]));
}

// 칸 순서: 단체 → 멤버(order 순) → 유닛
export function cellOrder(E, S, { includeEmpty = true, members } = {}) {
  const g = E.group;
  const out = [];
  if (S.cells.has(GROUP_KEY)) out.push({ key: GROUP_KEY, kind: 'group', memberIds: [], videos: S.cells.get(GROUP_KEY) });
  const cols = members || g._members.filter((m) => m.active !== false || E.memberSet.has(m.id));
  for (const m of cols) {
    const vids = S.cells.get(m.id);
    if (vids) out.push({ key: m.id, kind: 'member', member: m, memberIds: [m.id], videos: vids });
    else if (includeEmpty) out.push({ key: m.id, kind: 'member', member: m, memberIds: [m.id], videos: [] });
  }
  const units = [...S.cells.keys()].filter((k) => k !== GROUP_KEY && k.includes('+'));
  const rank = (k) => k.split('+').map((id) => g._members.findIndex((m) => m.id === id));
  units.sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    for (let i = 0; i < Math.min(ra.length, rb.length); i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return ra.length - rb.length;
  });
  for (const k of units) out.push({ key: k, kind: 'unit', memberIds: k.split('+'), videos: S.cells.get(k) });
  return out;
}

export function eventCover(E) {
  const c = E.ev.cover && E.videos.find((v) => v.id === E.ev.cover);
  if (c) return c;
  const order = [...E.songOrder, NOSONG];
  for (const k of order) { const S = E.sections.get(k); if (S && S.full.length) return S.full[0]; }
  for (const k of order) { const S = E.sections.get(k); if (S && S.cells.has(GROUP_KEY)) return S.cells.get(GROUP_KEY)[0]; }
  return E.videos[0] || null;
}

// 영상 하나의 맥락 (그룹, 공연, 곡들, 멤버)
export function videoCtx(ix, v) {
  const E = ix.E.get(v.eventId);
  return { E, g: E && E.group, songs: (v.songs || []).map((s) => ix.song.get(s.songId)).filter(Boolean), members: v.memberIds.map((id) => ix.member.get(id)).filter(Boolean) };
}

export function whoLabel(ix, v) {
  if (v.type === 'full') return '풀캠';
  if (!v.memberIds.length) return '단체';
  return v.memberIds.map((id) => ix.member.get(id)?.name || id).join('·');
}

function buildSearch(ix) {
  for (const [gid, list] of ix.eventsByGroup) {
    const g = ix.group.get(gid);
    const gText = [g.name, g.en].join(' ');
    for (const E of list) {
      const e = E.ev;
      const eText = [gText, e.show, e.label, e.note, ...dateForms(e.date)].join(' ');
      for (const v of E.videos) {
        const songs = (v.songs || []).map((s) => ix.song.get(s.songId)).filter(Boolean);
        const mems = v.type === 'full' ? [] : v.memberIds.map((id) => ix.member.get(id)).filter(Boolean);
        const text = [
          eText, ...songs.flatMap((s) => [s.title, ...(s.aliases || [])]), ...mems.flatMap((m) => [m.name, ...(m.aliases || [])]),
          v.title, v.channel, ...(v.tags || []), v.type === 'full' ? '풀캠 full' : '직캠 fancam', v.type === 'fancam' && !v.memberIds.length ? '단체' : '',
          v.memberIds.length > 1 ? '유닛' : '', v.source === 'official' ? '공식' : v.source === 'fan' ? '팬' : '', v.gone ? '삭제됨' : '',
        ].join(' ');
        ix.searchItems.push({ kind: 'video', id: v.id, E, text: norm(text) });
      }
      for (const C of E.clips) {
        const s = ix.song.get(C.songId);
        const mems = C.memberIds.map((id) => ix.member.get(id)).filter(Boolean);
        const text = [eText, s ? [s.title, ...(s.aliases || [])].join(' ') : '', ...mems.flatMap((m) => [m.name, ...(m.aliases || [])]), C.clip.note, '움짤 clip', C.video ? C.video.title : ''].join(' ');
        ix.searchItems.push({ kind: 'clip', id: C.id, E, text: norm(text) });
      }
    }
  }
}
