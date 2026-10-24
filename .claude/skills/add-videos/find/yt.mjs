// YouTube search with continuation paging (no API key needed beyond page's public innertube key)
const UA='Mozilla/5.0';
// "조회수 673,342회" · "조회수 131만회" · "1.2천회" · "12,155 views" → 숫자(모르면 null)
export function parseViews(t){
  const s=String(t||'').replace(/조회수|views?|회|,|\s/gi,'');
  if(!s) return null;
  const m=s.match(/^([\d.]+)(억|만|천|[KkMmBb])?$/); if(!m) return null;
  const n=parseFloat(m[1]); const u={억:1e8,만:1e4,천:1e3,k:1e3,m:1e6,b:1e9}[(m[2]||'').toLowerCase()]||1;
  return Math.round(n*u);
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function walk(o,f){ if(Array.isArray(o)) o.forEach(x=>walk(x,f)); else if(o&&typeof o==='object'){ f(o); for(const v of Object.values(o)) walk(v,f);} }
function parse(d){ const vids=[]; let tok=null;
  walk(d,o=>{ if(o.videoRenderer){const v=o.videoRenderer; vids.push({id:v.videoId,title:(v.title?.runs||[]).map(x=>x.text).join(''),ch:v.ownerText?.runs?.[0]?.text||'',pub:v.publishedTimeText?.simpleText||'',len:v.lengthText?.simpleText||'',views:parseViews(v.viewCountText?.simpleText||v.viewCountText?.runs?.map(x=>x.text).join('')||'')});}
    if(o.continuationItemRenderer) tok=o.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token||tok; });
  return {vids,tok}; }
export async function search(q,{pages=3,sp=''}={}){
  const url='https://www.youtube.com/results?search_query='+encodeURIComponent(q)+(sp?'&sp='+sp:'');
  let html; for(let i=0;i<3;i++){ try{ const r=await fetch(url,{headers:{'user-agent':UA,'accept-language':'ko'}}); html=await r.text(); if(html.includes('ytInitialData')) break; }catch{} await sleep(2000*(i+1)); }
  if(!html) return null;
  const m=html.match(/var ytInitialData = (\{.*?\});<\/script>/s); if(!m) return null;
  const key=(html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)||[])[1]; const ver=(html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)||[])[1]||'2.20260101.00.00';
  let {vids,tok}=parse(JSON.parse(m[1])); const all=[...vids];
  for(let p=1;p<pages&&tok&&key;p++){
    await sleep(700);
    try{ const r=await fetch('https://www.youtube.com/youtubei/v1/search?key='+key,{method:'POST',headers:{'content-type':'application/json','user-agent':UA},body:JSON.stringify({context:{client:{clientName:'WEB',clientVersion:ver,hl:'ko',gl:'KR'}},continuation:tok})});
      const j=await r.json(); const x=parse(j); all.push(...x.vids); tok=x.tok; if(!x.vids.length) break; }catch(e){ break; }
  }
  return all; }
