/* =========================================================
   sw.js — service worker for the installable app (PWA)
   ---------------------------------------------------------
   Only caches the app's own files (HTML/CSS/JS/icons) and the
   pinned CDN libraries. It never touches, caches or rewrites
   Firebase / Firestore requests — your data
   keeps flowing exactly as before.

   When you upload changed files to GitHub, bump VERSION so
   installed copies drop their old cache.
   ========================================================= */
const VERSION = "inv-v2";
const APP_CACHE = VERSION + "-app";
const CDN_CACHE = VERSION + "-cdn";

const SCOPE_PATH = new URL(self.registration.scope).pathname;

const APP_SHELL = [
  "./", "index.html", "pin-reset.html", "style.css", "pwa.js", "ui.js", "pin.js", "app.js",
  "firebase-config.js", "signature-data.js", "manifest.json", "logo.png",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png", "favicon.png"
];

const CDN_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

function isCdn(url) {
  return CDN_HOSTS.includes(url.hostname) ||
    (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/"));
}

// Hosts that strip ".html" answer with a redirect; a redirected response
// can't be replayed for a page navigation, so store a clean copy.
async function cleanCopy(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await Promise.all(APP_SHELL.map(async path => {
      try {
        const res = await fetch(path, { cache: "reload" });
        if (res.ok) await cache.put(path, await cleanCopy(res));
      } catch (e) { /* offline during install — it will be cached on first use */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith("inv-") && !n.startsWith(VERSION)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, (await cleanCopy(res.clone()))).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true }) ||
                await cache.match(new URL(request.url).pathname.replace(/\/$/, "") + ".html");
    if (hit) return hit;
    if (request.mode === "navigate") {
      const home = await cache.match("index.html") || await cache.match("./");
      if (home) return home;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CDN_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") cache.put(request, res.clone()).catch(() => {});
  return res;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(SCOPE_PATH)) return;   // anything outside this app is left alone
    event.respondWith(networkFirst(request));
    return;
  }
  if (isCdn(url)) { event.respondWith(cacheFirst(request)); return; }
  // Everything else (Firestore, Auth, the QR image service) goes straight to the network.
});
