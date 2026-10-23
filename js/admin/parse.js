// 유튜브 ID 추출, 제목·파일명 자동 해석
import { parseTime, isRealDate } from '../util.js';
import { BROADCAST_CHANNELS } from '../model.js';

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

// watch?v=, youtu.be/, shorts/, embed/, live/, m.youtube.com, 추가 파라미터 무시. t= 값은 시작 초 후보.
export function extractYt(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (ID_RE.test(s)) return { id: s, t: null };
  let url;
  try { url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(url.pathname);
      if (m) id = m[2];
    }
  }
  if (!id || !ID_RE.test(id)) return null;
  const tRaw = url.searchParams.get('t') || url.searchParams.get('start') || (url.hash.match(/t=([^&]+)/) || [])[1];
  const t = tRaw ? parseTime(tRaw) : null;
  return { id, t: Number.isFinite(t) ? t : null };
}

// 6·8자리 날짜 → YYYY-MM-DD
export function findDate(text) {
  const re = /(?:^|[^\d])(\d{8}|\d{6})(?=[^\d]|$)/g;
  let m;
  while ((m = re.exec(text))) {
    const d = m[1];
    const iso = d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
    if (isRealDate(iso)) return { iso, raw: d };
  }
  return null;
}

const lc = (s) => String(s || '').toLowerCase();
const has = (text, word) => {
  const w = lc(word).trim();
  if (!w) return false;
  if (/^[a-z0-9 ]+$/.test(w) && new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(text)) return true;
  if (!/^[a-z0-9 ]+$/.test(w) && text.includes(w)) return true;
  // 띄어쓰기 없이 붙여 쓴 경우(papermoon)
  const ns = w.replace(/\s+/g, '');
  return ns.length >= 4 && w.includes(' ') && text.replace(/\s+/g, '').includes(ns);
};

// 제목 해석: { date, memberIds, group, songId, type, tags, source }
export function parseTitle(title, group, { channel = '' } = {}) {
  const text = lc(title);
  const out = { date: null, memberIds: [], groupCam: false, songId: null, type: null, tags: [], source: null };
  const d = findDate(title);
  if (d) out.date = d.iso;
  if (group) {
    for (const m of group.members || []) {
      if ([m.name, ...(m.aliases || [])].some((w) => w && has(text, w))) out.memberIds.push(m.id);
    }
    let best = null;
    for (const s of group.songs || []) {
      for (const w of [s.title, ...(s.aliases || [])]) {
        if (w && has(text, w) && (!best || w.length > best.len)) best = { id: s.id, len: w.length };
      }
    }
    if (best) out.songId = best.id;
  }
  if (/직캠|fancam|fan cam|focus cam|페이스캠|facecam|얼빡/.test(text)) out.type = 'fancam';
  else if (/풀캠|full cam|fullcam|full ver|\bfull\b|무대|stage/.test(text)) out.type = 'full';
  if (!out.type && out.memberIds.length) out.type = 'fancam';
  if (/단체|group cam|full group|그룹 직캠/.test(text)) { out.groupCam = true; out.type = 'fancam'; }
  if (out.type === 'full') out.memberIds = [];
  const tags = [];
  if (/세로|vertical|shorts/.test(text)) tags.push('세로');
  if (/4k|2160p/.test(text)) tags.push('4K');
  if (/얼빡|페이스캠|facecam|face cam/.test(text)) tags.push('얼빡');
  if (/리허설|rehearsal/.test(text)) tags.push('리허설');
  if (/사녹|사전녹화|pre-?record/.test(text)) tags.push('사전녹화');
  out.tags = tags;
  if (channel && BROADCAST_CHANNELS.some((c) => lc(c) === lc(channel).trim())) out.source = 'official';
  return out;
}

// 움짤 파일명 해석 (구분자 _ - . 공백을 띄어쓰기로)
export function parseFileName(name, group) {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[_.-]+/g, ' ');
  return parseTitle(base, group);
}

export async function fetchOEmbed(id) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return { ok: false, status: res.status };
    const j = await res.json();
    return { ok: true, title: j.title || '', channel: j.author_name || '' };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  } finally { clearTimeout(timer); }
}
