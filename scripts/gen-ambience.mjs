// Generate an original, CC0 early-'80s funk-groove loop (WAV) for the retro room.
//
// Vibe reference: the bouncy, bright funk-dance feel of early-'80s groove records
// (Tom Tom Club "Genius of Love" energy) -- WITHOUT copying any melody, bassline
// or recording. Everything here is written from scratch -> 100% CC0, safe to host.
//
// Refined drum synthesis (the "cheap beat" fix):
//   * kick: clean sine pitch-drop + tiny transient click, punchy not muddy
//   * snare: resonant BANDPASS noise (tight snap) + tonal body, not raw hiss
//   * hi-hat: 808/909-style 6 inharmonic squares through a highpass -> metallic
//   * ghost snares + swung hats for pocket
// Lead is carried by a syncopated funk BASS + clavinet stabs + glue pad
// (marimba/bell removed; the other voices are turned up to fill the space).
// 100 BPM, 8 bars (~19.2 s). Seamless via index wrap-around (mod N).
//
// Run: node scripts/gen-ambience.mjs   ->   assets/audio/ambience.wav

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SR = 32000;
const BPM = 100;
const SPB = (SR * 60) / BPM; // 19200 samples / beat (integer)
const STEP = SPB / 4; // 16th = 4800
const SWING = 0.12; // tight funk swing
const BAR = SPB * 4;
const BARS = 8;
const N = BAR * BARS; // 614400 -> 19.2 s loop
const TAU = Math.PI * 2;

const L = new Float64Array(N),
  R = new Float64Array(N);
const wrap = (i) => ((i % N) + N) % N;
const add = (pos, l, r) => {
  const k = wrap(pos | 0);
  L[k] += l;
  R[k] += r;
};
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const saw = (p) => 2 * (p - Math.floor(p + 0.5));
const sq = (p, d = 0.5) => (p - Math.floor(p) < d ? 1 : -1);
const stepAt = (bar, s) => bar * BAR + s * STEP + (s & 1 ? SWING * STEP : 0);
const panLR = (pan) => [Math.cos((((pan + 1) / 2) * Math.PI) / 2), Math.sin((((pan + 1) / 2) * Math.PI) / 2)];
// Chamberlin SVF coefficient for a cutoff
const svfF = (fc) => 2 * Math.sin((Math.PI * Math.min(fc, SR / 2.2)) / SR);

// ---- kick: clean & punchy --------------------------------------------------
function kick(at, g = 1) {
  const dur = (0.3 * SR) | 0;
  let ph = 0,
    prev = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / SR;
    const f = 50 + (120 - 50) * Math.exp(-t / 0.022);
    ph += f / SR;
    const env = Math.exp(-t / 0.12);
    const click = Math.random() * 2 - 1;
    const hp = click - prev;
    prev = click;
    const s = (Math.sin(TAU * ph) * env + hp * Math.exp(-t / 0.0015) * 0.25) * g;
    add(at + i, s, s);
  }
}

// ---- snare: resonant bandpass snap + tonal body ---------------------------
function snare(at, g = 1) {
  const dur = (0.2 * SR) | 0;
  const rel = (0.01 * SR) | 0;
  let low = 0,
    band = 0;
  const f = svfF(2300),
    q = 1 / 1.7;
  let p1 = 0,
    p2 = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / SR;
    const n = Math.random() * 2 - 1;
    const high = n - low - q * band;
    band += f * high;
    low += f * band; // band = bandpass
    p1 += 185 / SR;
    p2 += 248 / SR;
    const body = (Math.sin(TAU * p1) + Math.sin(TAU * p2) * 0.6) * Math.exp(-t / 0.04);
    let env = Math.exp(-t / 0.075);
    if (i > dur - rel) env *= (dur - i) / rel;
    const s = (band * 1.1 + body * 0.45) * env * g;
    add(at + i, s * 0.93, s);
  }
}

