// 움짤 상세: 큰 재생 + 날짜·행사·곡·멤버·원본·구간·메모 + 네 가지 이동
import { html, fmtMD, fmtYear, fmtTime, fmtBytes } from '../util.js';
import { NOSONG, isSampleYt, ytUrl } from '../model.js';
import { app } from '../state.js';
import { href, baseOf } from '../router.js';
import { ICON, dowPill, clipThumb, whoText } from '../components.js';
import { silhouetteURL } from '../placeholder.js';
import { attachClipPlayback } from '../clipplay.js';

export function openClipDetail(root, s, close) {
  const ix = app.ix;
  const C = ix.C.get(s.clip);
  const c = C.clip, E = C.E, g = E.group, v = C.video;
  const song = C.songId === NOSONG ? null : ix.song.get(C.songId);
  const single = C.memberIds.length === 1 ? ix.member.get(C.memberIds[0]) : null;
  const who = C.key === 'full' ? '풀캠(전원)' : whoText(ix, C.memberIds, 'fancam');
  const isVideo = /\.(mp4|webm)$/i.test(c.file);
  const order = single ? single.order : 0;
  const ph = silhouetteURL({ eventId: E.id, kind: 'fancam', order });
  const poster = c.poster || ph;
  const auto = !app.reduced;
  const fileName = c.file.split('/').pop();
  const sameVideo = v ? (ix.clipsByVideo.get(v.id) || []).filter((x) => x.id !== C.id) : [];
  const sameEvent = E.clips.filter((x) => x.id !== C.id);
  const t = c.t ?? 0;
  const base = baseOf(app.state);

  let collect;
  if (song && single) collect = { h: href({ g: g.id, v: 'song', s: song.id, m: single.id }), t: `${single.name}의 ${song.title} 직캠 모아보기` };
  else if (song) collect = { h: href({ g: g.id, v: 'song', s: song.id }), t: `${song.title} 곡 페이지` };
  else if (single) collect = { h: href({ g: g.id, v: 'member', m: single.id }), t: `${single.name} 멤버 페이지` };
  const nextSame = sameVideo.find((x) => x.clip._i > c._i) || sameVideo[0];

  root.innerHTML = String(html`<div class="ov" role="dialog" aria-modal="true" aria-label="${`움짤 상세: ${c.note || c.id}`}">
    <div class="ov-box">
      <div class="ov-top">
        <p class="ctx"><b>${g.name}</b><span class="sep">·</span>움짤<span class="sep">·</span>${c.note || fileName}</p>
        <button type="button" class="iconbtn" data-close aria-label="움짤 닫기 (Esc)">${ICON.close}</button>
      </div>
      <div class="cd-body">
        <div class="cd-media">
          <div class="frame">${isVideo
            ? html`<video src="${c.file}" poster="${poster}" muted loop playsinline ${auto ? html`autoplay` : ''} controls aria-label="움짤 영상"></video>`
            : html`<img src="${auto ? c.file : poster}" data-ph="${ph}" data-anim="${c.file}" data-poster="${poster}" alt="${c.note || '움짤'}">`}</div>
          ${!isVideo && !auto ? html`<button type="button" class="btn btn-sm" data-toggle-anim style="margin:0 auto">${ICON.playLine}재생</button>` : ''}
          <p class="fmeta" data-fmeta>${fileName}</p>
        </div>
        <div class="cd-info">
          <div class="f-date"><span class="f-big">${fmtMD(E.date)}</span><span class="f-yd"><span class="y">${fmtYear(E.date)}</span>${dowPill(E.date)}</span></div>
          <dl>
            <dt>행사</dt><dd>${E.ev.show}${E.ev.label ? ` ${E.ev.label}` : ''}</dd>
            <dt>곡</dt><dd>${song ? song.title : '전체 공연'}</dd>
            <dt>멤버</dt><dd>${who}</dd>
            <dt>원본</dt><dd>${v ? `${v.title || v.ytId}${v.gone ? ' (삭제됨)' : ''}` : '원본 영상 없음'}</dd>
            <dt>구간</dt><dd class="num">${c.t != null ? `${fmtTime(c.t)}${c.end != null ? ` – ${fmtTime(c.end)}` : ''}` : '모름'}</dd>
            <dt>메모</dt><dd>${c.note || '—'}</dd>
          </dl>
          <div class="cd-actions">
            ${v ? html`<a class="btn btn-fill" href="${href({ ...base, play: v.id, ps: C.songId || undefined, pt: Math.floor(t) })}">${ICON.play}원본 영상 ${fmtTime(t)}부터</a>`
              : html`<span class="btn" aria-disabled="true">원본 영상 없음</span>`}
            <a class="btn" href="${href({ g: g.id, e: E.id })}">${ICON.folder}이 날 공연 폴더</a>
            ${collect ? html`<a class="btn" href="${collect.h}">${ICON.grid}${collect.t}</a>` : ''}
            ${nextSame ? html`<a class="btn" href="${href({ ...base, clip: nextSame.id })}">같은 영상의 다른 움짤 (${sameVideo.length})</a>`
              : html`<span class="btn" aria-disabled="true">같은 영상의 다른 움짤 없음</span>`}
            ${v && !isSampleYt(v.ytId) ? html`<a class="textlink" href="${ytUrl(v.ytId, t)}" target="_blank" rel="noopener noreferrer">유튜브에서 ${fmtTime(t)}부터 열기 ↗</a>` : ''}
          </div>
        </div>
      </div>
      ${sameEvent.length ? html`<div class="cd-more"><h3>같은 공연의 다른 움짤 ${sameEvent.length}</h3>
        <div class="cliprow">${sameEvent.map((x) => clipThumb(x, { caption: html`<div class="lm">${x.songId === NOSONG ? '전체 공연' : ix.song.get(x.songId)?.title || ''} · ${x.key === 'full' ? '풀캠' : whoText(ix, x.memberIds, 'fancam')}</div><div class="lm">${x.clip.note || ''}</div>` }))}</div></div>` : ''}
    </div>
  </div>`);

  const ov = root.querySelector('.ov');
  ov.addEventListener('click', (e) => {
    if (e.target === ov || e.target.closest('[data-close]')) { e.preventDefault(); close(); return; }
    const tg = e.target.closest('[data-toggle-anim]');
    if (tg) {
      const img = ov.querySelector('img[data-anim]');
      const playing = img.getAttribute('src') === img.dataset.anim;
      img.src = playing ? img.dataset.poster : img.dataset.anim;
      tg.lastChild.textContent = playing ? '재생' : '정지';
    }
  });
  attachClipPlayback(root);
  root.querySelector('[data-close]').focus();
  fileMeta(ov.querySelector('[data-fmeta]'), c, isVideo, ov.querySelector('video'));
}

