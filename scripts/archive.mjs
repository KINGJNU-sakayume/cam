#!/usr/bin/env node
// 무대 서랍 데이터 명령줄 도구 (Node 20+, 의존성 없음)
// Claude(또는 사람)가 data/videos.json을 손으로 고치지 않고 안전하게 바꾸기 위한 도구.
// 관리 화면과 같은 해석(js/admin/parse.js)·검증(js/validate-core.js) 규칙을 쓴다.
// 모든 쓰기 명령은 --dry-run을 지원하고, 쓰기 뒤 검증에 실패하면 원래 파일로 되돌린다.
//
//   node scripts/archive.mjs help
import { readFileSync, writeFileSync, existsSync, statSync, copyFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData, fileRefs } from '../js/validate-core.js';
import { extractYt, parseTitle, parseFileName, fetchOEmbed, findDate, sameShow, showKey, excludedReason } from '../js/admin/parse.js';
import { GROUP_KEY, DEFAULT_COLORS, cellKey, isSampleYt } from '../js/model.js';
import { isRealDate, parseTime, fmtTime, norm, dateForms } from '../js/util.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
// --키 값 / --키=값 / --불리언
const BOOL = new Set(['reorder', 'dry-run', 'no-fetch', 'yes', 'undo', 'cascade', 'json', 'with-empty-event', 'create-songs', 'keep-groups', 'skip-invalid', 'inactive', 'help']);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    const k = eq < 0 ? a.slice(2) : a.slice(2, eq);
    if (eq >= 0) flags[k] = a.slice(eq + 1);
    else if (!BOOL.has(k) && i + 1 < argv.length && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
    else flags[k] = true;
  } else pos.push(a);
}
const cmd = pos.shift();

const DATA = resolve(flags.data || join(HERE, '..', 'data', 'videos.json'));
const ROOT = resolve(dirname(DATA), '..');
const DRY = !!flags['dry-run'];
const MAX = 25 * 1024 * 1024, WARN = 8 * 1024 * 1024;

const out = (...a) => console.log(...a);
const warns = [];
const warn = (m) => { warns.push(m); console.log(`  ! ${m}`); };
function die(msg, code = 1) { console.error(`✗ ${msg}`); process.exit(code); }

// ---------- 데이터 읽기·쓰기 ----------
const original = readFileSync(DATA, 'utf8');
const data = JSON.parse(original);
for (const k of ['groups', 'events', 'videos', 'clips']) if (!Array.isArray(data[k])) data[k] = [];
const created = []; // 이번 명령으로 새로 만든 파일(실패 시 지움)

function serialize(d) {
  return `${JSON.stringify(JSON.parse(JSON.stringify(d, (k, v) => (k.startsWith('_') ? undefined : v))), null, 2)}\n`;
}
function fullCheck(d) {
  const errs = validateData(JSON.parse(serialize(d))).map((e) => e.text);
  for (const r of fileRefs(d)) {
    const p = join(ROOT, r.path);
    if (!existsSync(p)) errs.push(`${r.where}: ${r.field} 파일 ${r.path}이 없어요`);
    else if (r.clip && statSync(p).size > MAX) errs.push(`${r.where}: 움짤 ${r.path}이 25MB를 넘어요`);
  }
  return errs;
}
function save(summary) {
  const errs = fullCheck(data);
  if (errs.length) {
    for (const f of created) { try { unlinkSync(f); } catch { /* 없음 */ } }
    console.error('✗ 검증에 실패해서 아무것도 쓰지 않았어요:');
    for (const e of errs.slice(0, 30)) console.error(`  - ${e}`);
    process.exit(1);
  }
  if (DRY) {
    for (const f of created) { try { unlinkSync(f); } catch { /* 없음 */ } }
    out(`\n(--dry-run) 검증 통과. 실제로는 쓰지 않았어요. ${summary || ''}`);
    return;
  }
  writeFileSync(DATA, serialize(data));
  out(`\n✓ 저장했어요: ${DATA.replace(`${ROOT}/`, '')}${summary ? ` · ${summary}` : ''}`);
}

// ---------- 찾기 도우미 ----------
const groupById = (id) => data.groups.find((g) => g.id === id);
const eventById = (id) => data.events.find((e) => e.id === id);
const membersOf = (g) => [...g.members].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const songsOf = (g) => [...g.songs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const lc = (s) => String(s ?? '').trim().toLowerCase();

function resolveGroup(q) {
  if (!q) {
    if (data.groups.length === 1) return data.groups[0];
    die(`그룹을 정해 주세요 (${data.groups.map((g) => g.name).join(', ')})`);
  }
  const g = data.groups.find((x) => [x.id, x.name, x.en].some((v) => v && lc(v) === lc(q)));
  if (!g) die(`그룹 "${q}"을 찾지 못했어요. 있는 그룹: ${data.groups.map((x) => `${x.name}(${x.id})`).join(', ') || '없음'}. 새 그룹이면 add-group을 먼저 쓰세요.`);
  return g;
}
function resolveMember(g, q) {
  if (['단체', 'group', GROUP_KEY].includes(lc(q))) return GROUP_KEY;
  const m = g.members.find((x) => [x.id, x.name, ...(x.aliases || [])].some((v) => v && lc(v) === lc(q)));
  if (!m) die(`${g.name}에 멤버 "${q}"이 없어요. 멤버: ${membersOf(g).map((x) => x.name).join(', ')}. 새 멤버면 add-member를 먼저 쓰세요.`);
  return m.id;
}
function resolveSong(g, q, { create = false } = {}) {
  if (q == null || ['전체 공연', '전체공연', 'none', ''].includes(lc(q))) return null;
  const s = g.songs.find((x) => [x.id, x.title, ...(x.aliases || [])].some((v) => v && lc(v) === lc(q)));
  if (s) return s.id;
  if (create) {
    const ns = { id: nextId(`${g.id}s`, data.groups.flatMap((x) => x.songs.map((y) => y.id))), title: String(q).trim(), aliases: [], order: g.songs.length + 1, release: '' };
    g.songs.push(ns);
    out(`  + 새 곡 ${ns.title} (${ns.id})`);
    return ns.id;
  }
  die(`${g.name}에 곡 "${q}"이 없어요. 곡: ${songsOf(g).map((x) => x.title).join(', ')}. 새 곡이면 add-song을 먼저 쓰거나 --create-songs를 붙이세요.`);
}
function nextId(prefix, ids) {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const id of ids) { const m = re.exec(id); if (m) max = Math.max(max, +m[1]); }
  return `${prefix}${max + 1}`;
}
function normDate(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (isRealDate(t)) return t;
  const d = findDate(t.replace(/[.\-/ ]/g, ''));
  if (d) return d.iso;
  die(`날짜 "${s}"를 읽지 못했어요. 2026-10-23, 261023, 20261023 중 하나로 주세요.`);
}
function findVideo(q) {
  const v = data.videos.find((x) => x.id === q || x.ytId === q) || (extractYt(q) && data.videos.find((x) => x.ytId === extractYt(q).id));
  if (!v) die(`영상 "${q}"을 찾지 못했어요. find로 먼저 찾아보세요.`);
  return v;
}
const memberName = (id) => { for (const g of data.groups) { const m = g.members.find((x) => x.id === id); if (m) return m.name; } return id; };
const songTitle = (id) => { for (const g of data.groups) { const s = g.songs.find((x) => x.id === id); if (s) return s.title; } return id; };
const evLabel = (e) => (e ? `${e.date} ${e.show}${e.label ? ` ${e.label}` : ''}` : '?');
const whoOf = (v) => (v.type === 'full' ? '풀캠' : v.memberIds.length ? v.memberIds.map(memberName).join('·') : '단체');
const songsOfV = (v) => (v.songs.length ? v.songs.map((s) => `${songTitle(s.songId)}${s.t ? `@${fmtTime(s.t)}` : ''}`).join(' + ') : '전체 공연');
const srcOf = (v) => (v.source === 'official' ? '공식' : v.source === 'fan' ? '팬' : '출처 모름');
const vLine = (v) => `${v.id.padEnd(6)} ${evLabel(eventById(v.eventId))} · ${songsOfV(v)} · ${whoOf(v)} · ${srcOf(v)}${v.tags?.length ? ` ${v.tags.join(',')}` : ''}${v.pin ? ' · 대표' : ''}${v.gone ? ' · 삭제됨' : ''} · ${v.ytId} · ${v.title || ''}`;

