/* =====================================================================
   TWEAKS — vanilla panel speaking the host edit-mode protocol.
   Controls: accent color, depth-scroll strength. Persists to localStorage.
   ===================================================================== */
(function () {
  'use strict';

  const DEFAULTS = { accent: '#5383E8', depth: 1180 };
  const LS = 'yelim_tweaks_v2';
  let values = Object.assign({}, DEFAULTS);
  try { Object.assign(values, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}

  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }
  function shade(hex, pct) {
    let n = parseInt(hex.slice(1), 16), r = (n>>16)&255, g = (n>>8)&255, b = n&255, f = pct/100;
    r = Math.round(Math.min(255, Math.max(0, r + r*f)));
    g = Math.round(Math.min(255, Math.max(0, g + g*f)));
    b = Math.round(Math.min(255, Math.max(0, b + b*f)));
    return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }

  function apply(key) {
    const r = document.documentElement;
    if (key === 'accent') {
      r.style.setProperty('--accent', values.accent);
      r.style.setProperty('--accent-strong', shade(values.accent, -14));
      r.style.setProperty('--accent-50', hexA(values.accent, .5));
      r.style.setProperty('--accent-20', hexA(values.accent, .2));
      r.style.setProperty('--accent-08', hexA(values.accent, .08));
    }
    if (key === 'depth' && window.DepthScene) window.DepthScene.setGap(values.depth);
  }
  function applyAll() { Object.keys(values).forEach(apply); }

  function setVal(key, v) {
    values[key] = v;
    try { localStorage.setItem(LS, JSON.stringify(values)); } catch (e) {}
    apply(key);
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: v } }, '*'); } catch (e) {}
  }

  const css = `
  .tw-panel{position:fixed;right:18px;bottom:90px;width:278px;z-index:9998;
    background:rgba(255,255,255,.93);backdrop-filter:blur(14px) saturate(160%);
    -webkit-backdrop-filter:blur(14px) saturate(160%);border:1px solid #E6E8EC;
    border-radius:16px;box-shadow:0 18px 50px rgba(11,13,18,.18);font-family:var(--font);
    color:#0B0D12;transform:translateY(14px) scale(.98);opacity:0;pointer-events:none;
    transition:opacity .26s,transform .26s;overflow:hidden;cursor:auto;}
  .tw-panel.open{opacity:1;transform:none;pointer-events:auto;}
  .tw-head{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid #EEF0F3;cursor:grab;}
  .tw-head.drag{cursor:grabbing;}
  .tw-head h4{font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;}
  .tw-head .x{font-size:18px;line-height:1;color:#9099A4;cursor:pointer;padding:2px 4px;}
  .tw-head .x:hover{color:#5383E8;}
  .tw-body{padding:16px 18px 20px;display:flex;flex-direction:column;gap:18px;}
  .tw-row .lbl{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#5C636E;margin-bottom:9px;display:flex;justify-content:space-between;}
  .tw-row .lbl b{color:var(--accent);font-weight:700;}
  .tw-swatch{display:flex;gap:8px;}
  .tw-swatch button{width:30px;height:30px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #E0E3E8;cursor:pointer;transition:.15s;}
  .tw-swatch button.on{box-shadow:0 0 0 2px #0B0D12;transform:scale(1.08);}
  .tw-range{width:100%;-webkit-appearance:none;appearance:none;height:4px;border-radius:4px;background:#E0E3E8;outline:none;cursor:pointer;}
  .tw-range::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--accent);cursor:pointer;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.2);}
  .tw-range::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--accent);cursor:pointer;border:2px solid #fff;}
  .tw-hint{font-size:11px;color:#9099A4;line-height:1.5;}
  @media(max-width:560px){.tw-panel{right:10px;left:10px;width:auto;bottom:120px;}}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'tw-panel';
  panel.innerHTML = `
    <div class="tw-head" id="twHead"><h4>Tweaks</h4><span class="x" id="twClose">✕</span></div>
    <div class="tw-body">
      <div class="tw-row">
        <div class="lbl">액센트 컬러</div>
        <div class="tw-swatch" id="twAccent"></div>
      </div>
      <div class="tw-row">
        <div class="lbl">깊이감 <b id="twDepthVal"></b></div>
        <input type="range" class="tw-range" id="twDepth" min="700" max="1700" step="20">
      </div>
      <div class="tw-hint">스크롤하면 섹션이 안쪽에서 앞으로 다가옵니다. ▶ PLAY MUSIC 으로 선택 음원 재생, “+ 내 음원”에 mp3 업로드 가능.</div>
    </div>`;
  document.body.appendChild(panel);

  const ACCENTS = ['#5383E8', '#7B5BE8', '#0B0D12', '#F2724B', '#3FB97A', '#E85E8A'];
  const accWrap = panel.querySelector('#twAccent');
  ACCENTS.forEach(c => {
    const b = document.createElement('button');
    b.style.background = c; b.dataset.v = c;
    b.addEventListener('click', () => { setVal('accent', c); syncAccent(); });
    accWrap.appendChild(b);
  });
  function syncAccent() { accWrap.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === values.accent)); }

  const dep = panel.querySelector('#twDepth');
  const depVal = panel.querySelector('#twDepthVal');
  dep.addEventListener('input', () => { setVal('depth', parseInt(dep.value)); depVal.textContent = dep.value + 'px'; });
  function syncDepth() { dep.value = values.depth; depVal.textContent = values.depth + 'px'; }

  function syncAll() { syncAccent(); syncDepth(); }

  // host protocol
  let open = false;
  function setOpen(o) { open = o; panel.classList.toggle('open', o); }
  panel.querySelector('#twClose').addEventListener('click', () => {
    setOpen(false);
    try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch (e) {}
  });
  window.addEventListener('message', e => {
    const t = e && e.data && e.data.type;
    if (t === '__activate_edit_mode') setOpen(true);
    else if (t === '__deactivate_edit_mode') setOpen(false);
  });
  try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (e) {}

  // drag
  (function drag() {
    const head = panel.querySelector('#twHead');
    let sx, sy, ox, oy, dragging = false;
    head.addEventListener('mousedown', e => {
      if (e.target.id === 'twClose') return;
      dragging = true; head.classList.add('drag');
      const r = panel.getBoundingClientRect();
      ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
      panel.style.left = ox + 'px'; panel.style.top = oy + 'px';
      e.preventDefault();
    });
    addEventListener('mousemove', e => { if (!dragging) return; panel.style.left = (ox + e.clientX - sx) + 'px'; panel.style.top = (oy + e.clientY - sy) + 'px'; });
    addEventListener('mouseup', () => { dragging = false; head.classList.remove('drag'); });
  })();

  applyAll(); syncAll();
})();
