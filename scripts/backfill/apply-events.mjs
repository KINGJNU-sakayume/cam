// After re-adding a branch: copy event setlist/note from the branch onto main's matching event when main's is empty.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const a = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const M = JSON.parse(fs.readFileSync('data/videos.json', 'utf8'));
let n = 0;
for (const e of a.events) {
  const m = M.events.find((x) => x.groupId === e.group && x.date === e.date && x.show === e.show && (x.label || '') === e.label);
  if (!m) continue;
  const args = [];
  if (!m.setlist.length && e.setlist.length) args.push(`setlist=${e.setlist.join(',')}`);
  if (!m.note && e.note) args.push(`note=${e.note}`);
  if (!args.length) continue;
  try { execFileSync(process.execPath, ['scripts/archive.mjs', 'set', m.id, ...args], { stdio: 'pipe' }); n++; } catch (err) { console.log('  ! set 실패', m.id, String(err.stderr || '').slice(0, 120)); }
}
for (const s of a.songs || []) {
  try { execFileSync(process.execPath, ['scripts/archive.mjs', 'set', s.id, `aliases=${s.aliases.join(',')}`], { stdio: 'pipe' }); } catch {}
}
console.log(`  공연 정보 ${n}개 반영`);
