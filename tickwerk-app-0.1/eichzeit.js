/* Tickwerk: Eichung mit Internetzeit, die Rechnung (ohne Oberfläche; läuft auch in Node, siehe test/eichzeit-test.js).

   Gesucht ist, um wie viel der Takt des Mikrofons von der wahren Zeit abweicht (ppm). Gemessen wird in zwei Schritten,
   beide gegen die laufende Uhr der Seite (performance.now):
     1. Takt des Mikrofons gegen die Uhr der Seite: Für jeden Block Samples gilt r = Ankunft − Samples / Nenn-Abtastrate.
        Zählt das Mikrofon zu schnell, fällt r mit der Zeit. Blöcke kommen nie zu früh, nur verspätet; darum zählt je
        Zeitfenster der Block mit dem kleinsten r (untere Hüllkurve).
     2. Uhr der Seite gegen die wahre Zeit: Jede Zeitabfrage grenzt «wahre Zeit minus Uhr der Seite» auf einen Bereich ein.
        Die Gerade durch die Mitten der Bereiche zeigt, wie die Uhr der Seite gegen die wahre Zeit wandert.
   Zusammen: Takt des Mikrofons gegen die wahre Zeit. */
(function (root) {
  'use strict';
  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length;
    return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN;
  }
  /* Schritt 1. pts: [{ t, r }] in ms, je Zeitfenster der Block mit der kleinsten Verspätung, der Zeit nach.
     Ergebnis: slope = Steigung von r über t (ohne Einheit), sigma = ihre Unsicherheit.
     Gerechnet wird der Median der Steigungen zwischen Punkten im Abstand von etwa einem Sechstel der Dauer. Das ist
     unempfindlich gegen einzelne Sprünge (verlorene Blöcke verschieben alles Folgende um einen festen Betrag) und gegen
     Fenster, in denen jeder Block verspätet war. Ein Sprung trifft nur die Paare, die ihn überspannen: etwa jedes fünfte. */
  function lagSlopes(t, r, L) {
    var s = [], i;
    for (i = 0; i + L < t.length; i++) { var dt = t[i + L] - t[i]; if (dt > 0) s.push((r[i + L] - r[i]) / dt); }
    return s;
  }
  /* Sprünge herausnehmen: Gehen Samples verloren, liegt r ab dort um einen festen Betrag höher (mindestens ein Block,
     einige ms). Mit einer ersten, groben Steigung m0 wird r geglättet; wo die Mitte der nächsten fünf Fenster deutlich
     neben der Mitte der letzten fünf liegt und der Wechsel von einem Fenster zum nächsten geschieht, ist ein Sprung.
     Alles danach wird um seine Höhe zurückgeschoben. Langsames Wandern (Temperatur) bleibt unberührt. */
  function destep(t, r, m0) {
    var n = t.length, K = 5, d = [], diffs = [], steps = 0, i, j;
    for (i = 0; i < n; i++) d.push(r[i] - m0 * t[i]);
    for (i = 1; i < n; i++) diffs.push(Math.abs(d[i] - d[i - 1]));
    var thr = Math.max(1.5, 8 * 1.4826 * median(diffs));
    for (i = K; i + K <= n; i++) {
      var jump = median(d.slice(i, i + K)) - median(d.slice(i - K, i));
      if (Math.abs(jump) > thr && Math.abs(d[i] - d[i - 1]) > thr / 2) {
        for (j = i; j < n; j++) d[j] -= jump;
        steps++;
      }
    }
    return { r: d.map(function (v, k) { return v + m0 * t[k]; }), steps: steps };
  }
  function slope(pts) {
    var n = pts.length;
    if (n < 12) return null;
    var t = pts.map(function (p) { return p.t; }), r = pts.map(function (p) { return p.r; });
    var s0 = lagSlopes(t, r, 1);   /* erste, grobe Steigung von Fenster zu Fenster: Ein Sprung trifft dabei nur ein einziges Paar */
    if (s0.length < 6) return null;
    var fix = destep(t, r, median(s0)), L = Math.max(3, Math.round(n / 6)), s = lagSlopes(t, fix.r, L);
    if (s.length < 6) return null;
    var m = median(s), sd = 1.4826 * median(s.map(function (v) { return Math.abs(v - m); }));
    return { slope: m, sigma: 1.2533 * sd / Math.sqrt(Math.max(1, s.length / L)), n: n, span: t[n - 1] - t[0], steps: fix.steps };
  }
  /* Schritt 2. syncs: [{ t, lo, hi, g }] in ms: Zeitpunkt der Abfrage (Uhr der Seite), Bereich für «wahre Zeit minus Uhr
     der Seite» und die Quelle der Zeit (g). Gerade durch die Mitten, gewichtet: Ein schmaler Bereich (kurze Laufzeit)
     zählt mehr. Als Streuung einer Mitte gilt ein Viertel der Breite, mindestens 1 ms: Der feste Anteil der Laufzeit (hin
     und zurück ungleich lang) verschiebt alle Mitten gleich und fällt aus der Steigung heraus. Streuen die Mitten stärker,
     zählt das; streuen sie bei acht oder mehr Abfragen deutlich weniger, darf die Unsicherheit bis auf die Hälfte sinken.
     Wechselt während der Eichung die Quelle (der Zeitdienst fällt aus, der Server der App springt ein), liegen die Mitten
     der zwei Quellen um einen festen Betrag auseinander: andere Laufzeit, anderer Moment des Stempelns. Darum bekommt jede
     Quelle ihre eigene Höhe, und nur die Steigung ist gemeinsam (jede Quelle wird um ihren eigenen Schwerpunkt gerechnet). */
  function line(syncs) {
    var k = syncs.length;
    if (k < 3) return null;
    var grp = Object.create(null), keys = [], w = [], x = [], y = [], gk = [], i, sxx = 0, sxy = 0, chi = 0;
    for (i = 0; i < k; i++) {
      var sg = Math.max(1, (syncs[i].hi - syncs[i].lo) / 4), key = 'g' + (syncs[i].g == null ? '' : syncs[i].g);
      if (!grp[key]) { grp[key] = { sw: 0, mx: 0, my: 0 }; keys.push(key); }
      w.push(1 / (sg * sg)); x.push(syncs[i].t); y.push((syncs[i].lo + syncs[i].hi) / 2); gk.push(key);
      grp[key].sw += w[i]; grp[key].mx += w[i] * x[i]; grp[key].my += w[i] * y[i];
    }
    keys.forEach(function (q) { grp[q].mx /= grp[q].sw; grp[q].my /= grp[q].sw; });
    for (i = 0; i < k; i++) { var g = grp[gk[i]]; sxx += w[i] * (x[i] - g.mx) * (x[i] - g.mx); sxy += w[i] * (x[i] - g.mx) * (y[i] - g.my); }
    var dof = k - keys.length - 1;
    if (!(sxx > 0) || dof < 1) return null;
    var b = sxy / sxx;
    for (i = 0; i < k; i++) { var h = grp[gk[i]], d = y[i] - (h.my + b * (x[i] - h.mx)); chi += w[i] * d * d; }
    return { slope: b, sigma: Math.max(k >= 8 ? 0.5 : 1, Math.sqrt(chi / dof)) / Math.sqrt(sxx), n: k, span: x[k - 1] - x[0], groups: keys.length };
  }
  /* Zusammen. a: Ergebnis von slope, c: Ergebnis von line. ppm > 0: Das Mikrofon liefert mehr Samples pro wahrer Sekunde
     als angegeben, die «Handy-Uhr geht vor» (gleiches Vorzeichen wie bei der Eichung mit der Quarzuhr).
     audio: Takt des Mikrofons gegen die Uhr der Seite, clock: Uhr der Seite gegen die wahre Zeit (beide in ppm). */
  function result(a, c) {
    if (!a || !c) return null;
    return { ppm: ((1 - a.slope) / (1 + c.slope) - 1) * 1e6, sigma: Math.sqrt(a.sigma * a.sigma + c.sigma * c.sigma) * 1e6,
      audio: -a.slope * 1e6, audioSigma: a.sigma * 1e6, clock: -c.slope * 1e6, clockSigma: c.sigma * 1e6, syncs: c.n, groups: c.groups, steps: a.steps, span: Math.min(a.span, c.span) };
  }
  var api = { slope: slope, line: line, result: result, median: median };
  root.TickwerkEichzeit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);
