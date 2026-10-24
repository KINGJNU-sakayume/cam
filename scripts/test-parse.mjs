#!/usr/bin/env node
// 제목 해석 회귀 테스트 (Node 20+, 의존성 없음)
//   node scripts/test-parse.mjs            손으로 쓴 사례 + scripts/fixtures/titles.json(실제 제목 스냅숏)
//   node scripts/test-parse.mjs --update   해석 규칙을 일부러 바꾼 뒤 스냅숏을 지금 결과로 다시 만든다(바뀐 줄을 꼭 확인)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findDate, findShow, findShowInfo, showKey, showSimilarity, parseTitle, songGuessOk, matchSong, weakShowFits,
} from '../js/admin/parse.js';
import { parseViews, publishToKst, relativeToDate, parsePlayer, parseWatchHtml } from './lib/yt.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'titles.json');
const DATA = join(HERE, '..', 'data', 'videos.json');
let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else { fail++; console.log(`✗ ${name}\n    결과 ${g}\n    기대 ${w}`); }
};

// ---------- 손으로 쓴 사례: 고친 버그마다 하나 이상 ----------
const G = {
  id: 'gt', name: '테스트', en: 'TEST',
  members: [{ id: 'm1', name: '리즈', aliases: ['LIZ'] }, { id: 'm2', name: '가을', aliases: ['GAEUL'] }],
  songs: [
    { id: 's1', title: 'Blackhole' }, { id: 's2', title: 'I Am' }, { id: 's3', title: 'Force' },
    { id: 's4', title: 'Super ICY' }, { id: 's5', title: '8' }, { id: 's6', title: 'Heya', aliases: ['해야'] },
    { id: 's7', title: 'Blue Valentine' }, { id: 's8', title: 'TOMORROW GLOW', kind: 'other' }, { id: 's9', title: 'Vitamin Me' },
  ],
};
const songs = (t) => parseTitle(t, G).songIds;

eq('울산 음악중심은 쇼! 음악중심보다 먼저', findShow("260615 프로미스나인 fromis9 'Supersonic' 4K 60P 직캠 @울산 음악중심"), '울산 음악중심');
eq('음악 방송 이름', findShow('[K-Choreo 8K] 아이브 직캠 @MusicBank 260227'), '뮤직뱅크');
eq('영문·한글 붙은 행사 이름', showKey('NOL페스티벌'), showKey('NOL FESTIVAL'));
eq('연도 붙은 이름', showKey('2026TIMA'), showKey('TIMA 2026'));
eq('다른 대학 축제는 다르다', showSimilarity('안양대 축제', '한양대 축제'), 0);
eq('국립한밭대 = 한밭대', showSimilarity('국립한밭대 축제', '한밭대 축제') >= 0.5, true);
eq('울산 음악중심 ~ 쇼! 음악중심', showSimilarity('울산 음악중심', '쇼! 음악중심') >= 0.5, true);
eq('앵콜콘 표기', showSimilarity('NOWTomorrow앵콜콘 첫콘', 'NOW TOMORROW. ENCORE 서울') >= 0.5, true);
eq('엠카와 뮤뱅은 다르다', showSimilarity('엠카운트다운', '뮤직뱅크') < 0.5, true);
eq('@문구는 raw', findShowInfo('[4K] 260331 NMIXX 해원 직캠 @Brooklyn Paramount, NYC')?.conf, 'raw');
eq('알려진 행사는 known', findShowInfo('260321 IVE 리즈 FANCAM @2026 IVE 4TH FAN CONCERT')?.conf, 'known');
eq('@OO대학교는 대학 축제', findShow('260929 프로미스나인 - LIKE YOU BETTER @ 강남대학교'), '강남대 축제');
eq('투어 날엔 장소 이름(raw)을 붙인다', weakShowFits('Brooklyn Paramount, NYC', 'raw', { show: 'NMIXX WORLD TOUR ZERO FRONTIER 뉴욕' }), true);
eq('행사 같은 raw 이름은 음악 방송에 붙이지 않는다', weakShowFits('MEGA CONCERT', 'raw', { show: '엠카운트다운' }), false);

eq('YYMMDD', findDate('[4K] 261023 아이브 직캠')?.iso, '2026-10-23');
eq('일.월.연', findDate('[FANCAM] Hearts2Hearts @IMPACT : Bangkok [23.10.2026]')?.iso, '2026-10-23');
eq('일월연 6자리는 업로드 날짜로 고른다', findDate('Hearts2Hearts 231026 fancam', { uploaded: '2026-10-24' })?.iso, '2026-10-23');
eq('업로드 날짜 없으면 연월일로', findDate('Hearts2Hearts 231026 fancam')?.iso, '2023-10-26');
eq('월/일/연 모호하면 업로드 날짜로', findDate('IVE 03/04/2026 Manila', { uploaded: '2026-04-05' })?.iso, '2026-04-03');
eq('한글 날짜', findDate('2026년 10월 3일 하츠투하츠')?.iso, '2026-10-03');

