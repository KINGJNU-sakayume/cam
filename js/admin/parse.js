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

// 제목의 날짜 → { iso, raw }. 261024 · 20261024 · 2026.10.24 · 2026-10-24 · 26.10.24 · 10/24/26 · 24.10.2026 ·
// 10-24-2026 · 2026년 10월 24일 · 10월 24일(opts.year 필요) · Oct 24, 2026 · 24 Oct 2026 를 읽는다.
export function findDate(text, opts = {}) {
  const t = String(text || '');
  let m, iso;
  // YYYY.M.D / YYYY-MM-DD / YYYY/M/D / YYYY M D
  const ymd = /(?:^|[^\d])(20\d\d)\s*[.\-/ ]\s*(\d{1,2})\s*[.\-/ ]\s*(\d{1,2})(?!\d)/g;
  while ((m = ymd.exec(t))) if ((iso = mk(+m[1], +m[2], +m[3]))) return { iso, raw: m[0].trim() };
  // 2026년 10월 24일
  m = /(20\d\d)\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(t);
  if (m && (iso = mk(+m[1], +m[2], +m[3]))) return { iso, raw: m[0] };
  // YY.MM.DD (연도가 앞, 25~27)
  const yymd = /(?:^|[^\d])(2[5-7])[.\-/](\d{1,2})[.\-/](\d{1,2})(?!\d)/g;
  while ((m = yymd.exec(t))) if ((iso = mk(2000 + +m[1], +m[2], +m[3]))) return { iso, raw: m[0].trim() };
  // A.B.YYYY / A.B.YY : 앞이 12보다 크면 일.월, 뒤가 12보다 크면 월.일, 둘 다 12 이하면 . 은 일.월, / - 는 월.일
  const abY = /(?:^|[^\d])(\d{1,2})([.\-/])(\d{1,2})\2(20\d\d|\d{2})(?!\d)/g;
  while ((m = abY.exec(t))) {
    const a = +m[1], b = +m[3], y = fullYear(+m[4]);
    const dm = a > 12 || (b <= 12 && m[2] === '.');
    iso = dm ? mk(y, b, a) : mk(y, a, b);
    if (iso) return { iso, raw: m[0].trim() };
  }
  // Oct 24, 2026 / October 24 2026 / 24 Oct 2026
  m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d\d)\b/i.exec(t);
  if (m && (iso = mk(+m[3], MONTHS[m[1].toLowerCase()], +m[2]))) return { iso, raw: m[0] };
  m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?,?\s+(20\d\d)\b/i.exec(t);
  if (m && (iso = mk(+m[3], MONTHS[m[2].toLowerCase()], +m[1]))) return { iso, raw: m[0] };
  // 6·8자리 붙은 날짜: 261024 · 20261024
  const re = /(?:^|[^\d])(\d{8}|\d{6})(?=[^\d]|$)/g;
  while ((m = re.exec(t))) {
    const d = m[1];
    iso = mk(d.length === 8 ? +d.slice(0, 4) : 2000 + +d.slice(0, 2), +d.slice(d.length === 8 ? 4 : 2, d.length === 8 ? 6 : 4), +d.slice(d.length === 8 ? 6 : 4));
    if (iso) return { iso, raw: d };
  }
  // 10월 24일 (연도는 opts.year로)
  if (opts.year) {
    m = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(t);
    if (m && (iso = mk(+opts.year, +m[1], +m[2]))) return { iso, raw: m[0] };
  }
  return null;
}

