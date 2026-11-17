// Merge classify (req2) + match (req3) + auto, apply generic fixes over two dry-runs, write final.json and final-dry.txt.
// usage: node finalize.mjs <dir>   (cwd = repo). Optional <dir>/manual.json: { drop: [ids|title substrings], set: { id: {...} } }
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
// university festival: "호서대학교", "영남대", "Hanyang Univ. ERICA" → "<이름>대 축제" when no show is known
const UNI_EN = { 'Hanyang Univ. ERICA': '한양대 ERICA', 'Hanyang Univ': '한양대', 'Korea Univ': '고려대', 'Yonsei': '연세대', 'Gangnam Univ': '강남대', 'Dankook': '단국대', 'Kwangwoon': '광운대', 'Kyung Hee': '경희대', 'Sungkyunkwan': '성균관대', 'Konkuk': '건국대', 'Chungnam': '충남대' };
const DATA = JSON.parse(fs.readFileSync('data/videos.json', 'utf8'));
const GROUP_RE = [['g1', /아이브|\bIVE\b/i], ['g2', /엔믹스|NMIXX/i], ['g3', /프로미스나인|fromis_?9/i], ['g4', /하츠투하츠|Hearts2Hearts/i], ['g5', /에스파|aespa/i], ['g6', /트리플에스|tripleS/i], ['g7', /있지|ITZY/i], ['g8', /베이비몬스터|BABYMONSTER/i], ['g9', /최예나|YENA/i], ['g10', /키스\s?오브\s?라이프|KISS OF LIFE/i], ['g11', /르세라핌|LE ?SSERAFIM/i]];
function uniShow(t) {
  for (const [en, kr] of Object.entries(UNI_EN)) if (t.includes(en)) return `${kr} 축제`;
  const m = t.match(/([가-힣]{2,6}?)(?:대학교|대)(?=\s|$|[^가-힣]|축제|직캠|들풀제|대동제)/);
  if (!m || /르세라핌|대기|가요대|무대|대전|대축제|대상/.test(m[0])) return null;
  return `${m[1]}대 축제`;
}
const D = process.argv[2];
const rd = (f, d) => (fs.existsSync(`${D}/${f}`) ? JSON.parse(fs.readFileSync(`${D}/${f}`, 'utf8')) : d);
const manual = rd('manual.json', { drop: [], set: {} });
const strip = ({ _how, ...v }) => v;
let vids = [...rd('auto.json', { videos: [] }).videos, ...rd('req2.json', { videos: [] }).videos, ...rd('req3.json', { videos: [] }).videos].map(strip);
const seen = new Set(); vids = vids.filter((v) => !seen.has(v.url) && seen.add(v.url));
const idOf = (v) => v.url.split('/').pop();
const NOT_STAGE = /VCR|Intermission|리액터|리액션|reaction|대기석|가대석|입장 및|포즈 타임|수상 ?소감|Acceptance|포토 ?촬영|speech|Intros|MESSAGE|MIX SYNC|EYE CONTACT|사운드 ?체크|サウンドチェック|Arrived|팬 ?서비스|팬써비스|MC OFF|Special MC|스타로드|FANS LIVE|베리즈|Berriz|라방|단체 라이브|놀면 ?뭐하니|OURBIRTHDAY|RNX tv|SIGNAL|Cosmo Live|Unit Live|STATIONHEAD|COMEBACK LIVE|보이는라이브|보이스라이브|\[EPISODE\]|비교|Original Stage|쇼츠 찍는|애교|vs 음원/i;
const WHOLE = /full concert|full performance|full perfo|full perform|full ver|full\.ver|풀영상|풀버전|풀 버전|Live at WATERBOMB|LIVE @ /i;
const TOURWORD = { 'CHOOM': /WORLD TOUR|CHOOM\]|\[춤/i, 'Andless': /ANDLESS (World )?Tour|World Tour "ANDLESS"/i, 'PUREFLOW': /./, 'Tunnel Vision': /TUNNEL VISION/i, 'Vision': /Visionary Vision/i, 'TOKYO': /./ };
const dropById = new Set(manual.drop.filter((x) => /^[\w-]{11}$/.test(x)));
const dropByText = manual.drop.filter((x) => !/^[\w-]{11}$/.test(x));
vids = vids.filter((v) => !NOT_STAGE.test(v.title) && !dropById.has(idOf(v)) && !dropByText.some((t) => v.title.includes(t)));
// a university festival named in the title wins over a same-day music show the tool would otherwise attach
const MUSIC_SHOW = /뮤직뱅크|뮤뱅|music ?bank|인기가요|inkigayo|음악중심|music ?core|엠카|countdown|MPD|쇼챔|show ?champion|THE ?SHOW|더쇼/i;
for (const v of vids) if (!v.show && !MUSIC_SHOW.test(v.title)) { const u = uniShow(v.title); if (u) v.show = u; }
// tour normalizer (manual.tour = [{ re, name, extraCities? }]): "<name> <city>" from the title; dates seen with a city
// also name same-date videos that only say the date (when the group has no other event that day)
const CITY = { 서울: /seoul|서울/i, 도쿄: /tokyo|도쿄|東京/i, 사이타마: /saitama|사이타마/i, 후쿠오카: /fukuoka|후쿠오카/i, 오사카: /osaka|오사카|kyocera/i, 나고야: /nagoya/i,
  타이베이: /taipei|타이베이|台北/i, 가오슝: /kaohsiung|高雄/i, 마카오: /macau|macao|마카오/i, 홍콩: /hong ?kong|\bHK\b|홍콩/i, 방콕: /bangkok|\bBKK\b|방콕/i, 싱가포르: /singapore|\bSG\b|싱가포르/i,
  자카르타: /jakarta|자카르타/i, 마닐라: /manila|마닐라/i, 쿠알라룸푸르: /kuala|\bKL\b/i, 시드니: /sydney|시드니/i, 멜버른: /melbourne|rod laver|멜버른/i, LA: /\bLA\b|los angeles/i, 뉴욕: /new york|NYC|뉴욕/i,
  런던: /london|런던/i, 파리: /paris|파리/i, 베를린: /berlin/i, 암스테르담: /amsterdam/i, 멕시코시티: /mexico city/i, 상파울루: /s[aã]o paulo/i, 산티아고: /santiago/i, 시애틀: /seattle/i, 오클랜드: /oakland/i, 밴쿠버: /vancouver/i, 토론토: /toronto/i, 올랜도: /orlando/i, 샬럿: /charlotte/i, 뉴어크: /newark|prudential/i, 마드리드: /madrid/i, 프랑크푸르트: /frankfurt|프랑크푸르트/i, 휴스턴: /houston/i, 피닉스: /phoenix/i, 오클랜드_NZ: /auckland/i, 시카고: /chicago/i, 댈러스: /dallas/i, 애틀랜타: /atlanta/i, 마이애미: /miami/i, '워싱턴 D.C.': /washington/i };
