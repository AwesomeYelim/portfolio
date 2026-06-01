/* =====================================================================
   AUDIO ENGINE — generative dance groove + analyser + mp3 upload
   - Web Audio API, no external assets (royalty-free, generated live)
   - Exposes window.AudioEngine
   - getLevel()  -> smoothed 0..1 amplitude (drives the dancers)
   - getBeat()   -> short decaying pulse on each kick (0..1)
   - toggle(), play(), stop(), setVolume(v), loadFile(file)
   - Dispatches 'audiostate' CustomEvent on window when play state changes
   ===================================================================== */
(function () {
  'use strict';

  let ctx = null;
  let master = null;      // master gain
  let analyser = null;
  let freqData = null;

  let playing = false;
  let mode = 'gen';       // 'gen' (generated groove) | 'file' (uploaded mp3)
  let volume = 0.7;

  // generated-groove scheduler state
  let schedulerId = null;
  let nextNoteTime = 0;
  let step16 = 0;                 // 0..15 sixteenth counter
  const BPM = 124;
  const secPer16 = 60 / BPM / 4;  // duration of a sixteenth note
  const LOOKAHEAD = 0.1;          // schedule this far ahead (s)
  const TICK = 25;                // scheduler poll (ms)

  // uploaded-file playback
  let fileBuffer = null;
  let fileSource = null;

  // level/beat smoothing
  let level = 0;
  let beat = 0;

  /* ---------- lazy context ---------- */
  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = volume;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    master.connect(analyser);
    analyser.connect(ctx.destination);
  }

  /* ---------- synth voices ---------- */
  function kick(t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.0, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.34);
    beat = 1; // pulse (read & decayed in getBeat)
  }

  let noiseBuf = null;
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    const n = ctx.sampleRate * 0.4;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function hat(t, open) {
    const s = ctx.createBufferSource();
    s.buffer = getNoise();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 8000;
    const g = ctx.createGain();
    const dur = open ? 0.14 : 0.045;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(open ? 0.32 : 0.45, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(hp).connect(g).connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }
  function clap(t) {
    const s = ctx.createBufferSource();
    s.buffer = getNoise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(bp).connect(g).connect(master);
    s.start(t); s.stop(t + 0.2);
  }
  function bass(t, freq) {
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 6;
    o.type = 'sawtooth'; o.frequency.value = freq;
    o2.type = 'square'; o2.frequency.value = freq / 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + secPer16 * 1.9);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(master);
    o.start(t); o2.start(t); o.stop(t + 0.4); o2.stop(t + 0.4);
  }
  function pluck(t, freq) {
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    o2.type = 'sawtooth'; o2.frequency.value = freq * 1.005; // slight detune
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); o2.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t + 0.24); o2.stop(t + 0.24);
  }

  /* ---------- pattern ---------- */
  // A minor pentatonic-ish groove. Bass roots cycle over 4 bars.
  const barRoots = [55.00, 49.00, 58.27, 43.65]; // A1, G1, A#1/Bb1, F1
  const arp = [440.00, 523.25, 659.25, 587.33, 523.25, 659.25, 783.99, 659.25]; // A4 C5 E5 D5 ...
  let barCount = 0;

  function scheduleStep(s, t) {
    // s = 0..15 sixteenth within bar
    const root = barRoots[barCount % barRoots.length];
    // KICK on quarters
    if (s % 4 === 0) kick(t);
    // CLAP on beats 2 & 4
    if (s === 4 || s === 12) clap(t);
    // HATS on every off 8th, open hat on the "and" of 4
    if (s % 2 === 1) hat(t, s === 7 || s === 15);
    // BASS on 8ths with a little movement
    if (s % 2 === 0) {
      const mul = (s === 6 || s === 14) ? 1.5 : 1.0; // a fifth-ish lift
      bass(t, root * mul);
    }
    // ARP plucks — sparse, lands on syncopated 16ths
    if (s === 0 || s === 3 || s === 6 || s === 10 || s === 13) {
      pluck(t, arp[(s + barCount) % arp.length]);
    }
    if (s === 15) barCount++;
  }

  function scheduler() {
    while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(step16, nextNoteTime);
      nextNoteTime += secPer16;
      step16 = (step16 + 1) % 16;
    }
  }

  /* ---------- file playback ---------- */
  function startFile() {
    if (!fileBuffer) return;
    fileSource = ctx.createBufferSource();
    fileSource.buffer = fileBuffer;
    fileSource.loop = true;
    fileSource.connect(master);
    fileSource.start();
  }
  function stopFile() {
    if (fileSource) { try { fileSource.stop(); } catch (e) {} fileSource.disconnect(); fileSource = null; }
  }

  /* ---------- transport ---------- */
  function play() {
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    if (playing) return;
    playing = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    if (mode === 'file' && fileBuffer) {
      startFile();
    } else {
      step16 = 0; barCount = 0;
      nextNoteTime = ctx.currentTime + 0.06;
      schedulerId = setInterval(scheduler, TICK);
    }
    emit();
  }
  function stop() {
    if (!playing) return;
    playing = false;
    if (schedulerId) { clearInterval(schedulerId); schedulerId = null; }
    stopFile();
    if (master) master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
    emit();
  }
  function toggle() { playing ? stop() : play(); }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master && playing) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
  }

  function loadFile(file) {
    return new Promise((resolve, reject) => {
      ensureCtx();
      const r = new FileReader();
      r.onload = () => {
        ctx.decodeAudioData(r.result.slice(0), (buf) => {
          fileBuffer = buf;
          mode = 'file';
          // restart playback with the new track if currently playing
          if (playing) { stop(); play(); } else { play(); }
          resolve(true);
        }, (err) => reject(err));
      };
      r.onerror = reject;
      r.readAsArrayBuffer(file);
    });
  }
  function useGenerated() {
    mode = 'gen';
    if (playing) { stop(); play(); }
  }

  /* ---------- analysis (called from rAF in dancefloor) ---------- */
  function update() {
    if (analyser && playing) {
      analyser.getByteFrequencyData(freqData);
      // weight low+mid for a "body" level
      let sum = 0, n = Math.min(freqData.length, 48);
      for (let i = 0; i < n; i++) sum += freqData[i];
      const raw = (sum / n) / 255;        // 0..1
      level += (raw - level) * 0.25;       // smooth attack/release
    } else {
      level += (0 - level) * 0.08;
    }
    beat *= 0.86;                          // decay kick pulse
    return level;
  }

  function emit() {
    window.dispatchEvent(new CustomEvent('audiostate', { detail: { playing, mode } }));
  }

  window.AudioEngine = {
    play, stop, toggle, setVolume, loadFile, useGenerated, update,
    getLevel: () => level,
    getBeat: () => beat,
    isPlaying: () => playing,
    getMode: () => mode,
  };
})();
