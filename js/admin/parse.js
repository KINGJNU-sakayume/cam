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

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');
const mk = (y, m, d) => { const iso = `${y}-${pad(m)}-${pad(d)}`; return isRealDate(iso) && y >= 2020 && y <= 2030 ? iso : null; };
const fullYear = (y) => (y < 100 ? 2000 + y : y);

// 제목의 날짜 후보들 → [{ iso, raw, alt }]. 읽는 순서가 곧 우선순위다. alt는 다르게 읽은 해석
// (261023을 일월연 23.10.26으로, 03.10.2026을 월.일로 읽은 것)이라 업로드 날짜가 있을 때만 고른다.
// 261024 · 20261024 · 2026.10.24 · 2026-10-24 · 26.10.24 · 10/24/26 · 24.10.2026 ·
// 10-24-2026 · 2026년 10월 24일 · 10월 24일(opts.year 필요) · Oct 24, 2026 · 24 Oct 2026 를 읽는다.
export function findDates(text, opts = {}) {
  const t = String(text || '');
  const outs = [];
  const push = (iso, raw, alt = false) => { if (iso && !outs.some((o) => o.iso === iso)) outs.push({ iso, raw: String(raw).trim(), alt }); };
  let m;
  // YYYY.M.D / YYYY-MM-DD / YYYY/M/D / YYYY M D
  const ymd = /(?:^|[^\d])(20\d\d)\s*[.\-/ ]\s*(\d{1,2})\s*[.\-/ ]\s*(\d{1,2})(?!\d)/g;
  while ((m = ymd.exec(t))) push(mk(+m[1], +m[2], +m[3]), m[0]);
  // 2026년 10월 24일
  m = /(20\d\d)\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(t);
  if (m) push(mk(+m[1], +m[2], +m[3]), m[0]);
  // YY.MM.DD (연도가 앞, 25~27)
  const yymd = /(?:^|[^\d])(2[5-7])[.\-/](\d{1,2})[.\-/](\d{1,2})(?!\d)/g;
  while ((m = yymd.exec(t))) push(mk(2000 + +m[1], +m[2], +m[3]), m[0]);
  // A.B.YYYY / A.B.YY : 앞이 12보다 크면 일.월, 뒤가 12보다 크면 월.일, 둘 다 12 이하면 . 은 일.월, / - 는 월.일
  const abY = /(?:^|[^\d])(\d{1,2})([.\-/])(\d{1,2})\2(20\d\d|\d{2})(?!\d)/g;
  while ((m = abY.exec(t))) {
    const a = +m[1], b = +m[3], y = fullYear(+m[4]);
    const dm = a > 12 || (b <= 12 && m[2] === '.');
    push(dm ? mk(y, b, a) : mk(y, a, b), m[0]);
    if (a <= 12 && b <= 12) push(dm ? mk(y, a, b) : mk(y, b, a), m[0], true);
  }
  // Oct 24, 2026 / October 24 2026 / 24 Oct 2026
  m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d\d)\b/i.exec(t);
  if (m) push(mk(+m[3], MONTHS[m[1].toLowerCase()], +m[2]), m[0]);
  m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?,?\s+(20\d\d)\b/i.exec(t);
  if (m) push(mk(+m[3], MONTHS[m[2].toLowerCase()], +m[1]), m[0]);
  // 6·8자리 붙은 날짜: 261024 · 20261024 (6자리는 일월연 231026으로도 읽어 본다)
  const re = /(?:^|[^\d])(\d{8}|\d{6})(?=[^\d]|$)/g;
  while ((m = re.exec(t))) {
    const d = m[1];
    if (d.length === 8) push(mk(+d.slice(0, 4), +d.slice(4, 6), +d.slice(6)), d);
    else {
      push(mk(2000 + +d.slice(0, 2), +d.slice(2, 4), +d.slice(4)), d);
      push(mk(2000 + +d.slice(4), +d.slice(2, 4), +d.slice(0, 2)), d, true);
    }
  }
  // 10월 24일 (연도는 opts.year로)
  if (opts.year) {
    m = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(t);
    if (m) push(mk(+opts.year, +m[1], +m[2]), m[0]);
  }
  return outs;
}

const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