// ---- hi-hat: 808/909-style metallic (6 inharmonic squares + highpass) -----
const HAT_RATIOS = [2.0, 3.0, 4.16, 5.43, 6.79, 8.21];
function hat(at, g = 1, open = false) {
  const decay = open ? 0.28 : 0.035;
  const dur = (decay * 5 * SR) | 0;
  const rel = (0.005 * SR) | 0;
  const base = 325;
  const phs = HAT_RATIOS.map(() => 0);
  let lp = 0;
  const a = 1 - Math.exp((-TAU * 7000) / SR); // one-pole HP (always stable)
  for (let i = 0; i < dur; i++) {
    const t = i / SR;
    let sum = 0;
    for (let k = 0; k < HAT_RATIOS.length; k++) {
      phs[k] += (base * HAT_RATIOS[k]) / SR;
      sum += sq(phs[k]);
    }
    const inp = sum / HAT_RATIOS.length;
    lp += a * (inp - lp);
    const high = inp - lp; // highpass = input - lowpass
    let env = Math.exp(-t / decay);
    if (i > dur - rel) env *= (dur - i) / rel;
    const s = high * env * g * 0.5;
    add(at + i, s, s * 0.9);
  }
}

// ---- staccato funk bass (the hook) ----------------------------------------
function bass(at, dur, freq, g = 1) {
  let ph = 0,
    y = 0;
  const rel = (0.02 * SR) | 0;
  for (let i = 0; i < dur; i++) {
    const t = i / SR;
    ph += freq / SR;
    const x = saw(ph) * 0.6 + Math.sin(TAU * ph) * 0.5;
    const fc = 180 + 1500 * Math.exp(-t / 0.05);
    const a = 1 - Math.exp((-TAU * fc) / SR);
    y += a * (x - y);
    let env = Math.min(1, i / 120);
    if (i > dur - rel) env *= (dur - i) / rel;
    const s = y * env * g;
    add(at + i, s, s);
  }
}

// ---- clavinet stab (bright, off-beat comping) -----------------------------
function clav(at, midis, g, pan = -0.35) {
  const dur = (0.17 * SR) | 0,
    rel = (0.02 * SR) | 0;
  const [gl, gr] = panLR(pan);
  const v = midis.map((m) => ({ f: mtof(m), ph: Math.random() }));
  let y = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / SR;
    let env = (1 - Math.exp(-t / 0.001)) * Math.exp(-t / 0.075);
    if (i > dur - rel) env *= (dur - i) / rel;
    let x = 0;
    for (const o of v) {
      o.ph += o.f / SR;
      x += sq(o.ph, 0.42);
    }
    x /= v.length;
    const fc = 700 + 3200 * Math.exp(-t / 0.045);
    const a = 1 - Math.exp((-TAU * fc) / SR);
    y += a * (x - y);
    const s = y * env * g;
    add(at + i, s * gl, s * gr);
  }
}

// ---- glue pad (sustained, low) --------------------------------------------
function pad(at, dur, midis, g) {
  const rel = (0.15 * SR) | 0;
  const v = midis.map((m, i) => ({
    f: mtof(m),
    ph: Math.random(),
    pan: -0.3 + 0.6 * (i / Math.max(1, midis.length - 1)),
  }));
  for (let i = 0; i < dur; i++) {
    const t = i / SR;
    let amp = 1 - Math.exp(-t / 0.05);
    if (i > dur - rel) amp *= (dur - i) / rel;
    let sl = 0,
      sr = 0;
    for (const o of v) {
      const x = Math.sin(TAU * o.f * t + o.ph) * 0.6 + saw(o.f * t + o.ph) * 0.16;
      const [gl, gr] = panLR(o.pan);
      sl += x * gl;
      sr += x * gr;
    }
    const k = (g * amp) / v.length;
    add(at + i, sl * k, sr * k);
  }
}

// ---- arrangement: bright 9th funk vamp ------------------------------------
const PROG = [
  { bass: 33, ch: [60, 64, 67, 71], pad: [57, 60, 64] }, // Am9
  { bass: 38, ch: [60, 64, 66, 69], pad: [57, 62, 66] }, // D9
  { bass: 29, ch: [60, 64, 67, 69], pad: [57, 60, 64] }, // Fmaj9
  { bass: 31, ch: [59, 62, 65, 69], pad: [55, 59, 62] }, // G9
];

const KICK = [0, 6, 10, 11]; // syncopated, not busy
const SNARE = [4, 12]; // backbeat
const GHOST = [7, 15]; // ghost snares -> groove
const HAT = [0, 2, 4, 6, 8, 10, 12, 14];
const BASSLINE = [
  [0, 0], // root on beat 1
  [8, 0], // root on beat 3 — steady foundation, no melodic riff
];
const CLAV = [2, 6, 10, 14]; // off-beat stabs

