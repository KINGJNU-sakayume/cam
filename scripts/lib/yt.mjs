// 유튜브 검색·영상 정보 (API 키 없이, 의존성 없음). harvest.mjs가 쓴다.
// 화면에 보이는 공개 정보만 읽는다: 검색 결과(ytInitialData + continuation), 영상 정보(innertube player → 안 되면 watch 페이지).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
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

async function get(url, opts = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9', ...(opts.headers || {}) }, signal: AbortSignal.timeout(15000) });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1500 * (i + 1) + Math.random() * 1000);
    }
  }
  return null;
}

let client = null; // { key, ver } 첫 검색 페이지에서 얻는다
// 검색: 첫 페이지 + continuation pages-1장. 실패하면 null
export async function search(q, { pages = 3 } = {}) {
  let html;
  try { html = await (await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`)).text(); } catch { return null; }
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return null;
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
    } catch { /* watch 페이지로 */ }
  }
  try { return parseWatchHtml(await (await get(`https://www.youtube.com/watch?v=${id}&hl=ko`, {}, 2)).text()); } catch { return null; }
}