// 제목의 날짜 → { iso, raw } 또는 null.
// opts.uploaded(YYYY-MM-DD)가 있으면 공연 날짜 ≤ 업로드 날짜(+1일, 시차) 이고 120일 안인 후보를 고른다.
export function findDate(text, opts = {}) {
  const all = findDates(text, opts);
  const plain = all.filter((c) => !c.alt);
  if (opts.uploaded && isRealDate(opts.uploaded)) {
    // 제목 순서대로 표기(raw)마다 보고, 그 표기의 읽기 중 범위 안이면서 업로드 날짜에 가장 가까운 것
    const inRange = (c) => { const d = dayDiff(opts.uploaded, c.iso); return d >= -1 && d <= 120; };
    for (const raw of [...new Set(all.map((c) => c.raw))]) {
      const ok = all.filter((c) => c.raw === raw && inRange(c)).sort((a, b) => Math.abs(dayDiff(opts.uploaded, a.iso)) - Math.abs(dayDiff(opts.uploaded, b.iso)) || a.alt - b.alt);
      if (ok[0]) return { iso: ok[0].iso, raw: ok[0].raw };
    }
  }
  return plain[0] ? { iso: plain[0].iso, raw: plain[0].raw } : null;
}

// 공연 이름 비교용 핵심 키: 도시·방송사·연도·Day 표기를 빼고 낱말을 정렬한다. 같은 행사의 다른 표기는 같은 키가 된다.
const SHOW_STOP = new Set(['2025', '2026', '2027', 'sbs', 'kbs', 'mbc', 'mnet', 'tvn', 'jtbc', 'day', 'ver', 'the', 'in', 'of', 'at', 'live', '서울', '도쿄', '오사카', '요코하마', '뉴욕', '뉴어크', 'la', '엘에이', '오클랜드', '시애틀', '댈러스', '시카고', '토론토', '몬트리올', '마닐라', '싱가포르', '쿠알라룸푸르', '마카오', '홍콩', '가오슝', '타이베이', '방콕', '자카르타', '시드니', '멜버른', '런던', '파리', '베를린', '마드리드', '암스테르담', '부산', '대구']);
const SHOW_SYN = { 썸머: 'summer', 윈터: 'winter', 대학교: '대', 대학: '대', 대동제: '축제', 페스티벌: '축제', festival: '축제', 가요대제전: '가요대전', 앙코르: 'encore', 앵콜: 'encore', 앵콘: 'encore', 앵콜콘: 'encore', 앙코르콘: 'encore', 콘서트: 'concert', 어워드: '어워즈', 어워: '어워즈', awards: '어워즈', award: '어워즈' };
// 영문↔한글, 글자↔숫자가 붙은 곳을 띄운다: "NOL페스티벌" → "nol 페스티벌", "2026TIMA" → "2026 tima"
const splitScripts = (s) => String(s || '').toLowerCase().normalize('NFC')
  .replace(/([a-z])(?=[가-힣])|([가-힣])(?=[a-z])/g, '$1$2 ')
  .replace(/([a-z가-힣])(?=\d)|(\d)(?=[a-z가-힣])/g, '$1$2 ');
function showTokens(name) {
  return splitScripts(name).replace(/water ?music( pool party)?|워터 ?뮤직|캐리비안 ?베이|스타쉽 ?데이/g, '캐리비안베이').replace(/대학교|대학/g, '대').replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(Boolean)
    .map((w) => w.replace(/^day(\d)$/, '$1')).map((w) => SHOW_SYN[w] || w).filter((w) => !SHOW_STOP.has(w) && !/^\d+$/.test(w));
}
export function showKey(name) {
  const uni = [...new Set(showTokens(name))].sort();
  return uni.length ? uni.join(' ') : String(name || '').toLowerCase().replace(/\s+/g, '');
}
export const sameShow = (a, b) => showKey(a) === showKey(b);