// 공연 이름 비교용 핵심 키: 도시·방송사·연도·Day 표기를 빼고 낱말을 정렬한다. 같은 행사의 다른 표기는 같은 키가 된다.
const SHOW_STOP = new Set(['2025', '2026', '2027', 'sbs', 'kbs', 'mbc', 'mnet', 'tvn', 'jtbc', 'day', 'ver', 'the', 'in', 'of', 'at', 'live', '서울', '도쿄', '오사카', '요코하마', '뉴욕', '뉴어크', 'la', '엘에이', '오클랜드', '시애틀', '댈러스', '시카고', '토론토', '몬트리올', '마닐라', '싱가포르', '쿠알라룸푸르', '마카오', '홍콩', '가오슝', '타이베이', '방콕', '자카르타', '시드니', '멜버른', '런던', '파리', '베를린', '마드리드', '암스테르담', '부산', '대구']);
const SHOW_SYN = { 썸머: 'summer', 윈터: 'winter', 대학교: '대', 대학: '대', 대동제: '축제', 페스티벌: '축제', festival: '축제', 가요대제전: '가요대전', 앙코르: 'encore', 앵콜: 'encore', 앵콘: 'encore', 콘서트: 'concert' };
export function showKey(name) {
  const toks = String(name || '').toLowerCase().replace(/water ?music( pool party)?|워터 ?뮤직|캐리비안 ?베이|스타쉽 ?데이/g, '캐리비안베이').replace(/대학교|대학/g, '대').replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(Boolean)
    .map((w) => w.replace(/^day(\d)$/, '$1')).map((w) => SHOW_SYN[w] || w).filter((w) => !SHOW_STOP.has(w) && !/^\d$/.test(w));
  const uni = [...new Set(toks)].sort();
  return uni.length ? uni.join(' ') : String(name || '').toLowerCase().replace(/\s+/g, '');
}
export const sameShow = (a, b) => showKey(a) === showKey(b);

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
export function inferShow(title, { segments = true } = {}) {
  const t = String(title || '');
  const uni = findUniFestival(t);
  if (uni) return uni;
  for (const [re, name] of SHOW_RULES) {
    const m = re.exec(t);
    if (!m) continue;
    if (name === null) { const loc = (m[1] || 'JAPAN').toUpperCase(); return `KCON ${loc} 2026`; }
    return typeof name === 'function' ? name(t) : name;
  }
  if (!segments) return null;
  // 마지막 수단: 구분자로 나눈 조각 중 행사 낱말이 있는 조각
  for (const seg of t.split(/[|｜@·]/).map((x) => x.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').trim())) {
    if (/축제|festival|페스티벌|콘서트|concert|어워즈|awards|페스타|festa|시상식|fan ?concert/i.test(seg) && !/직캠|fancam|focus|full/i.test(seg) && seg.length >= 3 && seg.length <= 40) {
      return seg.replace(/\b(20\d\d|2[5-7]\d{4})\b/g, '').replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}

// 제목에서 행사명: 알려진 음악 방송 → "@행사명" 꼴 → null
export function findShow(title) {
  const text = lc(title);
  const tokens = text.split(TOKEN_SPLIT).filter(Boolean);
  for (const [name, words, shorts] of SHOWS) {
    if (words.some((w) => has(text, w)) || shorts.some((s) => tokens.some((t) => t === s || /^(직캠|풀캠|사녹)$/.test(t.slice(s.length)) && t.startsWith(s)))) return name;
  }
  const known = inferShow(title, { segments: false });
  if (known) return known;
  const m = /@\s*([^|[\]()@]+?)\s*(?:$|[|[\]()@]|\b\d{6}\b|\b\d{8}\b)/.exec(String(title || ''));
  if (m) {
    const raw = m[1].replace(/\s+(직캠|fancam|full|풀캠|4k)\b.*$/i, '').trim();
    const uni = /^([가-힣]{2,8}?)(대학교|전문대학|전문대|대학|대)$/.exec(raw);
    if (uni) return `${uni[1]}${/전문대/.test(uni[2]) ? '전문대' : '대'} 축제`;
    if (raw && raw.length <= 40) return raw;
  }
  return inferShow(title);
}

// 제목 해석: { date, show, label, memberIds, groupCam, songId, songGuess, type, tags, source }
export function parseTitle(title, group, { channel = '' } = {}) {
  const text = lc(title);
  const out = { date: null, show: null, label: null, memberIds: [], groupCam: false, songId: null, songGuess: null, type: null, tags: [], source: null };
  const d = findDate(title);
  if (d) out.date = d.iso;
  out.show = findShow(title);
  // 따옴표 안의 곡명 후보('Paper Moon', ‘Static’, "첫 장면")
  const q = /['‘’"“”]([^'‘’"“”]{1,60})['‘’"“”]/.exec(String(title || ''));
  if (q) out.songGuess = q[1].trim();
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
