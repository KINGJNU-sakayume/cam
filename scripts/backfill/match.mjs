// For candidates without a date: extra date formats, then match the group's existing events by city / event keywords.
// usage: node match.mjs <scratch dir>  (cwd = repo)
import fs from 'node:fs';
const S = process.argv[2];
const data = JSON.parse(fs.readFileSync('data/videos.json', 'utf8'));
const rows = Object.fromEntries(JSON.parse(fs.readFileSync(`${S}/rows.json`, 'utf8')).map((r) => [r.id, r]));
const skip = fs.readFileSync(`${S}/skip2.txt`, 'utf8').split('\n').map((l) => l.split('\t')).filter((x) => x[1] === '날짜를 알 수 없음');

const GROUPS = { g1: /아이브|\bIVE\b/i, g2: /엔믹스|NMIXX/i, g3: /프로미스나인|fromis_?9/i, g4: /하츠투하츠|Hearts2Hearts|\bH2H\b/i, g5: /에스파|aespa/i,
  g6: /트리플에스|tripleS/i, g7: /있지|ITZY/i, g8: /베이비몬스터|BABYMONSTER|베몬/i, g9: /최예나|YENA/i, g10: /키스\s?오브\s?라이프|KISS OF LIFE|KIOF/i, g11: /르세라핌|LE ?SSERAFIM/i };
const CITY = { 서울: /seoul|서울/i, 도쿄: /tokyo|도쿄|東京/i, 타이베이: /taipei|타이베이|台北/i, 마카오: /macau|macao|마카오/i, 방콕: /bangkok|방콕|BKK/i, 쿠알라룸푸르: /kuala|쿠알라|\bKL\b/i,
  자카르타: /jakarta|자카르타/i, 마닐라: /manila|마닐라/i, 오사카: /osaka|오사카/i, 가오슝: /kaohsiung|가오슝|高雄/i, 밴쿠버: /vancouver|밴쿠버/i, 시애틀: /seattle|시애틀/i, 오클랜드: /oakland|오클랜드/i,
  LA: /\bLA\b|los angeles/i, 파리: /paris|파리/i, 런던: /london|런던/i, 암스테르담: /amsterdam|암스테르담/i, 프랑크푸르트: /frankfurt|프랑크푸르트/i, 싱가포르: /singapore|싱가포르/i, 홍콩: /hong ?kong|홍콩/i,
  뉴욕: /new york|NYC|뉴욕|brooklyn/i, 토론토: /toronto|토론토/i, 시카고: /chicago|시카고/i, 댈러스: /dallas|댈러스/i, 마이애미: /miami|마이애미/i, 멕시코시티: /mexico city|멕시코시티/i, 시드니: /sydney|시드니/i,
  멜버른: /melbourne|멜버른/i, 고베: /kobe|고베/i, 요코하마: /yokohama|요코하마/i, 치바: /chiba|치바/i, 부산: /busan|부산/i, 상파울루: /s[aã]o paulo|상파울루/i, 산티아고: /santiago|산티아고/i, 리마: /\blima\b|리마/i,
  해밀턴: /hamilton|해밀턴/i, 애틀랜타: /atlanta|애틀랜타/i, '워싱턴 D.C.': /washington|워싱턴/i, 마드리드: /madrid|마드리드/i, 베를린: /berlin|베를린/i, 부다페스트: /budapest|부다페스트/i, 나고야: /nagoya|나고야/i, 후쿠오카: /fukuoka|후쿠오카/i };
const KEYS = [/TUNNEL VISION/i, /CHOOM|춤/i, /SYNK|COMPL[aæ]XITY|aeXIS/i, /ANDLESS|tripleS World Tour/i, /TOMORROW GLOW/i, /PUREFLOW/i, /SHOW WHAT I AM/i, /ZERO FRONTIER/i, /HEARTS 2 HOUSE/i, /NOW TOMORROW/i,
  /KGMA|Korea Grand|코리아 ?그랜드/i, /\bMMA\b|melon music|멜론/i, /TIMA/i, /\bTMA\b|더팩트|the fact/i, /한터|hanteo/i, /lollapalooza|롤라팔루자/i, /mawazine/i, /입실렌티|ipselenti/i, /가요대전/i, /가요대축제/i,
  /MyK FESTA/i, /waterbomb|워터밤/i, /SMTOWN/i, /KCON/i, /AAA|asia artist/i, /MAMA/i, /golden disc|골든디스크/i, /서울가요대상|\bSMA\b/i, /YENA LIVE TOUR|2세계/i, /fan ?meeting|팬미팅|ALL IN, MIDZY/i,
  /버추얼 라이브|virtual live|\bVLF\b/i, /sziget/i, /summer sonic|서머소닉/i, /DEJA VU/i, /KISS ROAD/i, /A LIVE/i, /Alphie/i, /ASSEMBLE/i, /OT ?24/i];