// 행사 이름 유사도(0~1): 핵심 낱말을 붙인 글자의 2글자 조각으로 Jaccard와 포함도(작은 쪽이 큰 쪽에 든 비율) 중 큰 값.
// 같은 그룹·같은 날짜 안에서만 쓴다(다른 날짜의 비슷한 이름은 다른 공연).
const bigrams = (s) => { const out = new Set(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out; };
const UNI_NAME = /([가-힣]{2,8}?)(?:대학교|전문대학|전문대|대학|대)(?=\s|축제|대동제|$)/;
export function showSimilarity(a, b) {
  if (showKey(a) === showKey(b)) return 1;
  // 대학 축제는 학교 이름이 같거나 한쪽이 다른 쪽을 품을 때만(국립한밭대 = 한밭대, 안양대 ≠ 한양대)
  const ua = UNI_NAME.exec(String(a || '')), ub = UNI_NAME.exec(String(b || ''));
  if (ua && ub && !ua[1].includes(ub[1]) && !ub[1].includes(ua[1])) return 0;
  const A = bigrams(showTokens(a).join('')), B = bigrams(showTokens(b).join(''));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const jac = inter / (A.size + B.size - inter);
  const small = Math.min(A.size, B.size);
  const cover = small >= 4 ? inter / small : 0;
  return Math.max(jac, cover * 0.9);
}
export const similarShow = (a, b) => showSimilarity(a, b) >= 0.5;

// 여러 장소·여러 날에 걸친 큰 행사(투어·콘서트·페스티벌). 장소 이름만 적힌 영상은 그날 이 행사로 본다
export const HOST_SHOW = /HEARTS 2 HOUSE|TOUR|CONCERT|HOME ?GROUND|ENCORE|FESTIVAL|GLOW|SHOW WHAT I AM|ZERO FRONTIER|콘서트|페스티벌|투어|팬미팅|fan ?meeting/i;
// 행사 이름처럼 보이는 낱말. 이런 낱말이 있는 이름은 그 자체로 다른 행사일 수 있다
export const EVENT_WORD = /콘서트|concert|festival|페스티벌|축제|어워즈|어워드|awards?|시상식|쇼케이스|showcase|팬미팅|fan ?meeting|라디오|radio|가요|music|뮤직|방송|live|라이브|페스타|festa|fes\b/i;
// 확실하지 않은 이름(raw·guess)을 같은 날 공연 day에 붙여도 되는지
export function weakShowFits(name, conf, day) {
  if (conf === 'guess') return true;
  return HOST_SHOW.test(day.show) || !EVENT_WORD.test(name || '');
}

// 담지 않는 영상: 퇴근길·출근길, 팬사인회, mirrored, 댄스 동아리·팀의 커버. 이유를 돌려주고 해당 없으면 null.
export function excludedReason(title, channel = '') {
  const t = `${title || ''} ${channel || ''}`;
  if (/퇴근길|출근길|퇴근 ?직캠|출근 ?직캠/.test(t)) return '퇴근길·출근길';
  if (/팬싸|팬사인|사인회|fan ?sign|fansign/i.test(t)) return '팬사인회';
  if (/mirror(ed)?\b|미러드|좌우반전/i.test(t)) return 'mirrored';
  if (/댄스\s?(동아리|팀|크루|클럽)|dance\s?(team|club|crew|cover)|댄스 ?커버|dance ?cover|\bcover\b|커버 ?(댄스|영상)|동아리|\bDENIS\b/i.test(t)) return '댄스팀·동아리 커버';
  if (/performance ?video|퍼포먼스 ?비디오|stage ?practice|스테이지 ?프랙티스|무대 ?연습/i.test(t)) return '공식 퍼포먼스 영상·연습 영상';
  if (/\.zip\b|📂|무대 ?(영상 ?)?모음|몰아보기|모아보기|compilation|역대 .*무대/i.test(t)) return '무대 모음(zip·compilation)';
  if (/직캠 ?확대|확대 ?직캠|확대본|확대 ?영상|교차 ?편집|stage ?mix|편집본/i.test(t)) return '편집 영상(확대·교차편집)';
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

// 음악 방송 표기 → 정식 행사명. 두 글자 줄임말은 따로 떨어진 낱말일 때만 인정한다(확인가능 → 인가 오인 방지)
export const SHOWS = [
  ['뮤직뱅크', ['뮤직뱅크', 'music bank', 'musicbank', 'kbs music bank'], ['뮤뱅']],
  ['인기가요', ['인기가요', 'inkigayo', 'sbs inkigayo'], ['인가']],
  ['쇼! 음악중심', ['쇼! 음악중심', '쇼!음악중심', '쇼 음악중심', '음악중심', 'music core', 'show! music core', 'show!music core'], ['음중']],
  ['엠카운트다운', ['엠카운트다운', 'm countdown', 'mcountdown', 'm!countdown', 'm count down'], ['엠카']],
  ['더 쇼', ['더 쇼', 'the show', 'sbs fil the show'], ['더쇼']],
  ['쇼챔피언', ['쇼챔피언', 'show champion', 'showchampion'], ['쇼챔']],
];
const TOKEN_SPLIT = /[\s@|[\](){}'"‘’“”·,_\-/:#<>【】「」]+/;


// ---------- 행사 추정: 음악 방송이 아닌 행사(축제·투어·어워즈·방송 프로그램) ----------
const CITY = [[/Kuala|\bKL\b|쿠알라/i, '쿠알라룸푸르'], [/Manila|마닐라/i, '마닐라'], [/Singapore|싱가포르/i, '싱가포르'], [/Macau|마카오/i, '마카오'], [/Sydney|시드니/i, '시드니'], [/Melbourne|멜버른/i, '멜버른'], [/Montreal|몬트리올/i, '몬트리올'], [/Prudential|Newark|뉴어크/i, '뉴어크'], [/\bLA\b|Los Angeles|로스앤젤레스/i, 'LA'], [/Oakland|오클랜드/i, '오클랜드'], [/Seattle|시애틀/i, '시애틀'], [/Hong ?Kong|홍콩/i, '홍콩'], [/Madrid|마드리드/i, '마드리드'], [/Amsterdam|암스테르담/i, '암스테르담'], [/New York|뉴욕/i, '뉴욕'], [/Dallas|댈러스/i, '댈러스'], [/Kaohsiung|가오슝/i, '가오슝'], [/Tokyo|도쿄/i, '도쿄'], [/Osaka|오사카/i, '오사카'], [/Bangkok|방콕/i, '방콕'], [/Jakarta|자카르타/i, '자카르타'], [/Paris|파리/i, '파리'], [/London|런던/i, '런던'], [/Berlin|베를린/i, '베를린'], [/Chicago|시카고/i, '시카고'], [/Toronto|토론토/i, '토론토'], [/Taipei|타이베이/i, '타이베이'], [/Mexico|멕시코/i, '멕시코시티']];
const cityOf = (t) => { for (const [r, n] of CITY) if (r.test(t)) return n; return ''; };
const withCity = (base) => (t) => `${base}${cityOf(t) ? ` ${cityOf(t)}` : ''}`;
const SHOW_RULES = [
  [/울산 ?음악중심/, '울산 음악중심'],
  [/가요대전.{0,20}(summer|썸머)|(summer|썸머).{0,20}가요대전|sbs.{0,20}summer|summer.{0,20}sbs/i, 'SBS 가요대전 SUMMER'],
  [/가요대전|sbs gayo|gayo daejeon/i, 'SBS 가요대전'],
  [/가요대제전|mbc (music )?festival|mbc 가요/i, 'MBC 가요대제전'],
  [/KBS 가요대축제|가요대축제/, 'KBS 가요대축제'],
  [/golden ?disc|골든 ?디스크/i, '골든디스크어워즈'],
  [/서울가요대상|서가대|\bSMA\b|seoul music awards/i, '서울가요대상'],
  [/한터 ?뮤직 ?어워즈|hanteo music award/i, '한터뮤직어워즈'],
  [/\bMAMA\b/, 'MAMA AWARDS'],
  [/KM ?차트|한국대중음악상|KMA\b/i, '한국대중음악상'],
  [/TMElive|\bTIMA\b/i, 'TIMA 2026'],
  [/\bTMA\b|the fact music/i, 'TMA 2026'],
  [/KCON ?(JAPAN|LA|SAUDI|AUSTRALIA)?/i, null],
  [/DIVE ?in ?to IVE|4TH FAN ?CONCERT|팬콘서트|팬콘/i, 'IVE 4TH FAN CONCERT DIVE into IVE'],
  [/SHOW WHAT I AM/i, withCity('IVE WORLD TOUR SHOW WHAT I AM')],
  [/ZERO FRONTIER|1st world tour/i, withCity('NMIXX WORLD TOUR ZERO FRONTIER')],
  [/NOW TOMORROW/i, withCity('NOW TOMORROW. ENCORE')],
  [/TOMORROW ?GLOW/i, withCity('TOMORROW GLOW')],
  [/HEARTS ?2 ?HOUSE/i, withCity('HEARTS 2 HOUSE')],
  [/NOL ?FESTIVAL|놀 ?페스티벌|놀페/i, 'NOL FESTIVAL'],
  [/대구 ?세계마스터즈|WMAC/i, '대구 세계마스터즈 육상경기대회'],
  [/팝업스토어/, '팝업스토어 오픈 행사'],
  [/포토콜|브랜드 ?행사/, '브랜드 행사'],
  [/더 ?시즌즈|THE SEASONS/i, '더 시즌즈'],
  [/water ?music|워터 ?뮤직|캐리비안 ?베이|starship day/i, '캐리비안 베이 Water Music Pool Party'],
  [/열린 ?음악회|open ?concert/i, 'KBS 열린음악회'],
  [/불후의 ?명곡|immortal songs/i, '불후의 명곡'],
  [/가요광장/, 'KBS 가요광장'],
  [/SMTOWN/i, 'SMTOWN LIVE'],
  [/\bASEA\b/, 'ASEA 2026'],
  [/ASIATOP/i, 'ASIATOP MUSIC FESTIVAL'],
  [/한강가요제/, '한강가요제'],
  [/THE PERFORMANCE/i, 'THE PERFORMANCE JAPAN'],
  [/시구|night game/i, '야구 시구 행사'],
  [/입학식|\bOT\b|신입생/, '신입생 행사'],
  [/listening party|리스닝 ?파티/i, 'IVE Listening Party'],
  [/팬미팅|fan ?meeting/i, '팬미팅'],
  [/컴백 ?쇼케이스|쇼케이스|showcase/i, '쇼케이스'],
];
// 대학 축제: "OO대 축제" · "OO대학교 대동제" · "2026 OO대학교 가을 대동제"
function findUniFestival(t) {
  if (!/축제|대동제|festival|festa|페스타|행사|연회|제$/i.test(t)) return null;
  const m = /([가-힣]{2,8}?)(대학교|전문대학|전문대|대학|대)(?![가-힣]*학과)/.exec(t);
  if (!m) return null;
  const name = `${m[1]}${m[2] === '전문대학' || m[2] === '전문대' ? '전문대' : '대'}`;
  return `${name} 축제`;
}
// 알려진 규칙으로 정한 행사 → { name, match } (match: 제목에서 행사 이름에 해당한 부분. 곡 찾기에서 뺀다)
function knownShow(t) {
  const uni = findUniFestival(t);
  if (uni) return { name: uni, match: '' };
  for (const [re, name] of SHOW_RULES) {
    const m = re.exec(t);
    if (!m) continue;
    if (name === null) { const loc = (m[1] || 'JAPAN').toUpperCase(); return { name: `KCON ${loc} 2026`, match: m[0] }; }
    return { name: typeof name === 'function' ? name(t) : name, match: m[0] };
  }
  return null;
}
// 마지막 수단: 구분자로 나눈 조각 중 행사 낱말이 있는 조각
function segmentShow(t) {
  for (const seg of t.split(/[|｜@·]/).map((x) => x.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').trim())) {
    if (/축제|festival|페스티벌|콘서트|concert|어워즈|awards|페스타|festa|시상식|fan ?concert/i.test(seg) && !/직캠|fancam|focus|full/i.test(seg) && seg.length >= 3 && seg.length <= 40) {
      return seg.replace(/\b(20\d\d|2[5-7]\d{4})\b/g, '').replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}
export function inferShow(title, { segments = true } = {}) {
  const t = String(title || '');
  const k = knownShow(t);
  if (k) return k.name;
  return segments ? segmentShow(t) : null;
}

// 음악 방송 이름이 들어 있어도 따로 보는 행사(지역 공개방송 등). 음악 방송 목록보다 먼저 본다.
const SHOW_FIRST = [[/울산 ?음악중심/, '울산 음악중심']];

// 제목에서 행사명과 확실도 → { name, conf, match } 또는 null
//   conf 'known': 음악 방송·알려진 행사 규칙·"@OO대" / 'raw': "@행사명" 문구 그대로 / 'guess': 구분자 조각에서 추정
//   'raw'·'guess'는 같은 날 공연이 이미 있으면 새 공연을 만들지 않고 거기에 붙인다(scripts/archive.mjs add).
export function findShowInfo(title) {
  const src = String(title || '');
  const text = lc(src);
  for (const [re, name] of SHOW_FIRST) { const m = re.exec(src); if (m) return { name, conf: 'known', match: m[0] }; }
  const tokens = text.split(TOKEN_SPLIT).filter(Boolean);
  for (const [name, words, shorts] of SHOWS) {
    if (words.some((w) => has(text, w)) || shorts.some((s) => tokens.some((t) => t === s || /^(직캠|풀캠|사녹)$/.test(t.slice(s.length)) && t.startsWith(s)))) return { name, conf: 'known', match: '' };
  }
  const known = knownShow(src);
  if (known) return { ...known, conf: 'known' };
  const m = /@\s*([^|[\]()@]+?)\s*(?:$|[|[\]()@]|\b\d{6}\b|\b\d{8}\b)/.exec(src);
  if (m) {
    const raw = m[1].replace(/\s+(직캠|fancam|full|풀캠|4k)\b.*$/i, '').trim();
    const uni = /^([가-힣]{2,8}?)(대학교|전문대학|전문대|대학|대)$/.exec(raw);
    if (uni) return { name: `${uni[1]}${/전문대/.test(uni[2]) ? '전문대' : '대'} 축제`, conf: 'known', match: m[0] };
    if (raw && raw.length <= 40) return { name: raw, conf: 'raw', match: m[0] };
  }
  const seg = segmentShow(src);
  return seg ? { name: seg, conf: 'guess', match: '' } : null;
}

// 제목에서 행사명: 알려진 음악 방송 → 알려진 행사 → "@행사명" 꼴 → 조각 추정 → null
export function findShow(title) {
  return findShowInfo(title)?.name ?? null;
}

// 곡 비교 키: 소문자, 글자·숫자만(띄어쓰기·기호 무시). "BLACK HOLE" = "Blackhole", "RUDE!" = "RUDE"
export const songKey = (s) => String(s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '');

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let pprev = prev;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // 이웃 글자 바뀜(Phoneix/Phoenix)은 1
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], pprev[j - 2] + 1);
    }
    pprev = prev;
    prev = cur;
  }
  return prev[b.length];
}

// 그룹 곡 목록에서 이름으로 곡 찾기: 같은 키 → 오타(키 8자 이상이면 2자, 5자 이상이면 1자) → null
export function matchSong(group, name) {
  const k = songKey(name);
  if (!k || !group) return null;
  const songs = (group.songs || []).filter((s) => s.kind !== 'other');
  const names = (s) => [s.title, ...(s.aliases || [])].map(songKey).filter(Boolean);
  const exact = songs.find((s) => names(s).includes(k));
  if (exact) return exact;
  if (k.length < 5 || !/[a-z]/.test(k)) return null;
  let best = null;
  for (const s of songs) for (const n of names(s)) {
    if (n.length < 5) continue;
    const d = editDistance(k, n);
    const lim = Math.min(k.length, n.length) >= 8 ? 2 : 1;
    if (d <= lim && (!best || d < best.d)) best = { s, d };
  }
  return best ? best.s : null;
}

// 따옴표 안 문구가 곡 이름일 수 있는지: 멤버·그룹 이름, 행사·상 이름, 챌린지·멘트·이벤트, 직캠 표기는 곡이 아니다.
const NOT_SONG = /상$|부문|챌린지|challenge|멘트|토크|팬서비스|행사|이벤트|event|컬렉션|프레젠테이션|라운지|lounge|award|어워즈|시상|tournament|festival|페스티벌|축제|콘서트|concert|직캠|fancam|focus|풀캠|full ?cam|\bver\b|버전|모음|하이라이트|highlight|브이로그|vlog|인터뷰|interview|리액션|reaction/i;
export function songGuessOk(guess, group) {
  const g = String(guess || '').trim();
  const k = songKey(g);
  if (!k || g.length > 40 || NOT_SONG.test(g)) return false;
  if (group) {
    const people = [group.name, group.en, ...(group.members || []).flatMap((m) => [m.name, ...(m.aliases || [])])].map(songKey);
    if (people.includes(k)) return false;
  }
  if (findShowInfo(g)?.conf === 'known') return false;
  return true;
}

// 제목 속 곡 찾기: 짧은 한글 이름(해야 등)은 따로 떨어진 낱말일 때만, 6자 이상 키는 띄어쓰기를 무시하고도 찾는다.
function songHits(text, group) {
  const compact = songKey(text);
  const tokens = text.split(TOKEN_SPLIT).filter(Boolean);
  const hits = [];
  for (const s of group.songs || []) {
    if (s.kind === 'other') continue; // 곡이 아닌 항목(투어·상·챌린지 이름)은 제목에서 찾지 않는다
    let best = null;
    for (const w of [s.title, ...(s.aliases || [])]) {
      if (!w) continue;
      const lw = lc(w).trim();
      const k = songKey(w);
      let pos = -1;
      if (/^\d+$/.test(k)) {
        // 숫자만인 곡(8 등)은 공백·따옴표·괄호로 둘러싸일 때만. 날짜 8.4.26의 8은 곡이 아니다
        const mm = new RegExp(`(^|[\\s'"‘’“”(\\[])${k}(?=$|[\\s'"‘’“”)\\]])`).exec(text);
        if (mm) pos = mm.index;
      } else if (!/^[a-z0-9 ]+$/.test(lw) && k.length <= 2) { if (tokens.includes(lw)) pos = text.indexOf(lw); }
      else if (has(text, w)) pos = Math.max(0, text.indexOf(lw));
      else if (k.length >= 6 && compact.includes(k)) pos = Math.max(0, text.indexOf(lw.slice(0, 2)));
      if (pos >= 0 && (!best || k.length > best.len)) best = { id: s.id, len: k.length, key: k, pos };
    }
    if (best && !hits.some((h) => h.key === best.key)) hits.push(best);
  }
  // 긴 이름에 포함된 짧은 이름은 버린다(Super Icy & Force 안의 Force 등은 둘 다 곡이면 남는다: 키가 다른 곡이니까)
  return hits.filter((h) => !hits.some((o) => o !== h && o.len > h.len && o.key.includes(h.key))).sort((a, b) => a.pos - b.pos);
}

// 제목 해석: { date, show, showConf, label, memberIds, groupCam, songId, songIds, songGuess, type, tags, source }
// opts.uploaded: 업로드 날짜(YYYY-MM-DD). 날짜 표기가 두 가지로 읽힐 때 고르는 데 쓴다.
export function parseTitle(title, group, { channel = '', uploaded = null } = {}) {
  const text = lc(title);
  const out = { date: null, show: null, showConf: null, label: null, memberIds: [], groupCam: false, songId: null, songIds: [], songGuess: null, type: null, tags: [], source: null };
  const d = findDate(title, { uploaded });
  if (d) out.date = d.iso;
  const si = findShowInfo(title);
  if (si) { out.show = si.name; out.showConf = si.conf; }
  // 따옴표 안의 곡명 후보('Paper Moon', ‘Static’, "첫 장면")
  const q = /['‘’"“”]([^'‘’"“”]{1,60})['‘’"“”]/.exec(String(title || ''));
  if (q && songGuessOk(q[1], group)) out.songGuess = q[1].trim();
  if (group) {
    for (const m of group.members || []) {
      if ([m.name, ...(m.aliases || [])].some((w) => w && has(text, w))) out.memberIds.push(m.id);
    }
    // 행사 이름 부분(SHOW WHAT I AM 투어의 "I AM" 등)은 빼고 곡을 찾는다
    const songText = si && si.match ? text.replace(lc(si.match), ' ') : text;
    const hits = songHits(songText, group);
    out.songIds = [...new Set(hits.map((h) => h.id))];
    if (hits.length) out.songId = hits.reduce((a, b) => (b.len > a.len ? b : a)).id;
    if (!out.songId && out.songGuess) {
      const ms = matchSong(group, out.songGuess);
      if (ms) { out.songId = ms.id; out.songIds = [ms.id]; out.songGuess = null; }
    }
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
  if (/사녹|사전녹화|pre-?record/.test(text)) { tags.push('사전녹화'); out.label = '사전녹화'; }
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
