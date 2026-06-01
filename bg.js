/* =====================================================================
   BG FX — premium party confetti: refined rounded metallic chips
   (platinum / silver / a touch of champagne) that flutter gracefully
   down and catch the light as they tumble — a polished sheen sweep,
   never thinning to a hairline. Soft float-shadow, gentle beat flash,
   falls faster while you scroll. Drawn over the flat white stage.
   ===================================================================== */
(function () {
  'use strict';
  const c = document.getElementById('bgfx');
  if (!c) return;
  const ctx = c.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // refined metallic tones — platinum / silver dominant, a little champagne
  const TONES = [
    [223, 227, 233], [223, 227, 233],   // platinum
    [202, 208, 217], [202, 208, 217],   // silver
    [224, 212, 184],                    // champagne
  ];

  const PN = reduce ? 70 : 150;
  const flakes = [];
  for (let i = 0; i < PN; i++) {
    const z = 0.45 + Math.random() * 0.55;          // depth → size / speed
    const sq = 3.5 + Math.random() * 4.5;
    flakes.push({
      x: Math.random() * W,
      y: Math.random() * (H + 240) - 120,
      z,
      vx: (Math.random() - 0.5) * 0.3,
      vy: 0.45 + Math.random() * 0.95,              // graceful fall
      sway: 0.45 + Math.random() * 0.9, swayA: 0.45 + Math.random() * 0.85, sph: Math.random() * 6.28,
      flip: Math.random() * 6.28, fsp: 0.035 + Math.random() * 0.055,   // slow tumble
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.025,     // gentle spin
      w: sq * (0.8 + Math.random() * 0.5),
      h: sq,
      tone: TONES[(Math.random() * TONES.length) | 0],
      pop: 0,
    });
  }

  let t = 0;
  function frame() {
    requestAnimationFrame(frame);
    t += 0.016;
    const B = window.Beat || { level: 0, kick: 0 };
    const DS = window.DepthScene;
    const vel = DS ? Math.min(1, DS.getVelocity() * 26) : 0;
    const speed = 1 + vel * 2.8;

    ctx.clearRect(0, 0, W, H);

    for (const d of flakes) {
      d.y += d.vy * speed * (0.55 + d.z);
      d.x += d.vx * speed + Math.sin(t * d.sway + d.sph) * d.swayA * speed;
      d.flip += d.fsp * speed;
      d.rot += d.vr * speed;
      d.pop += (B.kick - d.pop) * 0.5; d.pop *= 0.9;
      if (d.y > H + 30) { d.y = -30; d.x = Math.random() * W; }
      if (d.x < -30) d.x = W + 30; else if (d.x > W + 30) d.x = -30;

      // tumble: stays a solid chip (min 40% width), brightness peaks face-on
      const flip = Math.cos(d.flip);
      const wsc = 0.4 + 0.6 * Math.abs(flip);
      const m = 0.66 + 0.34 * Math.abs(flip) + d.pop * 0.4;   // light catch + beat flash
      const a = Math.min(1, 0.82 + d.z * 0.18);
      const w = d.w * (1 + d.pop * 0.35), h = d.h * (1 + d.pop * 0.35);
      const [br, bg, bb] = d.tone;

      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.scale(wsc, 1);
      ctx.shadowColor = `rgba(36,40,52,${0.13 + d.pop * 0.2})`;
      ctx.shadowBlur = 7 + d.pop * 10;
      ctx.shadowOffsetY = 3;
      // polished metallic sweep: bright highlight -> body -> soft deep silver
      const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      g.addColorStop(0,    `rgba(255,255,255,${a})`);
      g.addColorStop(0.32, `rgba(${cl(br * m + 26)},${cl(bg * m + 26)},${cl(bb * m + 26)},${a})`);
      g.addColorStop(0.58, `rgba(${cl(br * m)},${cl(bg * m)},${cl(bb * m)},${a})`);
      g.addColorStop(1,    `rgba(${cl(br * m * 0.88)},${cl(bg * m * 0.88)},${cl(bb * m * 0.88)},${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }
  frame();
})();
