#!/usr/bin/env node
// harvest.mjs를 유튜브에 막히지 않게 천천히 돌리고, 실패가 남으면 쉬었다가 실패한 것만 다시 돌린다.
//
//   node scripts/harvest-slow.mjs 2024-10-01 2024-12-31 --group g11 --full --out .cache/bf2/g11-2024q4
//
// - 요청 간격 HARVEST_GAP_MS(기본 1500ms)로 시작. 429·빈 응답이 오면 yt.mjs가 스스로 간격을 두 배로 늘린다.
// - 동시 개수는 --jobs(기본 1).
// - 끝났는데 검색 실패가 있거나 영상 정보 실패가 많으면(정보 30개 넘게) 쉬었다가(10분 × 시도 횟수) 다시 돌린다. 최대 6번.
//   harvest는 done.txt·yt-meta 캐시로 이미 한 검색·정보는 건너뛰므로 실패한 것만 다시 한다.
// - 출력은 <out>/slow.log에도 남는다.
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) {
  console.log('node scripts/harvest-slow.mjs <harvest.mjs와 같은 인자> [--jobs 1]   (요청 간격: HARVEST_GAP_MS, 기본 1500)');
  process.exit(0);
}
if (!args.includes('--jobs')) args.push('--jobs', '1');
const oi = args.indexOf('--out');
const out = oi >= 0 ? args[oi + 1] : join(ROOT, '.cache', 'harvest');
mkdirSync(out, { recursive: true });
const LOG = join(out, 'slow.log');
const log = (s) => { process.stdout.write(s); appendFileSync(LOG, s); };
const env = { ...process.env, HARVEST_GAP_MS: process.env.HARVEST_GAP_MS || '1500' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let attempt = 1; attempt <= 6; attempt++) {
  log(`\n=== ${new Date().toISOString()} 시도 ${attempt}: node scripts/harvest.mjs ${args.join(' ')} (간격 ${env.HARVEST_GAP_MS}ms)\n`);
  let text = '';
  const code = await new Promise((resolve) => {
    const p = spawn(process.execPath, [join(ROOT, 'scripts', 'harvest.mjs'), ...args], { env, cwd: ROOT });
    p.stdout.on('data', (d) => { text += d; log(String(d)); });
    p.stderr.on('data', (d) => { text += d; log(String(d)); });
    p.on('close', resolve);
  });
  const searchFail = [...text.matchAll(/검색 (\d+)개 실패/g)].reduce((s, m) => s + Number(m[1]), 0);
  const infoFail = Number((text.match(/정보 (\d+)개 실패/) || [])[1] || 0);
  log(`\n=== 시도 ${attempt} 끝: 종료 코드 ${code}, 검색 실패 ${searchFail}, 정보 실패 ${infoFail}\n`);
  if (code === 0 && !searchFail && infoFail <= 30) { log('=== 완료\n'); process.exit(0); }
  if (attempt === 6) break;
  // 막혔으면 다음 시도는 더 천천히 시작한다
  env.HARVEST_GAP_MS = String(Math.min(10000, Number(env.HARVEST_GAP_MS) * 2));
  const rest = 10 * attempt;
  log(`=== ${rest}분 쉬고 실패한 것만 다시 (다음 간격 ${env.HARVEST_GAP_MS}ms)\n`);
  await sleep(rest * 60e3);
}
log('=== 6번 시도 후에도 실패가 남았어요. 나중에 같은 명령으로 다시 돌리세요\n');
process.exit(1);
