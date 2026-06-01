/* =====================================================================
   APP — cursor + music wiring (YouTube track + mp3 upload + generated
   fallback). Depth scrolling lives in depth.js.
   ===================================================================== */
(function () {
  'use strict';
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  /* ---------- CUSTOM CURSOR ---------- */
  if (!coarse) {
    const ring = document.getElementById('ring');
    const dot = document.getElementById('dot');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, dx = mx, dy = my;
    addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
    (function tick() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      dx += (mx - dx) * 0.6; dy += (my - dy) * 0.6;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      dot.style.transform = `translate(${dx}px,${dy}px) translate(-50%,-50%)`;
      requestAnimationFrame(tick);
    })();
    const hov = () => { ring.classList.add('is-hover'); dot.style.opacity = '0'; };
    const out = () => { ring.classList.remove('is-hover'); dot.style.opacity = '1'; };
    document.querySelectorAll('a,button,.chip,.work,.upload,label,input').forEach(el => {
      el.addEventListener('mouseenter', hov); el.addEventListener('mouseleave', out);
    });
  }

  /* ---------- mark = home ---------- */
  const mark = document.getElementById('markHome');
  if (mark) mark.addEventListener('click', e => { e.preventDefault(); if (window.DepthScene) window.DepthScene.goTo(0); else scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ---------- MUSIC + BEAT REACTIVITY ----------
     The track plays through an <audio> element routed into a Web Audio
     AnalyserNode, so the visuals pulse to the real waveform. Uploading
     an mp3 swaps the element's source through the same graph.           */
  const muteBtn = document.getElementById('muteBtn');
  const muteTxt = document.getElementById('muteTxt');
  const bgAudio = document.getElementById('bgAudio');

  let playing = false;
  let started = false;

  // --- analyser graph (built lazily on first play, after user gesture) ---
  let actx = null, analyser = null, freq = null, srcNode = null;
  let level = 0, kick = 0, prevLow = 0;
  function ensureGraph() {
    if (actx) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      srcNode = actx.createMediaElementSource(bgAudio);
      analyser = actx.createAnalyser();
      analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.78;
      freq = new Uint8Array(analyser.frequencyBinCount);
      srcNode.connect(analyser);
      analyser.connect(actx.destination);
    } catch (e) { /* analyser optional — playback still works */ }
  }
  (function beatLoop() {
    if (analyser && playing) {
      analyser.getByteFrequencyData(freq);
      let sum = 0; for (let i = 0; i < 40; i++) sum += freq[i];
      const raw = (sum / 40) / 255;
      level += (raw - level) * 0.22;
      let low = 0; for (let i = 0; i < 6; i++) low += freq[i];
      low = (low / 6) / 255;
      if (low - prevLow > 0.12 && low > 0.45) kick = 1;   // onset detect
      prevLow = low;
    } else {
      level += (0 - level) * 0.08;
    }
    kick *= 0.85;
    window.Beat = { level, kick };
    requestAnimationFrame(beatLoop);
  })();
  window.Beat = { level: 0, kick: 0 };

  function updateMuteUI() {
    if (!muteBtn) return;
    const muted = bgAudio ? bgAudio.muted || !playing : true;
    muteBtn.classList.toggle('muted', muted);
    muteBtn.setAttribute('aria-pressed', String(muted));
    if (muteTxt) muteTxt.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  }

  if (bgAudio) {
    bgAudio.volume = 0.85;
    bgAudio.loop = true;
    bgAudio.addEventListener('playing', () => { playing = true; updateMuteUI(); });
    bgAudio.addEventListener('pause', () => { playing = false; updateMuteUI(); });
  }

  // start (or resume) playback — safe to call repeatedly (never stacks a 2nd stream)
  function startMusic() {
    if (!bgAudio) return;
    ensureGraph();
    if (actx && actx.state === 'suspended') actx.resume();
    if (!bgAudio.paused) return;          // already playing — don't trigger another play()
    started = true;
    const pr = bgAudio.play();
    if (pr && pr.catch) pr.catch(() => {});
  }

  // try to autoplay immediately; if the browser blocks it, the first user
  // gesture (scroll / click / key / touch) kicks it off automatically.
  const GEST = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
  function firstGesture() {
    if (actx && actx.state === 'suspended') actx.resume();
    startMusic();
  }
  GEST.forEach(ev => window.addEventListener(ev, firstGesture, { passive: true }));
  // once playback truly begins, drop the gesture hooks so nothing can re-trigger it
  if (bgAudio) bgAudio.addEventListener('playing',
    () => GEST.forEach(ev => window.removeEventListener(ev, firstGesture)), { once: true });
  // attempt right away (works when the tab already has audio permission)
  window.addEventListener('load', startMusic);
  startMusic();

  // the corner button toggles mute (and unmutes/starts on the very first press)
  if (muteBtn && bgAudio) {
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!started || bgAudio.paused) { startMusic(); bgAudio.muted = false; }
      else { bgAudio.muted = !bgAudio.muted; }
      updateMuteUI();
    });
  }
  updateMuteUI();

  // GUARD AGAINST OVERLAP: a backgrounded or bfcached copy must never keep
  // playing on top of the visible one. Pause when hidden, resume when shown.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (bgAudio && !bgAudio.paused) bgAudio.pause(); }
    else if (started) startMusic();
  });
  window.addEventListener('pagehide', () => { if (bgAudio && !bgAudio.paused) bgAudio.pause(); });
})();
