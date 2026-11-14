/* Money Manager service worker.
   Caches only the app's own files and its libraries (the "app shell") so the app
   installs and opens fast. It never touches Firebase / Firestore requests, so your
   data always goes straight between the app and Firebase exactly as before. */
const VERSION = 'mm-shell-v1';
const SHELL_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const isFirebaseSdk = u => u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/');

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png'])).catch(() => { }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // never intercept writes
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !SHELL_HOSTS.includes(url.hostname) && !isFirebaseSdk(url)) return;   // Firestore, Auth, everything else: untouched

  if (sameOrigin) {
    // The app itself: always try the network first so updates arrive immediately; fall back to the saved copy when offline.
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./'))));
    return;
  }
  // Versioned libraries and fonts: use the saved copy, otherwise download and save.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
