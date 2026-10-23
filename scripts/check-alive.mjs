#!/usr/bin/env node
// 담아 둔 유튜브 영상이 아직 살아 있는지 oEmbed로 확인한다 (Node 20+, 의존성 없음).
// 404·401(삭제·비공개)인 영상을 모아 GitHub 이슈 하나로 올리고, 같은 이슈가 열려 있으면 갱신한다.
// gone 처리는 사람이 관리 화면에서 한다. 샘플 ID(SMPL…)와 이미 gone인 영상은 건너뛴다.
//   로컬: node scripts/check-alive.mjs            (결과만 출력)
//   CI:   GITHUB_TOKEN, GITHUB_REPOSITORY가 있으면 이슈를 만들거나 고친다
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LABEL = 'dead-videos';
const TITLE = '삭제·비공개된 유튜브 영상';
const data = JSON.parse(readFileSync(join(ROOT, 'data/videos.json'), 'utf8'));
const events = new Map(data.events.map((e) => [e.id, e]));
const members = new Map(data.groups.flatMap((g) => g.members.map((m) => [m.id, m])));
const groups = new Map(data.groups.map((g) => [g.id, g]));

const targets = data.videos.filter((v) => !v.gone && !String(v.ytId).startsWith('SMPL'));
console.log(`확인할 영상 ${targets.length}개 (샘플·gone 제외)`);

async function check(v) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${v.ytId}`)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404 || res.status === 401) return res.status;
      if (res.ok) return 200;
    } catch { /* 다시 시도 */ }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  return 0; // 확인 실패(네트워크) — 죽은 영상으로 세지 않는다
}

const dead = [];
let unknown = 0;
const queue = [...targets];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const v = queue.shift();
    const st = await check(v);
    if (st === 0) unknown++;
    else if (st !== 200) dead.push({ v, st });
  }
}));

const line = ({ v, st }) => {
  const e = events.get(v.eventId);
  const g = e && groups.get(e.groupId);
  const who = v.type === 'full' ? '풀캠' : v.memberIds.length ? v.memberIds.map((id) => members.get(id)?.name || id).join('·') : '단체';
  return `| ${v.id} | [${v.ytId}](https://www.youtube.com/watch?v=${v.ytId}) | ${e ? `${e.date} ${e.show}${e.label ? ` ${e.label}` : ''}` : '?'} | ${g ? g.name : ''} ${who} | ${String(v.title || '').replace(/\|/g, '\\|')} | ${st === 404 ? '삭제됨(404)' : '비공개·제한(' + st + ')'} |`;
};
const body = dead.length
  ? [
    `주간 확인에서 영상 ${dead.length}개가 열리지 않았어요. 관리 화면 → 수정·삭제에서 각 영상을 찾아 “삭제·비공개됨”을 켜고 저장하세요. 목록에는 흐리게 남고 “삭제됨” 배지가 붙어요. 다시 살아난 영상이면 그대로 두면 돼요.`,
    '',
    '| id | 유튜브 | 공연 | 멤버 | 제목 | 상태 |',
    '|---|---|---|---|---|---|',
    ...dead.map(line),
    '',
    `확인 ${new Date().toISOString().slice(0, 10)} · 대상 ${targets.length}개${unknown ? ` · 네트워크 문제로 확인 못 함 ${unknown}개` : ''}`,
  ].join('\n')
  : `확인 ${new Date().toISOString().slice(0, 10)}: 대상 ${targets.length}개 모두 열려요.${unknown ? ` (확인 못 함 ${unknown}개)` : ''}`;

console.log(dead.length ? `열리지 않는 영상 ${dead.length}개` : '모두 열려요');
if (dead.length) console.log(dead.map(line).join('\n'));

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
if (!token || !repo) process.exit(0);

const gh = async (path, opts = {}) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const open = (await gh(`/issues?state=open&labels=${LABEL}&per_page=10`)).filter((i) => !i.pull_request);
const existing = open[0];
if (dead.length) {
  if (existing) {
    await gh(`/issues/${existing.number}`, { method: 'PATCH', body: JSON.stringify({ title: `${TITLE} ${dead.length}개`, body }) });
    console.log(`이슈 #${existing.number}을 고쳤어요.`);
  } else {
    try { await gh('/labels', { method: 'POST', body: JSON.stringify({ name: LABEL, color: 'b3261e', description: '주간 생존 확인에서 열리지 않은 영상' }) }); } catch { /* 이미 있음 */ }
    const i = await gh('/issues', { method: 'POST', body: JSON.stringify({ title: `${TITLE} ${dead.length}개`, body, labels: [LABEL] }) });
    console.log(`이슈 #${i.number}을 만들었어요.`);
  }
} else if (existing) {
  await gh(`/issues/${existing.number}`, { method: 'PATCH', body: JSON.stringify({ body, state: 'closed', state_reason: 'completed' }) });
  console.log(`모두 열려서 이슈 #${existing.number}을 닫았어요.`);
}
