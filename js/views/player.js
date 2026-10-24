// 플레이어: 어두운 오버레이, youtube-nocookie 임베드, 상하좌우 이동
import { html, fmtFull, fmtMD } from '../util.js';
import { NOSONG, cellKey, isSampleYt, ytUrl, ytEmbed } from '../model.js';
import { app, savePrefs } from '../state.js';
import { go, href, baseOf } from '../router.js';
import { cellOrder, memberQueue } from '../indexer.js';
import { ICON, imgOf, tagLine, clipThumb, cellKeyLabel, toast, posOf } from '../components.js';
import { attachClipPlayback } from '../clipplay.js';

let nav = {};
let rootEl = null;
let closeFn = null;
let autoStart = false; // 이어보기로 넘어온 영상은 바로 재생
let endedFor = null; // 끝남 신호를 한 번만 처리
let pingTimer = null;

const songTitle = (k) => (k === NOSONG ? '전체 공연' : app.ix.song.get(k)?.title || '');
const keyLabel = (k) => (k === 'full' ? '풀캠' : cellKeyLabel(app.ix, k));

function resolve(s) {
  const ix = app.ix;
  const v = ix.video.get(s.play);
  const E = ix.E.get(v.eventId);
  const keys = v.songs && v.songs.length ? v.songs.map((x) => x.songId) : [NOSONG];
  const songKey = keys.includes(s.ps) ? s.ps : keys[0];
  const songEntry = (v.songs || []).find((x) => x.songId === songKey);
  const t = s.pt != null ? +s.pt : songEntry && songEntry.t ? songEntry.t : 0;
  const S = E.sections.get(songKey);
  const key = v.type === 'full' ? 'full' : cellKey(v.memberIds);
  return { v, E, songKey, t, S, key };
}

function cellVideos(S, key) {
  if (!S) return [];
  return key === 'full' ? S.full : S.cells.get(key) || [];
}

// ← →: 같은 공연·같은 곡의 이전/다음 칸 (풀캠 → 단체 → 멤버 → 유닛). 빈 칸은 건너뛴다.
function sideTargets(E, S, key) {
  const seq = [];
  if (S && S.full.length) seq.push({ key: 'full', videos: S.full });
  if (S) for (const c of cellOrder(E, S, { includeEmpty: true })) seq.push({ key: c.key, videos: c.videos, member: c.member });
  const i = seq.findIndex((x) => x.key === key);
  const walk = (dir) => {
    const skipped = [];
    for (let j = i + dir; j >= 0 && j < seq.length; j += dir) {
      if (seq[j].videos.length) return { v: seq[j].videos[0], label: keyLabel(seq[j].key), skipped };
      if (seq[j].member) skipped.push(seq[j].member.name);
    }
    return null;
  };
  return { left: i < 0 ? null : walk(-1), right: i < 0 ? null : walk(1) };
}

// ↑ ↓: 같은 멤버(칸)·같은 곡의 이전/다음 날짜
function dateTargets(E, songKey, key) {
  const list = app.ix.eventsByGroup.get(E.group.id);
  const has = (X) => {
    const S = X.sections.get(songKey);
    const l = cellVideos(S, key);
    return l.length ? l[0] : null;
  };
  let up = null, down = null;
  for (let i = E.seq - 1; i >= 0; i--) { const v = has(list[i]); if (v) { up = { v, E: list[i] }; break; } }
  for (let i = E.seq + 1; i < list.length; i++) { const v = has(list[i]); if (v) { down = { v, E: list[i] }; break; } }
  const lab = (x) => x && { v: x.v, label: `${fmtMD(x.E.date)} ${x.E.ev.show}${x.E.ev.label ? ` ${x.E.ev.label}` : ''}` };
  return { up: lab(up), down: lab(down) };
}

// 이어보기: 이 공연에서 같은 멤버의 다음/이전 곡 직캠. 지금 영상이 큐에 없으면 같은 곡 자리에서 이어 간다.
function queueOf(E, v, songKey) {
  if (v.type !== 'fancam' || v.memberIds.length !== 1) return null;
  const member = app.ix.member.get(v.memberIds[0]);
  const list = member ? memberQueue(E, member.id) : [];
  if (list.length < 2) return null;
  let i = list.findIndex((x) => x.v.id === v.id && x.songKey === songKey);
  if (i < 0) i = list.findIndex((x) => x.v.id === v.id);
  const exact = i >= 0;
  if (i < 0) i = list.findIndex((x) => x.songKey === songKey);
  // 삭제된 영상은 건너뛰고 다음 곡을 고른다
  const step = (dir) => { for (let j = i + dir; j >= 0 && j < list.length; j += dir) if (!list[j].v.gone) return list[j]; return null; };
  const lab = (x) => x && { v: x.v, songKey: x.songKey, label: songTitle(x.songKey) || '전체 공연' };
  return { member, list, i, exact, prev: i < 0 ? null : lab(step(-1)), next: lab(i < 0 ? list.find((x) => !x.v.gone) : step(1)) };
}

