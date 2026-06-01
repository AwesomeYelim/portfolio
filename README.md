# Yelim Hong — Portfolio

**Live site:** https://hongyelim.namo.site

Three.js r128 기반 레트로 방 씬 포트폴리오.  
CRT 모니터 줌인 → 레트로 OS UI 진입 플로우.

## Structure

```
index.html          entry point
css/
  room.css          3D stage, loader, chrome
  desktop.css       CRT overlay, desktop OS UI
js/
  scene.js          Three.js room scene (chair, deskset, retro_computer GLB)
  desktop.js        CRT OS desktop UI (icons, windows, taskbar)
models/
  chair.glb
  deskset.glb
  retro_computer.glb
  tex/
    screen_base.png
    screen_emis.png
assets/
  poster.png
```

## Deploy

Hosted on [namo.site](https://namo.site) via SiteBuilder MCP.  
Assets served from jsDelivr CDN: `https://cdn.jsdelivr.net/gh/AwesomeYelim/portfolio@master/`
