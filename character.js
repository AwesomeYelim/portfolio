/* =====================================================================
   CHARACTER — loads the user's GLB model (bully_baldi.glb) and makes it
   GROOVE to the music: a continuous two-step bounce/sway/twist driven by
   window.Beat, plus a squash-&-stretch pop on each kick. Scrolling speeds
   the groove up (reads DepthScene velocity). Exposes window.Mascot.
   ===================================================================== */
(function () {
  'use strict';
  if (!window.THREE) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.getElementById('mascot');
  if (!canvas) return;

  let scene, camera, renderer, clock;
  let fig = null, model = null;       // fig = wrapper we transform; model = loaded gltf scene
  let fitScale = 1;                   // scale that normalises the model height
  const B0 = { x: 0, y: 0, rotY: 0 }; // base placement (groove offsets ride on top)

  // groove state
  let phase = 0, lastT = 0, scrollBoost = 0;
  // mouse-interaction state
  let mpx = -9999, mpy = -9999;       // cursor in px
  let leanX = 0, leanY = 0;           // smoothed look/lean toward cursor
  let hover = 0;                      // proximity 0..1
  let poke = 0;                       // click impulse (decays)
  let mouseSeen = false;              // stay neutral until the cursor actually moves
  const _v = new THREE.Vector3();

  // project the character's chest to screen px; returns null until loaded
  function charScreen() {
    if (!fig || !camera) return null;
    _v.set(B0.x, B0.y + 1.9, 0).project(camera);
    return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight };
  }

  function place() {
    if (!fig) return;
    const w = window.innerWidth;
    if (w < 820) {
      // portrait: tucked into the lower-right corner so it never covers text
      B0.x = 1.7;  B0.y = -3.2; B0.rotY = -0.18;
      camera.position.set(0, 1.6, 9.4); camera.lookAt(1.2, 1.0, 0);
    } else if (w < 1200) {
      // mid widths: small mascot peeking from the bottom-right
      B0.x = 5.1; B0.y = -3.3; B0.rotY = -0.34;
      camera.position.set(0, 1.5, 9.0); camera.lookAt(4.0, 0.7, 0);
    } else {
      B0.x = 4.4; B0.y = -3.0; B0.rotY = -0.30;
      camera.position.set(0, 1.6, 8.4); camera.lookAt(3.4, 0.9, 0);
    }
    fig.position.set(B0.x, B0.y, 0);
    fig.rotation.set(0, B0.rotY, 0);
  }

  function fitModel() {
    // center the model on X/Z and drop its feet to y=0, then normalise height
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x;
    model.position.z -= c.z;
    model.position.y -= box.min.y;
    const targetH = 4.1;
    fitScale = targetH / (size.y || 1);
    fig.scale.setScalar(fitScale);
  }

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 100);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    clock = new THREE.Clock();

    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);  key.position.set(3, 8, 6);  scene.add(key);
    const rim = new THREE.DirectionalLight(0xBFC9D6, 0.4);  rim.position.set(-5, 3, -4); scene.add(rim);
    const fill= new THREE.DirectionalLight(0x88aaff, 0.3);  fill.position.set(6, 1, 4);  scene.add(fill);

    const loader = new THREE.GLTFLoader();
    loader.load(
      'bully_baldi.glb',
      (gltf) => {
        model = gltf.scene;
        // strip the baked-in "THIS IS A BULLY" annotation text
        const junk = [];
        model.traverse((o) => {
          if (/^text/i.test(o.name || '')) junk.push(o);
          if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; }
        });
        junk.forEach((o) => { if (o.parent) o.parent.remove(o); });
        fig = new THREE.Group();
        fig.add(model);
        scene.add(fig);
        fitModel();
        place();
      },
      undefined,
      (err) => { console.error('GLB load failed', err); }
    );

    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight); place();
    }, { passive: true });

    // mouse interaction: track cursor, and "poke" the character on a click near it
    addEventListener('pointermove', (e) => { mpx = e.clientX; mpy = e.clientY; mouseSeen = true; }, { passive: true });
    addEventListener('pointerdown', (e) => {
      const s = charScreen();
      if (!s) return;
      const r = Math.min(innerWidth, innerHeight) * 0.34;
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < r) poke = 1;
    }, { passive: true });

    animate();
  }

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    const dt = Math.min(0.05, t - lastT); lastT = t;

    if (fig) {
      const B = window.Beat || { level: 0, kick: 0 };
      const DS = window.DepthScene;
      const vel = DS ? Math.min(1, DS.getVelocity() * 26) : 0;   // scroll energy 0..1

      // scrolling speeds the groove up; eases back to a chill tempo when you stop
      scrollBoost += (vel - scrollBoost) * (vel > scrollBoost ? 0.2 : 0.035);

      const idle = reduce ? 0.25 : 0.62;
      const E   = Math.min(1.8, idle + B.level * 1.05 + scrollBoost * 0.7);   // amplitude
      const spd = 2.0 + B.level * 1.1 + scrollBoost * 5.2;                    // tempo (scroll = faster)
      phase += spd * dt;

      const bob  = Math.sin(phase);         // main beat
      const half = Math.sin(phase * 0.5);   // weight shift (half-time)
      const bob2 = Math.cos(phase);

      // bounce on the beat + a kick pop; weight sways side to side on the half-beat
      fig.position.y = B0.y + Math.abs(bob) * 0.22 * E + B.kick * 0.16;
      fig.position.x = B0.x + half * 0.16 * (0.5 + E * 0.5);
      // lean / twist with the groove
      fig.rotation.z = -half * 0.07 * E;
      fig.rotation.x = bob2 * 0.03 * E;
      fig.rotation.y = B0.rotY + half * 0.22 + bob2 * 0.04 * E;

      // squash & stretch — stretch up on the bounce, squash on the kick
      const stretch = 1 + Math.abs(bob) * 0.05 * E - B.kick * 0.05;
      const squash  = 1 - Math.abs(bob) * 0.03 * E + B.kick * 0.04;
      fig.scale.set(fitScale * squash, fitScale * stretch, fitScale * squash);

      // --- MOUSE INTERACTION (rides on top of the groove) ---
      const s = charScreen();
      if (s && mouseSeen) {
        const d = Math.hypot(mpx - s.x, mpy - s.y);
        const radius = Math.min(innerWidth, innerHeight) * 0.34;
        const near = Math.max(0, 1 - d / radius);     // 1 when cursor is on the character
        hover += (near - hover) * 0.12;
        // look/lean toward the cursor (more eagerly while hovering)
        const tgX = Math.max(-1.4, Math.min(1.4, (mpx - s.x) / (innerWidth * 0.42)));
        const tgY = Math.max(-1.4, Math.min(1.4, (mpy - s.y) / (innerHeight * 0.42)));
        leanY += (tgX - leanY) * 0.08;
        leanX += (tgY - leanX) * 0.08;
      } else {
        hover += (0 - hover) * 0.1;
        leanY += (0 - leanY) * 0.08; leanX += (0 - leanX) * 0.08;
      }
      poke *= 0.90;

      // turn & tilt toward the cursor; perk up + wobble & pop when poked
      fig.rotation.y += leanY * (0.45 + hover * 0.7);
      fig.rotation.x += -leanX * (0.22 + hover * 0.35);
      fig.rotation.z += Math.sin(t * 33) * poke * 0.4;
      fig.position.y += poke * 0.55 + hover * Math.abs(Math.sin(t * 3.2)) * 0.05;
      fig.scale.multiplyScalar(1 + poke * 0.12 + hover * 0.03);
    }

    renderer.render(scene, camera);
  }

  window.Mascot = {
    get scene() { return scene; }, get model() { return model; }, get fig() { return fig; },
    render() { renderer.render(scene, camera); },
  };
  init();
})();
