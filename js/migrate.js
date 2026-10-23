// version 1·2 → version 3 변환
// 1·2의 단위는 "무대(stage)" = 그룹·날짜·행사·곡 하나. 3에서는 같은 그룹·날짜·행사·label 무대를
// 공연(event) 하나로 합치고 곡은 그룹의 songs 목록으로 옮긴다.
import { DATA_VERSION, DEFAULT_COLORS } from './model.js';

export function needsMigration(data) {
  return data && typeof data === 'object' && (data.version === 1 || data.version === 2 || (data.version == null && Array.isArray(data.stages)));
}

export function migrate(input) {
  if (!needsMigration(input)) return input;
  const src = JSON.parse(JSON.stringify(input));
  const out = { version: DATA_VERSION, groups: [], events: [], videos: [], clips: [] };
  let seq = 0;
  const uid = (p) => `${p}${++seq}`;

  const groups = Array.isArray(src.groups) ? src.groups : [];
  // version 1은 그룹 목록이 없고 stage.group(이름)만 있을 수 있다
  const groupByName = new Map();
  for (const g of groups) {
    const ng = {
      id: g.id || uid('g'), name: g.name || '이름 없음', en: g.en || '', hue: typeof g.hue === 'number' ? g.hue : 200,
      members: [], songs: [],
    };
    (g.members || []).forEach((m, i) => ng.members.push({
      id: m.id || uid(`${ng.id}m`), name: m.name || '', aliases: m.aliases || [],
      order: typeof m.order === 'number' ? m.order : i + 1, active: m.active !== false,
      color: m.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length], ...(m.thumb ? { thumb: m.thumb } : {}),
    }));
    (g.songs || []).forEach((s, i) => ng.songs.push({
      id: s.id || uid(`${ng.id}s`), title: s.title || s.name || '', aliases: s.aliases || [], order: s.order ?? i + 1, release: s.release || '',
    }));
    out.groups.push(ng);
    groupByName.set(ng.name, ng);
  }
  const groupFor = (stage) => {
    let g = out.groups.find((x) => x.id === stage.groupId);
    if (!g && stage.group) g = groupByName.get(stage.group);
    if (!g) {
      g = { id: uid('g'), name: stage.group || '이름 없음', en: '', hue: 200, members: [], songs: [] };
      out.groups.push(g); groupByName.set(g.name, g);
    }
    return g;
  };
  const songFor = (g, stage) => {
    const ref = stage.songId || stage.song;
    if (!ref) return null;
    let s = g.songs.find((x) => x.id === ref || x.title === ref);
    if (!s) {
      s = { id: uid(`${g.id}s`), title: String(ref), aliases: [], order: g.songs.length + 1, release: '' };
      g.songs.push(s);
    }
    return s;
  };
  const memberFor = (g, ref) => {
    if (!ref) return null;
    let m = g.members.find((x) => x.id === ref || x.name === ref);
    if (!m) {
      const i = g.members.length;
      m = { id: uid(`${g.id}m`), name: String(ref), aliases: [], order: i + 1, active: true, color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] };
      g.members.push(m);
    }
    return m;
  };

  const stageMap = new Map(); // stage.id → { event, songId }
  const eventByKey = new Map();
  for (const st of src.stages || []) {
    const g = groupFor(st);
    const s = songFor(g, st);
    const key = [g.id, st.date, st.show || '', st.label || ''].join('|');
    let ev = eventByKey.get(key);
    if (!ev) {
      ev = { id: uid('e'), groupId: g.id, date: st.date, show: st.show || '', label: st.label || '', setlist: [], note: st.note || '' };
      eventByKey.set(key, ev);
      out.events.push(ev);
    }
    if (s && !ev.setlist.includes(s.id)) ev.setlist.push(s.id);
    stageMap.set(st.id, { event: ev, songId: s ? s.id : null, group: g });
  }

  for (const v of src.videos || []) {
    const st = stageMap.get(v.stageId);
    if (!st) continue;
    const tags = [...(v.tags || [])];
    if (v.rehearsal && !tags.includes('리허설')) tags.push('리허설');
    let memberIds = Array.isArray(v.memberIds) ? v.memberIds : (v.memberId ? [v.memberId] : []);
    memberIds = memberIds.map((r) => memberFor(st.group, r)).filter(Boolean).map((m) => m.id);
    const type = v.type === 'full' || v.type === 'stage' ? 'full' : 'fancam';
    out.videos.push({
      id: v.id || uid('v'), ytId: v.ytId, eventId: st.event.id,
      songs: st.songId ? [{ songId: st.songId, t: v.t ?? 0 }] : [],
      type, memberIds: type === 'full' ? [] : memberIds,
      source: v.source === 'official' || v.source === 'fan' ? v.source : null,
      tags, title: v.title || '', channel: v.channel || '',
      ...(v.thumb ? { thumb: v.thumb } : {}), ...(v.thumbPos ? { thumbPos: v.thumbPos } : {}),
      pin: !!v.pin, gone: !!v.gone,
    });
  }

  for (const c of src.clips || []) {
    const st = c.stageId ? stageMap.get(c.stageId) : null;
    out.clips.push({
      id: c.id || uid('c'), file: c.file, poster: c.poster || '',
      videoId: c.videoId ?? null, t: c.t ?? null, end: c.end ?? null,
      eventId: c.videoId ? null : (st ? st.event.id : c.eventId ?? null),
      songId: c.videoId ? null : (st ? st.songId : c.songId ?? null),
      memberIds: c.videoId ? [] : (c.memberIds || (c.memberId ? [c.memberId] : [])),
      note: c.note || '',
    });
  }
  return out;
}
