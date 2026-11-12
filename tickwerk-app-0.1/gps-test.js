/* Tickwerk, Testseite «GPS-Zeit prüfen» (Auftrag Eichung, Stufe 4). Nur in der Testversion, in der App nicht verlinkt.
   Fragt die Ortung laufend ab und vergleicht den Zeitstempel jeder Position (position.timestamp) mit der Uhr des Handys
   (Date.now) und mit der laufenden Uhr der Seite (performance.now, springt nicht, wenn die Handy-Uhr gestellt wird).
   Antworten soll der Test auf drei Fragen:
     a) Sind die Zeitstempel volle Sekunden?
     b) Folgen sie einer von Hand verstellten Handy-Uhr? Dann sind sie nur Handy-Zeit, und GPS bringt nichts.
     c) Wie stark streut die Verzögerung, bis die Seite die Position erhält?
   Koordinaten werden nicht gelesen, nichts wird gespeichert oder übertragen. */
(function () {
  'use strict';
  var PERF0 = Date.now() - performance.now(), watch = null, rows = [], skew0 = null, jumps = [], t0 = 0;
  function $(id) { return document.getElementById(id); }
  function page() { return PERF0 + performance.now(); }
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; }
  function f(v, d) { return isFinite(v) ? v.toFixed(d == null ? 0 : d).replace('.', ',') : '–'; }
  function status(t, kind) { $('gStatus').textContent = t; $('gStatus').setAttribute('data-kind', kind || ''); }
  function summary() {
    var L = [], n = rows.length;
    L.push('Tickwerk GPS-Test · ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC · ' + String(navigator.userAgent).replace(/[^\x20-\x7e]/g, '').slice(0, 110));
    L.push('Positionen: ' + n + ' in ' + f((performance.now() - t0) / 1000) + ' s');
    if (!n) return L.join('\n');
    var whole = rows.filter(function (r) { return r.ts % 1000 === 0; }).length, gaps = [], i;
    for (i = 1; i < n; i++) gaps.push(rows[i].ts - rows[i - 1].ts);
    L.push('a) Zeitstempel auf volle Sekunden: ' + whole + ' von ' + n + (gaps.length ? ' · Abstand der Zeitstempel (Median): ' + f(median(gaps)) + ' ms' : ''));
    /* Abschnitte zwischen zwei Sprüngen der Handy-Uhr: je Abschnitt «Seite minus Zeitstempel» und «Handy-Uhr minus Zeitstempel» */
    var seg = [], cur = null;
    rows.forEach(function (r) { if (!cur || r.seg !== cur.seg) { cur = { seg: r.seg, page: [], wall: [] }; seg.push(cur); } cur.page.push(r.dPage); cur.wall.push(r.dWall); });
    seg.forEach(function (s, k) {
      var mp = median(s.page), sp = s.page.map(function (v) { return v - mp; });
      L.push('   Abschnitt ' + (k + 1) + ' (' + s.page.length + ' Positionen): Handy-Uhr minus Zeitstempel ' + f(median(s.wall)) + ' ms · Uhr der Seite minus Zeitstempel ' + f(mp) + ' ms' +
        ' · Streuung ' + f(Math.min.apply(null, sp)) + ' bis +' + f(Math.max.apply(null, sp)) + ' ms');
    });
    if (!jumps.length) L.push('b) Die Handy-Uhr wurde noch nicht verstellt: Schritt 2 der Anleitung fehlt noch.');
    else if (seg.length < 2 || seg[seg.length - 1].page.length < 3) L.push('b) Handy-Uhr um ' + f(jumps[jumps.length - 1] / 1000, 1) + ' s verstellt: Es fehlen noch Positionen danach, bitte warten.');
    else {
      var a = seg[seg.length - 2], b = seg[seg.length - 1], dj = jumps[jumps.length - 1], dPage = median(b.page) - median(a.page), dWall = median(b.wall) - median(a.wall);
      var follows = Math.abs(dPage + dj) < Math.abs(dj) / 4, gps = Math.abs(dPage) < Math.abs(dj) / 4;
      L.push('b) Handy-Uhr um ' + f(dj / 1000, 1) + ' s verstellt. Uhr der Seite minus Zeitstempel änderte sich um ' + f(dPage / 1000, 2) + ' s, Handy-Uhr minus Zeitstempel um ' + f(dWall / 1000, 2) + ' s.');
      L.push('   ' + (follows ? 'ERGEBNIS: Der Zeitstempel folgt der Handy-Uhr. Er ist keine GPS-Zeit; für Tickwerk bringt er nichts.' :
        gps ? 'ERGEBNIS: Der Zeitstempel folgt der Handy-Uhr nicht. Er kommt von der Ortung selbst und könnte als Zeitquelle taugen.' : 'ERGEBNIS: unklar, bitte den Test wiederholen.'));
    }
    var all = rows.map(function (r) { return r.dPage - median(rows.filter(function (q) { return q.seg === r.seg; }).map(function (q) { return q.dPage; })); });
    L.push('c) Streuung der Verzögerung über alle Positionen: ' + f(Math.min.apply(null, all)) + ' bis +' + f(Math.max.apply(null, all)) + ' ms · Genauigkeit der Ortung (Median): ' + f(median(rows.map(function (r) { return r.acc; }))) + ' m');
    L.push('');
    L.push('Letzte Positionen (Zeitstempel ms-Teil · Handy-Uhr minus Zeitstempel · Seite minus Zeitstempel · Genauigkeit):');
    rows.slice(-12).forEach(function (r) { L.push('  ' + ('00' + (r.ts % 1000)).slice(-3) + ' · ' + f(r.dWall) + ' ms · ' + f(r.dPage) + ' ms · ' + f(r.acc) + ' m'); });
    return L.join('\n');
  }
  function onPos(p) {
    var now = Date.now(), pg = page(), skew = now - pg, ts = Math.round(p.timestamp);
    if (skew0 == null) skew0 = skew;
    if (Math.abs(skew - skew0) > 500) { jumps.push(skew - skew0); skew0 = skew; }   /* die Handy-Uhr wurde gestellt */
    rows.push({ ts: ts, dWall: now - ts, dPage: pg - ts, acc: p.coords && isFinite(p.coords.accuracy) ? p.coords.accuracy : NaN, seg: jumps.length });
    if (rows.length > 2000) rows.shift();
    $('gOut').textContent = summary(); $('gCopy').disabled = false;
    status('Läuft: ' + rows.length + ' Positionen.', 'busy');
  }
  function onErr(e) {
    status(e && e.code === 1 ? 'Der Standort ist nicht erlaubt. In den Einstellungen des Browsers für diese Seite erlauben.' :
      e && e.code === 3 ? 'Noch keine Position (Zeitüberschreitung). Ins Freie gehen und warten.' : 'Die Ortung meldet keinen Standort. Ist sie am Handy eingeschaltet?', 'err');
  }
  function stop() { if (watch != null) navigator.geolocation.clearWatch(watch); watch = null; $('gStart').textContent = 'Start'; }
  $('gStart').addEventListener('click', function () {
    if (watch != null) { stop(); status('Angehalten.', ''); return; }
    if (!navigator.geolocation) { status('Dieser Browser kennt keine Ortung.', 'err'); return; }
    rows = []; jumps = []; skew0 = null; t0 = performance.now();
    $('gOut').textContent = '–'; $('gCopy').disabled = true;
    status('Warte auf die erste Position …', 'busy');
    watch = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 });
    $('gStart').textContent = 'Anhalten';
  });
  $('gCopy').addEventListener('click', function () {
    var txt = $('gOut').textContent;
    function done(ok) { status(ok ? 'Kopiert. Jetzt in eine Nachricht einfügen.' : 'Kopieren ging nicht. Den Text lange antippen und von Hand kopieren.', ok ? 'ok' : 'err'); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { done(false); });
    else done(false);
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && watch != null) $('gOut').textContent = summary(); });
})();
