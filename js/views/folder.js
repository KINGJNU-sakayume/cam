// 공연 폴더: 머리 카드 + 곡별 섹션(풀캠 줄, 고정 순서 직캠 칸, 움짤 줄) + 전체 공연 섹션
import { html, fmtMD, fmtYear } from '../util.js';
import { NOSONG, GROUP_KEY } from '../model.js';
import { app, adminHref } from '../state.js';
import { href } from '../router.js';
import { cellOrder, eventCover } from '../indexer.js';
import { videoThumb, clipThumb, emptyCell, dowPill, srcTags, cellKeyLabel, memberDots } from '../components.js';

let openCell = null; // `${songKey}|${cellKey}`
let curEvent = null;

const songTitle = (k) => (k === NOSONG ? '전체 공연' : app.ix.song.get(k)?.title || k);
const no2 = (n) => String(n).padStart(2, '0');

function stats(E) {
  let empty = 0;
  for (const k of E.sectionKeys) {
    const S = E.sections.get(k) || { cells: new Map() };
    for (const c of cellOrder(E, S)) if (c.kind === 'member' && !c.videos.length) empty++;
  }
  return { videos: E.videos.length, clips: E.clips.length, empty };
}

function cellCaption(c) {
  const ix = app.ix;
  const v = c.videos[0];
  if (c.kind === 'member') return html`<div class="l1"><span class="dot" style="${`background:${c.member._color}`}"></span><span>${c.member.name}</span></div><div class="lm">${srcTags(v)}</div>`;
  if (c.kind === 'group') return html`<div class="l1"><span>단체</span></div><div class="lm">${srcTags(v)}</div>`;
  return html`<div class="l1">${memberDots(ix, c.memberIds)}<span>${cellKeyLabel(ix, c.key)}</span></div><div class="lm">${srcTags(v)}</div>`;
}

function cellHTML(E, S, c) {
  const songKey = S.key;
  if (!c.videos.length) {
    return html`<div class="fcell">${emptyCell({ member: c.member, g: E.group.id, e: E.id, s: songKey || undefined })}
      <div class="cap"><div class="l1"><span class="dot" style="${`background:${c.member._color}`}"></span><span>${c.member.name}</span></div><div class="lm">빈 칸</div></div></div>`;
  }
  const v = c.videos[0];
  const id = `${songKey || 'none'}|${c.key}`;
  const more = c.videos.length > 1
    ? html`<button type="button" class="badge cellmore" data-act="cell" data-s="${songKey || 'none'}" data-k="${c.key}" aria-expanded="${String(!!(openCell === id))}" aria-label="${`${cellKeyLabel(app.ix, c.key)} 칸 영상 ${c.videos.length}개 보기`}">+${c.videos.length - 1}</button>`
    : '';
  const badges = [];
  if (S.clips.some((C) => C.key === c.key)) badges.push({ text: '움짤' });
  if ((v.tags || []).includes('세로')) badges.push({ text: '세로' });
  return html`<div class="fcell">${videoThumb(v, {
    ratio: '23', songKey, badges, extraBadge: more,
    label: `${cellKeyLabel(app.ix, c.key)} 직캠 재생`, caption: cellCaption(c),
  })}</div>`;
}

function cellListHTML(E, S, c) {
  return html`<div class="fcell-list" id="${`cl-${S.key || 'none'}-${c.key}`}">
    <h4>${cellKeyLabel(app.ix, c.key)} 칸의 영상 ${c.videos.length}</h4>
    <div class="grid-23">${c.videos.map((v, i) => videoThumb(v, {
      ratio: '23', songKey: S.key, badges: i === 0 ? [{ text: '대표' }] : [],
      caption: html`<div class="lm">${srcTags(v)}</div><div class="lm">${v.channel || ''}</div>`,
    }))}</div>
  </div>`;
}

