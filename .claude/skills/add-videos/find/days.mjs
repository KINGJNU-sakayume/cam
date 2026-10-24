// 사용: node .claude/skills/add-videos/find/days.mjs <시작YYYY-MM-DD> <끝YYYY-MM-DD> <출력폴더> [deep]
// 1) 날짜(YYMMDD)×그룹명 전수 검색 → found.json  2) deep: 후보가 5개 이상인 (그룹,날짜)에 멤버×날짜 검색 추가
import fs from 'fs'; import path from 'path'; import {search} from './yt.mjs';
const [from,to,dir,mode]=process.argv.slice(2); fs.mkdirSync(dir,{recursive:true});
const data=JSON.parse(fs.readFileSync('data/videos.json'));
const fp=path.join(dir,'found.json'), dp=path.join(dir,'done.txt');
const out=fs.existsSync(fp)?JSON.parse(fs.readFileSync(fp)):{};
const done=new Set(fs.existsSync(dp)?fs.readFileSync(dp,'utf8').split('\n'):[]);
const run=async(g,day,q,pages)=>{ if(done.has(q)) return; const r=await search(q,{pages}); if(!r) return;
  for(const v of r) if(!out[v.id]) out[v.id]={...v,g:g.id,day}; fs.appendFileSync(dp,q+'\n'); };
const days=[]; for(let d=new Date(from);d<=new Date(to);d.setDate(d.getDate()+1)) days.push(d.toISOString().slice(0,10));
if(mode!=='deep'){
  for(const day of days){ const y=day.slice(2,4)+day.slice(5,7)+day.slice(8,10);
    for(const g of data.groups) for(const n of [g.name,g.en]) await run(g,day,`${n} ${y}`,5);
    fs.writeFileSync(fp,JSON.stringify(out)); }
} else {
  const cnt={}; for(const v of Object.values(out)){const k=v.g+' '+v.day;cnt[k]=(cnt[k]||0)+1}
  for(const [k,c] of Object.entries(cnt)) if(c>=5){ const [gid,day]=k.split(' '); const g=data.groups.find(x=>x.id===gid); const y=day.slice(2,4)+day.slice(5,7)+day.slice(8,10);
    for(const m of g.members.filter(m=>m.active)) for(const q of [`${m.name} 직캠 ${y}`,`${m.aliases[0]} fancam ${y}`]) await run(g,day,q,3);
    fs.writeFileSync(fp,JSON.stringify(out)); }
}
console.log('후보',Object.keys(out).length);