eq('띄어쓰기 다른 곡', songs("[4K] 아이브 'BLACK HOLE' 직캠"), ['s1']);
eq('투어 이름 속 I AM은 곡이 아니다', songs("260404 IVE 'XOXZ' @ SHOW WHAT I AM Kuala Lumpur"), []);
eq('투어 공연의 I AM 무대', songs("260404 IVE 'I AM' @ SHOW WHAT I AM Kuala Lumpur"), ['s2']);
eq('여러 곡', songs("IVE 이서 'Super ICY' + 'Force' 260725 Newark"), ['s4', 's3']);
eq('날짜 속 숫자는 곡이 아니다', songs('8.4.26 IVE - Oakland Show What i Am (full)'), []);
eq('숫자 곡', songs("260904 장원영 솔로곡 '8 (Eight)' 직캠"), ['s5']);
eq('짧은 한글 별칭은 낱말일 때만', songs('공연 전에 연습 해야지 브이로그'), []);
eq('짧은 한글 별칭', songs('260322 아이브 해야 직캠'), ['s6']);
eq('곡 아닌 항목은 찾지 않는다', songs('260904 프로미스나인 TOMORROW GLOW Vitamin Me 직캠'), ['s9']);
eq('대소문자', songs('fromis_9 "VITAMIN ME" 2nd Win'), ['s9']);

eq('멤버 이름은 곡 후보가 아니다', songGuessOk('리즈', G), false);
eq('상 이름은 곡 후보가 아니다', songGuessOk('음반 부문 본상', G), false);
eq('행사 이름은 곡 후보가 아니다', songGuessOk('NOL FESTIVAL', G), false);
eq('챌린지는 곡 후보가 아니다', songGuessOk('바라밤 챌린지', G), false);
eq('새 곡 후보', songGuessOk('Paper Moon', G), true);
eq('오타 곡 찾기', matchSong(G, 'Blue valentain')?.id, 's7');
eq('짧은 이름은 오타 찾기 안 함', matchSong(G, 'Forc')?.id ?? null, null);

// ---------- 유튜브 정보 읽기(harvest) ----------
eq('조회수 만', parseViews('조회수 131만회'), 1310000);
eq('조회수 views', parseViews('12,155 views'), 12155);
eq('업로드 시각은 한국 날짜로', publishToKst('2026-10-22T20:30:00-07:00'), '2026-10-23');
eq('날짜만 있으면 그대로', publishToKst('2026-10-23'), '2026-10-23');
eq('N일 전', relativeToDate('3일 전', new Date('2026-10-24T03:00:00Z')), { date: '2026-10-21', err: 1 });
eq('weeks ago 오차', relativeToDate('2 weeks ago', new Date('2026-10-24T03:00:00Z'))?.err, 7);
eq('player 응답', parsePlayer({ videoDetails: { title: 'T', author: 'C', viewCount: '42', lengthSeconds: '200', shortDescription: 'd' }, microformat: { playerMicroformatRenderer: { publishDate: '2026-10-23T01:00:00-07:00' } } }),
  { title: 'T', channel: 'C', uploaded: '2026-10-23', views: 42, seconds: 200, description: 'd' });
eq('watch 페이지', parseWatchHtml('<meta name="title" content="제목"><script>"publishDate":"2026-10-23T09:00:00+09:00","ownerChannelName":"채널"</script>')?.uploaded, '2026-10-23');

// ---------- 실제 제목 스냅숏 ----------
const data = JSON.parse(readFileSync(DATA, 'utf8'));
const ev = new Map(data.events.map((e) => [e.id, e]));
const gr = new Map(data.groups.map((g) => [g.id, g]));
const nameOf = (g, ids, kind) => ids.map((id) => (kind === 'm' ? g.members : g.songs).find((x) => x.id === id)?.[kind === 'm' ? 'name' : 'title'] ?? id);
function snap(title, g) {
  const p = parseTitle(title, g);
  return { date: p.date, show: p.show, conf: p.showConf, members: nameOf(g, p.memberIds, 'm'), songs: nameOf(g, p.songIds, 's'), type: p.type, tags: p.tags };
}
if (process.argv.includes('--update')) {
  // 그룹·공연 종류가 고루 섞이게 영상 15개마다 하나
  const cases = data.videos.filter((v, i) => v.title && i % 15 === 0).map((v) => {
    const g = gr.get(ev.get(v.eventId).groupId);
    return { g: g.id, title: v.title, want: snap(v.title, g) };
  });
  writeFileSync(FIX, `${JSON.stringify(cases, null, 1)}\n`);
  console.log(`스냅숏 ${cases.length}개를 다시 만들었어요: ${FIX}`);
} else if (existsSync(FIX)) {
  for (const c of JSON.parse(readFileSync(FIX, 'utf8'))) {
    const g = gr.get(c.g);
    if (!g) continue;
    eq(`스냅숏: ${c.title}`, snap(c.title, g), c.want);
  }
}

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
if (fail) {
  console.log('규칙을 일부러 바꿨다면 바뀐 결과가 맞는지 확인하고 node scripts/test-parse.mjs --update');
  process.exit(1);
}
