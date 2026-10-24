#!/usr/bin/env node
// 영상 찾기 → 거르기 → 정확한 업로드 날짜 → 분류를 한 번에, 동시에 돌린다 (Node 20+, 의존성 없음)
//
//   node scripts/harvest.mjs 2026-10-01 2026-10-24 [--group g1] [--deep] [--out <폴더>] [--jobs 4]
//   node scripts/harvest.mjs --since-last [--group g1]        그룹마다 지난번 끝 날짜 3일 전부터 오늘까지
//   node scripts/harvest.mjs --gaps [--group g1] [--no-info]  멤버 직캠이 빈 음악 방송 공연만 멤버 × 날짜로 찾기
//
// 결과(<폴더>, 기본 .cache/harvest):
//   auto.json    확실한 영상. 그대로 node scripts/archive.mjs add <폴더>/auto.json --create-songs --dry-run → 실제 실행
//   review.txt   사람(Claude)이 볼 영상만 한 줄씩: 이유·제목·해석. 고친 값을 넣어 review.json에서 골라 add
//   review.json  같은 내용(요청 형식). 필요한 키만 채워 add에 넘긴다
//   summary.txt  걸러진 이유별 개수
// data/videos.json은 읽기만 한다. 쓰기는 archive.mjs add 하나만(동시에 여러 개 돌리지 않는다).
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTitle, excludedReason } from '../js/admin/parse.js';
import { BROADCAST_CHANNELS } from '../js/model.js';
import { search, videoInfo, relativeToDate, kstDate } from './lib/yt.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    if (['deep', 'since-last', 'help', 'no-info', 'gaps'].includes(k)) flags[k] = true;
    else flags[k] = argv[++i];
  } else pos.push(a);
}
if (flags.help || (!pos[0] && !flags['since-last'] && !flags.gaps)) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 15).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}

const data = JSON.parse(readFileSync(join(ROOT, 'data', 'videos.json'), 'utf8'));
const groups = flags.group ? data.groups.filter((g) => g.id === flags.group || g.name === flags.group) : data.groups;
if (!groups.length) { console.error(`✗ 그룹 ${flags.group}이 없어요`); process.exit(1); }
const OUT = resolve(flags.out || join(ROOT, '.cache', 'harvest'));
const CACHE = join(ROOT, '.cache', 'yt-meta.json');
const STATE = join(ROOT, '.cache', 'harvest-state.json');
const JOBS = Math.max(1, Math.min(8, Number(flags.jobs) || 4));
mkdirSync(OUT, { recursive: true });
const readJson = (p, d) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } };
const meta = readJson(CACHE, {});
const state = readJson(STATE, {});
const today = kstDate(new Date());
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 86400e3).toISOString().slice(0, 10);
const dayGap = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400e3);
const yymmdd = (d) => d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10);

async function pool(items, n, fn) {
  let i = 0, done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      await fn(items[k], k);
      done++;
      if (done % 25 === 0 || done === items.length) process.stdout.write(`\r  ${done}/${items.length} (${Math.round((Date.now() - t0) / 1000)}초)   `);
    }
  }));
  if (items.length) process.stdout.write('\n');
}