for (let bar = 0; bar < BARS; bar++) {
  const c = PROG[(bar >> 1) % PROG.length];
  const fill = bar % 4 === 3;

  // pad removed per request — no tonal/melodic content

  // all drums removed per request (kick included)

  // bass removed per request
  // clavinet removed per request
}

// ---- typing-keyboard foley (the retro-desk texture) -----------------------
// Free-time mechanical key clicks: bursts of 3-8 keys (a "word") then a pause.
// Each real keypress = TWO transients — a down-stroke (bottom-out "thock" +
// plasticky keycap clack) and, ~40-90ms later, a softer/brighter up-stroke as
// the key returns. Two resonant modes give a woody plastic body, not a beep.
function tick(at, gain, pan, bright, decay) {
  const dur = (0.045 * SR) | 0;
  const [gl, gr] = panLR(pan);
  const f1 = svfF(bright * (0.85 + Math.random() * 0.3)),
    q1 = 1 / 6;
  const f2 = svfF(bright * (1.7 + Math.random() * 0.5)),
    q2 = 1 / 9;
  let l1 = 0,
    b1 = 0,
    l2 = 0,
    b2 = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / SR;
    const n = Math.random() * 2 - 1;
    const h1 = n - l1 - q1 * b1;
    b1 += f1 * h1;
    l1 += f1 * b1;
    const h2 = n - l2 - q2 * b2;
    b2 += f2 * h2;
    l2 += f2 * b2;
    const env = Math.exp(-t / decay) * (1 - Math.exp(-t / 0.0014)); // softer, more natural attack
    const s = (b1 * 0.7 + b2 * 0.4 + n * 0.1) * env * gain;
    add(at + i, s * gl, s * gr);
  }
}
function key(at, gain, pan) {
  const bright = 1500 + Math.random() * 1100; // a touch darker -> less ticky, more body
  // down-stroke: heavy bottom-out thock (two low layers) under the keycap clack
  {
    const dur = (0.07 * SR) | 0;
    const [gl, gr] = panLR(pan);
    const thockF = 68 + Math.random() * 48; // deeper -> more weight
    let p = 0,
      p2 = 0;
    for (let i = 0; i < dur; i++) {
      const t = i / SR;
      p += thockF / SR;
      p2 += (thockF * 2) / SR;
      // fundamental + a bit of 2nd harmonic for a fuller "thunk"
      const thock = (Math.sin(TAU * p) + 0.35 * Math.sin(TAU * p2)) * Math.exp(-t / 0.016) * 0.95 * gain;
      add(at + i, thock * gl, thock * gr);
    }
  }
  tick(at, gain * 0.9, pan, bright, 0.013);
  // up-stroke: shorter, brighter, quieter, slightly delayed (key returning)
  const relGap = (0.05 + Math.random() * 0.05) * SR;
  tick(at + relGap, gain * (0.28 + Math.random() * 0.14), pan, bright * 1.3, 0.006);
}
{
  const TYPE_GAIN = 0.22; // quieter still — well back in the room
  let pos = 0.15 * SR;
  while (pos < N - 0.12 * SR) {
    const burst = 2 + ((Math.random() * 5) | 0); // a "word"
    for (let k = 0; k < burst && pos < N - 0.12 * SR; k++) {
      const space = Math.random() < 0.12; // occasional spacebar: louder, lower
      const pan = -0.6 + Math.random() * 1.2; // scatter each key across the stereo field
      key(pos, TYPE_GAIN * (space ? 1.1 : 0.55 + Math.random() * 0.45), pan);
      pos += (0.16 + Math.random() * 0.18) * SR; // sparser, irregular spacing
    }
    pos += (0.7 + Math.random() * 1.7) * SR; // longer scattered gaps between words
  }
}

