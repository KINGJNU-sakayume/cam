// 움짤 재생 정책
// 기본은 정지 포스터. 데스크톱은 호버(또는 키보드 포커스) 때, 터치 기기는 화면 안에 들어오면 재생.
// 동시 재생 최대 4개, 화면 밖이면 포스터로. reduced-motion이면 자동 재생하지 않는다(상세에서 눌러서 재생).
const MAX = 4;
const playing = [];
let io = null;
const canHover = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function play(el) {
  if (reduced() || el.dataset.playing) return;
  while (playing.length >= MAX) stop(playing[0]);
  const img = el.querySelector('img');
  if (el.dataset.kind === 'video') {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.src = el.dataset.file;
    v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
    el.insertBefore(v, img.nextSibling);
    v.play().catch(() => {});
  } else {
    img.src = el.dataset.file;
  }
  el.dataset.playing = '1';
  playing.push(el);
}

function stop(el) {
  const i = playing.indexOf(el);
  if (i >= 0) playing.splice(i, 1);
  if (!el.dataset.playing) return;
  delete el.dataset.playing;
  const v = el.querySelector('video');
  if (v) { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); }
  const img = el.querySelector('img');
  if (img && img.getAttribute('src') !== el.dataset.poster) img.src = el.dataset.poster;
}

function observer() {
  if (io) return io;
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target;
      if (!el.isConnected) { io.unobserve(el); stop(el); continue; }
      if (e.isIntersecting && e.intersectionRatio >= 0.6) { if (!canHover()) play(el); }
      else stop(el);
    }
  }, { threshold: [0, 0.6] });
  return io;
}

export function attachClipPlayback(root) {
  // 화면에서 사라진 요소 정리
  for (let i = playing.length - 1; i >= 0; i--) if (!playing[i].isConnected) playing.splice(i, 1);
  if (reduced()) return;
  for (const el of root.querySelectorAll('.clipthumb:not([data-bound])')) {
    el.dataset.bound = '1';
    el.addEventListener('mouseenter', () => { if (canHover()) play(el); });
    el.addEventListener('mouseleave', () => { if (canHover()) stop(el); });
    el.addEventListener('focus', () => play(el));
    el.addEventListener('blur', () => stop(el));
    observer().observe(el);
  }
}
