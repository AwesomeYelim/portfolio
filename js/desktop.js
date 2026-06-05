/* ============================================================
   CRT desktop OS — runs inside #crt-screen, shown when zoomed in
   ============================================================ */
(function () {
  const APPS = {
    intro: {
      glyph: "01", label: "Intro.txt", title: "intro.txt",
      x: 18, y: 16, w: 50, h: 60,
      body: `
        <div class="kicker">01 — Intro</div>
        <div class="h1">YELIM HONG<br><span class="dim" style="font-size:.62em;letter-spacing:.18em">홍예림</span></div>
        <p class="lead">복잡한 문제를 <span class="em">구조화</span>하고, 이를
        <span class="em">안정적인 시스템</span>으로 구현하는 백엔드 · 인프라 엔지니어.</p>
        <p>아키텍처 · DevOps · 자동화 · 클라우드를 탐구합니다. 서비스가 조용히,
        오래, 잘 굴러가게 만드는 일에 마음이 갑니다.</p>
        <hr>
        <div class="contact-row"><span class="k">Role</span><span>Software Engineer · Backend / Infra</span></div>
        <div class="contact-row"><span class="k">Based</span><span>Seoul, Korea</span></div>
        <div class="contact-row"><span class="k">Status</span><span class="em">▸ open to work</span></div>
      `
    },
    about: {
      glyph: "02", label: "About.md", title: "about.md",
      x: 26, y: 12, w: 52, h: 70,
      body: `
        <div class="kicker">02 — About</div>
        <div class="h1">기술의 원리부터<br>파고듭니다</div>
        <p class="lead">서비스의 기능뿐 아니라 <span class="em">운영 안정성 · 확장성 · 유지보수성</span>까지
        고려하는 엔지니어링 관점을 지향합니다.</p>
        <p>기술의 원리와 동작 방식을 깊이 이해하고, 다양한 기술 영역을 연결해
        실질적인 문제를 해결하는 데 가치를 둡니다.</p>
        <div class="h2">// 핵심 강점</div>
        <ul class="list">
          <li><span class="num">1.</span><span><span class="em">구조화 (Structure)</span> — 얽힌 요구사항을 명확한 도메인과 흐름으로 설계.</span></li>
          <li><span class="num">2.</span><span><span class="em">운영 안정성 (Reliability)</span> — 장애 대응 · 확장성 · 유지보수성까지 고려.</span></li>
          <li><span class="num">3.</span><span><span class="em">자동화 (Automation)</span> — 반복 작업과 배포 파이프라인을 자동화.</span></li>
          <li><span class="num">4.</span><span><span class="em">깊은 이해 (Depth)</span> — 도구를 넘어 원리와 동작 방식까지 탐구.</span></li>
        </ul>
      `
    },
    stack: {
      glyph: "03", label: "Stack.cfg", title: "stack.cfg",
      x: 30, y: 18, w: 50, h: 62,
      body: `
        <div class="kicker">03 — Stack</div>
        <div class="h1">도구 상자</div>
        <div class="stack-grp"><div class="lbl">Backend</div>
          <div class="chips"><span class="chip">Go</span><span class="chip">gRPC</span><span class="chip">Node.js</span><span class="chip">REST</span></div></div>
        <div class="stack-grp"><div class="lbl">Frontend</div>
          <div class="chips"><span class="chip">TypeScript</span><span class="chip">React</span><span class="chip">Next.js</span></div></div>
        <div class="stack-grp"><div class="lbl">Data</div>
          <div class="chips"><span class="chip">PostgreSQL</span><span class="chip">MySQL</span><span class="chip">Redis</span><span class="chip">Prisma</span></div></div>
        <div class="stack-grp"><div class="lbl">Infra · DevOps</div>
          <div class="chips"><span class="chip">Docker</span><span class="chip">Nginx</span><span class="chip">GitHub Actions</span><span class="chip">Oracle Cloud</span></div></div>
      `
    },
    contact: {
      glyph: "04", label: "Contact", title: "contact.exe",
      x: 32, y: 22, w: 46, h: 50,
      body: `
        <div class="kicker">04 — Contact</div>
        <div class="big-cta">LET'S WORK<br>TOGETHER.</div>
        <div class="contact-row"><span class="k">Email</span><a id="mailLink" href="mailto:ylhong@ssrinc.co.kr">ylhong@ssrinc.co.kr</a></div>
        <div class="contact-row"><span class="k">Location</span><span>Seoul, Korea</span></div>
        <hr>
        <p class="dim">새로운 시스템을 함께 설계할 분을 기다립니다. 메일은 환영입니다.</p>
      `
    }
  };
  const ORDER = ["intro", "about", "stack", "contact"];

  let screen = null, winLayer = null, taskItems = {}, zTop = 30, booted = false;
  const openWins = {}; // id -> {el, body}

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function mount(screenEl) {
    if (screen) return;
    screen = screenEl;

    // menubar
    const mb = el("div", "menubar");
    mb.innerHTML = `<span class="mb-logo">◆ YH/OS</span>
      <span class="mb-item">File</span><span class="mb-item">View</span><span class="mb-item">Help</span>
      <span class="mb-spacer"></span><span class="mb-clock" id="mbClock">--:--</span>`;
    screen.appendChild(mb);

    // icons
    const icons = el("div", "icons");
    ORDER.forEach(id => {
      const a = APPS[id];
      const ic = el("div", "icon");
      ic.dataset.app = id;
      ic.innerHTML = `<div class="icon-glyph">${a.glyph}</div><div class="icon-label">${a.label}</div>`;
      ic.addEventListener("click", () => { window.__click && window.__click(); selectIcon(ic); openWindow(id); });
      ic.addEventListener("dblclick", () => openWindow(id));
      icons.appendChild(ic);
    });
    screen.appendChild(icons);

    // window layer
    winLayer = el("div", "win-layer");
    winLayer.style.cssText = "position:absolute;inset:0;z-index:20;pointer-events:none;";
    screen.appendChild(winLayer);

    // taskbar
    const tb = el("div", "taskbar");
    let tasksHtml = "";
    ORDER.forEach(id => { tasksHtml += `<span class="task" data-task="${id}">${APPS[id].title}</span>`; });
    tb.innerHTML = tasksHtml + `<span class="ts-sp"></span><span class="ts-net">▮▮▮ ONLINE</span>`;
    screen.appendChild(tb);
    tb.querySelectorAll(".task").forEach(t => {
      t.addEventListener("click", () => { window.__click && window.__click(); toggleWindow(t.dataset.task); });
      taskItems[t.dataset.task] = t;
    });

    clock();
    setInterval(clock, 1000 * 15);
  }

  function clock() {
    const c = document.getElementById("mbClock");
    if (!c) return;
    const d = new Date();
    c.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function selectIcon(ic) {
    screen.querySelectorAll(".icon").forEach(i => i.classList.remove("sel"));
    if (ic) ic.classList.add("sel");
  }

  function toggleWindow(id) { openWins[id] ? closeWindow(id) : openWindow(id); }

  function closeAllExcept(keepId) {
    Object.keys(openWins).forEach(k => {
      if (k === keepId) return;
      const w = openWins[k]; delete openWins[k];
      if (taskItems[k]) taskItems[k].classList.remove("on");
      if (w) w.remove();
    });
  }

  function openWindow(id) {
    const a = APPS[id];
    if (openWins[id]) { focusWindow(id); return; }
    closeAllExcept();                       // single-window mode: only one open at a time
    selectIcon(screen.querySelector('.icon[data-app="' + id + '"]'));
    const w = el("div", "win");
    w.dataset.app = id;
    // unified placement so the window always sits neatly inside the screen, beside the icons
    w.style.left = "25%"; w.style.top = "11%";
    w.style.width = "71%"; w.style.maxHeight = "80%";
    w.innerHTML =
      `<div class="win-bar"><span class="win-title">${a.title}</span><span class="win-bar-sp"></span><span class="win-close">×</span></div>
       <div class="win-body">${a.body}</div>`;
    winLayer.appendChild(w);
    openWins[id] = w;
    if (taskItems[id]) taskItems[id].classList.add("on");
    w.querySelector(".win-close").addEventListener("click", e => { e.stopPropagation(); window.__click && window.__click(); closeWindow(id); });
    w.addEventListener("pointerdown", () => focusWindow(id));
    makeDraggable(w, w.querySelector(".win-bar"));
    focusWindow(id);
    // open animation
    w.animate(
      [{ transform: "scale(.9)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
      { duration: 170, easing: "ease-out" }
    );
  }

  function closeWindow(id) {
    const w = openWins[id]; if (!w) return;
    delete openWins[id];
    if (taskItems[id]) taskItems[id].classList.remove("on");
    w.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(.95)" }], { duration: 130, easing: "ease-in" })
      .onfinish = () => w.remove();
  }

  function focusWindow(id) {
    const w = openWins[id]; if (!w) return;
    Object.values(openWins).forEach(x => x.classList.remove("front"));
    w.classList.add("front");
    w.style.zIndex = ++zTop;
  }

  function makeDraggable(win, handle) {
    let sx, sy, ox, oy, rect, parent;
    handle.addEventListener("pointerdown", e => {
      if (e.target.classList.contains("win-close")) return;
      e.preventDefault();
      parent = screen.getBoundingClientRect();
      rect = win.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY;
      ox = rect.left - parent.left; oy = rect.top - parent.top;
      handle.setPointerCapture(e.pointerId);
      const move = ev => {
        let nx = ox + (ev.clientX - sx);
        let ny = oy + (ev.clientY - sy);
        nx = Math.max(-rect.width * 0.4, Math.min(nx, parent.width - rect.width * 0.6));
        ny = Math.max(parent.height * 0.07, Math.min(ny, parent.height - 28));
        win.style.left = (nx / parent.width * 100) + "%";
        win.style.top = (ny / parent.height * 100) + "%";
      };
      const up = ev => {
        handle.releasePointerCapture(e.pointerId);
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }

  /* ---------- boot sequence ---------- */
  const BOOT_LINES = [
    ["YH/OS v2.6   (c) 1986 YELIM HONG SYSTEMS", ""],
    ["MEMORY TEST ......................... ", "OK"],
    ["MOUNT /dev/portfolio ................ ", "OK"],
    ["LOAD backend.module ................. ", "OK"],
    ["LOAD infra.daemon ................... ", "OK"],
    ["INIT automation.pipeline ............ ", "OK"],
    ["", ""],
    ["READY.", ""]
  ];

  function boot(onDone) {
    if (booted) { if (onDone) onDone(); return; }
    const b = el("div", "boot");
    screen.appendChild(b);
    let li = 0, buf = "";
    function nextLine() {
      if (li >= BOOT_LINES.length) {
        booted = true;
        setTimeout(() => {
          b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280 }).onfinish = () => b.remove();
          selectIcon(screen.querySelector('.icon[data-app="intro"]'));
          openWindow("intro");
          if (onDone) onDone();
        }, 380);
        return;
      }
      const [pre, ok] = BOOT_LINES[li];
      buf += pre + (ok ? `<span class="ok">${ok}</span>` : "") + "\n";
      b.innerHTML = buf + '<span class="cur"></span>';
      li++;
      setTimeout(nextLine, pre === "" ? 90 : 150);
    }
    nextLine();
  }

  window.Desktop = { mount, boot, openWindow, isBooted: () => booted };
})();
