#!/bin/bash
# prep.sh <harvest out dir> <work dir> : build rows/auto, run classify + match + finalize
cd "$(dirname "$0")/../.."
SC="scripts/backfill"
O=$1; W=$2; mkdir -p "$W"; echo '{"videos":[]}' > "$W/req.json"; [ -f "$W/manual.json" ] || echo '{"drop":[],"set":{}}' > "$W/manual.json"
head -1 $O/summary.txt
node -e "
const fs=require('fs');const [O,W]=process.argv.slice(1);const m=JSON.parse(fs.readFileSync('.cache/yt-meta.json'));
const a=JSON.parse(fs.readFileSync(O+'/auto.json')).videos,r=JSON.parse(fs.readFileSync(O+'/review.json')).videos;
fs.writeFileSync(W+'/auto.json',JSON.stringify({videos:a}));
fs.writeFileSync(W+'/rows.json',JSON.stringify(r.map(v=>{const id=v.url.split('/').pop();const mm=m[id]||{};return {id,t:v.title,ch:v.channel,up:mm.uploaded||v.uploaded,sec:mm.seconds,desc:(mm.description||'').replace(/\s+/g,' ').slice(0,140)}})))" $O "$W"
node "$SC/classify.mjs" "$W" | head -1
node "$SC/match.mjs" "$W" > "$W/match.txt"; head -1 "$W/match.txt"
node "$SC/finalize.mjs" "$W"
