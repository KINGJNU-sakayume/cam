#!/bin/bash
# apply.sh <dir> "<commit message>" : add final.json, face positions, validate, commit
set -e
cd "$(dirname "$0")/../.."
export PYTHONIOENCODING=utf-8
before=$(node -e "console.log(JSON.parse(require('fs').readFileSync('data/videos.json')).videos.length)")
node scripts/archive.mjs add "$1/final.json" --create-songs --skip-invalid > "$1/add.txt" 2>&1 || true
after=$(node -e "console.log(JSON.parse(require('fs').readFileSync('data/videos.json')).videos.length)")
python scripts/face-pos.py > /dev/null 2>&1 && node scripts/archive.mjs thumbpos .cache/face-pos.json > /dev/null
python scripts/face-pos.py --full > /dev/null 2>&1 && node scripts/archive.mjs thumbpos .cache/face-pos-full.json > /dev/null
node scripts/archive.mjs validate | tail -1
n=$((after-before))
echo "담음 $n개"; grep -o '새 곡 [^(]*' "$1/add.txt" | sort -u | tr '\n' ' '; echo
git add data/videos.json
git commit -q -m "$(printf '%s\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>' "${2/N/$n}")"
git log --oneline -1
