#!/usr/bin/env node
// data/videos.json 검증 (Node 20+, 의존성 없음). 로컬과 CI에서 같이 쓴다.
//   node scripts/validate.mjs [경로]
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData, fileRefs } from '../js/validate-core.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(process.argv[2] || join(ROOT, 'data/videos.json'));
const base = process.argv[2] ? resolve(dirname(file), '..') : ROOT;
const MAX_CLIP = 25 * 1024 * 1024;

function fail(lines) {
  for (const l of lines) console.error(`✗ ${l}`);
  console.error(`\n오류 ${lines.length}개. 위 위치를 고친 뒤 다시 실행하세요.`);
  process.exit(1);
}

let text;
try { text = readFileSync(file, 'utf8'); } catch (e) { fail([`${file}: 파일을 읽을 수 없어요 (${e.code || e.message})`]); }

let data;
try { data = JSON.parse(text); } catch (e) {
  const m = /position (\d+)/.exec(e.message);
  let where = '';
  if (m) {
    const pos = +m[1];
    const before = text.slice(0, pos).split('\n');
    where = ` ${before.length}번째 줄 ${before[before.length - 1].length + 1}번째 글자`;
  }
  fail([`${file}:${where} JSON 문법 오류예요 (${e.message})`]);
}

const errors = validateData(data).map((e) => e.text);
for (const r of fileRefs(data)) {
  const p = join(base, r.path);
  if (!existsSync(p)) { errors.push(`${r.where}: ${r.field} 파일 ${r.path}이 없어요`); continue; }
  if (r.clip && statSync(p).size > MAX_CLIP) {
    errors.push(`${r.where}: 움짤 ${r.path}이 ${(statSync(p).size / 1048576).toFixed(1)}MB예요. 25MB 이하로 줄여 주세요`);
  }
}

if (errors.length) fail(errors);
console.log(`✓ 통과: 그룹 ${data.groups.length}, 공연 ${data.events.length}, 영상 ${data.videos.length}, 움짤 ${data.clips.length}`);
