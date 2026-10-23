// 데이터 검증 (관리 화면과 scripts/validate.mjs 공용). 오류는 위치와 이유를 한국어로.
import { isRealDate } from './util.js';
import { DATA_VERSION } from './model.js';

const YT_RE = /^[A-Za-z0-9_-]{11}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const TYPES = ['full', 'fancam'];
const SOURCES = ['official', 'fan', null];

const at = (coll, i, item) => `${coll}[${i}]${item && item.id ? ` (${item.id})` : ''}`;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';

export function validateData(data) {
  const errors = [];
  const err = (where, msg) => errors.push({ where, msg, text: `${where}: ${msg}` });

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    err('(최상위)', '데이터가 객체가 아니에요');
    return errors;
  }
  if (data.version !== DATA_VERSION) err('version', `version이 ${DATA_VERSION}이어야 하는데 ${JSON.stringify(data.version)}이에요`);
  for (const k of ['groups', 'events', 'videos', 'clips']) {
    if (!Array.isArray(data[k])) { err(k, '배열이 아니에요'); data = { ...data, [k]: [] }; }
  }

  const seen = { group: new Map(), member: new Map(), song: new Map(), event: new Map(), video: new Map(), clip: new Map() };
  const dupCheck = (kind, id, where) => {
    if (!isStr(id)) { err(where, 'id가 비어 있어요'); return false; }
    if (seen[kind].has(id)) { err(where, `id ${id}가 ${seen[kind].get(id)}과 겹쳐요`); return false; }
    seen[kind].set(id, where);
    return true;
  };

  const groupById = new Map(), memberGroup = new Map(), songGroup = new Map();
  data.groups.forEach((g, gi) => {
    const w = at('groups', gi, g);
    if (!g || typeof g !== 'object') return err(w, '객체가 아니에요');
    if (dupCheck('group', g.id, w)) groupById.set(g.id, g);
    if (!isStr(g.name)) err(w, 'name이 비어 있어요');
    if (g.hue != null && (!isNum(g.hue) || g.hue < 0 || g.hue > 360)) err(w, 'hue는 0~360 숫자여야 해요');
    if (!Array.isArray(g.members)) err(w, 'members가 배열이 아니에요');
    if (!Array.isArray(g.songs)) err(w, 'songs가 배열이 아니에요');
    (g.members || []).forEach((m, mi) => {
      const mw = `${w}.members[${mi}]${m && m.id ? ` (${m.id})` : ''}`;
      if (dupCheck('member', m.id, mw)) memberGroup.set(m.id, g.id);
      if (!isStr(m.name)) err(mw, 'name이 비어 있어요');
      if (m.order != null && !isNum(m.order)) err(mw, 'order는 숫자여야 해요');
      if (m.color != null && m.color !== '' && !COLOR_RE.test(m.color)) err(mw, `color ${JSON.stringify(m.color)}는 #rrggbb 형식이 아니에요`);
      if (m.aliases != null && !Array.isArray(m.aliases)) err(mw, 'aliases는 배열이어야 해요');
      if (m.active != null && typeof m.active !== 'boolean') err(mw, 'active는 true/false여야 해요');
    });
    (g.songs || []).forEach((s, si) => {
      const sw = `${w}.songs[${si}]${s && s.id ? ` (${s.id})` : ''}`;
      if (dupCheck('song', s.id, sw)) songGroup.set(s.id, g.id);
      if (!isStr(s.title)) err(sw, 'title이 비어 있어요');
      if (s.release != null && s.release !== '' && !isRealDate(s.release)) err(sw, `release ${JSON.stringify(s.release)}는 실제 날짜(YYYY-MM-DD)가 아니에요`);
    });
  });

  const eventById = new Map();
  const eventKeys = new Map();
  data.events.forEach((e, ei) => {
    const w = at('events', ei, e);
    if (!e || typeof e !== 'object') return err(w, '객체가 아니에요');
    if (dupCheck('event', e.id, w)) eventById.set(e.id, e);
    if (!groupById.has(e.groupId)) err(w, `groupId ${JSON.stringify(e.groupId)} 그룹이 없어요`);
    if (!isRealDate(e.date)) err(w, `date ${JSON.stringify(e.date)}는 실제 날짜(YYYY-MM-DD)가 아니에요`);
    if (!isStr(e.show)) err(w, 'show(행사명)가 비어 있어요');
    if (e.setlist != null) {
      if (!Array.isArray(e.setlist)) err(w, 'setlist는 배열이어야 해요');
      else e.setlist.forEach((sid) => {
        if (!songGroup.has(sid)) err(w, `setlist의 ${sid} 곡이 없어요`);
        else if (songGroup.get(sid) !== e.groupId) err(w, `setlist의 ${sid}는 ${e.groupId} 그룹 곡이 아니에요`);
      });
    }
    const key = [e.groupId, e.date, (e.show || '').trim(), (e.label || '').trim()].join('|');
    if (eventKeys.has(key)) err(w, `같은 그룹·날짜·행사·label 공연이 ${eventKeys.get(key)}에 이미 있어요`);
    else eventKeys.set(key, w);
  });

  const videoById = new Map();
  const ytSeen = new Map();
  data.videos.forEach((v, vi) => {
    const w = at('videos', vi, v);
    if (!v || typeof v !== 'object') return err(w, '객체가 아니에요');
    if (dupCheck('video', v.id, w)) videoById.set(v.id, v);
    if (!YT_RE.test(v.ytId || '')) err(w, `ytId ${JSON.stringify(v.ytId)}는 유튜브 11자 ID 형식이 아니에요`);
    else if (ytSeen.has(v.ytId)) err(w, `ytId ${v.ytId}가 ${ytSeen.get(v.ytId)}과 같은 영상이에요`);
    else ytSeen.set(v.ytId, w);
    const ev = eventById.get(v.eventId);
    if (!ev) err(w, `eventId ${JSON.stringify(v.eventId)} 공연이 없어요`);
    const gid = ev && ev.groupId;
    if (!TYPES.includes(v.type)) err(w, `type은 full 또는 fancam이어야 하는데 ${JSON.stringify(v.type)}이에요`);
    if (!Array.isArray(v.songs)) err(w, 'songs는 배열이어야 해요');
    else v.songs.forEach((s, si) => {
      if (!s || !songGroup.has(s.songId)) err(w, `songs[${si}]의 ${s && s.songId} 곡이 없어요`);
      else if (gid && songGroup.get(s.songId) !== gid) err(w, `songs[${si}]의 ${s.songId}는 ${gid} 그룹 곡이 아니에요`);
      if (s && s.t != null && (!isNum(s.t) || s.t < 0)) err(w, `songs[${si}].t는 0 이상 숫자여야 해요`);
    });
    if (!Array.isArray(v.memberIds)) err(w, 'memberIds는 배열이어야 해요');
    else {
      if (v.type === 'full' && v.memberIds.length) err(w, 'full 영상의 memberIds는 비어 있어야 해요');
      v.memberIds.forEach((mid) => {
        if (!memberGroup.has(mid)) err(w, `memberIds의 ${mid} 멤버가 없어요`);
        else if (gid && memberGroup.get(mid) !== gid) err(w, `memberIds의 ${mid}은 ${gid} 그룹 멤버가 아니에요`);
      });
    }
    if (!SOURCES.includes(v.source ?? null)) err(w, `source는 official, fan, null 중 하나여야 하는데 ${JSON.stringify(v.source)}이에요`);
    if (v.tags != null && (!Array.isArray(v.tags) || v.tags.some((t) => typeof t !== 'string'))) err(w, 'tags는 문자열 배열이어야 해요');
    if (v.thumb != null && v.thumb !== '') {
      if (/^https?:/i.test(v.thumb)) {
        if (!/^https:\/\/i\.ytimg\.com\//.test(v.thumb)) err(w, `thumb URL은 i.ytimg.com만 쓸 수 있어요 (${v.thumb})`);
      } else if (typeof v.thumb !== 'string' || v.thumb.startsWith('/') || v.thumb.includes('..')) err(w, `thumb 경로 ${JSON.stringify(v.thumb)}가 올바르지 않아요`);
    }
    if (v.pin != null && typeof v.pin !== 'boolean') err(w, 'pin은 true/false여야 해요');
    if (v.gone != null && typeof v.gone !== 'boolean') err(w, 'gone은 true/false여야 해요');
  });

  data.events.forEach((e, ei) => {
    if (e && e.cover != null && e.cover !== '') {
      const cv = videoById.get(e.cover);
      if (!cv) err(at('events', ei, e), `cover의 ${e.cover} 영상이 없어요`);
      else if (cv.eventId !== e.id) err(at('events', ei, e), `cover의 ${e.cover}는 이 공연 영상이 아니에요`);
    }
  });

  data.clips.forEach((c, ci) => {
    const w = at('clips', ci, c);
    if (!c || typeof c !== 'object') return err(w, '객체가 아니에요');
    dupCheck('clip', c.id, w);
    if (!isStr(c.file)) err(w, 'file이 비어 있어요');
    else if (!/\.(webp|gif|mp4|webm)$/i.test(c.file)) err(w, `file ${c.file}는 webp·gif·mp4·webm이 아니에요`);
    let gid = null;
    if (c.videoId != null) {
      const v = videoById.get(c.videoId);
      if (!v) err(w, `videoId ${c.videoId} 영상이 없어요`);
      else gid = eventById.get(v.eventId)?.groupId;
    } else if (c.eventId == null) err(w, 'videoId와 eventId 중 하나는 있어야 해요');
    if (c.eventId != null) {
      const ev = eventById.get(c.eventId);
      if (!ev) err(w, `eventId ${c.eventId} 공연이 없어요`);
      else gid = gid || ev.groupId;
    }
    if (c.songId != null) {
      if (!songGroup.has(c.songId)) err(w, `songId ${c.songId} 곡이 없어요`);
      else if (gid && songGroup.get(c.songId) !== gid) err(w, `songId ${c.songId}는 ${gid} 그룹 곡이 아니에요`);
    }
    (c.memberIds || []).forEach((mid) => {
      if (!memberGroup.has(mid)) err(w, `memberIds의 ${mid} 멤버가 없어요`);
      else if (gid && memberGroup.get(mid) !== gid) err(w, `memberIds의 ${mid}은 ${gid} 그룹 멤버가 아니에요`);
    });
    if (c.t != null && (!isNum(c.t) || c.t < 0)) err(w, 't는 0 이상 숫자여야 해요');
    if (c.end != null && (!isNum(c.end) || c.end < 0)) err(w, 'end는 0 이상 숫자여야 해요');
    if (isNum(c.t) && isNum(c.end) && c.t > c.end) err(w, `t(${c.t})가 end(${c.end})보다 커요`);
  });

  return errors;
}

// 로컬 파일 참조 목록 (Node 검증 스크립트가 존재·용량을 확인)
export function fileRefs(data) {
  const refs = [];
  const local = (p) => typeof p === 'string' && p && !/^https?:/i.test(p);
  (data.groups || []).forEach((g, gi) => (g.members || []).forEach((m, mi) => {
    if (local(m.thumb)) refs.push({ where: `groups[${gi}].members[${mi}] (${m.id})`, field: 'thumb', path: m.thumb });
  }));
  (data.videos || []).forEach((v, i) => { if (local(v.thumb)) refs.push({ where: at('videos', i, v), field: 'thumb', path: v.thumb }); });
  (data.clips || []).forEach((c, i) => {
    if (local(c.file)) refs.push({ where: at('clips', i, c), field: 'file', path: c.file, clip: true });
    if (local(c.poster)) refs.push({ where: at('clips', i, c), field: 'poster', path: c.poster });
  });
  return refs;
}
