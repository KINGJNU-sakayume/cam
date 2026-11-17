#!/bin/bash
# chain.sh <group> "<from> <to> <tag>" ... : throttled harvest per chunk, sequential
cd "$(dirname "$0")/../.."
export HARVEST_GAP_MS=${HARVEST_GAP_MS:-400}
JOBS=${JOBS:-3}
g=$1; shift
for r in "$@"; do
  set -- $r
  echo "### $(date -Iseconds) $g $3 시작"
  node scripts/harvest-slow.mjs $1 $2 --group $g --deep --jobs $JOBS --out .cache/bf2/$g-$3 > /dev/null 2>&1
  echo "### $(date -Iseconds) $g $3 끝 (종료 코드 $?)"
done
echo "### 전체 끝"