// ---------- 1) 검색: 날짜(YYMMDD) × 그룹 이름 ----------
// --gaps: 멤버 직캠이 빈 음악 방송 공연(사전녹화 제외)
const MUSIC_SHOWS = new Set(['뮤직뱅크', '인기가요', '쇼! 음악중심', '엠카운트다운', '더 쇼', '쇼챔피언']);
const gapEvents = flags.gaps ? data.events.filter((e) => groups.some((g) => g.id === e.groupId) && MUSIC_SHOWS.has(e.show) && !e.label).map((e) => {
  const g = groups.find((x) => x.id === e.groupId);
  const have = new Set(data.videos.filter((v) => v.eventId === e.id && v.type === 'fancam').flatMap((v) => v.memberIds));
  return { e, g, miss: g.members.filter((m) => m.active !== false && !have.has(m.id)) };
}).filter((x) => x.miss.length) : [];
const ranges = groups.map((g) => {
  if (flags.gaps) {
    const ds = gapEvents.filter((x) => x.g === g).map((x) => x.e.date).sort();
    return { g, from: ds[0] || today, to: ds.at(-1) || today };
  }
  let from = pos[0], to = pos[1] || today;
  if (flags['since-last']) { from = state[g.id] ? addDays(state[g.id], -3) : addDays(today, -14); to = today; }
  return { g, from, to };
});
const doneFile = join(OUT, 'done.txt');
const doneQ = new Set(existsSync(doneFile) ? readFileSync(doneFile, 'utf8').split('\n') : []);
const found = readJson(join(OUT, 'found.json'), {});
const queries = [];
if (flags.gaps) {
  for (const { e, g, miss } of gapEvents) for (const m of miss) {
    queries.push({ g, day: e.date, q: `${g.name} ${m.name} 직캠 ${yymmdd(e.date)}`, pages: 2 });
    if (m.aliases?.[0] && g.en) queries.push({ g, day: e.date, q: `${g.en} ${m.aliases[0]} fancam ${yymmdd(e.date)}`, pages: 2 });
  }
} else for (const { g, from, to } of ranges) {
  for (let d = from; d <= to; d = addDays(d, 1)) for (const n of [g.name, g.en].filter(Boolean)) queries.push({ g, day: d, q: `${n} ${yymmdd(d)}`, pages: 5 });
}
const runQueries = async (list, label) => {
  const todo = list.filter((x) => !doneQ.has(x.q));
  console.log(`${label}: 검색 ${todo.length}개 (이미 한 것 ${list.length - todo.length}개 건너뜀, 동시 ${JOBS}개)`);
  await pool(todo, JOBS, async (x) => {
    await new Promise((r) => setTimeout(r, Math.random() * 400));
    const r = await search(x.q, { pages: x.pages });
    if (!r) return; // 실패한 검색은 done에 안 남겨 다음에 다시
    for (const v of r) if (!found[v.id]) found[v.id] = { ...v, g: x.g.id, day: x.day };
    doneQ.add(x.q);
    appendFileSync(doneFile, `${x.q}\n`);
  });
  writeFileSync(join(OUT, 'found.json'), JSON.stringify(found));
};
await runQueries(queries, '날짜별');
if (flags.deep) {
  // 후보가 5개 이상인 (그룹, 날짜): 멤버 × 날짜로 더 찾는다
  const cnt = {};
  for (const v of Object.values(found)) { const k = `${v.g} ${v.day}`; cnt[k] = (cnt[k] || 0) + 1; }
  const deep = [];
  for (const [k, c] of Object.entries(cnt)) {
    if (c < 5) continue;
    const [gid, day] = k.split(' ');
    const g = groups.find((x) => x.id === gid);
    if (!g) continue;
    for (const m of g.members.filter((x) => x.active !== false)) {
      deep.push({ g, day, q: `${m.name} 직캠 ${yymmdd(day)}`, pages: 3 });
      if (m.aliases?.[0]) deep.push({ g, day, q: `${m.aliases[0]} fancam ${yymmdd(day)}`, pages: 3 });
    }
  }
  await runQueries(deep, '멤버별(deep)');
}

