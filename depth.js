/* =====================================================================
   DEPTH — section-snap fly-through. Panels are laid on the Z axis and
   rush toward the camera. Navigation is DISCRETE: one wheel notch / one
   trackpad gesture / one swipe / one arrow key advances exactly ONE
   section. The transition between sections is still lerp-smoothed for a
   buttery fly-through. Exposes window.DepthScene { goTo, setGap, getCount }.
   ===================================================================== */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const panels = Array.from(document.querySelectorAll('.panel'));
  const N = panels.length;
  const dots = document.getElementById('dots');
  const sun = document.getElementById('halo');
  const counter = document.getElementById('counter');
  const caption = document.getElementById('caption');
  const captionText = document.getElementById('captionText');
  // the mascot introduces Yelim, one line per section
  const CAPTIONS = [
    '안녕하세요, 제가 <b>홍예림</b> 님을 소개할게요',
    '복잡한 문제를 <b>구조</b>로 푸는 분이에요',
    '<b>백엔드부터 인프라</b>까지 다루는 분이죠',
    '함께 만들고 싶으시다면 <b>메일</b> 주세요',
  ];
  let lastNear = -1;

  let GAP = 1180;          // px of translateZ between adjacent panels
  let index = 0;           // current section (integer 0 .. N-1)
  let target = 0;          // target progress (== index)
  let cur = 0;             // smoothed progress
  let vel = 0;             // |d(cur)| per frame -> "energy" for the dancer

  // build dot nav
  panels.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'dot';
    b.setAttribute('aria-label', (p.dataset.name || ('Section ' + (i + 1))));
    b.innerHTML = `<span class="t">${p.dataset.name || ''}</span>`;
    b.addEventListener('click', () => goTo(i));
    dots.appendChild(b);
  });
  const dotEls = Array.from(dots.children);

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function goTo(i) {
    index = clamp(Math.round(i), 0, N - 1);
    target = index;
  }
  function step(dir) { goTo(index + dir); }

  function apply() {
    for (let i = 0; i < N; i++) {
      const d = i - cur;                 // >0 ahead (far), <0 passed (through camera)
      const z = -d * GAP;
      let op;
      if (d >= 0) op = clamp(1.25 - d * 1.7, 0, 1);
      else op = clamp(1 + d * 2.4, 0, 1);
      const el = panels[i];
      el.style.transform = `translate(0,-50%) translateZ(${z}px)`;
      el.style.opacity = op.toFixed(3);
      el.style.filter = d > 0.5 ? `blur(${Math.min(7, (d - 0.5) * 7)}px)` : 'none';
      el.style.pointerEvents = Math.abs(d) < 0.42 ? 'auto' : 'none';
      el.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
    }
    // beat-reactive halo behind the dancer
    const beat = window.Beat || { level: 0, kick: 0 };
    if (sun) {
      const sc = 1 + beat.level * 0.18 + beat.kick * 0.12;
      sun.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(3)})`;
      sun.style.opacity = (0.34 + beat.level * 0.4 + beat.kick * 0.2).toFixed(3);
    }
    // dot + counter + caption
    const near = Math.round(cur);
    dotEls.forEach((d, i) => d.classList.toggle('on', i === near));
    if (near !== lastNear) {
      lastNear = near;
      if (counter) counter.innerHTML = '<b>' + String(near + 1).padStart(2, '0') + '</b> / ' + String(N).padStart(2, '0');
      if (caption) {
        caption.classList.remove('show');
        setTimeout(() => { if (captionText) captionText.innerHTML = CAPTIONS[near] || ''; caption.classList.add('show'); }, 170);
      }
    }
  }

  function tick() {
    const prev = cur;
    cur += (target - cur) * (reduce ? 1 : 0.12);
    if (Math.abs(target - cur) < 0.0004) cur = target;
    vel += (Math.abs(cur - prev) - vel) * 0.2;   // smoothed energy
    apply();
    requestAnimationFrame(tick);
  }

  /* ---------- DISCRETE INPUT: one gesture == one section ---------- */
  // A wheel gesture (mouse notch or trackpad swipe) fires many events; we
  // trigger ONE step on the first event, then stay locked until the gesture
  // goes quiet (no wheel events for a short window). That guarantees a single
  // section change per scroll, no matter how long the trackpad inertia runs.
  let locked = false;
  let quietTimer = null;
  function unlockWhenQuiet() {
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => { locked = false; }, 180);
  }
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (Math.abs(e.deltaY) < 2) return;
    if (!locked) { locked = true; step(e.deltaY > 0 ? 1 : -1); }
    unlockWhenQuiet();
  }, { passive: false });

  // touch swipe — one swipe == one section
  let touchY = null;
  window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (touchY === null) return;
    const dy = touchY - e.touches[0].clientY;
    if (Math.abs(dy) > 44) { step(dy > 0 ? 1 : -1); touchY = null; }
  }, { passive: true });
  window.addEventListener('touchend', () => { touchY = null; }, { passive: true });

  // keyboard
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Home') goTo(0);
    else if (e.key === 'End') goTo(N - 1);
  });

  cur = target = index = 0;
  apply();
  requestAnimationFrame(tick);

  window.DepthScene = {
    goTo,
    setGap(v) { GAP = v; },
    getCount: () => N,
    getProgress: () => cur,           // 0 .. N-1
    getVelocity: () => vel,           // energy (per-frame)
  };
})();