const DAYS = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');
function moreDate(t) {
  let m = t.match(/(?<!\d)(0[1-9]|1[0-2])([0-2]\d|3[01])(202[4-6])(?!\d)/); if (m) return `${m[3]}-${m[1]}-${m[2]}`; // MMDDYYYY
  m = t.match(/(?<!\d)(202[4-6])\.(\d{1,2})\.(\d{1,2})(?!\d)/); if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = t.match(/(?<!\d)(\d{1,2}) (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (20)?(2[4-6])(?!\d)/i); if (m) return `20${m[4]}-${pad(MON[m[2].toLowerCase()])}-${pad(m[1])}`;
  m = t.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2}),? (202[4-6])/i); if (m) return `${m[3]}-${pad(MON[m[1].toLowerCase()])}-${pad(m[2])}`;
  return null;
}
const dayNo = (t) => { const m = t.match(/day ?-?(\d)|D-(\d)|(\d)일차|(첫|막)콘/i); if (!m) return null; if (m[4]) return m[4] === '첫' ? 1 : -1; return +(m[1] || m[2] || m[3]); };

const out = [], why = {};
const note = (k) => { why[k] = (why[k] || 0) + 1; };
for (const [id] of skip) {
  const r = rows[id]; if (!r) continue;
  const t = r.t;
  const gs = Object.entries(GROUPS).filter(([, re]) => re.test(t)).map(([g]) => g);
  if (gs.length !== 1) { note(gs.length ? '그룹 여럿' : '그룹 모름'); continue; }
  const g = gs[0];
  const v = { url: `https://youtu.be/${id}`, title: t, channel: r.ch, uploaded: r.up };
  const d = moreDate(t) || moreDate(r.desc || '');
  if (d && r.up && DAYS(d, r.up) >= -1 && DAYS(d, r.up) <= 400) { v.date = d; v._how = '날짜 형식'; out.push(v); continue; }
  if (!r.up) { note('업로드 날짜 없음'); continue; }
  const evs = data.events.filter((e) => e.groupId === g && DAYS(e.date, r.up) >= -1 && DAYS(e.date, r.up) <= 150);
  const scored = evs.map((e) => {
    let s = 0, city = false, key = false;
    for (const [kr, re] of Object.entries(CITY)) if (e.show.includes(kr) && re.test(t)) { s += 2; city = true; }
    for (const re of KEYS) if (re.test(e.show) && re.test(t)) { s += 2; key = true; }
    // Korean words of the event name (university, festival names) appearing in the title
    for (const w of e.show.split(/[\s:()]+/)) if (/[가-힣]{2,}/.test(w) && !/축제|대회|콘서트|페스티벌|이벤트/.test(w) && !Object.keys(CITY).includes(w) && t.includes(w.replace(/대$/, ''))) { s += 2; key = true; }
    return { e, s, ok: key || (city && /tour|concert|콘서트|투어|live/i.test(t)) };
  }).filter((x) => x.ok && x.s > 0);
  if (!scored.length) { note('맞는 공연 없음'); continue; }
  const best = Math.max(...scored.map((x) => x.s));
  let top = scored.filter((x) => x.s === best).map((x) => x.e).sort((a, b) => a.date.localeCompare(b.date));
  const shows = new Set(top.map((e) => e.show));
  if (shows.size > 1) { note('공연 여럿'); continue; }
  if (top.length > 1) {
    const n = dayNo(t);
    if (n == null) { note('여러 날 공연, 몇째 날인지 모름'); continue; }
    top = [n === -1 ? top[top.length - 1] : top[n - 1]].filter(Boolean);
    if (!top.length) { note('여러 날 공연, 몇째 날인지 모름'); continue; }
  }
  v.date = top[0].date; v.show = top[0].show; v._how = `공연 맞춤(${top[0].id})`;
  out.push(v);
}
fs.writeFileSync(`${S}/req3.json`, JSON.stringify({ videos: out }, null, 1));
console.log('찾음', out.length, why);
for (const v of out) console.log(v._how, '|', v.date, v.show || '', '|', v.title.slice(0, 100));