// ---------- 2) 거르기(정보 없이 할 수 있는 것부터) ----------
const have = new Set(data.videos.map((v) => v.ytId));
const groupHits = (title) => {
  const t = String(title || '').toLowerCase();
  return data.groups.filter((g) => [g.name, g.en].filter(Boolean).some((w) => {
    const x = w.toLowerCase();
    return /^[a-z0-9 ]+$/.test(x) ? new RegExp(`(^|[^a-z0-9])${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(t) : t.includes(x);
  }));
};
const official = (ch) => BROADCAST_CHANNELS.some((c) => c.toLowerCase() === String(ch || '').toLowerCase().trim());
const reject = {};
const rej = (why) => { reject[why] = (reject[why] || 0) + 1; };
const fancamsByChannel = {};
for (const v of Object.values(found)) if (/직캠|fancam/i.test(v.title)) fancamsByChannel[v.ch] = (fancamsByChannel[v.ch] || 0) + 1;
const cands = [];
for (const v of Object.values(found)) {
  if (have.has(v.id)) { rej('이미 담음'); continue; }
  const hits = groupHits(v.title);
  if (hits.length !== 1) { rej(hits.length ? '그룹 여럿' : '그룹 이름 없음'); continue; }
  const g = hits[0];
  if (!groups.includes(g)) { rej('다른 그룹'); continue; }
  const ex = excludedReason(v.title, v.ch);
  if (ex) { rej(`제외: ${ex}`); continue; }
  cands.push({ ...v, g });
}

// ---------- 3) 정확한 업로드 날짜·조회수 (동시에, 캐시) ----------
const needInfo = flags['no-info'] ? [] : cands.filter((c) => !meta[c.id]?.uploaded);
console.log(`정보 불러오기: ${needInfo.length}개 (캐시 ${cands.length - needInfo.length}개, 동시 ${Math.min(8, JOBS * 2)}개)`);
await pool(needInfo, Math.min(8, JOBS * 2), async (c) => {
  const x = await videoInfo(c.id);
  if (x) meta[c.id] = { ...(meta[c.id] || {}), ...Object.fromEntries(Object.entries(x).filter(([, val]) => val != null && val !== '')), at: today };
});
mkdirSync(dirname(CACHE), { recursive: true });
writeFileSync(CACHE, JSON.stringify(meta));

// ---------- 4) 분류 ----------
const evByGroupDay = new Map();
for (const e of data.events) { const k = `${e.groupId}|${e.date}`; (evByGroupDay.get(k) || evByGroupDay.set(k, []).get(k)).push(e); }
const auto = [], review = [];
const NEWS_CH = /MBN|뉴스|news|스타뉴스|STARPLUS|연합|YTN|디스패치|dispatch|스포츠|일간|TV리포트|bnt|텐아시아|엑스포츠|OSEN|마이데일리/i;
const STAGE_WORD = /직캠|fancam|facecam|cam\b|stage|무대|full|콘서트|concert|축제|festival|performance|공연|live|라이브|encore|앵콜|tour|투어|@/i;
const rangeOf = new Map(ranges.map((r) => [r.g.id, r]));
for (const c of cands) {
  const m = meta[c.id] || {};
  const title = m.title || c.title, channel = m.channel || c.ch;
  const views = m.views ?? c.views;
  const quality = /4k|8k|60p|fancam/i.test(title) || (fancamsByChannel[c.ch] || 0) >= 5;
  if (!official(channel) && views != null && views < (quality ? 1000 : 2000)) { rej('조회수 적음'); continue; }
  const approx = !m.uploaded ? relativeToDate(c.pub) : null;
  const uploaded = m.uploaded || null;
  const p = parseTitle(title, c.g, { channel, uploaded });
  const why = [];
  // 무대라는 근거: 곡이 있거나 무대 낱말이 있어야 자동으로 담는다(예능·뉴스 영상이 업로드 날짜로 공연에 붙지 않게)
  const staged = p.songIds.length > 0 || STAGE_WORD.test(title);
  if (NEWS_CH.test(channel)) why.push(`뉴스·예능 채널(${channel})`);
  if (!staged) why.push('곡도 무대 낱말도 없음');
  let date = p.date;
  const { from, to } = rangeOf.get(c.g.id);
  if (date && (date < addDays(from, -7) || date > to)) { rej('기간 밖'); continue; }
  if (date && uploaded && dayGap(date, uploaded) > 1) why.push(`제목 날짜 ${date}가 업로드 ${uploaded}보다 늦음`);
  if (date && uploaded && dayGap(uploaded, date) > 60) why.push(`업로드가 공연보다 ${dayGap(uploaded, date)}일 늦음`);
  if (!date) {
    const up = uploaded || approx?.date;
    const near = up ? data.events.filter((e) => e.groupId === c.g.id && dayGap(up, e.date) >= 0 && dayGap(up, e.date) <= 7) : [];
    if (uploaded && near.length === 1 && staged) date = near[0].date; // archive add가 같은 규칙으로 정한다
    else why.push(`제목에 날짜 없음${up ? ` (업로드 ${up}${uploaded ? '' : ' 추정'}, 앞 7일 공연 ${near.map((e) => `${e.date} ${e.show}`).join(', ') || '없음'})` : ''}`);
  }
  const day = date ? evByGroupDay.get(`${c.g.id}|${date}`) || [] : [];
  if (!p.show && day.length !== 1) why.push('행사 없음');
  if (p.show && p.showConf !== 'known' && !day.length) why.push(`새 행사 "${p.show}"(확실하지 않음)`);
  const type = p.type || (p.memberIds.length ? 'fancam' : null);
  if (!type) why.push('풀캠/직캠 모름');
  if (type === 'fancam' && !p.memberIds.length && !p.groupCam) why.push('멤버 없음');
  if (!p.songIds.length && !p.songGuess) why.push('곡 없음');
  else if (!p.songIds.length) why.push(`새 곡? '${p.songGuess}'`);
  const req = { url: `https://youtu.be/${c.id}`, title, channel, ...(uploaded ? { uploaded } : {}) };
  if (!why.length) auto.push(req);
  else review.push({ ...req, why, parsed: { date, show: p.show, conf: p.showConf, members: p.memberIds, song: p.songIds, type }, views });
}

writeFileSync(join(OUT, 'auto.json'), `${JSON.stringify({ videos: auto }, null, 1)}\n`);
writeFileSync(join(OUT, 'review.json'), `${JSON.stringify({ videos: review.map(({ why, parsed, views, ...r }) => r) }, null, 1)}\n`);
writeFileSync(join(OUT, 'review.txt'), review.map((r, i) => `${String(i).padStart(3)} ${r.url.slice(-11)} [${r.why.join(' / ')}] ${r.title} · ${r.channel}${r.uploaded ? ` · 업로드 ${r.uploaded}` : ''}${r.views != null ? ` · ${r.views}회` : ''}`).join('\n') + (review.length ? '\n' : ''));
const sum = [`후보 ${Object.keys(found).length} → 확실 ${auto.length} · 확인 필요 ${review.length}`, ...Object.entries(reject).sort((a, b) => b[1] - a[1]).map(([k, n]) => `  걸러짐 ${k}: ${n}`)].join('\n');
writeFileSync(join(OUT, 'summary.txt'), `${sum}\n`);
// 검색을 모두 마친 그룹만 '어디까지 찾았는지'를 남긴다(--since-last가 실패한 날을 건너뛰지 않게)
if (!flags.gaps) for (const { g, to } of ranges) if (queries.filter((x) => x.g === g).every((x) => doneQ.has(x.q)) && (!state[g.id] || state[g.id] < to)) state[g.id] = to;
writeFileSync(STATE, JSON.stringify(state, null, 1));
console.log(`\n${sum}\n\n다음:\n  node scripts/archive.mjs add ${join(OUT, 'auto.json')} --create-songs --dry-run\n  확인 필요: ${join(OUT, 'review.txt')}`);