function readRequest(src) {
  let text;
  if (!src || src === '-') text = readFileSync(0, 'utf8');
  else if (existsSync(src)) text = readFileSync(src, 'utf8');
  else text = src;
  try { return JSON.parse(text); } catch (e) { die(`요청 JSON을 읽지 못했어요: ${e.message}`); }
}

// ---------- 명령 ----------
const COMMANDS = {
  help() {
    out(`무대 서랍 데이터 도구 — node scripts/archive.mjs <명령> [옵션]

읽기
  status                         그룹·멤버·곡·공연 수, 샘플 여부, 최근 공연
  find <단어...>                 영상·공연·움짤 검색 (날짜 261023·10.23, 멤버·곡 이름, ytId, id)
  show <id>                      항목 JSON과 맥락
  events [그룹]                  공연 목록 (id, 날짜, 행사, setlist, 영상 수)

담기
  add <요청.json | ->            영상 담기. 링크만 줘도 제목으로 그룹·날짜·행사를 읽어 공연별로 나눠요 (형식: add --help)
  add-clip <파일> [옵션]          움짤 파일 담기 (형식: add-clip --help)

고치기
  set <id> 키=값 ...             영상·공연·움짤·멤버·곡·그룹 필드 고치기 (형식: set --help)
  gone <영상id|ytId> [--undo]    삭제·비공개 표시(또는 해제)
  pin <영상id>                   칸 대표로 (같은 칸 다른 영상은 해제)
  cover <공연id> <영상id|auto>   공연 표지
  remove <id> [--cascade] [--with-empty-event]   영상·공연·움짤 지우기
  merge <남길공연id> <합칠공연id>...   같은 행사가 쪼개진 공연을 하나로 (--show 로 이름도 지정)
  dedupe-events                  같은 그룹·날짜의 같은 행사(이름 표기만 다른) 공연을 모두 합치기

그룹·멤버·곡
  roster <그룹정보.json> [--reorder]   그룹·멤버·곡을 한 번에 등록·보강 (형식: roster --help)
  add-group <이름> [--en ENG] [--hue 0-360]
  add-member <그룹> <이름> [--alias A,B] [--color #rrggbb] [--inactive]
  add-song <그룹> <곡명> [--alias A,B] [--release YYYY-MM-DD]
  move <멤버id|곡id> <새 순서(1부터)>

정리
  clear-samples [--yes] [--keep-groups]   샘플(SMPL…) 영상·움짤과 빈 공연·그룹 지우기
  validate                       scripts/validate.mjs 실행

공통 옵션: --dry-run(쓰지 않고 계획만), --data <경로>`);
  },

  status() {
    const samples = data.videos.filter((v) => isSampleYt(v.ytId)).length;
    out(`영상 ${data.videos.length} (샘플 ${samples}) · 공연 ${data.events.length} · 움짤 ${data.clips.length}`);
    for (const g of data.groups) {
      const evs = data.events.filter((e) => e.groupId === g.id).sort((a, b) => b.date.localeCompare(a.date));
      const nv = data.videos.filter((v) => evs.some((e) => e.id === v.eventId)).length;
      out(`\n[${g.id}] ${g.name}${g.en ? ` (${g.en})` : ''} · hue ${g.hue} · 공연 ${evs.length} · 영상 ${nv}`);
      out(`  멤버: ${membersOf(g).map((m) => `${m.name}(${m.id}${m.active === false ? ', 활동 종료' : ''}${m.aliases?.length ? `, ${m.aliases.join('/')}` : ''})`).join(' ')}`);
      out(`  곡:   ${songsOf(g).map((s) => `${s.title}(${s.id}${s.aliases?.length ? `, ${s.aliases.join('/')}` : ''})`).join(' ')}`);
      for (const e of evs.slice(0, 5)) out(`  최근: ${e.id} ${evLabel(e)}`);
    }
    if (samples) out(`\n샘플 데이터가 섞여 있어요. 실제 데이터만 남기려면 clear-samples를 쓰세요(사용자 확인 후).`);
  },

  find() {
    const toks = norm(pos.join(' ')).split(' ').filter(Boolean);
    if (!toks.length) die('찾을 단어를 주세요.');
    const hay = (parts) => norm(parts.filter(Boolean).join(' '));
    const evText = (e) => { const g = groupById(e?.groupId); return e ? [e.id, g?.name, g?.en, e.show, e.label, e.note, ...dateForms(e.date)] : []; };
    let n = 0;
    for (const e of data.events) {
      if (toks.every((t) => hay([...evText(e), '공연']).includes(t))) { out(`${e.id.padEnd(6)} 공연 ${evLabel(e)} · ${groupById(e.groupId)?.name} · 영상 ${data.videos.filter((v) => v.eventId === e.id).length}${e.note ? ` · ${e.note}` : ''}`); n++; }
    }
    for (const v of data.videos) {
      const e = eventById(v.eventId);
      const t = hay([...evText(e), v.id, v.ytId, v.title, v.channel, ...(v.tags || []), whoOf(v), ...v.memberIds.flatMap((id) => { const g = groupById(e?.groupId); const m = g?.members.find((x) => x.id === id); return m ? [m.name, ...(m.aliases || [])] : []; }), ...v.songs.flatMap((s) => { const g = groupById(e?.groupId); const so = g?.songs.find((x) => x.id === s.songId); return so ? [so.title, ...(so.aliases || [])] : []; }), v.type === 'full' ? '풀캠 full' : '직캠 fancam']);
      if (toks.every((tk) => t.includes(tk))) { out(vLine(v)); n++; }
    }
    for (const c of data.clips) {
      const v = c.videoId ? data.videos.find((x) => x.id === c.videoId) : null;
      const e = eventById(v ? v.eventId : c.eventId);
      if (toks.every((tk) => hay([...evText(e), c.id, c.file, c.note, '움짤', v?.title]).includes(tk))) { out(`${c.id.padEnd(6)} 움짤 ${evLabel(e)} · ${c.note || ''} · ${c.file}${v ? ` · 원본 ${v.id}` : ' · 원본 없음'}`); n++; }
    }
    if (!n) out('찾은 항목이 없어요.');
  },

  show() {
    const id = pos[0];
    const all = [...data.groups, ...data.groups.flatMap((g) => [...g.members, ...g.songs]), ...data.events, ...data.videos, ...data.clips];
    const x = all.find((y) => y.id === id) || data.videos.find((v) => v.ytId === id);
    if (!x) die(`"${id}"을 찾지 못했어요.`);
    out(JSON.stringify(x, null, 2));
    if (x.ytId) out(`\n${vLine(x)}`);
  },

  events() {
    const g = pos[0] ? resolveGroup(pos[0]) : null;
    const list = data.events.filter((e) => !g || e.groupId === g.id).sort((a, b) => b.date.localeCompare(a.date));
    for (const e of list) out(`${e.id.padEnd(6)} ${evLabel(e)} · ${groupById(e.groupId)?.name} · setlist ${(e.setlist || []).map(songTitle).join(' → ') || '-'} · 영상 ${data.videos.filter((v) => v.eventId === e.id).length}${e.note ? ` · ${e.note}` : ''}`);
  },

  // ---------- 담기 (공연 하나 또는 제목으로 여러 공연에 나눠서) ----------
  async add() {
    if (flags.help) {
      out(`add <요청.json | - | JSON 문자열> [--dry-run] [--no-fetch] [--create-songs] [--skip-invalid]

공연 정보(group·date·show·label)는 모두 선택이에요. 빠진 값은 링크마다 제목에서 읽어요
(그룹명·영문명, 6·8자리 날짜, 뮤직뱅크·인기가요·쇼! 음악중심·엠카운트다운·더 쇼·쇼챔피언 또는 "@행사명", 사녹 → label 사전녹화).
그래서 링크만 주면 날짜·행사별로 공연을 알아서 나눠 담아요. 영상마다 같은 키로 덮어쓸 수도 있어요.

{
  "group": "르니에",                 // 선택. id·이름·영문명
  "date": "2026-10-23",              // 선택. 261023 등도 가능
  "show": "뮤직뱅크",                // 선택
  "label": "",                       // 선택. 같은 날 행사가 둘이면 "사전녹화" 등
  "note": "레드 투피스",              // 선택. 공연이 하나로 정해질 때만
  "setlist": ["Paper Moon", "Static"], // 선택. 공연이 하나로 정해질 때만. 주면 덮어씀
  "videos": [
    { "url": "https://youtu.be/…?t=30",
      "group": "…", "date": "…", "show": "…", "label": "…",   // 선택. 이 영상만 다른 공연일 때
      "title": "…", "channel": "…",          // 선택. 없으면 oEmbed → 실패하면 비움
      "type": "fancam" | "full",              // 선택. 없으면 제목에서
      "members": ["유나"] | ["단체"] | ["도희","세린"],  // 직캠은 필수(제목에서 못 찾으면 오류)
      "song": "Paper Moon" | "전체 공연",     // 선택. 없으면 제목 → setlist가 한 곡이면 그 곡
      "songs": [{"song": "Paper Moon", "t": 0}, {"song": "Static", "t": 214}],  // 두 곡이 든 영상
      "t": 30,                                // 곡 시작 초(없으면 URL의 t=)
      "source": "official" | "fan" | null,    // 선택. 방송사 채널이면 official
      "tags": ["4K", "세로"], "pin": false, "thumbPos": "50% 30%" }
  ]
}

--create-songs: 곡이 그룹에 없으면 만든다(요청의 곡명, 또는 제목의 따옴표 안 곡명)`);
      return;
    }
    const req = readRequest(pos[0]);
    if (Array.isArray(req)) die('요청은 { "videos": [...] } 형태의 객체여야 해요.');
    const create = !!flags['create-songs'] || !!req.createSongs;
    const errors = [];
    const items = [];
    const seen = new Set();

    // 1) 링크마다 제목을 불러오고 그룹·공연을 정한다
    for (const [i, r0] of (req.videos || []).entries()) {
      const r = typeof r0 === 'string' ? { url: r0 } : r0;
      const tag = `videos[${i}]`;
      const yt = extractYt(r.url || r.ytId);
      if (!yt) { errors.push(`${tag}: 유튜브 주소를 읽지 못했어요 (${r.url})`); continue; }
      const dup = data.videos.find((v) => v.ytId === yt.id);
      if (dup) { warn(`${tag}: ${yt.id}는 이미 담았어요 → ${dup.id} ${evLabel(eventById(dup.eventId))}. 건너뜀`); continue; }
      if (seen.has(yt.id)) { warn(`${tag}: 요청 안에서 같은 영상이 또 나와요. 건너뜀`); continue; }
      seen.add(yt.id);
      let title = r.title ?? '', channel = r.channel ?? '';
      const auto = [];
      if ((!r.title || !r.channel) && !flags['no-fetch']) {
        const o = await fetchOEmbed(yt.id);
        if (o.ok) { if (!r.title) { title = o.title; auto.push('제목'); } if (!r.channel) { channel = o.channel; auto.push('채널'); } }
        else if (o.status === 401 || o.status === 404) warn(`${tag}: oEmbed가 ${o.status}를 돌려줬어요. 삭제·비공개 영상일 수 있어요.`);
        else warn(`${tag}: 제목·채널을 불러오지 못했어요(${o.error || o.status}). 제목이 없으면 자동 해석도 못 해요.`);
      }
      const where = `${tag} ${yt.id}`;
      const ctx = `(제목: ${title || '없음'})`;
      const exWhy = (r.include ?? req.include) ? null : excludedReason(title, channel);
      if (exWhy) { out(`  - 제외 ${where}: ${exWhy} ${ctx}`); continue; }
      // 그룹: 영상 → 요청 → 제목
      let g = null;
      const gq = r.group ?? req.group;
      if (gq) g = resolveGroup(gq);
      else {
        const hits = findGroupsIn(title);
        if (hits.length === 1) { g = hits[0]; auto.push(`그룹=${g.name}`); }
        else if (hits.length > 1) { errors.push(`${where}: 제목에 그룹이 여럿이에요(${hits.map((x) => x.name).join(', ')}). "group"을 주세요. ${ctx}`); continue; }
        else if (data.groups.length === 1 && !title) g = data.groups[0];
        else { errors.push(`${where}: 그룹을 정할 수 없어요. 등록된 그룹(${data.groups.map((x) => x.name).join(', ') || '없음'})이 제목에 없어요. 새 그룹이면 register-group 스킬로 먼저 등록하고, 아니면 "group"을 주세요. ${ctx}`); continue; }
      }
      const p = parseTitle(title, g, { channel });
      // 공연: 영상 → 요청 → 제목
      const date = (r.date ?? req.date) ? normDate(r.date ?? req.date) : p.date;
      const show = String((r.show ?? req.show) || p.show || '').trim();
      const labelSrc = r.label ?? req.label;
      const label = String(labelSrc != null ? labelSrc : (p.label || '')).trim();
      if (!(r.date ?? req.date) && p.date) auto.push(`날짜=${p.date}`);
      if (!(r.show ?? req.show) && p.show) auto.push(`행사=${p.show}`);
      if (labelSrc == null && p.label) auto.push(`label=${p.label}`);
      if (!date) { errors.push(`${where}: 날짜를 정할 수 없어요. "date"를 주세요. ${ctx}`); continue; }
      if (!show) { errors.push(`${where}: 행사를 정할 수 없어요. "show"(예: 뮤직뱅크)를 주세요. ${ctx}`); continue; }
      if ((r.date ?? req.date) && p.date && p.date !== date) warn(`${where}: 제목의 날짜 ${p.date}가 공연 날짜 ${date}와 달라요.`);
      items.push({ tag: where, r, yt, title, channel, auto, g, p, date, show, label, ctx });
    }

    // 2) 공연별로 묶는다(기존 공연이면 거기에, 없으면 새로). 같은 행사의 다른 표기(도시·방송사·연도 차이)는 한 공연으로 본다
    for (const it of items) {
      const ex = data.events.find((e) => e.groupId === it.g.id && e.date === it.date && (e.label || '').trim() === it.label && sameShow(e.show, it.show));
      if (ex) it.show = ex.show.trim();
    }
    const bestShow = new Map();
    const skey = (it) => [it.g.id, it.date, it.label, showKey(it.show)].join('|');
    for (const it of items) if (!bestShow.has(skey(it)) || it.show.length > bestShow.get(skey(it)).length) bestShow.set(skey(it), it.show);
    for (const it of items) it.show = bestShow.get(skey(it));
    const buckets = new Map();
    for (const it of items) {
      const key = [it.g.id, it.date, it.show, it.label].join('|');
      if (!buckets.has(key)) buckets.set(key, { g: it.g, date: it.date, show: it.show, label: it.label, items: [] });
      buckets.get(key).items.push(it);
    }
    const single = buckets.size === 1;
    if (!single && (req.setlist || req.note)) warn('공연이 여러 개로 나뉘어서 요청의 setlist·note는 쓰지 않았어요. 공연별로 set 명령으로 넣으세요.');
    const added = [];
    const touched = [];
    for (const b of [...buckets.values()].sort((a, c) => a.date.localeCompare(c.date))) {
      const { g } = b;
      let ev = data.events.find((e) => e.groupId === g.id && e.date === b.date && e.show.trim() === b.show && (e.label || '').trim() === b.label);
      const sameDay = data.events.filter((e) => e.groupId === g.id && e.date === b.date && e !== ev);
      out(`\n공연: ${ev ? `기존 ${ev.id} ${evLabel(ev)} 에 추가` : `새로 만듦 ${b.date} ${b.show}${b.label ? ` ${b.label}` : ''}`} · ${g.name}`);
      if (!ev && sameDay.length) warn(`같은 날 다른 공연이 있어요: ${sameDay.map((e) => `${e.id} ${evLabel(e)}`).join(', ')}. 같은 공연이면 show·label을 맞추세요.`);
      const isNew = !ev;
      if (!ev) {
        ev = { id: nextId('e', data.events.map((e) => e.id)), groupId: g.id, date: b.date, show: b.show, label: b.label, setlist: [], note: '' };
        data.events.push(ev);
      }
      if (single && Array.isArray(req.setlist)) {
        const sl = req.setlist.map((s) => resolveSong(g, s, { create })).filter(Boolean);
        if (ev.setlist?.length && ev.setlist.join() !== sl.join()) warn(`setlist를 ${ev.setlist.map(songTitle).join(' → ')} 에서 ${sl.map(songTitle).join(' → ')} 로 바꿔요.`);
        ev.setlist = sl;
      }
      if (single && req.note != null && String(req.note).trim()) ev.note = String(req.note).trim();
      const effSetlist = ev.setlist || [];
      const before = added.length;
      for (const it of b.items) {
        const v = buildVideo(it, ev, effSetlist, create, errors);
        if (!v) continue;
        if (v.pin) unpinOthers(v);
        data.videos.push(v);
        added.push(v);
        out(`  + ${vLine(v)}${it.auto.length ? `\n      자동: ${it.auto.join(', ')}` : ''}`);
      }
      if (!ev.setlist?.length) {
        const order = [];
        for (const v of data.videos.filter((x) => x.eventId === ev.id)) for (const s of v.songs) if (!order.includes(s.songId)) order.push(s.songId);
        if (order.length) ev.setlist = order;
      }
      if (added.length === before && isNew) data.events = data.events.filter((e) => e !== ev);
      else touched.push(ev);
    }

    if (errors.length) {
      console.error(`\n✗ 정할 수 없는 영상 ${errors.length}개:`);
      for (const e of errors) console.error(`  - ${e}`);
      if (!flags['skip-invalid']) { console.error('\n아무것도 쓰지 않았어요. 요청을 고치거나 --skip-invalid로 나머지만 담으세요.'); process.exit(2); }
    }
    if (!added.length) { out('\n담을 새 영상이 없어요.'); return; }
    const summary = touched.map((e) => `${evLabel(e)} (${e.id}) ${added.filter((v) => v.eventId === e.id).length}개 · 보기: index.html#g=${e.groupId}&e=${e.id}`).join('\n  ');
    save(`영상 ${added.length}개\n  ${summary}`);
  },

  // ---------- 움짤 ----------
  'add-clip'() {
    if (flags.help || !pos[0]) {
      out(`add-clip <파일> [--video <영상id|ytId>] [--event <공연id>] [--song <곡>] [--members 유나,도희] [--group <그룹>]
         [--t 0:42] [--end 0:48] [--note "엔딩 손하트"] [--dry-run]

- webp·gif·mp4·webm. 25MB 넘으면 거부, 8MB 넘으면 경고(ffmpeg로 줄이기 권장)
- --video를 주면 공연·곡·멤버를 그 영상에서 가져와요. 없으면 --event(+ --song, --members)
- 둘 다 없으면 파일명(261023_yuna_paper-moon.webp)에서 날짜·멤버·곡을 읽어 영상을 찾아요(--group 필요할 수 있음)
- 포스터(첫 프레임 jpg)는 ffmpeg가 있으면 clips/posters/<id>.jpg로 만들어요`);
      return;
    }
    const src = resolve(pos[0]);
    if (!existsSync(src)) die(`파일 ${pos[0]}이 없어요.`);
    const ext = extname(src).slice(1).toLowerCase();
    if (!['webp', 'gif', 'mp4', 'webm'].includes(ext)) die('webp·gif·mp4·webm만 담을 수 있어요. ffmpeg로 바꾼 뒤 다시 주세요(README 용량 주의 참고).');
    const size = statSync(src).size;
    if (size > MAX) die(`${(size / 1048576).toFixed(1)}MB예요. 25MB를 넘어 담지 않아요. ffmpeg로 mp4·webp로 줄여 주세요.`);
    if (size > WARN) warn(`${(size / 1048576).toFixed(1)}MB로 커요. mp4·webp로 줄이면 사이트가 빨라져요.`);
    let video = flags.video ? findVideo(flags.video) : null;
    let eventId = null, songId = null, memberIds = [];
    if (!video && flags.event) {
      const e = eventById(flags.event);
      if (!e) die(`공연 ${flags.event}이 없어요.`);
      const g = groupById(e.groupId);
      eventId = e.id;
      songId = flags.song ? resolveSong(g, flags.song) : (e.setlist?.length === 1 ? e.setlist[0] : null);
      memberIds = flags.members ? String(flags.members).split(',').map((m) => resolveMember(g, m.trim())).filter((x) => x !== GROUP_KEY) : [];
    }
    if (!video && !eventId) {
      const g = resolveGroup(flags.group || (data.groups.length === 1 ? data.groups[0].id : null));
      const p = parseFileName(basename(src), g);
      const cands = data.videos.filter((v) => eventById(v.eventId)?.groupId === g.id
        && (!p.date || eventById(v.eventId)?.date === p.date)
        && (!p.memberIds.length || cellKey(v.memberIds) === cellKey(p.memberIds))
        && (!p.songId || v.songs.some((s) => s.songId === p.songId)));
      if (p.date && cands.length === 1) { video = cands[0]; out(`  파일명으로 영상을 찾았어요: ${vLine(video)}`); }
      else die(`연결할 영상을 정할 수 없어요(파일명 해석: 날짜 ${p.date || '?'}, 멤버 ${p.memberIds.map(memberName).join('·') || '?'}, 곡 ${p.songId ? songTitle(p.songId) : '?'} → 후보 ${cands.length}개). --video 또는 --event를 주세요.`);
    }
    if (flags.song && video) songId = resolveSong(groupById(eventById(video.eventId).groupId), flags.song);
    const t = flags.t != null ? parseTime(flags.t) : null;
    const end = flags.end != null ? parseTime(flags.end) : null;
    if (Number.isNaN(t) || Number.isNaN(end)) die('--t, --end는 0:42 형식으로 주세요.');
    const id = nextId('c', data.clips.map((c) => c.id));
    const file = `clips/${id}.${ext}`;
    let poster = `clips/posters/${id}.jpg`;
    mkdirSync(join(ROOT, 'clips/posters'), { recursive: true });
    copyFileSync(src, join(ROOT, file));
    created.push(join(ROOT, file));
    if (makePoster(join(ROOT, file), join(ROOT, poster))) created.push(join(ROOT, poster));
    else { warn('포스터(첫 프레임)를 만들 도구가 없어 포스터 없이 담아요(보기 화면은 실루엣을 보여 줘요). 관리 화면 움짤 담기로 다시 만들 수 있어요.'); poster = ''; }
    const c = { id, file, poster, videoId: video ? video.id : null, t, end, eventId: video ? null : eventId, songId: video ? (songId || null) : songId, memberIds: video ? [] : memberIds, note: String(flags.note || '').trim() };
    data.clips.push(c);
    out(`  + ${id} ${file}${poster ? ` + ${poster}` : ''} → ${video ? `영상 ${video.id}` : `공연 ${eventId}`}${t != null ? ` ${fmtTime(t)}${end != null ? `–${fmtTime(end)}` : ''}` : ''}`);
    save(`움짤 ${id}`);
  },

  // ---------- 고치기 ----------
  set() {
    if (flags.help || pos.length < 2) {
      out(`set <id> 키=값 ...
영상: title channel type(fancam|full) members(유나,도희|단체) song(Paper Moon@0,Static@3:34|전체 공연) source(official|fan|none)
      tags(4K,세로|없음) thumb(i.ytimg.com URL·thumbs/경로|none) thumbPos("50% 30%"|none) event(공연id) ytId
공연: date show label note(|none) setlist(곡,곡)
움짤: note t end video(영상id|none) event song members
멤버: name aliases color active(true|false) thumb(thumbs/<멤버id>.jpg|none) thumbPos
곡:   title aliases release
그룹: name en hue`);
      return;
    }
    const id = pos[0];
    const kv = pos.slice(1).map((s) => { const i = s.indexOf('='); if (i < 0) die(`"${s}"는 키=값 형식이 아니에요.`); return [s.slice(0, i), s.slice(i + 1)]; });
    const none = (v) => ['none', '없음', ''].includes(lc(v));
    const list = (v) => (none(v) ? [] : v.split(',').map((x) => x.trim()).filter(Boolean));
    const v = data.videos.find((x) => x.id === id);
    const e = data.events.find((x) => x.id === id);
    const c = data.clips.find((x) => x.id === id);
    const g0 = data.groups.find((x) => x.id === id);
    let mem = null, song = null;
    for (const g of data.groups) { mem = mem || g.members.find((x) => x.id === id); song = song || g.songs.find((x) => x.id === id); }
    const target = v || e || c || g0 || mem || song;
    if (!target) die(`"${id}"을 찾지 못했어요.`);
    const before = JSON.stringify(target);
    for (const [k, val] of kv) {
      if (v) {
        const g = groupById(eventById(v.eventId).groupId);
        if (k === 'title' || k === 'channel') v[k] = val;
        else if (k === 'type') { if (!['fancam', 'full'].includes(val)) die('type은 fancam 또는 full'); v.type = val; if (val === 'full') v.memberIds = []; }
        else if (k === 'members') { const ids = list(val).map((m) => resolveMember(g, m)); v.memberIds = ids.includes(GROUP_KEY) ? [] : ids; }
        else if (k === 'song' || k === 'songs') v.songs = list(val).map((s) => { const [name, t] = s.split('@'); const sid = resolveSong(g, name); return sid ? { songId: sid, t: t ? parseTime(t) : 0 } : null; }).filter(Boolean);
        else if (k === 'source') v.source = val === 'official' || val === 'fan' ? val : null;
        else if (k === 'tags') v.tags = list(val);
        else if (k === 'thumb') { if (none(val)) delete v.thumb; else v.thumb = val; }
        else if (k === 'thumbPos') { if (none(val)) delete v.thumbPos; else v.thumbPos = val; }
        else if (k === 'event') { const ne = eventById(val); if (!ne) die(`공연 ${val}이 없어요.`); v.eventId = ne.id; }
        else if (k === 'ytId') { const yt = extractYt(val); if (!yt) die('유튜브 ID를 읽지 못했어요.'); v.ytId = yt.id; }
        else die(`영상에는 ${k}를 바꿀 수 없어요. set --help`);
      } else if (e) {
        const g = groupById(e.groupId);
        if (k === 'date') e.date = normDate(val);
        else if (k === 'show' || k === 'label') e[k] = val.trim();
        else if (k === 'note') e.note = none(val) ? '' : val.trim();
        else if (k === 'setlist') e.setlist = list(val).map((s) => resolveSong(g, s)).filter(Boolean);
        else die(`공연에는 ${k}를 바꿀 수 없어요.`);
      } else if (c) {
        if (k === 'note') c.note = val;
        else if (k === 't' || k === 'end') c[k] = none(val) ? null : parseTime(val);
        else if (k === 'video') { if (none(val)) c.videoId = null; else { c.videoId = findVideo(val).id; c.eventId = null; c.songId = null; c.memberIds = []; } }
        else if (k === 'event') { const ne = eventById(val); if (!ne) die(`공연 ${val}이 없어요.`); c.eventId = ne.id; }
        else if (k === 'song') { const ev = eventById(c.eventId) || eventById(data.videos.find((x) => x.id === c.videoId)?.eventId); c.songId = resolveSong(groupById(ev.groupId), val); }
        else if (k === 'members') { const ev = eventById(c.eventId); if (!ev) die('원본 영상 없는 움짤만 members를 바꿀 수 있어요.'); c.memberIds = list(val).map((m) => resolveMember(groupById(ev.groupId), m)).filter((x) => x !== GROUP_KEY); }
        else die(`움짤에는 ${k}를 바꿀 수 없어요.`);
      } else if (mem) {
        if (k === 'name') mem.name = val.trim();
        else if (k === 'aliases') mem.aliases = list(val);
        else if (k === 'color') mem.color = val;
        else if (k === 'active') mem.active = val === 'true';
        else if (k === 'thumb') { if (none(val)) delete mem.thumb; else mem.thumb = val; }
        else if (k === 'thumbPos') { if (none(val)) delete mem.thumbPos; else mem.thumbPos = val; }
        else die(`멤버에는 ${k}를 바꿀 수 없어요. 순서는 move를 쓰세요.`);
      } else if (song) {
        if (k === 'title') song.title = val.trim();
        else if (k === 'aliases') song.aliases = list(val);
        else if (k === 'release') song.release = none(val) ? '' : normDate(val);
        else die(`곡에는 ${k}를 바꿀 수 없어요.`);
      } else if (g0) {
        if (k === 'name' || k === 'en') g0[k] = val.trim();
        else if (k === 'hue') g0.hue = Number(val);
        else die(`그룹에는 ${k}를 바꿀 수 없어요.`);
      }
    }
    out(`  전: ${before}\n  후: ${JSON.stringify(target)}`);
    save(`${id} 고침`);
  },

  gone() {
    const v = findVideo(pos[0]);
    v.gone = !flags.undo;
    out(`  ${vLine(v)}`);
    save(`${v.id} ${v.gone ? '삭제됨 표시' : '삭제됨 해제'}`);
  },

  pin() {
    const v = findVideo(pos[0]);
    v.pin = true;
    unpinOthers(v);
    out(`  ${vLine(v)}`);
    save(`${v.id} 칸 대표`);
  },

  cover() {
    const e = eventById(pos[0]);
    if (!e) die(`공연 ${pos[0]}이 없어요.`);
    if (!pos[1] || pos[1] === 'auto') delete e.cover;
    else { const v = findVideo(pos[1]); if (v.eventId !== e.id) die(`${v.id}는 ${e.id} 공연 영상이 아니에요.`); e.cover = v.id; }
    save(`${e.id} 표지 ${e.cover || '자동'}`);
  },

  merge() {
    if (flags.help || pos.length < 2) {
      out(`merge <남길공연id> <합칠공연id>... [--show "행사명"] [--force] [--dry-run]

같은 행사가 여러 공연으로 쪼개졌을 때 영상·움짤을 남길 공연으로 옮기고 setlist를 합친 뒤 나머지 공연을 지워요.
그룹과 날짜가 같아야 해요(다르면 --force).`);
      return;
    }
    const keep = eventById(pos[0]);
    if (!keep) die(`공연 ${pos[0]}이 없어요.`);
    const others = pos.slice(1).map((id) => eventById(id) || die(`공연 ${id}이 없어요.`));
    for (const o of others) {
      if (o.groupId !== keep.groupId) die(`${o.id}는 다른 그룹 공연이에요.`);
      if (o.date !== keep.date && !flags.force) die(`${o.id}(${o.date})와 ${keep.id}(${keep.date})의 날짜가 달라요. 맞다면 --force`);
    }
    if (flags.show) keep.show = String(flags.show);
    mergeEvents(keep, others);
    save(`${keep.id} ${evLabel(keep)}로 ${others.map((o) => o.id).join(', ')} 합침`);
  },

  'dedupe-events'() {
    if (flags.help) { out('dedupe-events [--dry-run]\n같은 그룹·같은 날짜·같은 label에서 이름이 같은 행사(showKey 기준)인 공연을 하나로 합쳐요. 가장 구체적인(긴) 이름을 남겨요.'); return; }
    const clusters = new Map();
    for (const e of data.events) {
      const k = [e.groupId, e.date, (e.label || '').trim(), showKey(e.show)].join('|');
      if (!clusters.has(k)) clusters.set(k, []);
      clusters.get(k).push(e);
    }
    let n = 0, m = 0;
    for (const list of clusters.values()) {
      if (list.length < 2) continue;
      const cnt = (e) => data.videos.filter((v) => v.eventId === e.id).length;
      const keep = [...list].sort((a, b) => b.show.length - a.show.length || cnt(b) - cnt(a))[0];
      const others = list.filter((e) => e !== keep);
      out(`  ${keep.id} ${evLabel(keep)} ← ${others.map((o) => `${o.id} ${o.show}`).join(', ')}`);
      mergeEvents(keep, others);
      n++; m += others.length;
    }
    // 이름이 너무 일반적인 공연(팬미팅·Spotify·쇼케이스)은 같은 날 투어·콘서트·페스티벌이 하나뿐이면 그 공연으로 본다
    const GENERIC = new Set(['팬미팅', 'spotify', '쇼케이스']);
    const HOST = /HEARTS 2 HOUSE|TOUR|CONCERT|HOME ?GROUND|ENCORE|FESTIVAL|GLOW|콘서트|페스티벌|투어/i;
    const byDay = new Map();
    for (const e of data.events) { const k = `${e.groupId}|${e.date}`; (byDay.get(k) || byDay.set(k, []).get(k)).push(e); }
    for (const list of byDay.values()) {
      const hosts = list.filter((e) => HOST.test(e.show));
      if (hosts.length !== 1) continue;
      const gen = list.filter((e) => GENERIC.has(e.show.trim().toLowerCase()) && (e.label || '') === (hosts[0].label || ''));
      if (!gen.length) continue;
      out(`  ${hosts[0].id} ${evLabel(hosts[0])} ← ${gen.map((o) => `${o.id} ${o.show}`).join(', ')} (일반 이름)`);
      mergeEvents(hosts[0], gen);
      n++; m += gen.length;
    }
    if (!n) { out('합칠 공연이 없어요.'); return; }
    save(`공연 ${m + n}개를 ${n}개로 합침`);
  },

  remove() {
    const id = pos[0];
    const v = data.videos.find((x) => x.id === id || x.ytId === id);
    const e = data.events.find((x) => x.id === id);
    const c = data.clips.find((x) => x.id === id);
    if (v) {
      for (const cl of data.clips) if (cl.videoId === v.id) { cl.videoId = null; cl.eventId = v.eventId; cl.songId = v.songs[0]?.songId || null; cl.memberIds = [...v.memberIds]; warn(`움짤 ${cl.id}는 공연에 직접 연결해 남겨요.`); }
      const ev = eventById(v.eventId);
      if (ev && ev.cover === v.id) delete ev.cover;
      data.videos = data.videos.filter((x) => x !== v);
      out(`  - ${vLine(v)}`);
      if (ev && !data.videos.some((x) => x.eventId === ev.id)) {
        if (flags['with-empty-event']) { removeEvent(ev); out(`  - 빈 공연 ${ev.id}도 지움`); }
        else warn(`${ev.id} ${evLabel(ev)} 공연에 영상이 남지 않았어요. 공연도 지우려면 --with-empty-event`);
      }
      save(`${v.id} 지움`);
    } else if (e) {
      const n = data.videos.filter((x) => x.eventId === e.id).length;
      if (n && !flags.cascade) die(`${e.id}에 영상 ${n}개가 있어요. 함께 지우려면 --cascade`);
      removeEvent(e);
      save(`${e.id} 지움`);
    } else if (c) {
      data.clips = data.clips.filter((x) => x !== c);
      if (!DRY) for (const f of [c.file, c.poster]) if (f && existsSync(join(ROOT, f))) unlinkSync(join(ROOT, f));
      save(`${c.id}와 파일 지움`);
    } else die(`"${id}"을 찾지 못했어요.`);
  },

  // ---------- 그룹·멤버·곡 ----------
  'add-group'() {
    const name = pos[0];
    if (!name) die('그룹 이름을 주세요.');
    if (data.groups.some((g) => lc(g.name) === lc(name))) die(`그룹 ${name}은 이미 있어요.`);
    const g = { id: nextId('g', data.groups.map((x) => x.id)), name, en: flags.en || '', hue: flags.hue != null ? Number(flags.hue) : (data.groups.length * 67 + 200) % 360, members: [], songs: [] };
    data.groups.push(g);
    save(`그룹 ${name} (${g.id})`);
  },
  'add-member'() {
    const g = resolveGroup(pos[0]);
    const name = pos[1];
    if (!name) die('멤버 이름을 주세요.');
    if (g.members.some((m) => lc(m.name) === lc(name))) die(`${g.name}에 ${name}은 이미 있어요.`);
    const n = g.members.length;
    const m = { id: nextId(`${g.id}m`, data.groups.flatMap((x) => x.members.map((y) => y.id))), name, aliases: flags.alias ? String(flags.alias).split(',').map((s) => s.trim()) : [], order: n + 1, active: !flags.inactive, color: flags.color || DEFAULT_COLORS[n % DEFAULT_COLORS.length] };
    g.members.push(m);
    save(`${g.name} 멤버 ${name} (${m.id})`);
  },
  'add-song'() {
    const g = resolveGroup(pos[0]);
    const title = pos[1];
    if (!title) die('곡명을 주세요.');
    if (g.songs.some((s) => lc(s.title) === lc(title))) die(`${g.name}에 ${title}은 이미 있어요.`);
    const s = { id: nextId(`${g.id}s`, data.groups.flatMap((x) => x.songs.map((y) => y.id))), title, aliases: flags.alias ? String(flags.alias).split(',').map((x) => x.trim()) : [], order: g.songs.length + 1, release: flags.release ? normDate(flags.release) : '' };
    g.songs.push(s);
    save(`${g.name} 곡 ${title} (${s.id})`);
  },
  move() {
    const id = pos[0]; const to = Number(pos[1]);
    for (const g of data.groups) {
      for (const key of ['members', 'songs']) {
        const sorted = (key === 'members' ? membersOf : songsOf)(g);
        const i = sorted.findIndex((x) => x.id === id);
        if (i < 0) continue;
        if (!(to >= 1 && to <= sorted.length)) die(`순서는 1~${sorted.length}`);
        const [x] = sorted.splice(i, 1);
        sorted.splice(to - 1, 0, x);
        sorted.forEach((y, k) => { y.order = k + 1; });
        out(`  ${sorted.map((y) => y.name || y.title).join(' → ')}`);
        save(`${id} → ${to}번째`);
        return;
      }
    }
    die(`멤버·곡 ${id}을 찾지 못했어요.`);
  },

  // ---------- 그룹 정보 한 번에 등록·보강 ----------
  roster() {
    if (flags.help || !pos[0]) {
      out(`roster <그룹정보.json | - | JSON 문자열> [--reorder] [--dry-run]

그룹·멤버·곡을 한 번에 등록하거나(새 그룹) 보강해요(기존 그룹: 이름·별칭으로 맞춰 별칭 합치기, 없는 멤버·곡 추가).
{
  "group": { "name": "르니에", "en": "LUNIER", "hue": 200 },      // hue 선택(없으면 기존 그룹과 겹치지 않게)
  "members": [                                                    // 데뷔 공식 순서(라인업 열 순서)
    { "name": "유나", "aliases": ["YUNA", "Yuna"], "active": true, "color": "#c2553f" },   // color 선택
    { "name": "하린", "aliases": ["HARIN"], "active": false }     // 탈퇴·활동 종료
  ],
  "songs": [                                                      // 타이틀곡·활동곡 위주, 발매 순
    { "title": "Paper Moon", "aliases": ["페이퍼문", "PAPER MOON"], "release": "2026-10-09" }
  ],
  "sources": ["https://ko.wikipedia.org/wiki/…"]                 // 확인한 자료(출력에만 씀)
}
--reorder: 기존 그룹의 멤버·곡 순서를 이 목록 순서로 다시 매김(목록에 없는 것은 뒤로)`);
      return;
    }
    const req = readRequest(pos[0]);
    const gi = req.group || {};
    if (!gi.name) die('group.name이 필요해요.');
    let g = data.groups.find((x) => [x.name, x.en].some((v) => v && (lc(v) === lc(gi.name) || (gi.en && lc(v) === lc(gi.en)))));
    const isNew = !g;
    if (!g) {
      const used = data.groups.map((x) => x.hue);
      let hue = gi.hue != null ? Number(gi.hue) : null;
      if (hue == null) { hue = (data.groups.length * 67 + 200) % 360; for (let k = 0; k < 10 && used.some((u) => Math.abs(((u - hue + 540) % 360) - 180) > 150); k++) hue = (hue + 37) % 360; }
      g = { id: nextId('g', data.groups.map((x) => x.id)), name: gi.name.trim(), en: (gi.en || '').trim(), hue, members: [], songs: [] };
      data.groups.push(g);
      out(`+ 그룹 ${g.name}${g.en ? ` (${g.en})` : ''} ${g.id} · hue ${g.hue}`);
    } else {
      out(`= 기존 그룹 ${g.name} (${g.id})에 보강`);
      if (gi.en && !g.en) { g.en = gi.en.trim(); out(`  영문명 ${g.en}`); }
      if (gi.hue != null && Number(gi.hue) !== g.hue) { out(`  hue ${g.hue} → ${gi.hue}`); g.hue = Number(gi.hue); }
    }
    const merge = (list, extra) => [...new Set([...(list || []), ...(extra || []).map((a) => String(a).trim()).filter(Boolean)])];
    const match = (arr, names) => arr.find((x) => [x.id, x.name, x.title, ...(x.aliases || [])].some((v) => v && names.some((n) => n && lc(v) === lc(n))));
    const memberOrder = [];
    for (const m of req.members || []) {
      if (!m.name) die('members[].name이 필요해요.');
      let cur = match(g.members, [m.name, ...(m.aliases || [])]);
      if (cur) {
        const before = JSON.stringify(cur);
        cur.aliases = merge(cur.aliases, [...(m.aliases || []), ...(lc(m.name) !== lc(cur.name) ? [m.name] : [])]).filter((a) => lc(a) !== lc(cur.name));
        if (m.active != null) cur.active = !!m.active;
        if (m.color) cur.color = m.color;
        if (JSON.stringify(cur) !== before) out(`  ~ 멤버 ${cur.name} (${cur.id}) 별칭 ${cur.aliases.join('/') || '-'}${cur.active === false ? ' · 활동 종료' : ''}`);
      } else {
        const n = g.members.length;
        cur = { id: nextId(`${g.id}m`, data.groups.flatMap((x) => x.members.map((y) => y.id))), name: m.name.trim(), aliases: merge([], m.aliases).filter((a) => lc(a) !== lc(m.name)), order: n + 1, active: m.active !== false, color: m.color || DEFAULT_COLORS[n % DEFAULT_COLORS.length] };
        g.members.push(cur);
        out(`  + 멤버 ${cur.name} (${cur.id}) ${cur.aliases.join('/')}${cur.active ? '' : ' · 활동 종료'} · ${cur.color}`);
      }
      memberOrder.push(cur);
    }
    const songOrder = [];
    for (const s of req.songs || []) {
      if (!s.title) die('songs[].title이 필요해요.');
      let cur = match(g.songs, [s.title, ...(s.aliases || [])]);
      const rel = s.release ? normDate(s.release) : '';
      if (cur) {
        const before = JSON.stringify(cur);
        cur.aliases = merge(cur.aliases, [...(s.aliases || []), ...(lc(s.title) !== lc(cur.title) ? [s.title] : [])]).filter((a) => lc(a) !== lc(cur.title));
        if (rel && cur.release !== rel) { if (cur.release) warn(`곡 ${cur.title} 발매일 ${cur.release} → ${rel}`); cur.release = rel; }
        if (JSON.stringify(cur) !== before) out(`  ~ 곡 ${cur.title} (${cur.id}) 별칭 ${cur.aliases.join('/') || '-'} ${cur.release || ''}`);
      } else {
        cur = { id: nextId(`${g.id}s`, data.groups.flatMap((x) => x.songs.map((y) => y.id))), title: s.title.trim(), aliases: merge([], s.aliases).filter((a) => lc(a) !== lc(s.title)), order: g.songs.length + 1, release: rel };
        g.songs.push(cur);
        out(`  + 곡 ${cur.title} (${cur.id}) ${cur.aliases.join('/')} ${cur.release}`);
      }
      songOrder.push(cur);
    }
    if (isNew || flags.reorder) {
      for (const [list, key] of [[memberOrder, 'members'], [songOrder, 'songs']]) {
        if (!list.length) continue;
        const rest = (key === 'members' ? membersOf : songsOf)(g).filter((x) => !list.includes(x));
        [...list, ...rest].forEach((x, i) => { x.order = i + 1; });
      }
    }
    if (Array.isArray(req.sources) && req.sources.length) out(`  자료: ${req.sources.join(' · ')}`);
    const dupAlias = new Map();
    for (const m of g.members) for (const a of [m.name, ...(m.aliases || [])]) { const k = lc(a); if (dupAlias.has(k) && dupAlias.get(k) !== m.id) warn(`별칭 "${a}"를 ${dupAlias.get(k)}와 ${m.id}가 같이 써요. 제목 해석이 헷갈릴 수 있어요.`); dupAlias.set(k, m.id); }
    save(`${g.name} (${g.id}) · 멤버 ${g.members.length} · 곡 ${g.songs.length} · 보기: index.html#g=${g.id}`);
  },

  // ---------- 정리 ----------
  'clear-samples'() {
    const vids = new Set(data.videos.filter((v) => isSampleYt(v.ytId)).map((v) => v.id));
    const clips = data.clips.filter((c) => (c.videoId && vids.has(c.videoId)) || (!c.videoId && data.videos.filter((v) => v.eventId === c.eventId).every((v) => vids.has(v.id))));
    const evs = data.events.filter((e) => data.videos.filter((v) => v.eventId === e.id).every((v) => vids.has(v.id)));
    const keepGroups = !!flags['keep-groups'];
    const grps = keepGroups ? [] : data.groups.filter((g) => data.events.filter((e) => e.groupId === g.id).every((e) => evs.includes(e)) && data.events.some((e) => e.groupId === g.id));
    out(`지울 것: 샘플 영상 ${vids.size} · 움짤 ${clips.length}(파일 포함) · 빈 공연 ${evs.length} · 그룹 ${grps.length}${grps.length ? ` (${grps.map((g) => g.name).join(', ')})` : ''}`);
    if (!flags.yes) { out('\n확인용 출력이에요. 실제로 지우려면 --yes를 붙이세요(사용자에게 먼저 물어보세요).'); return; }
    data.videos = data.videos.filter((v) => !vids.has(v.id));
    data.clips = data.clips.filter((c) => !clips.includes(c));
    data.events = data.events.filter((e) => !evs.includes(e));
    data.groups = data.groups.filter((g) => !grps.includes(g));
    if (!DRY) for (const c of clips) for (const f of [c.file, c.poster]) if (f && existsSync(join(ROOT, f))) unlinkSync(join(ROOT, f));
    save('샘플 정리');
  },

  validate() {
    const r = spawnSync(process.execPath, [join(HERE, 'validate.mjs'), DATA], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
  },
};

// 첫 프레임 → JPEG. ffmpeg는 애니메이션 webp를 못 읽어서 ImageMagick, Python PIL 순으로 시도한다
function makePoster(src, dst) {
  const tries = [
    ['ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-frames:v', '1', '-q:v', '4', dst]],
    ['magick', [`${src}[0]`, '-quality', '85', dst]],
    ['convert', [`${src}[0]`, '-quality', '85', dst]],
    ['python3', ['-c', 'import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]); im.seek(0); im.convert("RGB").save(sys.argv[2], quality=85)', src, dst]],
  ];
  for (const [bin, args] of tries) {
    try { if (existsSync(dst)) unlinkSync(dst); } catch { /* 없음 */ }
    const r = spawnSync(bin, args);
    if (r.status === 0 && existsSync(dst) && statSync(dst).size > 0) return true;
  }
  return false;
}

