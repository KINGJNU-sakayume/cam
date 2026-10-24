// 곡 보기: 곡 목록 → 곡 페이지(그 곡만 남은 라인업, 멤버를 고르면 그 멤버의 이 곡 직캠)
import { html, fmtMD, fmtDow, fmtFull } from '../util.js';
import { app, sortEvents, matchVideo, matchClip } from '../state.js';
import { href } from '../router.js';
import { lineupHTML } from './lineup.js';
import { videoThumb, clipThumb, emptyCell, dowPill, srcTags } from '../components.js';
import { silhouetteURL } from '../placeholder.js';
import { noResultHTML } from './states.js';
import { filterCount } from '../state.js';

function songStats(g, song) {
  let stages = 0, cams = 0, clips = 0, latestFull = null, last = null;
  for (const E of app.ix.eventsByGroup.get(g.id)) {
    const S = E.sections.get(song.id);
    if (!S) continue;
    stages++;
    last = E;
    for (const [, l] of S.cells) cams += l.length;
    clips += S.clips.length;
    if (S.full.length) latestFull = { v: S.full[0], E };
  }
  return { stages, cams, clips, latestFull, last };
}

export function songListHTML(g, f) {
  // 곡이 아닌 항목(kind=other)은 빼고, 무대가 아직 없는 곡은 맨 아래 한 줄로
  const all = g._songs.filter((s) => s.kind !== 'other').map((s) => ({ s, st: songStats(g, s) }));
  const rows = all.filter((r) => r.st.stages);
  const none = all.filter((r) => !r.st.stages);
  if (app.prefs.songSort === 'recent') rows.sort((a, b) => (b.st.last?.date || '').localeCompare(a.st.last?.date || ''));
  else if (app.prefs.songSort === 'count') rows.sort((a, b) => b.st.cams - a.st.cams || b.st.stages - a.st.stages);
  return html`<div class="pagehead"><h1>곡</h1><span class="sub">${rows.length}곡</span>
    <div class="tools"><div class="seg" role="group" aria-label="곡 정렬">
      <button type="button" data-act="songSort" data-v="order" aria-pressed="${String(!!(!['recent', 'count'].includes(app.prefs.songSort)))}">곡 순서</button>
      <button type="button" data-act="songSort" data-v="recent" aria-pressed="${String(!!(app.prefs.songSort === 'recent'))}">최근 무대순</button>
      <button type="button" data-act="songSort" data-v="count" aria-pressed="${String(!!(app.prefs.songSort === 'count'))}">직캠 많은 순</button>
    </div></div></div>
    <section class="sheet psheet"><div class="tiles">${rows.map(({ s, st }) => {
      const h = href({ g: g.id, v: 'song', s: s.id });
      const cover = st.latestFull
        ? videoThumb(st.latestFull.v, { ratio: '169', songKey: s.id, label: `${s.title} 최신 풀캠 재생` })
        : html`<a class="thumb r169" href="${h}" aria-label="${`${s.title} 곡 페이지`}"><img src="${silhouetteURL({ eventId: s.id, kind: 'full' })}" alt=""></a>`;
      return html`<div class="tile">${cover}
        <a class="tname" href="${h}">${s.title}</a>
        <div class="tmeta">무대 ${st.stages} · 직캠 ${st.cams}${st.clips ? ` · 움짤 ${st.clips}` : ''}${st.last ? ` · 최근 ${fmtMD(st.last.date)}` : ''}</div>
      </div>`;
    })}</div></section>
    ${none.length ? html`<p class="nodays"><b>아직 무대가 없는 곡 ${none.length}:</b> ${none.map(({ s }, i) => html`${i ? ', ' : ''}${s.title}`)}</p>` : ''}`;
}

export function songPageHTML(g, song, member, f, open) {
  const st = songStats(g, song);
  const events = sortEvents(app.ix.eventsByGroup.get(g.id)).filter((E) => E.sections.has(song.id));
  const chips = html`<div class="fgroup" role="group" aria-label="멤버 고르기" style="margin:0 0 16px">
    <a class="chip" href="${href({ g: g.id, v: 'song', s: song.id })}" ${!member ? html`aria-current="page"` : ''}>전체 라인업</a>
    ${g._members.map((m) => html`<a class="chip" href="${href({ g: g.id, v: 'song', s: song.id, m: m.id })}" ${member && member.id === m.id ? html`aria-current="page"` : ''}><span class="dot" style="${`background:${m._color}`}"></span>${m.name}</a>`)}
  </div>`;
  const head = html`<div class="pagehead"><h1>${song.title}</h1>
    <span class="sub">${song.release ? `발매 ${fmtFull(song.release)} · ` : ''}무대 ${st.stages} · 직캠 ${st.cams}${st.clips ? ` · 움짤 ${st.clips}` : ''}</span></div>`;
  if (!member) {
    const body = lineupHTML({ group: g, events, f, forceSong: song.id, open });
    return html`${head}${chips}${body || noResultHTML(filterCount(f) > 0)}`;
  }
  // 그 멤버의 이 곡 직캠 날짜순 격자 + 직캠 없는 날
  const items = [], missing = [];
  for (const E of events) {
    const S = E.sections.get(song.id);
    const list = (S.cells.get(member.id) || []).filter((v) => matchVideo(v, f));
    if (list.length) items.push({ E, v: list[0], n: list.length, clips: S.clips.filter((C) => C.key === member.id && matchClip(C, f)) });
    else missing.push(E);
  }
  const grid = items.length
    ? html`<div class="grid-23 big">${items.map(({ E, v, n, clips }) => videoThumb(v, {
      ratio: '23', songKey: song.id, badges: [...(n > 1 ? [{ text: `+${n - 1}` }] : []), ...(clips.length ? [{ text: '움짤' }] : [])],
      stripText: `${fmtMD(E.date)} ${fmtDow(E.date)}`,
      label: `${fmtMD(E.date)} ${E.ev.show} ${member.name} 직캠 재생`,
      caption: html`<div class="lm" style="color:var(--text);font-weight:700">${E.ev.show}${E.ev.label ? ` ${E.ev.label}` : ''}</div><div class="lm">${srcTags(v)}</div>`,
    }))}</div>`
    : html`<div style="max-width:200px">${emptyCell({ member, g: g.id, s: song.id, label: '이 곡 직캠이 아직 없어요' })}</div>`;
  const memberClips = items.flatMap((x) => x.clips);
  return html`${head}${chips}
    <section class="sheet psheet"><h2 class="sheet-h"><span class="big-dot" style="${`background:${member._color}`}"></span>${member.name}의 ${song.title} 직캠 <span class="cnt">${items.length}</span></h2>
    ${grid}</section>
    ${missing.length ? html`<p class="nodays"><b>직캠 없는 날:</b> ${missing.map((E, i) => html`${i ? ', ' : ''}<a href="${href({ g: g.id, e: E.id })}">${fmtMD(E.date)} ${E.ev.show}${E.ev.label ? ` ${E.ev.label}` : ''}</a>`)}</p>` : ''}
    ${memberClips.length ? html`<section class="sheet psheet"><h2 class="sheet-h">움짤 <span class="cnt">${memberClips.length}</span></h2><div class="grid-23 big">${memberClips.map((C) => clipThumb(C, {
      caption: html`<div class="l1"><span class="num">${fmtMD(C.E.date)}</span>${dowPill(C.E.date)}</div><div class="lm">${C.E.ev.show}</div><div class="lm">${C.clip.note || ''}</div>`,
    }))}</div></section>` : ''}`;
}
