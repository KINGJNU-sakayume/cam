#!/usr/bin/env node
// 샘플 데이터(data/videos.json)와 샘플 움짤(clips/, clips/posters/)을 만든다.
// 실존 인물과 무관한 가상 그룹 3팀. 같은 입력이면 항상 같은 결과.
//   node scripts/make-samples.mjs            데이터 + 움짤
//   node scripts/make-samples.mjs --data     데이터만
//   node scripts/make-samples.mjs --clips    움짤만
// 움짤은 ffmpeg(libwebp_anim, gif, libx264)로 만든다. ffmpeg가 없으면 정지 포스터만 만든다(jpg 대신 없음 → 보고).
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickColors, darken } from '../js/placeholder.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const doData = !args.has('--clips');
const doClips = !args.has('--data');

// ---------- 그룹 ----------
const PALETTE = ['#c2553f', '#2f7d6d', '#3d6fb6', '#b07f22', '#8a5aa8', '#c0567e', '#4f8a3c', '#7a6a58'];
function group(id, name, en, hue, members, songs) {
  return {
    id, name, en, hue,
    members: members.map(([n, a, active = true], i) => ({
      id: `${id}m${i + 1}`, name: n, aliases: [a], order: i + 1, active, color: PALETTE[i % PALETTE.length],
    })),
    songs: songs.map(([t, a, rel], i) => ({ id: `${id}s${i + 1}`, title: t, aliases: a ? [a] : [], order: i + 1, release: rel })),
  };
}
const groups = [
  group('g1', '르니에', 'LUNIER', 200,
    [['유나', 'YUNA'], ['도희', 'DOHEE'], ['세린', 'SERIN'], ['하온', 'HAON'], ['리아', 'RIA']],
    [['Paper Moon', '페이퍼문', '2026-10-09'], ['Static', '스태틱', '2026-10-09'], ['Velvet Hour', '벨벳아워', '2026-09-18'], ['첫 장면', 'FIRST SCENE', '2026-03-02']]),
  group('g2', '하이디어', 'HIDEAR', 150,
    [['채이', 'CHAEI'], ['소율', 'SOYUL'], ['나린', 'NARIN'], ['미오', 'MIO'], ['예서', 'YESEO'], ['하린', 'HARIN', false]],
    [['Sunroom', '선룸', '2026-09-30'], ['Ripple', '리플', '2026-08-14'], ['별 지도', 'STAR MAP', '2026-09-30']]),
  group('g3', '모노키', 'MONOKI', 28,
    [['지안', 'JIAN'], ['루아', 'RUA'], ['다은', 'DAEUN'], ['시아', 'SIA']],
    [['Tin Heart', '틴하트', '2026-09-08'], ['Daydream Bus', '데이드림버스', '2026-09-08'], ['오렌지 노트', 'ORANGE NOTE', '2026-05-20']]),
];
const G = Object.fromEntries(groups.map((g) => [g.id, g]));
const member = (id) => groups.flatMap((g) => g.members).find((m) => m.id === id);
const song = (id) => groups.flatMap((g) => g.songs).find((s) => s.id === id);

const CHANNEL = {
  '뮤직뱅크': 'KBS Kpop', '인기가요': 'SBS KPOP', '쇼! 음악중심': 'MBCkpop', '엠카운트다운': 'Mnet K-POP',
  '더 쇼': 'THE K-POP', '쇼챔피언': 'ALL THE K-POP',
};
const FAN = ['달빛기록', 'stage note', '오후의 직캠', 'hanbit cam', '무대 앞줄'];

// ---------- 공연 정의 ----------
// songs: [{ id|'' , full: [[source, tags]], cams: { memberId: [[source, tags, extra]] }, group: [...], units: [[ids, source, tags]] }]
// 영상 하나에 두 곡이 들어가면 both: [songId, songId, t2]
const O = 'official', F = 'fan';
const events = [];
const plan = [];
function ev(id, groupId, date, show, { label = '', setlist = [], note = '', cover } = {}, songs = [], extra = {}) {
  events.push({ id, groupId, date, show, label, setlist, note, ...(cover ? { cover } : {}) });
  plan.push({ id, groupId, songs, extra });
}
const all = (gid, src = O, tags = ['4K']) => Object.fromEntries(G[gid].members.filter((m) => m.active).map((m) => [m.id, [[src, tags]]]));
const pick = (ids, src = O, tags = ['4K']) => Object.fromEntries(ids.map((id) => [id, [[src, tags]]]));