// ---- distant crowd murmur (웅성웅성): faint, indistinct background chatter ----
// Several "voices": vocal-band noise pulsed at a syllable rate, gated by a slow
// phrase envelope (talk / pause), with a slowly wandering formant. Kept very low
// and band-limited so it reads as a room full of people far away, never words.
{
  const VOICES = 10;
  const MURMUR = 0.15; // overall level — brought up, the main ambience now
  for (let v = 0; v < VOICES; v++) {
    const pan = -0.8 + Math.random() * 1.6;
    const [gl, gr] = panLR(pan);
    let lp = 0,
      bp = 0;
    let fc = 320 + Math.random() * 700; // formant center, will wander
    let synPhase = Math.random() * TAU;
    const synRate = 2.6 + Math.random() * 3.4; // syllable rate 2.6-6 Hz
    let phrasePhase = Math.random() * TAU;
    const phraseRate = 0.12 + Math.random() * 0.33; // phrases come and go slowly
    const vGain = (0.7 + Math.random() * 0.6) / VOICES;
    for (let i = 0; i < N; i++) {
      // slow formant wander, bounded to the vocal range
      fc += (Math.random() - 0.5) * 6;
      if (fc < 250) fc = 250;
      else if (fc > 1350) fc = 1350;
      const f = svfF(fc),
        q = 1 / 8;
      const n = Math.random() * 2 - 1;
      const high = n - lp - q * bp;
      bp += f * high;
      lp += f * bp; // bp = band-limited "voice" noise
      // syllable pulsing (half-wave) + slow talk/pause phrase gate
      synPhase += (TAU * synRate) / SR;
      phrasePhase += (TAU * phraseRate) / SR;
      const syl = Math.max(0, Math.sin(synPhase));
      const phrase = Math.max(0, Math.sin(phrasePhase)); // off half the time -> pauses
      const s = bp * syl * phrase * phrase * vGain * MURMUR;
      add(i, s * gl, s * gr);
    }
  }
}

// ---- spatial low hum (웅웅): wide, slowly beating ambient drone for space ----
// A few low partials whose L/R channels are detuned by a few whole cycles over
// the loop -> slow beating = width + movement, and seamless at the loop seam.
{
  const HUM = 0.06;
  const inc = (c) => (TAU * c) / N; // phase step for `c` whole cycles over the loop (loops cleanly)
  const parts = [
    { cl: 1245, cr: 1251, w: 0.6 }, // ~65 Hz, widest detune -> slowest beat
    { cl: 1879, cr: 1885, w: 1.0 }, // ~98 Hz (most audible body of the hum)
    { cl: 2493, cr: 2499, w: 0.45 }, // ~130 Hz, airy top of the hum
  ];
  const phl = parts.map(() => 0),
    phr = parts.map(() => 0);
  let trem = 0;
  const tremInc = inc(2); // 2 slow swells per loop
  for (let i = 0; i < N; i++) {
    trem += tremInc;
    const amp = 0.72 + 0.28 * Math.sin(trem);
    let sl = 0,
      sr = 0;
    for (let k = 0; k < parts.length; k++) {
      phl[k] += inc(parts[k].cl);
      phr[k] += inc(parts[k].cr);
      sl += Math.sin(phl[k]) * parts[k].w;
      sr += Math.sin(phr[k]) * parts[k].w;
    }
    add(i, sl * amp * HUM, sr * amp * HUM);
  }
}

// ---- master: light low-pass (warmth, but bright) + soft-clip + normalize ---
let yl = 0,
  yr = 0;
const fc = 9500,
  a = 1 - Math.exp((-TAU * fc) / SR);
for (let i = 0; i < N; i++) {
  yl += a * (L[i] - yl);
  yr += a * (R[i] - yr);
  L[i] = yl;
  R[i] = yr;
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const pre = 0.9 / (peak || 1);
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * pre * 1.12);
  R[i] = Math.tanh(R[i] * pre * 1.12);
}
peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.85 / (peak || 1);

const data = Buffer.alloc(N * 2 * 2);
for (let i = 0; i < N; i++) {
  data.writeInt16LE((Math.max(-1, Math.min(1, L[i] * g)) * 32767) | 0, i * 4);
  data.writeInt16LE((Math.max(-1, Math.min(1, R[i] * g)) * 32767) | 0, i * 4 + 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 2 * 2, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

const outDir = path.join(root, "assets", "audio");
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, "ambience.wav");
const wav = Buffer.concat([header, data]);
await writeFile(outPath, wav);

let rms = 0;
for (let i = 0; i < N; i++) rms += (L[i] * g) ** 2;
rms = Math.sqrt(rms / N);
console.log(`wrote ${outPath}`);
console.log(
  `  '80s funk groove  Am9-D9-Fmaj9-G9  ${BPM} BPM, ${(N / SR).toFixed(1)}s loop, ${(wav.length / 1048576).toFixed(
    1
  )} MB`
);
console.log(`  refined drums + funk bass + pad + typing,  rms ${rms.toFixed(4)}`);
