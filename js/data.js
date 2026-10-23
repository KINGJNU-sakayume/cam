// data/videos.json 로드. 실패 원인을 구분해 상태 화면이 해결 방법을 알려 줄 수 있게 한다.
import { DATA_VERSION } from './model.js';

export class LoadError extends Error {
  constructor(kind, detail = {}) { super(kind); this.kind = kind; this.detail = detail; }
}

export const DATA_URL = 'data/videos.json';

export async function loadData(url = DATA_URL) {
  if (location.protocol === 'file:') throw new LoadError('file');
  let res;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (e) {
    throw new LoadError('network', { url, message: e.message });
  }
  if (!res.ok) throw new LoadError('path', { url, status: res.status });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new LoadError('syntax', { url, ...syntaxPos(text, e.message), message: e.message });
  }
  if (!data || data.version !== DATA_VERSION) throw new LoadError('version', { url, version: data && data.version });
  for (const k of ['groups', 'events', 'videos', 'clips']) if (!Array.isArray(data[k])) data[k] = [];
  return data;
}

export function syntaxPos(text, message) {
  const lc = /line (\d+) column (\d+)/.exec(message);
  if (lc) return { line: +lc[1], col: +lc[2] };
  const m = /position (\d+)/.exec(message);
  const pos = m ? +m[1] : jsonErrorOffset(text);
  if (pos == null) return {};
  const before = text.slice(0, pos).split('\n');
  return { line: before.length, col: before[before.length - 1].length + 1 };
}

// 브라우저 메시지에 위치가 없을 때: 처음으로 문법이 깨지는 글자 위치를 직접 찾는다
export function jsonErrorOffset(t) {
  let i = 0;
  const ws = () => { while (i < t.length && ' \t\n\r'.includes(t[i])) i++; };
  const fail = () => { throw i; };
  const lit = (w) => { if (t.startsWith(w, i)) i += w.length; else fail(); };
  const str = () => {
    i++;
    while (i < t.length && t[i] !== '"') {
      if (t[i] === '\\') i++;
      else if (t.charCodeAt(i) < 0x20) fail();
      i++;
    }
    if (i >= t.length) fail();
    i++;
  };
  const num = () => { const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(t.slice(i)); if (!m) fail(); i += m[0].length; };
  const val = () => {
    ws();
    const c = t[i];
    if (c === '{') {
      i++; ws();
      if (t[i] === '}') { i++; return; }
      for (;;) { ws(); if (t[i] !== '"') fail(); str(); ws(); if (t[i] !== ':') fail(); i++; val(); ws(); if (t[i] === ',') { i++; continue; } if (t[i] === '}') { i++; return; } fail(); }
    }
    if (c === '[') {
      i++; ws();
      if (t[i] === ']') { i++; return; }
      for (;;) { val(); ws(); if (t[i] === ',') { i++; continue; } if (t[i] === ']') { i++; return; } fail(); }
    }
    if (c === '"') return str();
    if (c === 't') return lit('true');
    if (c === 'f') return lit('false');
    if (c === 'n') return lit('null');
    return num();
  };
  try { val(); ws(); if (i < t.length) fail(); return null; } catch (pos) { return typeof pos === 'number' ? pos : null; }
}

// ?stress=1: 첫 그룹 공연을 날짜를 옮겨 복제해 영상 2,000개·공연 300개·움짤 300개 수준으로 부풀린다
export function inflate(data) {
  const g = data.groups[0];
  if (!g) return data;
  const baseEvents = data.events.filter((e) => e.groupId === g.id);
  const evIds = new Set(baseEvents.map((e) => e.id));
  const baseVideos = data.videos.filter((v) => evIds.has(v.eventId));
  const vIds = new Set(baseVideos.map((v) => v.id));
  const baseClips = data.clips.filter((c) => (c.videoId ? vIds.has(c.videoId) : evIds.has(c.eventId)));
  if (!baseVideos.length) return data;
  const copies = Math.ceil((2000 - data.videos.length) / baseVideos.length);
  const shift = (date, days) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };
  let n = 0;
  for (let k = 1; k <= copies; k++) {
    const days = k * 49;
    for (const e of baseEvents) {
      data.events.push({ ...e, id: `${e.id}x${k}`, date: shift(e.date, days), cover: e.cover ? `${e.cover}x${k}` : undefined });
    }
    for (const v of baseVideos) {
      n++;
      data.videos.push({ ...v, id: `${v.id}x${k}`, eventId: `${v.eventId}x${k}`, ytId: `SMPLX${String(n).padStart(6, '0')}`, pin: v.pin });
    }
    for (const rep of ['a', 'b']) {
      for (const c of baseClips) {
        data.clips.push({
          ...c, id: `${c.id}x${k}${rep}`, videoId: c.videoId ? `${c.videoId}x${k}` : null,
          eventId: c.eventId ? `${c.eventId}x${k}` : null,
        });
      }
    }
  }
  return data;
}