// 르니에 12공연
ev('e1', 'g1', '2026-09-12', '한빛대학교 가을 축제', { note: '흰 티셔츠 + 데님' }, [
  { id: '', full: [[F, ['전체 공연']]], cams: pick(['g1m1', 'g1m2', 'g1m3', 'g1m4'], F, ['세로']), group: [[F, []]] },
]);
ev('e2', 'g1', '2026-09-25', '뮤직뱅크', { setlist: ['g1s3'], note: '블랙 벨벳 드레스' }, [
  { id: 'g1s3', full: [[O, ['4K']]], cams: all('g1'), group: [[O, ['4K']]] },
]);
ev('e3', 'g1', '2026-09-27', '인기가요', { setlist: ['g1s3'] }, [
  { id: 'g1s3', full: [[O, []]], cams: pick(['g1m1', 'g1m3', 'g1m4', 'g1m5'], O, []) },
]);
ev('e4', 'g1', '2026-10-09', '뮤직뱅크', { setlist: ['g1s1', 'g1s2'], note: '아이보리 셋업 · 컴백' }, [
  { id: 'g1s1', full: [[O, ['4K']]], cams: { ...all('g1'), g1m1: [[O, ['4K']], [F, ['세로']]] }, group: [[O, ['4K']]] },
  { id: 'g1s2', cams: pick(['g1m1', 'g1m2', 'g1m3', 'g1m4']), units: [[['g1m1', 'g1m5'], F, ['세로']]] },
], { both: [['g1s1', 'g1s2', 214]] });
ev('e5', 'g1', '2026-10-10', '쇼! 음악중심', { setlist: ['g1s1'], note: '블루 미니 드레스' }, [
  { id: 'g1s1', full: [[O, []]], cams: { ...all('g1', O, []), g1m1: [[O, []], [F, ['세로', '4K']]], g1m2: [[O, []], [F, ['얼빡']]] } },
]);
ev('e6', 'g1', '2026-10-11', '인기가요', { setlist: ['g1s1', 'g1s2'] }, [
  { id: 'g1s1', full: [[O, ['4K']]], cams: pick(['g1m1', 'g1m2', 'g1m3', 'g1m5']) },
  { id: 'g1s2', full: [[O, ['4K']]], cams: all('g1') },
]);
ev('e7', 'g1', '2026-10-13', '더 쇼', { setlist: ['g1s1'] }, [
  { id: 'g1s1', full: [[O, []]], cams: all('g1', O, []), group: [[O, []]] },
]);
ev('e8', 'g1', '2026-10-15', '엠카운트다운', { setlist: ['g1s1'], note: '체크 재킷' }, [
  { id: 'g1s1', full: [[O, ['4K']]], cams: { ...pick(['g1m1', 'g1m2', 'g1m3', 'g1m4'], O, ['4K']), g1m3: [[O, ['4K']], [F, ['세로'], { gone: true }]], g1m4: [[O, []], [F, ['4K']]] } },
]);
ev('e9', 'g1', '2026-10-17', '쇼! 음악중심', { setlist: ['g1s1'] }, [
  { id: 'g1s1', full: [[O, []]], cams: pick(['g1m1', 'g1m3'], O, []) },
]);
ev('e10', 'g1', '2026-10-18', '인기가요', { label: '사전녹화', setlist: ['g1s1'] }, [
  { id: 'g1s1', full: [[F, ['사전녹화']]], cams: pick(['g1m1', 'g1m2'], F, ['사전녹화', '세로']) },
]);
ev('e11', 'g1', '2026-10-18', '인기가요', { setlist: ['g1s1'] }, [
  { id: 'g1s1', full: [[O, ['4K']]], cams: all('g1') },
]);
ev('e12', 'g1', '2026-10-23', '뮤직뱅크', { setlist: ['g1s1', 'g1s2'], note: '레드 투피스' }, [
  { id: 'g1s1', full: [[O, ['4K']]], cams: { ...all('g1'), g1m1: [[O, ['4K']], [F, ['4K', '엔딩'], { pin: true }]] }, units: [[['g1m2', 'g1m3'], F, []]] },
  { id: 'g1s2', full: [[O, ['4K']]], cams: pick(['g1m1', 'g1m2', 'g1m4']), group: [[O, ['4K']]] },
]);

