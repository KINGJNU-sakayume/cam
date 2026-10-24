// YouTube search with continuation paging (no API key needed beyond page's public innertube key)
const UA='Mozilla/5.0';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function walk(o,f){ if(Array.isArray(o)) o.forEach(x=>walk(x,f)); else if(o&&typeof o==='object'){ f(o); for(const v of Object.values(o)) walk(v,f);} }
function parse(d){ const vids=[]; let tok=null;
  walk(d,o=>{ if(o.videoRenderer){const v=o.videoRenderer; vids.push({id:v.videoId,title:(v.title?.runs||[]).map(x=>x.text).join(''),ch:v.ownerText?.runs?.[0]?.text||'',pub:v.publishedTimeText?.simpleText||'',len:v.lengthText?.simpleText||''});}
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