// 파일명 · 용량 · 길이
async function fileMeta(el, c, isVideo, videoEl) {
  const name = c.file.split('/').pop();
  const parts = { name, size: '', dur: '' };
  const paint = () => { if (el.isConnected) el.textContent = [parts.name, parts.size, parts.dur].filter(Boolean).join(' · '); };
  if (c.t != null && c.end != null) parts.dur = `구간 ${c.end - c.t}초`;
  paint();
  try {
    const res = await fetch(c.file);
    if (!res.ok) { parts.size = '파일 없음'; paint(); return; }
    const buf = await res.arrayBuffer();
    parts.size = fmtBytes(buf.byteLength);
    paint();
    if (isVideo && videoEl) {
      const set = () => { if (isFinite(videoEl.duration)) { parts.dur = `길이 ${videoEl.duration.toFixed(1)}초`; paint(); } };
      if (videoEl.readyState >= 1) set(); else videoEl.addEventListener('loadedmetadata', set, { once: true });
    } else if ('ImageDecoder' in window) {
      const type = /\.gif$/i.test(c.file) ? 'image/gif' : 'image/webp';
      const dec = new ImageDecoder({ data: buf, type });
      await dec.tracks.ready;
      const n = dec.tracks.selectedTrack.frameCount;
      let us = 0;
      for (let i = 0; i < n; i++) { const { image } = await dec.decode({ frameIndex: i }); us += image.duration || 0; image.close(); }
      dec.close();
      if (us) { parts.dur = `길이 ${(us / 1e6).toFixed(1)}초 · ${n}프레임`; paint(); }
    }
  } catch { /* 용량·길이를 못 구해도 파일명은 보인다 */ }
}
