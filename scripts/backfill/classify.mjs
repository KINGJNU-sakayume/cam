// Classify remaining harvest candidates using title, channel, real upload date, description and duration.
// usage: node classify.mjs <scratch dir>   (cwd = repo)
import fs from 'node:fs';
const S = process.argv[2];
const rows = JSON.parse(fs.readFileSync(`${S}/rows.json`, 'utf8'));
const done = new Set(JSON.parse(fs.readFileSync(`${S}/req.json`, 'utf8')).videos.map((v) => v.url.split('/').pop()));

const NONSTAGE = [
  [/STUDIO CHOOM|UNFILTERED CAM|스튜디오 ?춤|BE ORIGINAL/i, '스튜디오 춤'],
  [/주간아|아는 ?형님|런닝맨|놀라운 토요일|놀토|방판소녀|딩고|dingo|인간극장|매점|리무진서비스|돌박이일|aesParty|LENIVERSE|PICK NMIXX|IT’ZZZ|All Tastes|배지전쟁|성수기|트루만쇼|잠을 모짜렐|딱대|One Day Break|그림일기|방구석|MUSINSA|예능/i, '예능'],
  [/\bM\/?V\b|뮤직비디오|Official Video|Performance Film|PERFORMANCE VIDEO|Special Clip|Live Clip|Band ver|Recap|Teaser|티저|Trailer|Highlight Medley|하이라이트 메들리|A Cappella/i, '공식 영상(MV·클립)'],
  [/Q&A|sound ?check|사운드 ?체크|리허설|rehearsal|드레스 ?리허설/i, '리허설·Q&A'],
  [/reaction|리액션|REACT\b/i, '리액션'],
  [/\bedit\b|nano cut|교차편집|stage mix|무대 모음|zip|compilation|모음/i, '편집·모음'],
  [/KPOP CLASS|dance cover|커버 ?댄스|covered by|cover by|\bcover\b(?!.*원곡)|댄스 ?커버|OF DANCE|안무 ?영상|dance practice|안무 연습|연습 영상|relay ?dance|릴레이 ?댄스|choreography/i, '커버·안무 영상'],
  [/vlog|브이로그|라디오|radio|컬투쇼|가요광장|두시탈출|볼륨을 높여요|정희|weverse|위버스|bubble|버블|인스타|IG ?live|instagram|틱톡|tiktok|shorts? challenge|챌린지|challenge/i, '라디오·라이브 방송·챌린지'],
  [/팬싸|팬사인|fansign|영통|video call|interview|인터뷰|비하인드|behind|making|메이킹|BH2ND|먹방|mukbang|game|게임|NOTICE|공지|unboxing|언박싱/i, '비하인드·팬사인회'],
  [/lyrics|가사|audio|8D|sped ?up|nightcore|karaoke|노래방|piano|MR ?제거|clean ?mr|ringtone|instrumental/i, '음원·가사 영상'],
  [/STAR ROAD|레드 ?카펫|red ?carpet|포토 ?월|photo ?wall|포토타임|출근|퇴근|공항|airport/i, '레드카펫·출퇴근'],
  [/\bMENT\b|멘트|토크|TALK SOME MORE|Talk &|talk show|엔딩|ending|인사|끝인사|수상 ?소감|소감/i, '멘트·엔딩'],
];
const SHOWS = [
  [/뮤직뱅크|뮤뱅|music ?bank/i, '뮤직뱅크', 5],
  [/인기가요|인가|inkigayo/i, '인기가요', 0],
  [/음악중심|음중|music ?core/i, '쇼! 음악중심', 6],
  [/엠카|m ?countdown|MPD ?직캠|입덕 ?직캠|MPD FanCam/i, '엠카운트다운', 4],
  [/쇼챔|show ?champion/i, '쇼챔피언', 3],
  [/THE ?SHOW|더쇼|더 쇼/i, '더 쇼', 2],
  [/Simply K-?Pop|플리캠/i, '심플리케이팝', 5],
];
const SPECIAL_SHOW = /LIVE in|in TOKYO|in JAPAN|글로벌 페스티벌|global festival|가요대|가요제|world tour|in [A-Z][a-z]+/i;

const pad = (n) => String(n).padStart(2, '0');
function dateIn(text, up) {
  if (!text) return null;
  let m = text.match(/(?<![\d.])(20)?(2[4-6])[.\-/ ]?(0[1-9]|1[0-2])[.\-/ ]?(0[1-9]|[12]\d|3[01])(?![\d])/);
  if (m) return `20${m[2]}-${m[3]}-${m[4]}`;
  m = text.match(/(?<!\d)(0[1-9]|[12]\d|3[01])\.(0[1-9]|1[0-2])\.(20)?(2[4-6])(?!\d)/); // DD.MM.YYYY
  if (m) return `20${m[4]}-${m[2]}-${m[1]}`;
  return null;
}
function lastWeekday(up, wd) {
  const d = new Date(up + 'T00:00:00Z');
  for (let i = 0; i < 7; i++) { const x = new Date(d - i * 864e5); if (x.getUTCDay() === wd) return x.toISOString().slice(0, 10); }
}
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;

const out = [], skip = [];
for (const r of rows) {
  if (done.has(r.id)) continue;
  const t = r.t || '';
  const text = `${t} ${r.ch || ''}`;
  if (r.up && r.up < '2024-01-01') { skip.push([r, '2024년 이전 업로드(아카이브 범위 밖)']); continue; }
  const ns = NONSTAGE.find(([re]) => re.test(t));
  if (ns) { skip.push([r, `무대 아님: ${ns[1]}`]); continue; }
  const v = { url: `https://youtu.be/${r.id}`, title: t, channel: r.ch, uploaded: r.up };
  let date = dateIn(t), how = '제목';
  if (date && r.up && (days(date, r.up) < -1 || days(date, r.up) > 400)) { skip.push([r, `제목 날짜 ${date}가 업로드 ${r.up}와 안 맞음`]); continue; }
  const show = SHOWS.find(([re]) => re.test(t) || (re.source.includes('뮤직뱅크') && false));
  if (show && !SPECIAL_SHOW.test(t)) v.show = show[1];
  if (!date && r.desc) { const d2 = dateIn(r.desc); if (d2 && r.up && days(d2, r.up) >= 0 && days(d2, r.up) <= 60) { date = d2; how = '설명'; } }
  if (!date && v.show && r.up) { date = lastWeekday(r.up, show[2]); how = `요일(${v.show})`; }
  if (!date) { skip.push([r, '날짜를 알 수 없음']); continue; }
  if (r.up && days(date, r.up) < -1) { skip.push([r, `날짜 ${date}가 업로드 뒤`]); continue; }
  v.date = date; v._how = how;
  out.push(v);
}
fs.writeFileSync(`${S}/req2.json`, JSON.stringify({ videos: out }, null, 1));
const tally = {}; for (const [, why] of skip) tally[why.replace(/ \d{4}-.*/, '')] = (tally[why.replace(/ \d{4}-.*/, '')] || 0) + 1;
fs.writeFileSync(`${S}/skip2.txt`, skip.map(([r, w]) => `${r.id}\t${w}\t${r.up}\t${r.ch}\t${r.t}`).join('\n'));
console.log('후보', out.length, '· 건너뜀', skip.length);
console.log(Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${n} ${k}`).join('\n'));
const hows = {}; out.forEach((v) => { hows[v._how] = (hows[v._how] || 0) + 1; }); console.log(hows);