// 하이디어 5공연 (하린은 8월까지 활동)
ev('e13', 'g2', '2026-08-21', '엠카운트다운', { setlist: ['g2s2'] }, [
  { id: 'g2s2', full: [[O, []]], cams: pick(['g2m1', 'g2m2', 'g2m3', 'g2m4', 'g2m6'], O, []) },
]);
ev('e14', 'g2', '2026-08-23', '인기가요', { setlist: ['g2s2'], note: '민트 셔츠' }, [
  { id: 'g2s2', full: [[O, ['4K']]], cams: pick(['g2m1', 'g2m3', 'g2m5', 'g2m6']), group: [[O, ['4K']]] },
]);
ev('e15', 'g2', '2026-10-02', '뮤직뱅크', { setlist: ['g2s1'] }, [
  { id: 'g2s1', full: [[O, ['4K']]], cams: all('g2') },
]);
ev('e16', 'g2', '2026-10-04', '인기가요', { setlist: ['g2s1', 'g2s3'] }, [
  { id: 'g2s1', full: [[O, []]], cams: pick(['g2m1', 'g2m2', 'g2m4', 'g2m5'], O, []) },
  { id: 'g2s3', full: [[O, []]], cams: pick(['g2m2', 'g2m3'], F, ['세로']), units: [[['g2m1', 'g2m4'], O, []]] },
]);
ev('e17', 'g2', '2026-10-16', '뮤직뱅크', { setlist: ['g2s1'], note: '선셋 오렌지 원피스' }, [
  { id: 'g2s1', full: [[O, ['4K']]], cams: { ...all('g2'), g2m3: [[O, ['4K']], [F, ['얼빡']]] } },
]);

// 모노키 4공연
ev('e18', 'g3', '2026-09-10', '쇼챔피언', { setlist: ['g3s1'] }, [
  { id: 'g3s1', full: [[O, []]], cams: all('g3', O, []) },
]);
ev('e19', 'g3', '2026-09-13', '인기가요', { setlist: ['g3s1', 'g3s2'], note: '스쿨룩' }, [
  { id: 'g3s1', full: [[O, ['4K']]], cams: pick(['g3m1', 'g3m2', 'g3m4']) },
  { id: 'g3s2', full: [[O, ['4K']]], cams: all('g3') },
]);
ev('e20', 'g3', '2026-10-01', '더 쇼', { setlist: ['g3s2'] }, [
  { id: 'g3s2', full: [[O, []]], cams: pick(['g3m1', 'g3m3'], O, []), group: [[F, ['세로']]] },
]);
ev('e21', 'g3', '2026-10-20', '쇼챔피언', { setlist: ['g3s1'] }, [
  { id: 'g3s1', full: [[O, ['4K']]], cams: all('g3') },
]);