// 제목에 이름·영문명이 들어 있는 그룹들
function findGroupsIn(title) {
  const t = lc(title);
  if (!t) return [];
  return data.groups.filter((g) => [g.name, g.en].filter(Boolean).some((w) => {
    const x = lc(w);
    return /^[a-z0-9 ]+$/.test(x) ? new RegExp(`(^|[^a-z0-9])${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(t) : t.includes(x);
  }));
}

// 한 영상의 종류·멤버·곡·출처·태그를 정한다. 못 정하면 errors에 넣고 null
function buildVideo(it, ev, effSetlist, create, errors) {
  const { r, yt, title, channel, auto, g, p, tag: where, ctx } = it;
  let type = r.type || p.type || null;
  if (!r.type && p.type) auto.push(`종류=${p.type}`);
  let memberIds = null;
  if (Array.isArray(r.members)) memberIds = r.members.map((m) => resolveMember(g, m));
  else if (p.groupCam) { memberIds = [GROUP_KEY]; auto.push('멤버=단체'); }
  else if (p.memberIds.length) { memberIds = p.memberIds; auto.push(`멤버=${p.memberIds.map(memberName).join('·')}`); }
  if (!type) type = memberIds && memberIds.length ? 'fancam' : null;
  if (!type) { errors.push(`${where}: 풀캠인지 직캠인지 정할 수 없어요. "type"을 주세요. ${ctx}`); return null; }
  if (type === 'fancam' && (!memberIds || !memberIds.length)) { errors.push(`${where}: 직캠인데 멤버를 정할 수 없어요. "members"(멤버 이름 또는 "단체")를 주세요. 제목의 이름이 등록 안 된 멤버면 add-member나 register-group으로 먼저 등록하세요. ${ctx}`); return null; }
  if (type === 'full') memberIds = [];
  if (memberIds.includes(GROUP_KEY)) memberIds = [];
  memberIds.sort((a, b) => (g.members.find((m) => m.id === a)?.order ?? 0) - (g.members.find((m) => m.id === b)?.order ?? 0));
  let songs;
  if (Array.isArray(r.songs)) songs = r.songs.map((s) => ({ songId: resolveSong(g, s.song, { create }), t: s.t == null ? 0 : (typeof s.t === 'number' ? s.t : parseTime(s.t)) })).filter((s) => s.songId);
  else {
    let sid;
    if ('song' in r) sid = resolveSong(g, r.song, { create });
    else if (p.songId) { sid = p.songId; auto.push(`곡=${songTitle(sid)}`); }
    else if (p.songGuess && create) { sid = resolveSong(g, p.songGuess, { create: true }); auto.push(`곡=${songTitle(sid)}(제목, 새 곡)`); }
    else if (effSetlist.length === 1) { sid = effSetlist[0]; auto.push(`곡=${songTitle(sid)}(setlist)`); }
    else if (p.songGuess) { errors.push(`${where}: 제목의 곡 '${p.songGuess}'이 ${g.name} 곡 목록에 없어요. 맞으면 --create-songs, 별칭이면 set <곡id> aliases=…로 등록하세요. ${ctx}`); return null; }
    else if (effSetlist.length > 1) { errors.push(`${where}: 곡을 정할 수 없어요(setlist ${effSetlist.map(songTitle).join(', ')}). "song"을 주세요. 곡 구분 없는 영상이면 "song": "전체 공연". ${ctx}`); return null; }
    else { errors.push(`${where}: 곡을 정할 수 없어요. "song" 또는 공연 "setlist"를 주세요. 곡 구분 없는 영상이면 "song": "전체 공연". ${ctx}`); return null; }
    const t = r.t != null ? (typeof r.t === 'number' ? r.t : parseTime(r.t)) : (yt.t ?? 0);
    songs = sid ? [{ songId: sid, t: Number.isFinite(t) ? t : 0 }] : [];
  }
  if (effSetlist.length) for (const s of songs) if (!effSetlist.includes(s.songId)) warn(`${where}: ${songTitle(s.songId)}는 이 공연 setlist에 없어요. 맞는지 확인하세요.`);
  const source = 'source' in r ? (r.source === 'official' || r.source === 'fan' ? r.source : null) : (p.source || null);
  if (!('source' in r) && p.source) auto.push('출처=공식');
  const tags = Array.isArray(r.tags) ? r.tags : p.tags;
  if (!Array.isArray(r.tags) && p.tags.length) auto.push(`태그=${p.tags.join(',')}`);
  const v = {
    id: nextId('v', data.videos.map((x) => x.id)), ytId: yt.id, eventId: ev.id, songs, type, memberIds, source, tags,
    title, channel, pin: !!r.pin, gone: false,
  };
  if (r.thumbPos) v.thumbPos = String(r.thumbPos);
  return v;
}

function unpinOthers(v) {
  const key = cellKey(v.memberIds);
  for (const o of data.videos) {
    if (o !== v && o.eventId === v.eventId && o.type === v.type && cellKey(o.memberIds) === key && o.songs.some((s) => v.songs.some((x) => x.songId === s.songId)) && o.pin) {
      o.pin = false;
      out(`  (같은 칸 ${o.id}의 대표 표시를 풀었어요)`);
    }
  }
}
function mergeEvents(keep, others) {
  for (const o of others) {
    for (const v of data.videos) if (v.eventId === o.id) v.eventId = keep.id;
    for (const c of data.clips) if (c.eventId === o.id) c.eventId = keep.id;
    for (const sid of o.setlist || []) if (!keep.setlist.includes(sid)) keep.setlist.push(sid);
    if (!keep.cover && o.cover) keep.cover = o.cover;
    if (o.note && o.note !== keep.note) keep.note = [keep.note, o.note].filter(Boolean).join(' / ');
    data.events = data.events.filter((x) => x !== o);
  }
}
function removeEvent(e) {
  const vids = new Set(data.videos.filter((v) => v.eventId === e.id).map((v) => v.id));
  const clips = data.clips.filter((c) => c.eventId === e.id || vids.has(c.videoId));
  data.clips = data.clips.filter((c) => !clips.includes(c));
  if (!DRY) for (const c of clips) for (const f of [c.file, c.poster]) if (f && existsSync(join(ROOT, f))) unlinkSync(join(ROOT, f));
  data.videos = data.videos.filter((v) => v.eventId !== e.id);
  data.events = data.events.filter((x) => x !== e);
  if (clips.length) warn(`움짤 ${clips.length}개(${clips.map((c) => c.id).join(', ')})와 파일도 지웠어요.`);
}

const fn = COMMANDS[cmd] || (cmd ? null : COMMANDS.help);
if (!fn) die(`모르는 명령 "${cmd}". node scripts/archive.mjs help`);
await fn();