export function playerKey() { return nav; }

export function playerNav(dir) {
  const t = nav[dir];
  if (!t) return;
  if (dir === 'qnext' || dir === 'qprev') {
    autoStart = true;
    go({ ...baseOf(app.state), play: t.v.id, ps: t.songKey || undefined }, { replace: true });
    requestAnimationFrame(() => rootEl?.querySelector(`[data-dir="${dir}"]:not([disabled])`)?.focus({ preventScroll: true }));
    return;
  }
  go({ ...baseOf(app.state), play: t.v.id, ps: nav.songKey || undefined }, { replace: true });
  if (t.skipped && t.skipped.length) toast(`${t.skipped.join('·')} 칸은 비어 있어 건너뜀`);
  requestAnimationFrame(() => rootEl?.querySelector(`[data-dir="${dir}"]`)?.focus({ preventScroll: true }));
}

function stageHTML(v, t, kind, { api = false, autoplay = false } = {}) {
  if (v.gone) {
    return html`<div class="stage-wrap r169"><div class="gone-box"><b>삭제·비공개된 영상</b><span>${v.title || ''}</span><span>${v.channel || ''}</span></div></div>`;
  }
  if (isSampleYt(v.ytId)) {
    const { ph } = imgOf(v, kind === 'full' ? '169' : '23');
    return html`<div class="stage-wrap r169"><div class="ph"><img src="${ph}" alt="" class="${kind === 'full' ? 'full' : ''}"></div>
      <div class="ph-msg">${ICON.playLine}샘플 영상입니다${t ? ` · ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}부터` : ''}</div></div>`;
  }
  const vert = (v.tags || []).includes('세로');
  return html`<div class="${`stage-wrap ${vert ? 'r916' : 'r169'}`}"><iframe src="${ytEmbed(v.ytId, t, { api, autoplay, origin: location.origin })}" title="${v.title || '유튜브 영상'}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}

function navBtn(dir, t, arrow, kindLabel) {
  return html`<button type="button" class="nb ${dir}" data-dir="${dir}" ${t ? '' : html`disabled`} aria-label="${t ? `${kindLabel}: ${t.label}` : `${kindLabel} 없음`}">
    <span class="k">${arrow}${kindLabel}</span><span class="t">${t ? t.label : '없음'}</span></button>`;
}

export function openPlayer(root, s, close) {
  rootEl = root; closeFn = close;
  const ix = app.ix;
  const { v, E, songKey, t, S, key } = resolve(s);
  const g = E.group;
  const side = sideTargets(E, S, key);
  const dates = dateTargets(E, songKey, key);
  const q = queueOf(E, v, songKey);
  nav = { ...side, ...dates, songKey, qprev: q && q.prev, qnext: q && q.next };
  const autoplay = autoStart;
  autoStart = false;
  const kind = v.type === 'full' ? 'full' : 'fancam';
  const who = v.type === 'full' ? '' : v.memberIds.length ? cellKeyLabel(ix, key) : '단체';
  const typeText = v.type === 'full' ? '풀캠' : !v.memberIds.length ? '단체 직캠' : v.memberIds.length > 1 ? '유닛 직캠' : '직캠';
  const cellList = cellVideos(S, key);
  const clips = ix.clipsByVideo.get(v.id) || [];
  const single = v.type === 'fancam' && v.memberIds.length === 1 ? ix.member.get(v.memberIds[0]) : null;
  let collect = null;
  if (songKey && single) collect = { h: href({ g: g.id, v: 'song', s: songKey, m: single.id }), t: `${single.name}의 ${songTitle(songKey)} 모아보기` };
  else if (songKey) collect = { h: href({ g: g.id, v: 'song', s: songKey }), t: `${songTitle(songKey)} 곡 페이지` };
  else if (single) collect = { h: href({ g: g.id, v: 'member', m: single.id }), t: `${single.name} 멤버 페이지` };

  const wasOpen = !!root.querySelector('.ov');
  root.innerHTML = String(html`<div class="ov" role="dialog" aria-modal="true" aria-label="${`플레이어: ${v.title || ''}`}">
    <div class="ov-box">
      <div class="ov-top">
        <p class="ctx"><b>${g.name}</b><span class="sep">·</span><span class="num">${fmtFull(E.date)}</span><span class="sep">·</span>${E.ev.show}${E.ev.label ? ` ${E.ev.label}` : ''}<span class="sep">·</span><b>${songTitle(songKey)}</b>${who ? html`<span class="sep">·</span><b>${who}</b>` : ''}<span class="sep">·</span>${typeText}</p>
        <button type="button" class="iconbtn" data-close aria-label="플레이어 닫기 (Esc)">${ICON.close}</button>
      </div>
      <div class="ov-body">
        <div class="ov-main">
          ${stageHTML(v, t, kind, { api: !!q, autoplay })}
          <div class="vmeta"><h2>${v.title || '(제목 없음)'}</h2><p>${[v.channel || '채널 모름', tagLine(v), v.gone ? '삭제됨' : ''].filter(Boolean).join(' · ')}</p></div>
        </div>
        <div class="ov-side">
          ${q ? queueHTML(q, v, songKey) : ''}
          <div class="cross" role="group" aria-label="이동 (화살표 키)">
            ${navBtn('up', nav.up, ICON.up, '이전 날짜')}
            ${navBtn('left', nav.left, ICON.left, '이전 칸')}
            <div class="here"><span>지금<b>${keyLabel(key)}</b></span></div>
            ${navBtn('right', nav.right, ICON.right, '다음 칸')}
            ${navBtn('down', nav.down, ICON.down, '다음 날짜')}
          </div>
          <section class="side-sec"><h3>이 칸의 영상 ${cellList.length}</h3>
            <div class="vlist">${cellList.map((x) => {
              const { src, ph } = imgOf(x, kind === 'full' ? '169' : '23', true);
              const inner = html`<span class="mini${kind === 'full' ? ' r169' : ''}"><img src="${src}" data-ph="${ph}" alt="" loading="lazy" style="${`object-position:${posOf(x)}`}"></span>
                <span><span class="vt">${x.id === v.id ? html`<span class="now">재생 중 · </span>` : ''}${tagLine(x) || (x.type === 'full' ? '풀캠' : '직캠')}</span><span class="vs">${x.channel || ''}${x.pin ? ' · 대표' : ''}${x.gone ? ' · 삭제됨' : ''}</span></span>`;
              return x.id === v.id ? html`<div class="cur" aria-current="true">${inner}</div>` : html`<a href="${href({ ...baseOf(app.state), play: x.id, ps: songKey || undefined })}">${inner}</a>`;
            })}</div>
          </section>
          <section class="side-sec"><h3>이 영상의 움짤 ${clips.length}</h3>
            ${clips.length ? html`<div class="cliprow">${clips.map((C) => clipThumb(C, { caption: html`<div class="lm">${C.clip.note || ''}</div>` }))}</div>` : html`<p class="vs" style="color:var(--dark-muted);font-size:12.5px">아직 없어요</p>`}
          </section>
          <nav class="links" aria-label="바로 가기">
            ${isSampleYt(v.ytId) ? html`<span class="disabled-link">${ICON.ext}샘플 영상이라 유튜브 링크가 없어요</span>`
              : html`<a href="${ytUrl(v.ytId, t)}" target="_blank" rel="noopener noreferrer">${ICON.ext}유튜브에서 열기${t ? ` (${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}부터)` : ''}</a>`}
            <a href="${href({ g: g.id, e: E.id })}">${ICON.folder}공연 폴더</a>
            ${collect ? html`<a href="${collect.h}">${ICON.grid}${collect.t}</a>` : ''}
          </nav>
        </div>
      </div>
    </div>
  </div>`);

  const ov = root.querySelector('.ov');
  ov.addEventListener('click', (e) => {
    if (e.target === ov || e.target.closest('[data-close]')) { e.preventDefault(); closeFn(); return; }
    const b = e.target.closest('[data-dir]');
    if (b && !b.disabled) playerNav(b.dataset.dir);
  });
  ov.addEventListener('change', (e) => {
    if (e.target.matches('[data-autonext]')) { app.prefs.autoNext = e.target.checked; savePrefs(); }
  });
  attachClipPlayback(root);
  listenEnded(root, q ? v.id : null);
  if (!wasOpen) root.querySelector('[data-close]').focus();
}

function queueHTML(q, v, songKey) {
  const { member, list, i, exact } = q;
  const E = list[0] && app.ix.E.get(list[0].v.eventId);
  const no = (k) => (E && E.songNo.get(k) ? String(E.songNo.get(k)).padStart(2, '0') : '–');
  return html`<section class="side-sec qsec" aria-label="${`${member.name} 이어보기`}">
    <h3><span class="dot" style="${`background:${member._color}`}"></span>${member.name} 이어보기 · 이 공연 ${list.length}곡${i >= 0 ? html`<span class="qpos num">${i + 1}/${list.length}</span>` : ''}</h3>
    <div class="qbtns">
      <button type="button" class="nb" data-dir="qprev" ${nav.qprev ? '' : html`disabled`} aria-label="${nav.qprev ? `이전 곡: ${nav.qprev.label} (P)` : '이전 곡 없음'}"><span class="k">${ICON.left}이전 곡</span><span class="t">${nav.qprev ? nav.qprev.label : '없음'}</span></button>
      <button type="button" class="nb" data-dir="qnext" ${nav.qnext ? '' : html`disabled`} aria-label="${nav.qnext ? `다음 곡: ${nav.qnext.label} (N)` : '다음 곡 없음'}"><span class="k">다음 곡${ICON.right}</span><span class="t">${nav.qnext ? nav.qnext.label : '없음'}</span></button>
    </div>
    <label class="check qauto"><input type="checkbox" data-autonext ${app.prefs.autoNext ? html`checked` : ''}>끝나면 다음 곡 자동 재생</label>
    <ol class="vlist qlist">${list.map((x, j) => {
      const { src, ph } = imgOf(x.v, '23', true);
      const cur = j === i && exact;
      const inner = html`<span class="mini"><img src="${src}" data-ph="${ph}" alt="" loading="lazy" style="${`object-position:${posOf(x.v)}`}"></span>
        <span><span class="vt"><span class="num qno">${no(x.songKey)}</span> ${songTitle(x.songKey) || '전체 공연'}</span><span class="vs">${cur ? '재생 중 · ' : ''}${x.v.channel || ''}${x.v.gone ? ' · 삭제됨' : ''}</span></span>`;
      return html`<li>${cur ? html`<div class="cur" aria-current="true">${inner}</div>` : html`<a href="${href({ ...baseOf(app.state), play: x.v.id, ps: x.songKey || undefined })}">${inner}</a>`}</li>`;
    })}</ol>
  </section>`;
}

// 유튜브 임베드의 끝남 신호(postMessage). iframe_api 스크립트 없이 'listening'으로 구독한다.
function listenEnded(root, vid) {
  clearInterval(pingTimer);
  endedFor = null;
  const frame = vid && root.querySelector('.stage-wrap iframe');
  if (!frame) return;
  let heard = false, tries = 0;
  const ping = () => {
    const w = frame.contentWindow;
    if (!w || heard || tries++ > 20) { clearInterval(pingTimer); return; }
    w.postMessage(JSON.stringify({ event: 'listening', id: vid, channel: 'widget' }), '*');
    w.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: vid, channel: 'widget' }), '*');
  };
  frame.addEventListener('load', () => { ping(); clearInterval(pingTimer); pingTimer = setInterval(ping, 500); });
  frame._sdHeard = () => { heard = true; };
  frame._sdVid = vid;
}

// "처음부터 이어 보기" 같은 링크로 열면 바로 재생
document.addEventListener('click', (e) => { if (e.target.closest?.('a[data-autoplay]')) autoStart = true; }, true);

window.addEventListener('message', (e) => {
  if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
  const frame = rootEl && rootEl.querySelector('.stage-wrap iframe');
  if (!frame || e.source !== frame.contentWindow || !frame._sdVid) return;
  let d;
  try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
  if (!d || typeof d !== 'object') return;
  frame._sdHeard?.();
  const ended = (d.event === 'onStateChange' && d.info === 0) || (d.event === 'infoDelivery' && d.info && d.info.playerState === 0);
  if (!ended || endedFor === frame._sdVid) return;
  endedFor = frame._sdVid;
  if (app.prefs.autoNext && nav.qnext) playerNav('qnext');
});

