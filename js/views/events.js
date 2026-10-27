// 공연 보기: 공연마다 큰 카드(표지·날짜·행사·곡·영상 수), 월로 묶는다. 누르면 공연 폴더.
import { html, fmtMD, fmtYear, parseDate } from '../util.js';
import { NOSONG, SRCSET_SIZES } from '../model.js';
import { app, sortEvents, visibleSongKeys, matchVideo, matchClip, filterCount } from '../state.js';
import { href } from '../router.js';
import { eventCover } from '../indexer.js';
import { imgOf, dowPill, posOf } from '../components.js';
import { silhouetteURL } from '../placeholder.js';
import { noResultHTML } from './states.js';

const SONGS_SHOWN = 4;
const songTitle = (k) => (k === NOSONG ? '전체 공연' : app.ix.song.get(k)?.title || k);

function cardHTML(E, keys, f) {
  const g = E.group;
  const h = href({ g: g.id, e: E.id });
  const vids = E.videos.filter((v) => matchVideo(v, f));
  const full = vids.filter((v) => v.type === 'full').length;
  const cams = vids.length - full;
  const clips = E.clips.filter((C) => matchClip(C, f)).length;
  // 직캠이 있는 멤버(멤버 순서), 멤버 칩이 걸려 있으면 그 멤버만
  const camMembers = new Set();
  for (const v of vids) if (v.type === 'fancam') for (const m of v.memberIds) camMembers.add(m);
  const members = g._members.filter((m) => camMembers.has(m.id) && (!f.members.size || f.members.has(m.id)));
  const cover = eventCover(E);
  let img;
  if (cover) {
    const { src, fb, ph, srcset } = imgOf(cover, '169');
    img = html`<img src="${src}" ${srcset ? html`srcset="${srcset}" sizes="${SRCSET_SIZES}"` : ''} data-fb="${fb}" data-ph="${ph}" alt="" loading="lazy" decoding="async" style="${`object-position:${cover.type === 'full' ? '50% 50%' : posOf(cover)}`}">`;
  } else {
    const ph = silhouetteURL({ eventId: E.id, kind: 'full' });
    img = html`<img src="${ph}" alt="" loading="lazy">`;
  }
  const songs = keys.filter((k) => k !== NOSONG);
  const title = `${fmtMD(E.date)} ${E.ev.show}${E.ev.label ? ` ${E.ev.label}` : ''}`;
  return html`<article class="ecard sheet">
    <div class="ecover thumb r169">${img}${E.ev.label ? html`<span class="badges"><span class="badge">${E.ev.label}</span></span>` : ''}</div>
    <div class="ebody">
      <div class="dl"><span class="d-big">${fmtMD(E.date)}</span>${dowPill(E.date)}<span class="ey num">${fmtYear(E.date)}</span></div>
      <h2 class="eshow"><a class="ecard-link" href="${h}" aria-label="${`${title} 공연 폴더`}">${E.ev.show}</a>${E.ev.label ? html`<span class="lbl">${E.ev.label}</span>` : ''}</h2>
      ${songs.length ? html`<p class="esongs">${songs.slice(0, SONGS_SHOWN).map((k, i) => html`${i ? html`<span class="sep" aria-hidden="true">·</span>` : ''}<span>${songTitle(k)}</span>`)}${songs.length > SONGS_SHOWN ? html`<span class="more">+${songs.length - SONGS_SHOWN}</span>` : ''}</p>` : html`<p class="esongs muted">전체 공연</p>`}
      <p class="estats num">직캠 ${cams}${full ? ` · 풀캠 ${full}` : ''}${clips ? ` · 움짤 ${clips}` : ''}</p>
      ${members.length ? html`<p class="emembers">${members.map((m) => html`<span class="em"><span class="dot" style="${`background:${m._color}`}"></span>${m.name}</span>`)}</p>` : ''}
    </div>
  </article>`;
}

export function eventGridHTML(g, f) {
  const events = sortEvents(app.ix.eventsByGroup.get(g.id));
  const rows = events.map((E) => ({ E, keys: visibleSongKeys(E, f) })).filter((r) => r.keys.length);
  const head = html`<div class="pagehead"><h1>공연</h1><span class="sub">${rows.length}개</span></div>`;
  if (!rows.length) return html`${head}${noResultHTML(filterCount(f) > 0)}`;
  const out = [];
  let lastM = null, buf = [];
  const flush = () => { if (buf.length) out.push(html`<div class="egrid">${buf}</div>`); buf = []; };
  const counts = new Map();
  for (const { E } of rows) { const k = E.date.slice(0, 7); counts.set(k, (counts.get(k) || 0) + 1); }
  for (const { E, keys } of rows) {
    const k = E.date.slice(0, 7);
    if (k !== lastM) {
      flush();
      const p = parseDate(E.date);
      out.push(html`<div class="month-head"><span class="m-big">${p.m}</span><span class="m-unit">월</span><span class="m-sub">${p.y} · 공연 ${counts.get(k)}</span></div>`);
      lastM = k;
    }
    buf.push(cardHTML(E, keys, f));
  }
  flush();
  return html`${head}${out}`;
}
