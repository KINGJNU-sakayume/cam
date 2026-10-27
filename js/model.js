// 데이터 규칙 (보기·관리·검증 공용, DOM 없음)

export const DATA_VERSION = 3;
export const DEFAULT_COLORS = ['#c2553f', '#2f7d6d', '#3d6fb6', '#b07f22', '#8a5aa8', '#c0567e', '#4f8a3c', '#7a6a58'];
export const GROUP_KEY = '_group'; // 단체 직캠 칸 키
export const NOSONG = ''; // 곡 구분 없는 전체 공연

export const isSampleYt = (id) => typeof id === 'string' && id.startsWith('SMPL');

export function sortedMembers(group) {
  return [...(group.members || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
export function sortedSongs(group) {
  return [...(group.songs || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function memberColor(group, member) {
  if (member.color) return member.color;
  const idx = sortedMembers(group).findIndex((m) => m.id === member.id);
  return DEFAULT_COLORS[Math.max(0, idx) % DEFAULT_COLORS.length];
}

// 포토카드 이름띠 색: 멤버색을 흰 글자와 4.5:1 이상이 될 때까지 어둡게 한다(색상은 그대로)
export function stripColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#3f444d';
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const contrastWithWhite = () => 1.05 / (0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) + 0.05);
  for (let i = 0; i < 40 && contrastWithWhite() < 4.5; i++) { r *= 0.94; g *= 0.94; b *= 0.94; }
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

export function cellKey(memberIds) {
  if (!memberIds || memberIds.length === 0) return GROUP_KEY;
  return [...memberIds].sort().join('+');
}

// 칸 대표 순서: pin → official → 4K 태그 → 먼저 담은 순(배열 순서)
export function repCompare(a, b) {
  if (!!b.pin !== !!a.pin) return b.pin ? 1 : -1;
  const ao = a.source === 'official', bo = b.source === 'official';
  if (ao !== bo) return bo ? 1 : -1;
  const a4 = (a.tags || []).includes('4K'), b4 = (b.tags || []).includes('4K');
  if (a4 !== b4) return b4 ? 1 : -1;
  return (a._i ?? 0) - (b._i ?? 0);
}

// 공연의 곡 순서: setlist → 영상에 나온 곡을 곡 order 순
export function eventSongOrder(event, videosOfEvent, group) {
  const songIds = new Set((group.songs || []).map((s) => s.id));
  if (event.setlist && event.setlist.length) return event.setlist.filter((id) => songIds.has(id));
  const used = new Set();
  for (const v of videosOfEvent) for (const s of v.songs || []) used.add(s.songId);
  return sortedSongs(group).filter((s) => used.has(s.id)).map((s) => s.id);
}

// hqdefault(4:3)는 16:9 영상 위아래에 검은 띠가 들어 있어 칸에 잘라 넣으면 띠가 보인다.
// 16:9 칸·작은 그림은 mqdefault(16:9, 띠 없음), 그 밖의 칸(2:3, 조밀 모드의 1:2.2 띠·3:1 띠)은 크게 잘라 쓰니 hq720(1280×720, 띠 없음).
// hq720이 없는 영상은 thumbFallback으로.
export function thumbSrc(video, ratio = '169', small = false) {
  if (video.thumb) return video.thumb;
  if (video.ytId && !isSampleYt(video.ytId)) return `https://i.ytimg.com/vi/${video.ytId}/${ratio !== '169' && !small ? 'hq720' : 'mqdefault'}.jpg`;
  return null;
}
export function thumbFallback(video) {
  if (video.thumb || !video.ytId || isSampleYt(video.ytId)) return '';
  return `https://i.ytimg.com/vi/${video.ytId}/hqdefault.jpg`;
}
export const DEFAULT_THUMB_POS = '50% 35%';

export function ytUrl(ytId, t) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(ytId)}${t ? `&t=${Math.floor(t)}s` : ''}`;
}
// api: 끝남 신호를 받으려고 enablejsapi를 켠다(이어보기). autoplay: 이어보기에서 다음 곡으로 넘어갈 때
export function ytEmbed(ytId, t, { api = false, autoplay = false, origin = '' } = {}) {
  const q = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
  if (t) q.set('start', String(Math.floor(t)));
  if (api) { q.set('enablejsapi', '1'); if (origin) q.set('origin', origin); }
  if (autoplay) q.set('autoplay', '1');
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?${q}`;
}

export function clipKind(file) {
  const ext = (String(file).split('.').pop() || '').toLowerCase();
  return ext === 'mp4' || ext === 'webm' ? 'video' : 'image';
}

export function emptyData() {
  return { version: DATA_VERSION, groups: [], events: [], videos: [], clips: [] };
}

export const BROADCAST_CHANNELS = [
  'KBS Kpop', 'KBS WORLD TV', 'MBCkpop', 'MBC KPOP', 'Mnet K-POP', 'M2', 'SBS KPOP', 'SBS Inkigayo', 'THE K-POP',
  'ALL THE K-POP', 'SBS M', '1theK', 'Stone Music', 'MBCM', 'MBC Every1', 'JTBC', 'KBS Entertain', 'Studio CHOOM',
];