// ---------- 영상 생성 ----------
const videos = [];
let vseq = 0, fanSeq = 0;
const yymmdd = (d) => d.slice(2).replaceAll('-', '');
function addVideo({ event, songs, type, memberIds, source, tags, extra = {} }) {
  const g = G[event.groupId];
  vseq++;
  const ytId = `SMPL${String(vseq).padStart(7, '0')}`;
  const songTitles = songs.map((s) => song(s.songId).title);
  const names = memberIds.map((id) => member(id).name);
  const ens = memberIds.map((id) => member(id).aliases[0]);
  const date = yymmdd(event.date);
  const label = event.label ? ` ${event.label}` : '';
  const tagStr = tags.includes('4K') ? '[4K] ' : '';
  let title;
  const sTxt = songTitles.length ? `'${songTitles.join(' + ')}'` : '전체 공연';
  if (type === 'full') title = `${tagStr}${g.name}(${g.en}) - ${sTxt} | ${event.show}${label} ${date}`;
  else if (memberIds.length === 0) title = `${tagStr}${date} ${g.name} 단체 직캠 ${sTxt} @${event.show}${label}`;
  else title = `${tagStr}${date} ${g.name} ${names.join('·')} 직캠 ${sTxt} (${g.en} ${ens.join(' ')} FanCam) @${event.show}${label}`;
  const channel = source === 'official' && CHANNEL[event.show] ? CHANNEL[event.show] : FAN[(fanSeq++) % FAN.length];
  videos.push({
    id: `v${vseq}`, ytId, eventId: event.id, songs, type, memberIds,
    source: source === 'official' && !CHANNEL[event.show] ? 'fan' : source,
    tags, title, channel, pin: !!extra.pin, gone: !!extra.gone,
  });
}
for (const p of plan) {
  const event = events.find((e) => e.id === p.id);
  for (const [a, b, t2] of p.extra.both || []) {
    addVideo({ event, songs: [{ songId: a, t: 0 }, { songId: b, t: t2 }], type: 'full', memberIds: [], source: O, tags: ['송출본'] });
  }
  for (const s of p.songs) {
    const songs = s.id ? [{ songId: s.id, t: 0 }] : [];
    for (const [src, tags] of s.full || []) addVideo({ event, songs, type: 'full', memberIds: [], source: src, tags });
    for (const [src, tags] of s.group || []) addVideo({ event, songs, type: 'fancam', memberIds: [], source: src, tags });
    for (const [mid, list] of Object.entries(s.cams || {})) {
      for (const [src, tags, extra] of list) addVideo({ event, songs, type: 'fancam', memberIds: [mid], source: src, tags, extra });
    }
    for (const [ids, src, tags] of s.units || []) addVideo({ event, songs, type: 'fancam', memberIds: ids, source: src, tags });
  }
}
// 공연 표지 지정 예시: e12는 Paper Moon 풀캠
events.find((e) => e.id === 'e12').cover = videos.find((v) => v.eventId === 'e12' && v.type === 'full').id;

const findV = (eventId, songId, memberIds, nth = 0) => videos.filter((v) => v.eventId === eventId
  && (songId == null ? v.songs.length === 0 : v.songs.some((s) => s.songId === songId))
  && v.memberIds.join() === memberIds.join() && (memberIds.length || v.type === 'fancam'))[nth];
const findFull = (eventId, songId) => videos.find((v) => v.eventId === eventId && v.type === 'full' && v.songs.length === 1 && v.songs[0].songId === songId);

// ---------- 움짤 ----------
const yunaE12 = videos.find((v) => v.eventId === 'e12' && v.pin);
const clips = [
  { id: 'c1', ext: 'webp', videoId: yunaE12.id, t: 42, end: 48, note: '엔딩 손하트' },
  { id: 'c2', ext: 'webp', videoId: yunaE12.id, t: 95, end: 99, note: '킬링파트 윙크' },
  { id: 'c3', ext: 'gif', videoId: findV('e4', 'g1s2', ['g1m2']).id, t: 61, end: 66, note: '하이라이트 턴' },
  { id: 'c4', ext: 'mp4', videoId: findFull('e5', 'g1s1').id, t: 120, end: 126, note: '단체 웨이브 안무' },
  { id: 'c5', ext: 'webp', videoId: null, eventId: 'e12', songId: 'g1s1', memberIds: ['g1m3'], t: null, end: null, note: '엔딩 요정 (원본 영상 없음)' },
  { id: 'c6', ext: 'webp', videoId: findV('e7', 'g1s1', ['g1m3']).id, t: 30, end: 35, note: '도입부 시선 처리' },
  { id: 'c7', ext: 'webp', videoId: findV('e17', 'g2s1', ['g2m3']).id, t: 77, end: 82, note: '브릿지 손동작' },
].map((c) => ({
  id: c.id, file: `clips/${c.id}.${c.ext}`, poster: `clips/posters/${c.id}.jpg`,
  videoId: c.videoId, t: c.t, end: c.end,
  eventId: c.eventId ?? null, songId: c.songId ?? null, memberIds: c.memberIds ?? [], note: c.note,
}));

const data = { version: 3, groups, events, videos, clips };

if (doData) {
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(join(ROOT, 'data/videos.json'), JSON.stringify(data, null, 2) + '\n');
  console.log(`data/videos.json: 그룹 ${groups.length}, 공연 ${events.length}, 영상 ${videos.length}, 움짤 ${clips.length}`);
}

