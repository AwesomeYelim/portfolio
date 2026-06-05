// Deploy the portfolio to namo.site (SiteBuilder) on git push.
//
// Two-track deploy, matching how the live site actually loads things:
//   1. js/ + models/ + assets/  -> served live from jsDelivr CDN (@master).
//      A push already updates them; we only PURGE the CDN cache so the change
//      is visible within seconds instead of waiting for the ~12h TTL.
//   2. css/ + index.html body    -> stored inside SiteBuilder. We push these
//      via the SiteBuilder MCP (JSON-RPC over HTTP). NOTE: these go into an
//      ADMIN APPROVAL queue — they are submitted, not instantly live.
//
// Env:
//   SB_URL      MCP endpoint (default: the sunbisites cloud function)
//   SB_TOKEN    Bearer token            (required for CSS/HTML sync)
//   SB_SITE_ID  X-Site-Id header        (required for CSS/HTML sync)
//   SB_PAGE_ID  page id to update HTML on (required for HTML sync)
//   GH_REPO     "owner/repo" for jsDelivr/purge (default AwesomeYelim/portfolio)
//   GH_BRANCH   branch for jsDelivr      (default master)
//   CHANGED     newline/space list of changed paths; "ALL" (or empty) = sync everything

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SB_URL = process.env.SB_URL || "https://asia-northeast3-sunbisites.cloudfunctions.net/mcp_code_server";
const SB_TOKEN = process.env.SB_TOKEN || "";
const SB_SITE_ID = process.env.SB_SITE_ID || "";
const SB_PAGE_ID = process.env.SB_PAGE_ID || "";
const GH_REPO = process.env.GH_REPO || "AwesomeYelim/portfolio";
const GH_BRANCH = process.env.GH_BRANCH || "master";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- changed-file detection -------------------------------------------------
const rawChanged = (process.env.CHANGED || "").trim();
const ALL = !rawChanged || rawChanged.toUpperCase() === "ALL";
const changed = ALL ? [] : rawChanged.split(/[\s,]+/).filter(Boolean);
const touched = (prefix) => ALL || changed.some((f) => f.startsWith(prefix));

// --- MCP JSON-RPC client (stateless; no session handshake needed) -----------
let rpcId = 1;
async function mcp(name, args) {
  if (!SB_TOKEN || !SB_SITE_ID) {
    throw new Error("SB_TOKEN and SB_SITE_ID are required for SiteBuilder sync.");
  }
  const res = await fetch(SB_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SB_TOKEN}`,
      "X-Site-Id": SB_SITE_ID,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method: "tools/call", params: { name, arguments: args } }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${name}: non-JSON response (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  if (json.error) throw new Error(`${name}: ${json.error.message || JSON.stringify(json.error)}`);
  return json.result;
}

// --- jsDelivr cache purge ---------------------------------------------------
async function purge(files) {
  for (const f of files) {
    const url = `https://purge.jsdelivr.net/gh/${GH_REPO}@${GH_BRANCH}/${f}`;
    try {
      const r = await fetch(url);
      console.log(`  purge ${f} -> ${r.status}`);
    } catch (e) {
      console.warn(`  purge ${f} FAILED: ${e.message}`);
    }
  }
}

// --- CSS sync: concatenate the two stylesheets the way the site stores them --
async function syncCss() {
  const room = await readFile(path.join(root, "css/room.css"), "utf8");
  const desktop = await readFile(path.join(root, "css/desktop.css"), "utf8");
  const css = `/* === room.css === */\n${room}\n\n/* === desktop.css === */\n${desktop}\n`;
  await mcp("update_site_css", { css });
  console.log("  update_site_css submitted (pending admin approval)");
}

// --- HTML sync: inner <body> content, scripts stripped ----------------------
// SiteBuilder stores inner-body only and disallows <script>/<style>/<head>.
// The repo is the source of truth, so this may revert any in-console hand-edits.
async function syncHtml() {
  const raw = await readFile(path.join(root, "index.html"), "utf8");
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) throw new Error("index.html: <body> not found");
  const html = bodyMatch[1].replace(/[\t ]*<script\b[\s\S]*?<\/script>\s*/gi, "").trim();
  await mcp("update_page_html", { pageId: SB_PAGE_ID, html });
  console.log("  update_page_html submitted (pending admin approval)");
}

// --- run --------------------------------------------------------------------
const summary = [];
console.log(`Deploy: ${ALL ? "ALL files" : changed.join(", ")}`);

// 1. CDN-backed assets — purge so push is live in seconds.
const cdnFiles = [];
if (ALL) {
  cdnFiles.push("js/scene.js", "js/desktop.js");
} else {
  for (const f of changed) {
    if (f.startsWith("js/") || f.startsWith("models/") || f.startsWith("assets/")) cdnFiles.push(f);
  }
}
if (cdnFiles.length) {
  console.log("jsDelivr purge:");
  await purge(cdnFiles);
  summary.push(`purged ${cdnFiles.length} CDN file(s)`);
}

// 2. SiteBuilder-stored CSS/HTML — submit for approval.
if (touched("css/")) {
  console.log("Sync CSS:");
  await syncCss();
  summary.push("CSS submitted");
}
if (touched("index.html")) {
  if (!SB_PAGE_ID) {
    console.warn("index.html changed but SB_PAGE_ID is unset — skipping HTML sync.");
  } else {
    console.log("Sync HTML:");
    await syncHtml();
    summary.push("HTML submitted");
  }
}

console.log(`\nDone: ${summary.length ? summary.join("; ") : "nothing to do"}.`);
if (summary.some((s) => s.includes("submitted"))) {
  console.log("Note: CSS/HTML changes await admin approval before going live.");
}
