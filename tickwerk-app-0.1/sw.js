/* Tickwerk Service Worker: App funktioniert auch offline. */
var CACHE = 'tickwerk-6a122430a2';
var FILES = [
  './', 'index.html', 'app.css', 'app.js', 'kaliber.js', 'logo.js', 'report.js', 'worker.js', 'recorder-worklet.js',
  'engine/tickwerk-engine.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/favicon-48.png', 'icons/apple-touch-icon.png',
  'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-500-normal.woff2', 'fonts/inter-latin-600-normal.woff2',
  'fonts/space-grotesk-latin-500-normal.woff2', 'fonts/space-grotesk-latin-600-normal.woff2',
  'fonts/ibm-plex-mono-latin-400-normal.woff2', 'fonts/ibm-plex-mono-latin-500-normal.woff2'
];
// Beim Installieren alle Dateien frisch holen: am Browser-Speicher und am CDN vorbei (?v=...),
// damit die neue Version nicht mit alten Dateien gefüllt wird.
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return fetch(new Request(f + '?v=6a122430a2', { cache: 'reload' })).then(function (res) {
        if (!res.ok) throw new Error(f + ': ' + res.status);
        return c.put(f, res);
      });
    }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('tickwerk-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Sofort aus dem Speicher antworten und im Hintergrund auffrischen (naechster Start hat die neue Version)
  var net = fetch(req).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  });
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    return hit || net;
  }));
  e.waitUntil(net.then(function () {}, function () {}));
});