// ---------- 움짤 파일 ----------
const W = 160, H = 240, FRAMES = 16, FPS = 10;
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function drawFrame(buf, bg, costume, f, order) {
  const [br, bgc, bb] = hexRgb(bg);
  for (let i = 0; i < W * H; i++) { buf[i * 3] = br; buf[i * 3 + 1] = bgc; buf[i * 3 + 2] = bb; }
  const blend = (x, y, rgb, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    buf[i] = Math.round(buf[i] * (1 - a) + rgb[0] * a);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + rgb[1] * a);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + rgb[2] * a);
  };
  // 바닥 타원(흰색 7%)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / 62, dy = (y - 221) / 13;
    if (dx * dx + dy * dy <= 1) blend(x, y, [255, 255, 255], 0.07);
  }
  const phase = (f / FRAMES) * Math.PI * 2;
  const s = 0.8;
  const cx = W / 2 + Math.sin(phase) * 10;
  const lift = Math.abs(Math.sin(phase * 2)) * 4;
  const col = hexRgb(order % 2 === 1 ? darken(costume, 0.2) : costume);
  const poly = (pts) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) blend(x, y, col, 1);
      }
    }
  };
  const P = (px, py) => [cx + px * s, 4 - lift + py * s];
  // 머리
  const [hx, hy] = P(0, 78);
  for (let y = -16; y <= 16; y++) for (let x = -16; x <= 16; x++) if (x * x + y * y <= 15.5 * 15.5) blend(Math.round(hx + x), Math.round(hy + y), col, 1);
  // 드레스
  poly([P(-14, 102), P(14, 102), P(22, 140), P(42 + Math.sin(phase) * 6, 212), P(-42 + Math.sin(phase) * 6, 212), P(-22, 140)]);
  // 팔 (흔들림)
  const arm = Math.sin(phase) * 26;
  poly([P(-14, 104), P(-30 - arm * 0.4, 160 - Math.max(0, arm)), P(-24 - arm * 0.4, 162 - Math.max(0, arm)), P(-8, 112)]);
  poly([P(14, 104), P(30 - arm * 0.4, 160 - Math.max(0, -arm)), P(24 - arm * 0.4, 162 - Math.max(0, -arm)), P(8, 112)]);
  // 다리
  poly([P(-16, 210), P(-6, 210), P(-6, 272), P(-16, 272)]);
  poly([P(6, 210), P(16, 210), P(16, 272), P(6, 272)]);
}

function ffmpeg(argsList, input) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argsList], { input, maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(r.error ? r.error.message : r.stderr.toString());
}

if (doClips) {
  const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
  mkdirSync(join(ROOT, 'clips/posters'), { recursive: true });
  const cur = existsSync(join(ROOT, 'data/videos.json')) ? JSON.parse(readFileSync(join(ROOT, 'data/videos.json'), 'utf8')) : data;
  const report = [];
  for (const c of cur.clips) {
    if (!c.file.startsWith('clips/c')) continue;
    const v = cur.videos.find((x) => x.id === c.videoId);
    const eventId = v ? v.eventId : c.eventId;
    const mids = v ? v.memberIds : c.memberIds;
    const g = cur.groups.find((gg) => gg.id === cur.events.find((e) => e.id === eventId).groupId);
    const order = mids.length === 1 ? g.members.find((m) => m.id === mids[0]).order : 0;
    const { bg, costume } = pickColors(eventId);
    const frames = Buffer.alloc(W * H * 3 * FRAMES);
    for (let f = 0; f < FRAMES; f++) {
      const fb = Buffer.alloc(W * H * 3);
      drawFrame(fb, bg, costume, f, order);
      fb.copy(frames, f * W * H * 3);
    }
    const rawIn = ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-'];
    if (!hasFfmpeg) { report.push(`${c.id}: ffmpeg가 없어 만들지 못함`); continue; }
    const out = join(ROOT, c.file);
    const ext = c.file.split('.').pop();
    if (ext === 'webp') ffmpeg([...rawIn, '-c:v', 'libwebp_anim', '-loop', '0', '-quality', '70', out], frames);
    else if (ext === 'gif') ffmpeg([...rawIn, '-vf', 'split[a][b];[a]palettegen=max_colors=32[p];[b][p]paletteuse', '-loop', '0', out], frames);
    else if (ext === 'mp4') ffmpeg([...rawIn, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-crf', '28', out], frames);
    ffmpeg([...rawIn, '-frames:v', '1', '-q:v', '4', join(ROOT, c.poster)], frames.subarray(0, W * H * 3));
    report.push(`${c.file} + ${c.poster}`);
  }
  console.log(report.join('\n'));
}
