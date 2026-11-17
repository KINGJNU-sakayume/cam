// Re-apply what a data branch changed (relative to its merge-base) on top of the current data/videos.json.
// usage: node rebase-branch.mjs <base.json> <branch.json> <outdir>   (cwd = repo; reads current data/videos.json)
// Writes <outdir>/songs.sh (add-song / set kind commands), <outdir>/req.json (new videos), <outdir>/after.json (post-add fixes),
// and prints a summary. Songs/members are matched by NAME, never by id (ids diverged after the base).
import fs from 'node:fs';
const [baseF, brF, OUT] = process.argv.slice(2);
const A = JSON.parse(fs.readFileSync(baseF, 'utf8'));
const B = JSON.parse(fs.readFileSync(brF, 'utf8'));
const M = JSON.parse(fs.readFileSync('data/videos.json', 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const lc = (s) => String(s || '').toLowerCase().trim();
const gB = Object.fromEntries(B.groups.map((g) => [g.id, g]));
const gM = Object.fromEntries(M.groups.map((g) => [g.id, g]));
const songB = {}; for (const g of B.groups) for (const s of g.songs) songB[s.id] = { g: g.id, s };
const memB = {}; for (const g of B.groups) for (const m of g.members) memB[m.id] = { g: g.id, m };
const evB = Object.fromEntries(B.events.map((e) => [e.id, e]));
const evA = Object.fromEntries(A.events.map((e) => [e.id, e]));
const vidA = Object.fromEntries(A.videos.map((v) => [v.ytId, v]));
const vidM = Object.fromEntries(M.videos.map((v) => [v.ytId, v]));
const sh = [], after = { events: [], videos: [] }, notes = [];
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// songs and members new in the branch, missing (by name) in main
const songIdsA = new Set(A.groups.flatMap((g) => g.songs.map((s) => s.id)));
for (const g of B.groups) for (const s of g.songs) {
  const inMain = gM[g.id]?.songs.find((x) => [x.title, ...(x.aliases || [])].some((n) => lc(n) === lc(s.title)));
  if (!songIdsA.has(s.id) && !inMain) {
    sh.push(`node scripts/archive.mjs add-song ${g.id} ${q(s.title)}${s.aliases?.length ? ` --alias ${q(s.aliases.join(','))}` : ''}${s.release ? ` --release ${s.release}` : ''}`);
    if (s.kind) notes.push({ kindFor: { g: g.id, title: s.title, kind: s.kind } });
  } else if (inMain && s.aliases?.length) {
    const add = s.aliases.filter((a) => ![inMain.title, ...(inMain.aliases || [])].some((n) => lc(n) === lc(a)));
    if (add.length) after.songs = [...(after.songs || []), { g: g.id, id: inMain.id, aliases: [...(inMain.aliases || []), ...add] }];
  }
}
const memIdsA = new Set(A.groups.flatMap((g) => g.members.map((m) => m.id)));
for (const g of B.groups) for (const m of g.members) {
  if (memIdsA.has(m.id)) continue;
  if (!gM[g.id]?.members.find((x) => lc(x.name) === lc(m.name))) sh.push(`node scripts/archive.mjs add-member ${g.id} ${q(m.name)}${m.aliases?.length ? ` --alias ${q(m.aliases.join(','))}` : ''}${m.color ? ` --color ${m.color}` : ''}${m.active === false ? ' --inactive' : ''}`);
}

const songName = (id) => songB[id]?.s.title;
const memName = (id) => memB[id]?.m.name;
function req(v) {
  const e = evB[v.eventId];
  const r = { url: `https://youtu.be/${v.ytId}`, group: gB[e.groupId].name, date: e.date, show: e.show, label: e.label || '', type: v.type,
    title: v.title, channel: v.channel, source: v.source, tags: v.tags || [] };
  if (v.uploaded) r.uploaded = v.uploaded;
  if (v.thumbPos) r.thumbPos = v.thumbPos;
  if (v.pin) r.pin = true;
  if (v.type === 'fancam') r.members = v.memberIds.length ? v.memberIds.map(memName) : ['단체'];
  else if (v.memberIds.length) r.members = v.memberIds.map(memName);
  if (v.songs.length) r.songs = v.songs.map((s) => ({ song: songName(s.songId), t: s.t || 0 }));
  else r.song = '전체 공연';
  return r;
}
const news = [], changed = [];
for (const v of B.videos) {
  if (vidM[v.ytId] && !vidA[v.ytId]) continue; // main already has it (added elsewhere)
  if (!vidA[v.ytId]) { news.push(req(v)); continue; }
  const a = vidA[v.ytId];
  const strip = ({ id, eventId, ...x }) => x;
  const evKey = (ev) => (ev ? `${ev.groupId}|${ev.date}|${ev.show}|${ev.label}` : '');
  if (JSON.stringify(strip(a)) !== JSON.stringify(strip(v)) || evKey(evA[a.eventId]) !== evKey(evB[v.eventId])) changed.push({ ytId: v.ytId, from: a, to: v, toReq: req(v) });
}
// event-level fields (setlist/note) for events the branch created or edited
for (const e of B.events) {
  const a = evA[e.id];
  const same = a && a.groupId === e.groupId && a.date === e.date && a.show === e.show && a.label === e.label;
  if (same && JSON.stringify(a.setlist) === JSON.stringify(e.setlist) && a.note === e.note) continue;
  if (!B.videos.some((v) => v.eventId === e.id)) continue;
  after.events.push({ group: e.groupId, date: e.date, show: e.show, label: e.label || '', setlist: e.setlist.map(songName).filter(Boolean), note: e.note || '', renamedFrom: same ? null : a ? { date: a.date, show: a.show, label: a.label } : null });
}
const removed = A.videos.filter((v) => !B.videos.some((x) => x.ytId === v.ytId)).map((v) => v.ytId);
fs.writeFileSync(`${OUT}/songs.sh`, sh.join('\n') + '\n');
fs.writeFileSync(`${OUT}/req.json`, JSON.stringify({ createSongs: true, videos: news }, null, 1));
fs.writeFileSync(`${OUT}/after.json`, JSON.stringify({ ...after, changed, removed, notes }, null, 1));
console.log(`새 곡·멤버 ${sh.length} · 새 영상 ${news.length} · 바뀐 기존 영상 ${changed.length} · 공연 정보 ${after.events.length} · 지운 영상 ${removed.length}`);
