/* ============================================================
   Yelim Hong — 3D room + retro computer  (Three.js r128)
   ============================================================ */
(function () {
  "use strict";

  const stage = document.getElementById("stage");
  const crt = document.getElementById("crt");
  const crtScreen = document.getElementById("crt-screen");
  const backBtn = document.getElementById("backBtn");
  const soundBtn = document.getElementById("soundBtn");
  const hint = document.getElementById("hint");

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);

  // ---------- scene / camera ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14100b);
  scene.fog = new THREE.FogExp2(0x14100b, 0.075);

  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 100);

  const HOME = {
    pos: new THREE.Vector3(0.85, 1.92, 2.55),
    target: new THREE.Vector3(0, 1.5, -0.08)
  };
  camera.position.copy(HOME.pos);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 1.15;
  controls.maxDistance = 3.1;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.52;
  controls.rotateSpeed = 0.62;
  controls.enabled = false; // until entered

  // ============================================================
  //  ROOM
  // ============================================================
  function makeWoodTexture() {
    const c = document.createElement("canvas"); c.width = 512; c.height = 512;
    const x = c.getContext("2d");
    x.fillStyle = "#5a4029"; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 512; i += 32) {
      const tone = 30 + Math.random() * 26;
      x.fillStyle = `rgb(${70 + tone},${48 + tone * .7},${28 + tone * .5})`;
      x.fillRect(0, i, 512, 30);
      x.strokeStyle = "rgba(30,18,8,.45)"; x.lineWidth = 2;
      x.beginPath(); x.moveTo(0, i + 31); x.lineTo(512, i + 31); x.stroke();
      for (let k = 0; k < 60; k++) {
        x.strokeStyle = `rgba(40,26,12,${.04 + Math.random() * .06})`;
        x.beginPath(); const yy = i + Math.random() * 30;
        x.moveTo(Math.random() * 512, yy); x.lineTo(Math.random() * 512, yy + (Math.random() - .5) * 4); x.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function makeWallTexture() {
    const c = document.createElement("canvas"); c.width = 256; c.height = 256;
    const x = c.getContext("2d");
    x.fillStyle = "#6a513a"; x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 9000; k++) {
      x.fillStyle = `rgba(${30 + Math.random() * 40},${20 + Math.random() * 30},${10 + Math.random() * 20},${Math.random() * .08})`;
      x.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
    return t;
  }

  const woodTex = makeWoodTexture();
  const wallTex = makeWallTexture();

  // floor
  const floorTex = woodTex.clone(); floorTex.repeat.set(4, 4); floorTex.needsUpdate = true;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshStandardMaterial({ map: floorTex, color: 0x8a6a44, roughness: 0.85, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  // walls
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0x7c5f44, roughness: 0.95, metalness: 0 });
  wallTex.repeat.set(3, 2);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), wallMat);
  backWall.position.set(0, 4.5, -2.3); backWall.receiveShadow = true;
  scene.add(backWall);
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), wallMat);
  leftWall.rotation.y = Math.PI / 2; leftWall.position.set(-2.9, 4.5, 0); leftWall.receiveShadow = true;
  scene.add(leftWall);

  // window on the left wall (sunset)
  const winGroup = new THREE.Group();
  winGroup.position.set(-2.86, 1.85, -0.4);
  winGroup.rotation.y = Math.PI / 2;
  const winGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.7),
    new THREE.MeshBasicMaterial({ color: 0xffd49a })
  );
  winGroup.add(winGlow);
  // warm sky gradient behind glass
  (function () {
    const c = document.createElement("canvas"); c.width = 64; c.height = 128;
    const g = c.getContext("2d").createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "#ffe9c2"); g.addColorStop(.45, "#ffc777"); g.addColorStop(.75, "#ff9d57"); g.addColorStop(1, "#d6743e");
    const ctx = c.getContext("2d"); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 128);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    winGlow.material = new THREE.MeshBasicMaterial({ map: t });
  })();
  // muntins (frame bars)
  const barMat = new THREE.MeshStandardMaterial({ color: 0x2c2014, roughness: .7 });
  const barV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.78, 0.06), barMat); winGroup.add(barV);
  const barH = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.07, 0.06), barMat); winGroup.add(barH);
  const winFrame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.9, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: .65 }));
  winFrame.position.z = -0.04; winGroup.add(winFrame);
  winGlow.position.z = 0.01;
  scene.add(winGroup);

  // ============================================================
  //  LIGHTS — warm sunset + incandescent lamp
  // ============================================================
  scene.add(new THREE.HemisphereLight(0xffe0bc, 0x4a3826, 0.85));
  scene.add(new THREE.AmbientLight(0x7a5e40, 0.55));

  // sunset key light streaming from the window
  const sun = new THREE.DirectionalLight(0xffc070, 2.1);
  sun.position.set(-5.5, 3.4, 1.2);
  sun.target.position.set(0, 0.9, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 16;
  sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4;
  sun.shadow.bias = -0.0004; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);

  // cool fill from opposite side for shape
  const fill = new THREE.DirectionalLight(0x8fa6c4, 0.35);
  fill.position.set(3.5, 2.2, 2.5);
  scene.add(fill);

  // incandescent desk lamp light
  const lamp = new THREE.PointLight(0xffca73, 1.4, 6, 2);
  lamp.position.set(0.85, 1.55, 0.35);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.0008;
  scene.add(lamp);

  // ============================================================
  //  PROPS (primitives)
  // ============================================================
  function buildLamp() {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: .5, metalness: .45 });
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: .55, metalness: .3, side: THREE.DoubleSide });
    // weighted base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.03, 28), metal);
    base.position.y = 0.015; g.add(base);
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 16), metal);
    knuckle.position.y = 0.032; g.add(knuckle);
    // single straight pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.38, 16), metal);
    pole.position.y = 0.22; g.add(pole);
    // cone shade sitting on the pole, opening downward (pole enters the shade)
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.17, 30, 1, true), shadeMat);
    shade.position.y = 0.41; g.add(shade);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 14), metal);
    finial.position.y = 0.50; g.add(finial);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffc878, emissiveIntensity: 2.8 }));
    bulb.position.y = 0.37; g.add(bulb);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    return g;
  }

  function buildMug() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xb5402c, roughness: .55 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.13, 24), mat);
    body.castShadow = true; g.add(body);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 10, 20), mat);
    torus.position.set(0.075, 0, 0); torus.rotation.y = Math.PI / 2; torus.castShadow = true; g.add(torus);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.052, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: .3 }));
    coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.058; g.add(coffee);
    return g;
  }

  function buildBooks() {
    const g = new THREE.Group();
    const cols = [0x2f5d50, 0x7a3b2e, 0x33405e, 0x6a5a2c];
    let y = 0;
    for (let i = 0; i < 3; i++) {
      const h = 0.035 + Math.random() * 0.015;
      const w = 0.30 - i * 0.02, d = 0.21 - i * 0.01;
      const bk = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: .8 }));
      bk.position.set((Math.random() - .5) * 0.02, y + h / 2, (Math.random() - .5) * 0.02);
      bk.rotation.y = (Math.random() - .5) * 0.18;
      bk.castShadow = true; bk.receiveShadow = true; g.add(bk);
      y += h;
    }
    return g;
  }

  // poster frame on back wall
  (function buildPoster() {
    const frameM = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: .6 }));
    // cream matte behind the print
    const matte = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.72),
      new THREE.MeshStandardMaterial({ color: 0xd8c6a4, roughness: .9 }));
    matte.position.z = 0.018;
    // the uploaded character cutout (transparent PNG) sits on the matte
    const tex = new THREE.TextureLoader().load("assets/poster.png");
    tex.encoding = THREE.sRGBEncoding;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.345, 0.66),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: .85 }));
    art.position.set(0, -0.01, 0.024);
    const grp = new THREE.Group(); grp.add(frameM); grp.add(matte); grp.add(art);
    grp.position.set(-1.1, 2.05, -2.27);
    scene.add(grp);
  })();

  // ============================================================
  //  LOAD MODELS
  // ============================================================
  const loadMgr = new THREE.LoadingManager();
  const gltf = new THREE.GLTFLoader(loadMgr);
  let comp = null, screenGroup = null, deskObj = null;
  const screenSize = { w: 0.90, h: 0.76 }; // local, pre-scale — full glass extent
  const COMP_SCALE = 0.4;

  // progress -> loader bar
  let pModels = 0;
  function setProgress(p) {
    p = Math.min(100, Math.max(0, p));
    document.getElementById("barFill").style.width = p + "%";
    document.getElementById("pct").textContent = Math.round(p) + "%";
  }
  loadMgr.onProgress = (url, loaded, total) => { setProgress((loaded / total) * 92); };

  function fixMat(o) {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const m = o.material;
    if (m) { m.metalness = 0.0; m.roughness = 0.85; m.transparent = false; m.depthWrite = true; m.emissiveIntensity = 1.0; m.needsUpdate = true; }
  }

  // clean idle screen drawn to a canvas (covers the model's baked terminal text)
  function makeIdleScreen() {
    const c = document.createElement("canvas"); c.width = 760; c.height = 540;
    const x = c.getContext("2d");
    x.fillStyle = "#0a0c07"; x.fillRect(0, 0, 760, 540);
    // soft amber glow center
    const g = x.createRadialGradient(380, 250, 40, 380, 270, 440);
    g.addColorStop(0, "rgba(255,180,90,0.18)"); g.addColorStop(1, "rgba(255,180,90,0)");
    x.fillStyle = g; x.fillRect(0, 0, 760, 540);
    x.textAlign = "center";
    x.fillStyle = "#ffcf94"; x.shadowColor = "rgba(255,180,90,.8)"; x.shadowBlur = 14;
    x.font = "78px 'VT323', monospace"; x.fillText("YELIM HONG", 380, 240);
    x.font = "34px 'VT323', monospace"; x.fillStyle = "#d39a5e";
    x.fillText("software · backend · infra", 380, 292);
    x.shadowBlur = 8; x.fillStyle = "#ffcf94"; x.font = "30px 'VT323', monospace";
    x.fillText("▸ CLICK TO ENTER", 380, 372);
    // scanlines
    x.shadowBlur = 0; x.globalAlpha = 0.22; x.fillStyle = "#000";
    for (let y = 0; y < 540; y += 4) x.fillRect(0, y, 760, 2);
    x.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // "YELIM HONG" label drawn onto the idle screen (far view); covered by the HTML OS when zoomed
  function makeScreenLabel() {
    const W = 900, H = 720;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.clearRect(0, 0, W, H);
    x.textAlign = "center";
    x.fillStyle = "#ffce93"; x.shadowColor = "rgba(255,180,90,.95)"; x.shadowBlur = 22;
    x.font = "700 104px 'VT323', monospace";
    x.fillText("YELIM HONG", W / 2, H / 2 - 26);
    x.shadowBlur = 12; x.fillStyle = "#d79b5e"; x.font = "46px 'VT323', monospace";
    x.fillText("SOFTWARE ENGINEER", W / 2, H / 2 + 34);
    x.fillStyle = "#cf9256"; x.font = "38px 'VT323', monospace";
    x.fillText("backend · infra", W / 2, H / 2 + 80);
    x.fillStyle = "#ffce93"; x.shadowBlur = 14; x.font = "40px 'VT323', monospace";
    x.fillText("▸ CLICK TO ENTER", W / 2, H / 2 + 178);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // desk
  gltf.load("models/deskset.glb", g => {
    const desk = g.scene;
    let deskMesh = null;
    desk.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (o.material) { o.material.roughness = Math.max(o.material.roughness ?? 0.7, 0.55);
        o.material.metalness = Math.min(o.material.metalness ?? 0, 0.35); o.material.side = THREE.DoubleSide; o.material.needsUpdate = true; }
      const mn = (o.material && o.material.name) || "";
      if (mn === "Desk") deskMesh = o;
      else o.visible = false;          // hide Computer + Keyboard
    });
    window.__deskset = desk;
    const ref = deskMesh || desk;
    const dWrap = new THREE.Group();
    dWrap.add(desk);
    dWrap.position.set(0, 0, -0.35);
    scene.add(dWrap);
    // normalize raw model units (must refresh world matrices between each transform)
    dWrap.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(ref);
    const size = new THREE.Vector3(); box.getSize(size);
    const _s = 2.1 / Math.max(size.x, size.z);
    desk.scale.set(-_s, _s, _s);       // mirror left-right
    dWrap.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(ref);
    const c = new THREE.Vector3(); box.getCenter(c);
    // bring to world center-x, floor at y=0 (account for dWrap z offset)
    desk.position.x += -c.x;
    desk.position.y += -box.min.y;
    desk.position.z += (dWrap.position.z - c.z);
    dWrap.updateMatrixWorld(true);
    dWrap.rotation.y = Math.PI;         // drawer/front side faces the chair (rotate in place)
    dWrap.updateMatrixWorld(true);
    deskObj = deskMesh || dWrap;       // raycast surface against the desk mesh only
    window.__deskTopY = new THREE.Box3().setFromObject(ref).max.y;
    placeComputerIfReady();
  });

  // computer
  gltf.load("models/retro_computer.glb", g => {
    comp = new THREE.Group();
    const m = g.scene;
    // load the cleaned screen textures (alien glyphs painted out of the model's own maps)
    const texL = new THREE.TextureLoader();
    const cleanBase = texL.load("models/tex/screen_base.png");
    const cleanEmis = texL.load("models/tex/screen_emis.png");
    m.traverse(o => {
      if (!o.isMesh) return;
      fixMat(o);
      const mat = o.material;
      if (mat && mat.map && mat.emissiveMap && mat.name === "Part1") {
        const om = mat.map, oe = mat.emissiveMap;
        [cleanBase, cleanEmis].forEach((t, idx) => {
          const src = idx === 0 ? om : oe;
          t.flipY = src.flipY; t.encoding = src.encoding;
          t.wrapS = src.wrapS; t.wrapT = src.wrapT;
          t.repeat.copy(src.repeat); t.offset.copy(src.offset);
          t.needsUpdate = true;
        });
        mat.map = cleanBase; mat.emissiveMap = cleanEmis; mat.needsUpdate = true;
      }
    });
    comp.add(m);
    comp.scale.setScalar(COMP_SCALE);
    comp.rotation.y = -Math.PI / 2;  // screen faces +z

    // invisible screen anchor (drives camera zoom + CRT overlay alignment)
    screenGroup = new THREE.Group();
    screenGroup.position.set(0.25, 0.24, 0);  // between glass front and bezel rim (visible, inset)
    screenGroup.rotation.y = Math.PI / 2;        // its +z -> model +x (screen normal)
    const labelMat = new THREE.MeshBasicMaterial({ map: makeScreenLabel(), transparent: true, toneMapped: false, depthWrite: false });
    const anchorPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(screenSize.w, screenSize.h),
      labelMat
    );
    anchorPlane.position.z = 0.002;
    screenGroup.add(anchorPlane);
    window.__screenLabel = anchorPlane;
    m.add(screenGroup);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { labelMat.map = makeScreenLabel(); labelMat.needsUpdate = true; });
    }

    scene.add(comp);
    placeComputerIfReady();
  });

  // office chair (in front of the desk, facing it)
  let chair = null;
  gltf.load("models/chair.glb", g => {
    chair = new THREE.Group();
    const m = g.scene;
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (o.material) { o.material.metalness = Math.min(o.material.metalness ?? 0, 0.3); o.material.needsUpdate = true; } } });
    // normalize: center xz, base on floor, scale to a realistic height
    let box = new THREE.Box3().setFromObject(m);
    const size = new THREE.Vector3(); box.getSize(size);
    const s = 1.5 / size.y;            // target height to match the desk/room scale
    m.scale.setScalar(s);
    box = new THREE.Box3().setFromObject(m);
    const c = new THREE.Vector3(); box.getCenter(c);
    m.position.set(-c.x, -box.min.y, -c.z);
    chair.add(m);
    chair.position.set(-0.28, 0, 0.80);  // in front of the desk, off to one side
    chair.rotation.y = Math.PI - 0.55;   // angled, not dead-on
    scene.add(chair);
    window.__chair = chair;
  });

  function placeComputerIfReady() {
    if (!comp || window.__deskTopY == null) return;
    // sit computer bottom on desk top, pushed back so the keyboard rests on the surface
    comp.position.set(0, 0, -0.30);
    const b = new THREE.Box3().setFromObject(comp);
    comp.position.set(0, surfaceY(0, -0.20) - b.min.y, -0.30);
    refreshHome();
  }

  function refreshHome() {
    if (!screenGroup) return;
    const sc = new THREE.Vector3(); screenGroup.getWorldPosition(sc);
    HOME.target.set(0, sc.y - 0.12, -0.05);
    if (!entered) { camera.position.copy(HOME.pos); controls.target.copy(HOME.target); }
  }

  // raycast straight down to find the real desk surface height at (x,z)
  const _downRay = new THREE.Raycaster();
  function surfaceY(x, z) {
    if (!deskObj) return window.__deskTopY != null ? window.__deskTopY : 0.78;
    _downRay.set(new THREE.Vector3(x, 4, z), new THREE.Vector3(0, -1, 0));
    const hits = _downRay.intersectObject(deskObj, true);
    return hits.length ? hits[0].point.y : (window.__deskTopY != null ? window.__deskTopY : 0.78);
  }

  // place lamp / mug / books on the desk once we know its top
  loadMgr.onLoad = () => {
    const lampObj = buildLamp();
    const ly = surfaceY(0.7, -0.12);
    lampObj.position.set(0.7, ly, -0.12); scene.add(lampObj);
    lamp.position.set(0.7, ly + 0.37, -0.12);
    const mug = buildMug(); mug.position.set(-0.5, surfaceY(-0.5, -0.04) + 0.065, -0.04); scene.add(mug);
    const books = buildBooks(); books.position.set(-0.66, surfaceY(-0.66, -0.24), -0.24); scene.add(books);
    refreshHome();
    setProgress(100);
    document.getElementById("status").textContent = "READY";
    const enter = document.getElementById("enterBtn");
    enter.disabled = false;
    enter.addEventListener("click", enterScene);
    // allow Enter key
    window.addEventListener("keydown", e => {
      if (e.key === "Enter" && !entered && !enter.disabled) enterScene();
    });
    if (location.hash.indexOf("auto") >= 0) setTimeout(enterScene, 60);
  };

  // ============================================================
  //  ENTER / ZOOM
  // ============================================================
  let entered = false;
  let mode = "orbit"; // orbit | toScreen | screen | toHome
  const tween = { active: false, t: 0, dur: 1.15, fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(),
    fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3(), onDone: null };

  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function startTween(toPos, toTgt, dur, onDone) {
    tween.fromPos.copy(camera.position);
    tween.fromTgt.copy(controls.target);
    tween.toPos.copy(toPos); tween.toTgt.copy(toTgt);
    tween.t = 0; tween.dur = dur || 1.15; tween.active = true; tween.onDone = onDone || null;
  }

  function enterScene() {
    if (entered) return; entered = true;
    document.getElementById("loader").classList.add("gone");
    document.body.classList.add("entered");
    if (location.hash.indexOf("auto") >= 0) {       // verification helper
      const st = document.getElementById("stage"); st.style.transition = "none"; st.style.opacity = "1";
      document.getElementById("loader").style.display = "none";
      controls.enabled = true; return;
    }
    setTimeout(() => { controls.enabled = true; }, 1100);
  }

  // screen world frame helpers
  const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3();
  function screenFrame() {
    screenGroup.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3().setFromMatrixPosition(screenGroup.matrixWorld);
    const nrm = new THREE.Vector3(0, 0, 1).transformDirection(screenGroup.matrixWorld).normalize();
    const up = new THREE.Vector3(0, 1, 0).transformDirection(screenGroup.matrixWorld).normalize();
    const right = new THREE.Vector3(1, 0, 0).transformDirection(screenGroup.matrixWorld).normalize();
    return { wp, nrm, up, right, w: screenSize.w * COMP_SCALE, h: screenSize.h * COMP_SCALE };
  }

  function arriveScreen() {
    mode = "screen";
    camera.up.set(0, 1, 0);
    const f2 = screenFrame();
    const D2 = f2.h / (2 * 0.66 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    camera.position.copy(f2.wp.clone().add(f2.nrm.clone().multiplyScalar(D2)));
    camera.lookAt(f2.wp);
    Desktop.mount(crtScreen);
    alignCRT();
    crt.classList.add("live"); crt.setAttribute("aria-hidden", "false");
    backBtn.hidden = false;
    Desktop.boot();
  }

  function zoomToScreen() {
    if (mode !== "orbit") return;
    const f = screenFrame();
    const D = f.h / (2 * 0.66 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const toPos = f.wp.clone().add(f.nrm.clone().multiplyScalar(D));
    controls.enabled = false;
    mode = "toScreen";
    startTween(toPos, f.wp.clone(), 1.2, arriveScreen);
  }

  function zoomHome() {
    if (mode !== "screen") return;
    crt.classList.remove("live"); crt.setAttribute("aria-hidden", "true");
    backBtn.hidden = true;
    mode = "toHome";
    startTween(HOME.pos.clone(), HOME.target.clone(), 1.05, () => {
      mode = "orbit"; controls.enabled = true;
      controls.target.copy(HOME.target);
    });
  }

  // align the #crt overlay rect to the projected screen quad (head-on => AABB)
  function alignCRT() {
    if (!screenGroup) return;
    camera.updateMatrixWorld(true);
    const f = screenFrame();
    const hw = f.w / 2, hh = f.h / 2;
    const corners = [
      f.wp.clone().add(f.right.clone().multiplyScalar(-hw)).add(f.up.clone().multiplyScalar(hh)),
      f.wp.clone().add(f.right.clone().multiplyScalar(hw)).add(f.up.clone().multiplyScalar(hh)),
      f.wp.clone().add(f.right.clone().multiplyScalar(hw)).add(f.up.clone().multiplyScalar(-hh)),
      f.wp.clone().add(f.right.clone().multiplyScalar(-hw)).add(f.up.clone().multiplyScalar(-hh))
    ];
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    corners.forEach(c => {
      const v = c.clone().project(camera);
      const sx = (v.x * 0.5 + 0.5) * innerWidth;
      const sy = (-v.y * 0.5 + 0.5) * innerHeight;
      minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
    });
    crt.style.left = minX + "px";
    crt.style.top = minY + "px";
    crt.style.width = (maxX - minX) + "px";
    crt.style.height = (maxY - minY) + "px";
  }

  // ============================================================
  //  INTERACTION
  // ============================================================
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downXY = null;
  renderer.domElement.addEventListener("pointerdown", e => { downXY = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", e => {
    if (!downXY) return;
    const moved = Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]);
    downXY = null;
    if (moved > 6 || mode !== "orbit" || !comp) return; // it was a drag
    ndc.x = (e.clientX / innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(comp, true).length) zoomToScreen();
  });
  // hover cursor over the monitor
  renderer.domElement.addEventListener("pointermove", e => {
    if (mode !== "orbit" || !comp) { return; }
    ndc.x = (e.clientX / innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    renderer.domElement.style.cursor = ray.intersectObject(comp, true).length ? "pointer" : "grab";
  });

  backBtn.addEventListener("click", zoomHome);
  window.addEventListener("keydown", e => { if (e.key === "Escape" && mode === "screen") zoomHome(); });

  // ============================================================
  //  AMBIENCE (optional)
  // ============================================================
  let audio = null, audioOn = false;
  soundBtn.addEventListener("click", () => {
    if (!audio) initAudio();
    audioOn = !audioOn;
    audio.gain.gain.linearRampToValueAtTime(audioOn ? 0.05 : 0.0001, audio.ctx.currentTime + 0.6);
    soundBtn.querySelector("span").textContent = audioOn ? "ON" : "OFF";
    if (audioOn && audio.ctx.state === "suspended") audio.ctx.resume();
  });
  function initAudio() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain(); gain.gain.value = 0.0001; gain.connect(ctx.destination);
    // warm hum: two detuned low oscillators + soft filtered noise
    const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = 58;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = 87.2;
    const og = ctx.createGain(); og.gain.value = 0.35; o1.connect(og); o2.connect(og);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 320;
    og.connect(lp); lp.connect(gain);
    const bufSize = 2 * ctx.sampleRate;
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = "lowpass"; nf.frequency.value = 600;
    const ng = ctx.createGain(); ng.gain.value = 0.12; noise.connect(nf); nf.connect(ng); ng.connect(gain);
    o1.start(); o2.start(); noise.start();
    audio = { ctx, gain };
  }

  // ============================================================
  //  RENDER LOOP
  // ============================================================
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = clock.getDelta();
    if (tween.active) {
      tween.t += dt / tween.dur;
      const k = easeInOut(Math.min(1, tween.t));
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromTgt, tween.toTgt, k);
      camera.lookAt(controls.target);
      if (tween.t >= 1) { tween.active = false; if (tween.onDone) tween.onDone(); }
    } else if (mode === "orbit") {
      controls.update();
    } else if (mode === "screen") {
      alignCRT();
    }
    // gentle lamp flicker
    lamp.intensity = 1.32 + Math.sin(clock.elapsedTime * 7.3) * 0.03 + Math.sin(clock.elapsedTime * 2.1) * 0.04;
    renderer.render(scene, camera);
  }
  frame();
  // expose for verification screenshots (rAF throttles in bg iframes)
  window.__render = () => renderer.render(scene, camera);
  window.__zoom = zoomToScreen; window.__home = zoomHome;
  window.__forceScreen = () => { mode = "orbit"; controls.enabled = false; arriveScreen(); renderer.render(scene, camera); };
  window.__dbg = { camera, controls, get comp() { return comp; }, get sg() { return screenGroup; }, screenFrame, scene, COMP_SCALE };

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (mode === "screen") alignCRT();
  });

  // if the tab was backgrounded mid-transition, rAF/timers freeze — snap to done on return
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    clock.getDelta();              // discard the huge accumulated delta
    if (tween.active) tween.t = 1; // finish any frozen camera move cleanly next frame
  });
})();
