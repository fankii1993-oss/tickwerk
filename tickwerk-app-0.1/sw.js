/* Tickwerk Service Worker: App funktioniert auch offline. */
var PREFIX = 'tickwerk-test-';
var CACHE = PREFIX + 'bf0253b0c2';
var FILES = [
  './', 'index.html', 'datenschutz.html', 'app.css', 'app.js', 'config.js', 'kaliber.js', 'logo.js', 'report.js', 'worker.js', 'recorder-worklet.js',
  'engine/tickwerk-engine.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/favicon-48.png', 'icons/apple-touch-icon.png',
  'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-500-normal.woff2', 'fonts/inter-latin-600-normal.woff2',
  'fonts/space-grotesk-latin-500-normal.woff2', 'fonts/space-grotesk-latin-600-normal.woff2',
  'fonts/ibm-plex-mono-latin-400-normal.woff2', 'fonts/ibm-plex-mono-latin-500-normal.woff2'
];
/* Alte Speicher dieser Ausgabe löschen. Die Testversion räumt auch die Speicher von 0.1 bis 0.3 weg (tickwerk-<10 Zeichen>). */
function isOld(k) { return k !== CACHE && (k.indexOf(PREFIX) === 0 || (true && /^tickwerk-[0-9a-f]{10}$/.test(k))); }
// Beim Installieren alle Dateien frisch holen: am Browser-Speicher und am CDN vorbei (?v=...),
// damit die neue Version nicht mit alten Dateien gefüllt wird.
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return fetch(new Request(f + '?v=bf0253b0c2', { cache: 'reload' })).then(function (res) {
        if (!res.ok) throw new Error(f + ': ' + res.status);
        return c.put(f, res);
      });
    }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(isOld).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Sofort aus dem Speicher antworten und im Hintergrund auffrischen (nächster Start hat die neue Version)
  var net = fetch(req).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();   // nur in den eigenen Speicher; ist er schon gelöscht (neue Version aktiv), nicht neu anlegen
      caches.has(CACHE).then(function (has) { if (has) return caches.open(CACHE).then(function (c) { return c.put(req, copy); }); });
    }
    return res;
  });
  e.respondWith(caches.match(req, { ignoreSearch: true, cacheName: CACHE }).then(function (hit) {
    return hit || net;
  }));
  e.waitUntil(net.then(function () {}, function () {}));
});
