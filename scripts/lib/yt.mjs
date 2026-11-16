// 유튜브 검색·영상 정보 (API 키 없이, 의존성 없음). harvest.mjs가 쓴다.
// 화면에 보이는 공개 정보만 읽는다: 검색 결과(ytInitialData + continuation), 영상 정보(innertube player → 안 되면 watch 페이지).
import { spawn } from 'node:child_process';
const UA ='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "조회수 673,342회" · "조회수 131만회" · "1.2천회" · "12,155 views" → 숫자(모르면 null)
export function parseViews(t) {
  const s = String(t || '').replace(/조회수|views?|회|,|\s/gi, '');
  if (!s) return null;
  const m = s.match(/^([\d.]+)(억|만|천|[KkMmBb])?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = { 억: 1e8, 만: 1e4, 천: 1e3, k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(n * u);
}

// 조회수 컷: 올라온 지 얼마 안 된 영상은 조회수가 쌓이기 전이라 컷을 낮춘다.
// 조회수는 처음 1~2개월 동안 늘다가 거의 멈춰서, 컷도 600까지 포화 곡선으로 올린다(4K·직캠 표기가 없으면 2배).
//   1일 20 · 7일 125 · 14일 224 · 30일 379 · 60일 519 · 90일 이후 약 600
export function viewsCut(ageDays, { quality = true } = {}) {
  const age = Number.isFinite(ageDays) ? Math.max(0, ageDays) : 365; // 나이를 모르면 충분히 오래된 영상으로 본다
  const cut = 600 * (1 - Math.exp(-age / 30));
  return Math.round(quality ? cut : cut * 2);
}

// 한국 시간 날짜(YYYY-MM-DD). 공연 날짜가 한국 기준이라 업로드 날짜도 한국 기준으로 맞춘다
export function kstDate(d) {
  const t = d instanceof Date ? d.getTime() : Date.parse(d);
  if (!Number.isFinite(t)) return null;
  return new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
}
// publishDate: "2026-10-23T05:00:12-07:00" → 한국 날짜, "2026-10-23"(시각 없음) → 그대로
export function publishToKst(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return kstDate(s);
}
// 검색 결과의 "3일 전" · "2 weeks ago" → 대략의 날짜와 오차(일). 정확한 날짜를 못 얻었을 때만 쓴다
export function relativeToDate(pub, now = new Date()) {
  const s = String(pub || '').replace(/^(스트리밍 시간:|Streamed)\s*/, '');
  const m = /(\d+)\s*(초|분|시간|일|주|개월|달|년|second|minute|hour|day|week|month|year)s?/i.exec(s);
  if (!m) return null;
  const n = +m[1];
  const unit = m[2].toLowerCase();
  const days = { 초: 0, second: 0, 분: 0, minute: 0, 시간: n / 24, hour: n / 24, 일: n, day: n, 주: 7 * n, week: 7 * n, 개월: 30 * n, 달: 30 * n, month: 30 * n, 년: 365 * n, year: 365 * n }[unit];
  const err = { 주: 7, week: 7, 개월: 30, 달: 30, month: 30, 년: 365, year: 365 }[unit] || 1;
  return { date: kstDate(new Date(now.getTime() - (unit === '시간' || unit === 'hour' ? n * 3600e3 : days * 86400e3))), err };
}

function walk(o, f) {
  if (Array.isArray(o)) o.forEach((x) => walk(x, f));
  else if (o && typeof o === 'object') { f(o); for (const v of Object.values(o)) walk(v, f); }
}
export function parseSearch(d) {
  const vids = [];
  let tok = null;
  walk(d, (o) => {
    if (o.videoRenderer) {
      const v = o.videoRenderer;
      vids.push({
        id: v.videoId,
        title: (v.title?.runs || []).map((x) => x.text).join(''),
        ch: v.ownerText?.runs?.[0]?.text || '',
        pub: v.publishedTimeText?.simpleText || '',
        len: v.lengthText?.simpleText || '',
        views: parseViews(v.viewCountText?.simpleText || v.viewCountText?.runs?.map((x) => x.text).join('') || ''),
      });
    }
    if (o.continuationItemRenderer) tok = o.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token || tok;
  });
  return { vids, tok };
}

// 실패 이유 집계 (harvest.mjs가 끝에 출력한다): http429 · http5xx · network · no-data
const fails = {};
const noteFail = (why) => { fails[why] = (fails[why] || 0) + 1; };
export function takeFailStats() {
  const out = { ...fails };
  for (const k of Object.keys(fails)) delete fails[k];
  return out;
}
const reasonOf = (e) => {
  const m = /^HTTP (\d+)/.exec(e?.message || '');
  if (!m) return 'network';
  return m[1] === '429' ? 'http429' : 'http5xx';
};

// 전송은 curl을 먼저 쓴다. 클라우드 환경(프록시 뒤)에서는 Node fetch가 직접 DNS를 찾다가 절반 넘게 ENOTFOUND로 실패하는데,
// curl은 HTTPS_PROXY·CA 설정을 그대로 따라 안정적이다. curl이 없으면 fetch로 되돌아간다.
let curlOk = true;
function curlRequest(url, opts) {
  return new Promise((resolve, reject) => {
    const args = ['-sS', '--compressed', '-m', '20', '-w', '\n%{http_code}', '-A', UA, '-H', 'accept-language: ko-KR,ko;q=0.9'];
    for (const [k, v] of Object.entries(opts.headers || {})) args.push('-H', `${k}: ${v}`);
    if (opts.method === 'POST') args.push('-X', 'POST', '--data-binary', '@-');
    args.push(url);
    const p = spawn('curl', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [], err = [];
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => err.push(d));
    p.on('error', reject); // ENOENT: curl이 없다
    p.on('close', (code) => {
      const buf = Buffer.concat(out).toString('utf8');
      const nl = buf.lastIndexOf('\n');
      const status = Number(buf.slice(nl + 1)) || 0;
      if (code !== 0 || !status) return reject(new Error(`curl ${code}: ${Buffer.concat(err).toString('utf8').trim().slice(0, 120)}`));
      const text = buf.slice(0, nl);
      resolve({ status, text: async () => text, json: async () => JSON.parse(text) });
    });
    p.stdin.on('error', () => {});
    p.stdin.end(opts.body || '');
  });
}
async function request(url, opts) {
  if (curlOk) {
    try { return await curlRequest(url, opts); } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      curlOk = false; // curl이 없으면 이후로는 fetch만
    }
  }
  return fetch(url, { ...opts, headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9', ...(opts.headers || {}) }, signal: AbortSignal.timeout(15000) });
}

// 요청 간격 조절: HARVEST_GAP_MS(기본 0)만큼 요청 사이를 띄운다. 429·빈 응답(차단 신호)이 오면 간격을 두 배로(최대 20초),
// 성공이 50번 이어지면 20%씩 줄여 처음 값으로 돌아간다. 동시에 여러 작업이 돌아도 전체 요청 간격이 지켜진다.
const GAP_MIN = Math.max(0, Number(process.env.HARVEST_GAP_MS) || 0);
let gap = GAP_MIN, nextAt = 0, okRun = 0, emptyRun = 0;
async function gate() {
  const now = Date.now();
  const at = Math.max(now, nextAt);
  nextAt = at + gap;
  if (at > now) await sleep(at - now);
}
export function slowDown(why) {
  const old = gap;
  gap = Math.min(20000, Math.max(1000, gap * 2));
  okRun = 0;
  nextAt = Math.max(nextAt, Date.now() + gap);
  if (gap !== old) console.log(`\n  … ${why}: 요청 간격 ${old}ms → ${gap}ms`);
}
function speedUp() {
  if (++okRun < 50 || gap <= GAP_MIN) return;
  gap = Math.max(GAP_MIN, Math.round(gap * 0.8));
  okRun = 0;
}
export const currentGap = () => gap;

async function get(url, opts = {}, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      await gate();
      const r = await request(url, opts);
      if (r.status === 429) slowDown('http429');
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      speedUp();
      return r;
    } catch (e) {
      if (i === tries - 1) { noteFail(reasonOf(e)); throw e; }
      await sleep(1500 * (i + 1) + Math.random() * 1000);
    }
  }
  return null;
}

let client = null; // { key, ver } 첫 검색 페이지에서 얻는다
// 검색: 첫 페이지 + continuation pages-1장. 실패하면 null
export async function search(q, { pages = 3 } = {}) {
  let html, m;
  for (let i = 0; i < 3 && !m; i++) { // 검색 페이지에 ytInitialData가 빠져 오면(동의 화면 등) 잠시 뒤 다시
    if (i) await sleep(1500 * i + Math.random() * 1000);
    try { html = await (await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`)).text(); } catch { return null; }
    m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  }
  if (!m) { noteFail('no-data'); slowDown('검색 결과 페이지가 비어 옴'); return null; }
  const key = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
  const ver = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || [])[1] || '2.20261001.00.00';
  if (key) client = { key, ver };
  let { vids, tok } = parseSearch(JSON.parse(m[1]));
  const all = [...vids];
  for (let p = 1; p < pages && tok && key; p++) {
    await sleep(300 + Math.random() * 400);
    try {
      const r = await get(`https://www.youtube.com/youtubei/v1/search?key=${key}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: ver, hl: 'ko', gl: 'KR' } }, continuation: tok }),
      });
      const x = parseSearch(await r.json());
      all.push(...x.vids);
      tok = x.tok;
      if (!x.vids.length) break;
    } catch { break; }
  }
  return all;
}