const cityOf = (t) => Object.entries(CITY).find(([, re]) => re.test(t))?.[0];
const tourDate = {};
for (const tr of manual.tour || []) {
  const re = new RegExp(tr.re, 'i'), not = tr.not ? new RegExp(tr.not, 'i') : null;
  for (const v of vids) if (re.test(v.title) && !(not && not.test(v.title)) && v.date) { const c = cityOf(v.title); if (c) { v.show = `${tr.name} ${c}`; tourDate[v.date] = v.show; } }
}
for (const v of vids) if (!v.show && v.date && tourDate[v.date] && !MUSIC_SHOW.test(v.title)) {
  const g = GROUP_RE.find(([, re]) => re.test(v.title));
  const other = g && DATA.events.some((e) => e.groupId === g[0] && e.date === v.date);
  if (!other) v.show = tourDate[v.date];
}
for (const v of vids) if (manual.set[idOf(v)]) Object.assign(v, manual.set[idOf(v)]);
const dry = (name) => {
  fs.writeFileSync(`${D}/${name}.json`, JSON.stringify({ videos: vids }, null, 1));
  const p = spawnSync(process.execPath, ['scripts/archive.mjs', 'add', `${D}/${name}.json`, '--create-songs', '--dry-run', '--skip-invalid'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = `${p.stdout || ''}\n${p.stderr || ''}`;
  fs.writeFileSync(`${D}/${name}-dry.txt`, out);
  return out;
};
let out = dry('pass1');
// generic fixes from failures (run twice: a show fixed in round 1 can reveal a song failure in round 2)
for (let round = 0; round < 2; round++) {
if (round) out = dry('pass2');
const fail = {};
for (const l of out.split('\n')) { const m = l.match(/^  - videos\[\d+\] (\S+): (.*)/); if (m) fail[m[1]] = m[2]; }
for (const v of vids) {
  const f = fail[idOf(v)] || '';
  if (f.startsWith('행사') || /그날 공연/.test(f)) { const u = uniShow(v.title); if (u) v.show = u; }
  // song not determined: look for the group's known song titles/aliases in the title (in order of appearance)
  if (f.startsWith('곡을') && !v.song && !v.songs) {
    const g = GROUP_RE.find(([, re]) => re.test(v.title));
    const grp = g && DATA.groups.find((x) => x.id === g[0]);
    if (grp) {
      const tl = v.title.toLowerCase();
      const hits = [];
      for (const s of grp.songs) {
        if (s.kind === 'other') continue;
        for (const n of [s.title, ...(s.aliases || [])]) {
          if (String(n).length < 3) continue;
          const i = tl.search(new RegExp(`(^|[^a-z가-힣])${String(n).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z가-힣]|$)`));
          if (i >= 0) { hits.push([i, s.title]); break; }
        }
      }
      const uniq = [...new Map(hits.sort((a, b) => a[0] - b[0]).map(([i, t]) => [t, i])).keys()];
      if (uniq.length) v.songs = uniq.map((song) => ({ song }));
    }
  }
  if (WHOLE.test(v.title) && !v.song && !v.songs && !manual.set[idOf(v)]?.song) { v.song = '전체 공연'; v.type = 'full'; }
  else if ((f.startsWith('풀캠') || f.startsWith('직캠')) && !v.members) v.type = 'full';
}
}
// strip tour names read as songs, using pass1 parse
const parsed = {};
for (const l of out.split('\n')) if (l.startsWith('  + ')) { const p = l.split(' · '); if (p.length > 3) parsed[p[p.length - 2].trim()] = p[1].split(' + '); }
for (const v of vids) {
  const ps = parsed[idOf(v)]; if (!ps || v.song || v.songs) continue;
  const kept = ps.filter((s) => !(TOURWORD[s] && TOURWORD[s].test(v.title) && !new RegExp(`['‘"“]${s}['’"”]`, 'i').test(v.title)));
  if (kept.length !== ps.length && kept.length) v.songs = kept.map((song) => ({ song }));
}
out = dry('final');
const n = (out.match(/^  \+ (?!새 곡)/gm) || []).length;
console.log('최종 담을 영상', n, '· 못 정함', (out.match(/^  - videos/gm) || []).length);
