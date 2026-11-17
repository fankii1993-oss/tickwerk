/* Tickwerk Service Worker: App funktioniert auch offline. */
var PREFIX = 'tickwerk-test-';
var CACHE = PREFIX + '5dc30e8519';
/* Texterkennung (Ordner ocr/, ab 0.7.8): gross und selten geändert. Sie wird erst beim ersten Gebrauch geholt und liegt in einem
   eigenen Speicher, der ein Update der App überlebt, solange sich die Dateien in ocr/ nicht ändern. */
var OCR_CACHE = PREFIX + 'ocrp-193e124af5';   // «ocrp» seit 0.7.13: geprüfter Speicher; der ungeprüfte von 0.7.8 bis 0.7.12 («ocr-…») fällt beim Aktivieren weg
var FILES = [
  './', 'index.html', 'datenschutz.html', 'privacy.html', 'privacy-fr.html', 'privacy-it.html', 'app.css', 'app.js', 'config.js', 'kaliber.js', 'logo.js',
  'en.js', 'fr.js', 'it.js', 'report.js', 'eichzeit.js', 'worker.js', 'recorder-worklet.js',
  'engine/tickwerk-engine.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/favicon-48.png', 'icons/apple-touch-icon.png',
  'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-500-normal.woff2', 'fonts/inter-latin-600-normal.woff2',
  'fonts/space-grotesk-latin-500-normal.woff2', 'fonts/space-grotesk-latin-600-normal.woff2',
  'fonts/ibm-plex-mono-latin-400-normal.woff2', 'fonts/ibm-plex-mono-latin-500-normal.woff2'
];
/* Alte Speicher dieser Ausgabe löschen. Die Testversion räumt auch die Speicher von 0.1 bis 0.3 weg (tickwerk-<10 Zeichen>). */
function isOld(k) { return k !== CACHE && k !== OCR_CACHE && (k.indexOf(PREFIX) === 0 || (true && /^tickwerk-[0-9a-f]{10}$/.test(k))); }
/* Prüfsummen (SHA-256) der Dateien dieser Version; der Build setzt sie ein. */
var SUMS = {
  "index.html": "59ae216fc14813b24f084a2e4678ebc63a24cd6e3e94ce9bf0b00c7ddcef18e2",
  "datenschutz.html": "495b672b221b4459786120e0e1a262c819fe930871240f5d0a5c05da043e98a3",
  "privacy.html": "babf34aa7f9f3be037254e348e7f838ffda03545423d51fe66d94ce217962e9a",
  "privacy-fr.html": "cc5dcb921871ec449b0a735eebe02931d9b669653b01395c067676b09719df25",
  "privacy-it.html": "fa34057477a22e31bf45cb759df07b58c2b7c3a40831a6e5fe13c180bab0ec92",
  "app.css": "53e48d7b6223632a014dcbb55f985f9c1b89c076f817d68ff9a71edcf1bdab38",
  "app.js": "7370c72e585daaaebb5e35543ce373229420d513794416e4e6d52d1c8d9e4cea",
  "config.js": "47d49259691e07ca8478c1dc025ea712694517c75dcb458e4e97bd1d232ee507",
  "kaliber.js": "650709399578af8281d6e8ccb622d9ae21cd1a5af2fcdb183b6dc8d1f265230b",
  "logo.js": "6224144ef46502115c223ab7c787c978965b25eb709b59ba253724b972ca489b",
  "en.js": "67ba43112dbea555ba800b15532b1cae381e6aeab77c715f6d68c8d85b07f643",
  "fr.js": "e9c8d37a8f8bf81509491b787948f647763a360526898430b48bc5559088ac69",
  "it.js": "cabb6e7c9c0a7a58d04c14d3ddcaf518521cc376e11d329a09665d3951781416",
  "report.js": "e5affcd55fa91b1b29a8eb8ba628aa8f57dd535552dae407fd5262012e275cc1",
  "eichzeit.js": "7fc1b4f33b755b793ebdc379801a7a414e102fea5dc994a382c3858527893b54",
  "worker.js": "80211495a3210159d5f68aa3fc304f402184dc0f712d32c6b043f071f566b0bf",
  "recorder-worklet.js": "8429a12b3c20f3251056e94ad41155b430352bd120e6d06e8722abbe3dbbd6f4",
  "engine/tickwerk-engine.js": "9e7170ba3619999c21bf865b7b58a9cc3f13ef78352546b8b0d9b1495e61adc3",
  "manifest.webmanifest": "8ad754488e7abfb0d939594355726ef08412ff5bc6dbced35269ac36f4bd8fca",
  "icons/icon-192.png": "1fb720f27dcdd39c7b3ff54c58027f88c9d515d6b5b022feb3948d1cd89e1775",
  "icons/icon-512.png": "4c38103a47d6d5e1edd8c6fc81323d9c8856666a46ce547f1b30a33d96647c9c",
  "icons/icon-maskable-512.png": "7cc808eebaa728927f8c20ca15149f918b263afe6892d8b106ee4fb1fecdd213",
  "icons/favicon-48.png": "e387feb538a1f5374083969eb02cf352fa7330cf2537c32bc7a83d0f77a8da2c",
  "icons/apple-touch-icon.png": "eb7f6b971f1f03f4efef40638ef849fce5d08ead02ba35be7f6977b626a1a138",
  "fonts/inter-latin-400-normal.woff2": "8909904ab6c872eb994093482a88a28eca2cd95912d7b6fecd72103b0dc07edc",
  "fonts/inter-latin-500-normal.woff2": "f3779f1efccc4bdcdf9c0a02ab95bf6bd092ed09c48c08cedc725889edd1d19f",
  "fonts/inter-latin-600-normal.woff2": "f9a06e79cd3a2a20951c0f0e28f66dd0e6d3fda73911d640a2125c8fcb78f21a",
  "fonts/space-grotesk-latin-500-normal.woff2": "1b1a8131d9edf975d9decee81e2f2bf504812f7a4f498e5500f28a613e22e64c",
  "fonts/space-grotesk-latin-600-normal.woff2": "685bbbf69fa616df1ef81847c85fc76be097ddfb3468ff2257be54511ab3130f",
  "fonts/ibm-plex-mono-latin-400-normal.woff2": "08949f728dc52d528e69b1667d15c89a5686a4ee9a296ff90983985f99c380f7",
  "fonts/ibm-plex-mono-latin-500-normal.woff2": "01d285447409c8a588692162439a038b8cbd7871309ee20267b0d2d91c6e8e22"
};
/* 0.7.13: dasselbe für die Dateien der Texterkennung in ocr/ (Schlüssel: Dateiname ohne Ordner). */
var OCR_SUMS = {
  "LICENSE.txt": "c36e0dc3bc32fb7b43a538f311a8cbb3ef2425165344833f4fcb8b0359d7d831",
  "eng.traineddata.gz": "2a66ec904bc0e7657b27e200a874c01e1bc8a58b756cbbaa9afbae736fa50edc",
  "lib.js": "ed6b39d775484081affa3d21bf491f705673c2a3fd616b2f7bce9020ed8eba13",
  "tesseract-core-fallback.wasm.gz": "fbd3d289f13b292e76f5ae9c97674a5199aefdd5b7f5ad16f97245490aa0b31f",
  "tesseract-core.wasm.gz": "9136e169eefd2a4fdf53e184afc921db519f906c977ae1cebaaa14357a702a19",
  "worker.js": "7f4a6a0055ca06531b7dedec67c1c61436331aaab0987336910f68fc15589a0e"
};
function hex(buf) { var b = new Uint8Array(buf), s = ''; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
/* Eine Datei frisch holen: am Zwischenspeicher des Browsers vorbei (cache: 'reload') und mit eigener Adresse (?v=...) am CDN vorbei.
   Dann prüfen, ob ihr Inhalt zu dieser Version gehört. Passt er nicht, einmal mit neuer Adresse nachfragen; passt er wieder nicht,
   scheitert das Installieren, und die bisherige Version bleibt ganz, wie sie ist. */
function fresh(f, again) {
  return fetch(new Request(f + '?v=5dc30e8519' + (again ? '&r=' + Date.now() : ''), { cache: 'reload' })).then(function (res) {
    if (!res.ok) throw new Error(f + ': ' + res.status);
    var want = SUMS[f === './' ? 'index.html' : f];
    if (!want || !self.crypto || !self.crypto.subtle) return res;
    return res.clone().arrayBuffer().then(function (buf) { return self.crypto.subtle.digest('SHA-256', buf); }).then(function (d) {
      if (hex(d) === want) return res;
      if (!again) return fresh(f, true);
      throw new Error(f + ': Inhalt gehört nicht zu dieser Version');
    });
  });
}
/* Installieren: alle Dateien holen und prüfen; erst wenn jede stimmt, kommen sie in den Speicher. So enthält der Speicher einer
   Version genau diese Version oder nichts. */
self.addEventListener('install', function (e) {
  e.waitUntil(Promise.all(FILES.map(function (f) {
    return fresh(f, false).then(function (res) { return [f, res]; });
  })).then(function (all) {
    return caches.open(CACHE).then(function (c) {
      return Promise.all(all.map(function (x) { return c.put(x[0], x[1]); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(isOld).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
/* Antworten kommen aus dem Speicher dieser Version, und nur von dort.
   Bis 0.7.9 holte Tickwerk jede Datei im Hintergrund nochmals und legte sie in den Speicher («auffrischen»). Diese Abfrage lief durch
   den Zwischenspeicher des Browsers. Hielt der noch Dateien der Version davor (der Server lässt sie 10 Minuten gelten), lagen nach
   einem Update alte Dateien neben neuen: neue Seite, altes Programm. Eine neue Version kommt darum allein über «install». */
/* Texterkennung (0.7.13): eine Datei aus ocr/ frisch holen und prüfen, ob ihr Inhalt zu dieser Version gehört. Passt er nicht, einmal
   am Zwischenspeicher vorbei nachfragen; passt er wieder nicht, bekommt die Seite einen Fehler, und in den Speicher kommt nichts.
   Die App meldet dann «Die Texterkennung konnte nicht geladen werden». Dateien, die der Bau nicht kennt, werden nie behalten. */
function ocrFresh(req, name, again) {
  var u = req.url + (again ? (req.url.indexOf('?') < 0 ? '?' : '&') + 'r=' + Date.now() : '');
  return fetch(u, { cache: again ? 'reload' : 'no-cache' }).then(function (res) {
    var want = Object.prototype.hasOwnProperty.call(OCR_SUMS, name) ? OCR_SUMS[name] : '';
    if (!res || !res.ok || !want) return [res, false];
    if (!self.crypto || !self.crypto.subtle) return [res, true];
    return res.clone().arrayBuffer().then(function (buf) { return self.crypto.subtle.digest('SHA-256', buf); }).then(function (d) {
      if (hex(d) === want) return [res, true];
      if (!again) return ocrFresh(req, name, true);
      return [new Response('', { status: 502, statusText: 'Inhalt passt nicht zu dieser Version' }), false];
    });
  });
}
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  var at = url.pathname.lastIndexOf('/ocr/'), ocr = at >= 0;   // Texterkennung: einmal holen und prüfen, danach nur noch aus ihrem eigenen Speicher (je Datei bis 2 MB)
  var done = caches.match(req, { ignoreSearch: true, cacheName: ocr ? OCR_CACHE : CACHE }).then(function (hit) {
    if (hit) return [hit, null];
    if (ocr) {
      return ocrFresh(req, url.pathname.slice(at + 5), false).then(function (x) {
        var res = x[0], keep = null;
        if (x[1] && res && res.ok) { var copy = res.clone(); keep = caches.open(OCR_CACHE).then(function (c) { return c.put(req, copy); }); }
        return [res, keep];
      });
    }
    /* nicht im Speicher (Testseiten): vom Server, und zwar mit Nachfrage beim Server statt aus dem Zwischenspeicher des Browsers.
       In den Speicher der App kommt davon nichts. */
    return fetch(req.url, { cache: 'no-cache' }).then(function (res) { return [res, null]; });
  });
  e.respondWith(done.then(function (x) { return x[0]; }));
  e.waitUntil(done.then(function (x) { return x[1]; }).then(function () {}, function () {}));
});