// player 응답 → { title, channel, uploaded(한국 날짜), views, seconds, description }
export function parsePlayer(j) {
  const d = j?.videoDetails, mf = j?.microformat?.playerMicroformatRenderer;
  if (!d && !mf) return null;
  const pub = mf?.publishDate || mf?.uploadDate || '';
  return {
    title: d?.title || mf?.title?.simpleText || '',
    channel: d?.author || mf?.ownerChannelName || '',
    uploaded: publishToKst(pub),
    views: d?.viewCount != null ? Number(d.viewCount) : null,
    seconds: d?.lengthSeconds != null ? Number(d.lengthSeconds) : null,
    description: (d?.shortDescription || '').slice(0, 500),
  };
}
// watch 페이지 HTML → 같은 꼴(player가 막혔을 때)
export function parseWatchHtml(html) {
  const pr = html.match(/var ytInitialPlayerResponse = (\{.*?\});(?:var|<\/script>)/s);
  if (pr) { try { const x = parsePlayer(JSON.parse(pr[1])); if (x) return x; } catch { /* 아래로 */ } }
  const pub = (html.match(/"publishDate":"([^"]+)"/) || html.match(/itemprop="datePublished" content="([^"]+)"/) || [])[1];
  const title = (html.match(/<meta name="title" content="([^"]*)"/) || [])[1] || '';
  if (!pub && !title) return null;
  return { title, channel: (html.match(/"ownerChannelName":"([^"]+)"/) || [])[1] || '', uploaded: publishToKst(pub), views: null, seconds: null, description: '' };
}

// 영상 하나의 정확한 업로드 날짜·조회수·제목. 실패하면 null
export async function videoInfo(id) {
  if (client) {
    try {
      const r = await get(`https://www.youtube.com/youtubei/v1/player?key=${client.key}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: client.ver, hl: 'ko', gl: 'KR' } }, videoId: id }),
      }, 2);
      const x = parsePlayer(await r.json());
      if (x && x.uploaded) return x;
      noteFail('info-player-empty'); // 응답은 왔지만 영상 정보가 없다(비공개·삭제·봇 확인 등)
    } catch { /* watch 페이지로 */ }
  }
  try {
    const x = parseWatchHtml(await (await get(`https://www.youtube.com/watch?v=${id}&hl=ko`, {}, 2)).text());
    // 영상 하나가 비어 오는 건 비공개·연령 제한일 수 있어서, 3번 연속 비어 올 때만 차단으로 보고 늦춘다
    if (!x) { noteFail('info-watch-empty'); if (++emptyRun >= 3) { emptyRun = 0; slowDown('영상 정보 페이지가 연속으로 비어 옴'); } } else emptyRun = 0;
    return x;
  } catch { return null; }
}