function sectionHTML(E, k) {
  const g = E.group;
  const S = E.sections.get(k) || { key: k, full: [], cells: new Map(), clips: [] };
  const showEmpty = !app.prefs.hideEmpty;
  const cells = cellOrder(E, S, { includeEmpty: showEmpty });
  const count = S.full.length + [...S.cells.values()].reduce((a, l) => a + l.length, 0);
  const no = E.songNo.get(k);
  const openC = cells.find((c) => openCell === `${k || 'none'}|${c.key}`);
  return html`<section class="fsec" id="${`sec-${k || 'none'}`}" aria-labelledby="${`h-${k || 'none'}`}">
    <div class="fsec-head">
      ${no ? html`<span class="no">${no2(no)}</span>` : ''}
      <h2 id="${`h-${k || 'none'}`}" tabindex="-1">${songTitle(k)}</h2>
      <span class="cnt">영상 ${count}${S.clips.length ? ` · 움짤 ${S.clips.length}` : ''}</span>
      ${k ? html`<a class="more textlink" href="${href({ g: g.id, v: 'song', s: k })}">다른 날의 ${songTitle(k)} →</a>` : ''}
    </div>
    ${count === 0 && !S.clips.length ? html`<p class="note">이 곡 영상은 아직 없어요. <a href="${adminHref({ g: g.id, e: E.id, s: k || undefined })}">+ 담기</a></p>` : ''}
    ${S.full.length ? html`<div class="frow"><h3>풀캠 ${S.full.length}</h3><div class="grid-169">${S.full.map((v) => videoThumb(v, {
      ratio: '169', songKey: k, caption: html`<div class="l1 clamp1"><span>${v.title || '풀캠'}</span></div><div class="lm">${srcTags(v)} · ${v.channel || ''}</div>`,
    }))}</div></div>` : (showEmpty && count ? html`<div class="frow"><h3>풀캠</h3><div class="grid-169" style="max-width:320px">${emptyCell({ g: g.id, e: E.id, s: k || undefined, ratio: '169', label: '풀캠 없음' })}</div></div>` : '')}
    ${cells.length ? html`<div class="frow"><h3>직캠 칸 <span class="hint">단체 → 멤버 → 유닛</span></h3>
      <div class="fcells">${cells.map((c) => cellHTML(E, S, c))}</div>
      ${openC ? cellListHTML(E, S, openC) : ''}
    </div>` : ''}
    ${S.clips.length ? html`<div class="frow"><h3>움짤 ${S.clips.length}</h3><div class="grid-23">${S.clips.map((C) => clipThumb(C, {
      caption: html`<div class="l1">${memberDots(app.ix, C.memberIds)}<span>${C.key === 'full' ? '풀캠' : cellKeyLabel(app.ix, C.key)}</span></div><div class="lm">${C.clip.note || ''}</div>`,
    }))}</div></div>` : ''}
  </section>`;
}

export function folderHTML(E) {
  if (curEvent !== E.id) { openCell = null; curEvent = E.id; }
  const g = E.group;
  const list = app.ix.eventsByGroup.get(g.id);
  const prev = list[E.seq - 1], next = list[E.seq + 1];
  const st = stats(E);
  const cover = eventCover(E);
  const keys = E.sectionKeys;
  const navBtn = (X, dir) => X
    ? html`<a class="btn" href="${href({ g: g.id, e: X.id })}" rel="${dir === 'prev' ? 'prev' : 'next'}"><span>${dir === 'prev' ? '← 이전 공연' : '다음 공연 →'}<small>${fmtMD(X.date)} ${X.ev.show}${X.ev.label ? ` ${X.ev.label}` : ''}</small></span></a>`
    : html`<span class="btn" aria-disabled="true"><span>${dir === 'prev' ? '← 이전 공연' : '다음 공연 →'}<small>없음</small></span></span>`;
  return html`<article>
    <header class="fhead">
      <div class="fhead-main">
        <div class="f-date"><span class="f-big">${fmtMD(E.date)}</span><span class="f-yd"><span class="y">${fmtYear(E.date)}</span>${dowPill(E.date)}</span></div>
        <h1>${E.ev.show}${E.ev.label ? html`<span class="lbl">${E.ev.label}</span>` : ''}</h1>
        ${E.ev.note ? html`<p class="note">${E.ev.note}</p>` : ''}
        ${keys.length ? html`<div class="fsongs">${keys.map((k) => html`<button type="button" class="chip" data-act="jump" data-s="${k || 'none'}">${E.songNo.get(k) ? html`<span class="no num">${no2(E.songNo.get(k))}</span>` : ''}${songTitle(k)}</button>`)}</div>` : ''}
        <p class="fstats">영상 ${st.videos} · 움짤 ${st.clips} · 빈 칸 ${st.empty}</p>
        <div class="fnav">${navBtn(prev, 'prev')}${navBtn(next, 'next')}
          <label class="check"><input type="checkbox" data-act="showEmpty" ${app.prefs.hideEmpty ? '' : html`checked`}>빈 칸 보기</label>
          <a class="btn btn-sm" href="${adminHref({ g: g.id, e: E.id })}">이 공연에 담기</a>
        </div>
      </div>
      <div class="fcover">${cover ? videoThumb(cover, { ratio: '169', songKey: cover.songs?.[0]?.songId, caption: html`<div class="lm">표지 · ${cover.type === 'full' ? '풀캠' : cellKeyLabel(app.ix, cover.memberIds.length ? cover.memberIds.join('+') : GROUP_KEY)}</div>` }) : emptyCell({ g: g.id, e: E.id, ratio: '169', label: '영상 없음' })}</div>
    </header>
    ${keys.map((k) => sectionHTML(E, k))}
  </article>`;
}

export function mountFolder() {}

export function toggleFolderCell(root, btn) {
  const id = `${btn.dataset.s === 'none' ? '' : btn.dataset.s}|${btn.dataset.k}`;
  openCell = openCell === id ? null : id;
  const k = btn.dataset.s === 'none' ? '' : btn.dataset.s;
  const sec = root.querySelector(`#sec-${CSS.escape(btn.dataset.s)}`);
  const E = app.ix.E.get(curEvent);
  if (!sec || !E) return;
  sec.outerHTML = String(sectionHTML(E, k));
  const nb = root.querySelector(`#sec-${CSS.escape(btn.dataset.s)} [data-act="cell"][data-k="${CSS.escape(btn.dataset.k)}"]`);
  nb && nb.focus({ preventScroll: true });
}
