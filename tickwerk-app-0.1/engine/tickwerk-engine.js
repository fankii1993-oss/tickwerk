/*
 * Tickwerk Mess-Engine v0.2
 * Wertet die Tonaufnahme einer mechanischen Uhr aus:
 * Schlagzahl, Gangabweichung, Abfallfehler, Amplitude, Signalqualitaet, Papierstreifen.
 *
 * Laeuft ohne Abhaengigkeiten im Browser und in Node.
 *
 * Konventionen:
 *  - Gangabweichung (rate) in s/Tag, positiv = Uhr geht vor.
 *  - Abfallfehler (beatErrorMs) = halbe Differenz der beiden Halbschwingungen
 *    (= Abstand der beiden Linien auf dem Papierstreifen), in ms.
 *  - Amplitude: A = Hebewinkel / (2 * sin(pi * Hebezeit / Schwingungsdauer)),
 *    Hebezeit = Zeit vom ersten Geraeusch (Ausloesung) bis zum Hauptgeraeusch (Fall).
 *  - Zeitbezug jedes Schlags: das Hauptgeraeusch (lautester Ton), bei Tick und Tack dasselbe Ereignis.
 *  - clockPpm: Fehler der Abtastrate des Geraets (aus Quarz-Kalibrierung), wird korrigiert.
 */
(function (root) {
  'use strict';

  var CANDIDATE_BPH = [12000, 14400, 17280, 18000, 19800, 21600, 25200, 28800, 36000, 43200, 72000];

  /* ---------- Grundbausteine ---------- */

  function highpassCoeffs(fs, f0) {
    var q = Math.SQRT1_2;
    var w0 = 2 * Math.PI * f0 / fs;
    var cw = Math.cos(w0);
    var alpha = Math.sin(w0) / (2 * q);
    var a0 = 1 + alpha;
    return {
      b0: ((1 + cw) / 2) / a0,
      b1: (-(1 + cw)) / a0,
      b2: ((1 + cw) / 2) / a0,
      a1: (-2 * cw) / a0,
      a2: (1 - alpha) / a0
    };
  }

  function lowpassCoeffs(fs, f0) {
    var q = Math.SQRT1_2;
    var w0 = 2 * Math.PI * f0 / fs;
    var cw = Math.cos(w0);
    var alpha = Math.sin(w0) / (2 * q);
    var a0 = 1 + alpha;
    return {
      b0: ((1 - cw) / 2) / a0,
      b1: (1 - cw) / a0,
      b2: ((1 - cw) / 2) / a0,
      a1: (-2 * cw) / a0,
      a2: (1 - alpha) / a0
    };
  }

  function biquad(x, c, reverse) {
    var n = x.length;
    var y = new Float32Array(n);
    var x1 = 0, x2 = 0, y1 = 0, y2 = 0, i, xi, yi;
    if (!reverse) {
      for (i = 0; i < n; i++) {
        xi = x[i];
        yi = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
        x2 = x1; x1 = xi; y2 = y1; y1 = yi;
        y[i] = yi;
      }
    } else {
      for (i = n - 1; i >= 0; i--) {
        xi = x[i];
        yi = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
        x2 = x1; x1 = xi; y2 = y1; y1 = yi;
        y[i] = yi;
      }
    }
    return y;
  }

  // Nullphasiger Hochpass (vorwaerts + rueckwaerts)
  function highpass(x, fs, f0) {
    var c = highpassCoeffs(fs, f0);
    return biquad(biquad(x, c, false), c, true);
  }

  // Zentrierter gleitender Mittelwert
  function movingAverage(x, w) {
    var n = x.length;
    var y = new Float32Array(n);
    if (w <= 1) { y.set(x); return y; }
    var half = Math.floor(w / 2);
    var cs = new Float64Array(n + 1);
    var i;
    for (i = 0; i < n; i++) cs[i + 1] = cs[i] + x[i];
    for (i = 0; i < n; i++) {
      var a = i - half < 0 ? 0 : i - half;
      var b = i + half + 1 > n ? n : i + half + 1;
      y[i] = (cs[b] - cs[a]) / (b - a);
    }
    return y;
  }

  function decimateMean(x, D) {
    var m = Math.floor(x.length / D);
    var y = new Float32Array(m);
    for (var i = 0; i < m; i++) {
      var s = 0, base = i * D;
      for (var j = 0; j < D; j++) s += x[base + j];
      y[i] = s / D;
    }
    return y;
  }

  // Ungefaehrer Median ueber einen Bereich (Stichprobe)
  function approxMedian(x, start, end, maxSamples) {
    start = start || 0;
    end = end == null ? x.length : end;
    maxSamples = maxSamples || 20000;
    if (end <= start) return 0;
    var n = end - start;
    var step = Math.max(1, Math.floor(n / maxSamples));
    var arr = [];
    for (var i = start; i < end; i += step) arr.push(x[i]);
    arr.sort(function (a, b) { return a - b; });
    return arr[arr.length >> 1];
  }

  function argmax(x, start, end) {
    var best = start, bv = -Infinity;
    for (var i = start; i < end; i++) {
      if (x[i] > bv) { bv = x[i]; best = i; }
    }
    return best;
  }

  // Parabolische Interpolation um einen Index (gibt Verschiebung -0.5..0.5 zurueck)
  function parabolicOffset(ym1, y0, yp1) {
    var den = ym1 - 2 * y0 + yp1;
    if (den === 0) return 0;
    var d = 0.5 * (ym1 - yp1) / den;
    if (d > 0.5) d = 0.5;
    if (d < -0.5) d = -0.5;
    return d;
  }

  /* ---------- Huellkurve ---------- */

  // Huellkurve in einem Frequenzband lo..hi (Hz). hi = null: nur Hochpass.
  function bandEnvelope(x, fs, lo, hi) {
    var hp = highpass(x, fs, Math.min(lo, 0.15 * fs));
    if (hi && hi < 0.45 * fs) {
      var lc = lowpassCoeffs(fs, hi);
      hp = biquad(biquad(hp, lc, false), lc, true);
    }
    var n = hp.length;
    var e = new Float32Array(n);
    for (var i = 0; i < n; i++) e[i] = hp[i] * hp[i];
    var sm = movingAverage(e, Math.max(1, Math.round(0.0002 * fs)));
    for (i = 0; i < n; i++) sm[i] = Math.sqrt(sm[i]);
    return sm;
  }

  // Standard: 2-10 kHz, dort liegen die Tick-Geraeusche meistens
  function fineEnvelope(x, fs) {
    return bandEnvelope(x, fs, 2000, 10000);
  }

  // Je nach Uhr, Mikrofon und Tonformat steckt das Ticken in anderen Frequenzen
  // (Handy-Aufnahmen im AAC-Format z. B. oft nur oberhalb von 8 kHz).
  // Wir pruefen mehrere Baender und nehmen das mit dem deutlichsten Takt.
  var BANDS = [[2000, 10000], [1500, 5000], [4000, 9000], [8000, 13000], [12000, 20000], [3000, 20000]];

  function chooseBand(x, fs, opts) {
    var probe = x.length > 21 * fs ? x.subarray(0, Math.round(21 * fs)) : x;
    var best = null, tried = [];
    for (var b = 0; b < BANDS.length; b++) {
      var lo = BANDS[b][0];
      var hi = BANDS[b][1] < 0.45 * fs ? BANDS[b][1] : null;
      if (lo >= 0.38 * fs) continue;
      var det = detectBph(bandEnvelope(probe, fs, lo, hi), fs, { bph: opts.bph });
      if (!det) continue;
      var z = (det.score - det.noiseMean) / Math.max(det.noiseSd, 1e-6);
      tried.push({ lo: lo, hi: hi, bph: det.bph, score: +det.score.toFixed(3), z: +z.toFixed(1) });
      if (!best || z > best.z) best = { lo: lo, hi: hi, z: z };
    }
    return { best: best, tried: tried };
  }

  /* ---------- Schlagzahl erkennen ---------- */

  function detectBph(env, fs, opts) {
    opts = opts || {};
    var D = Math.max(1, Math.round(fs / 2000)); // 0.5-ms-Raster
    var fsC = fs / D;
    var n0 = env.length, i;
    // Energie-Huellkurve, 1 ms geglaettet, ohne Mittelwert (Rauschen mittelt sich in der Korrelation weg)
    var e2 = new Float32Array(n0);
    for (i = 0; i < n0; i++) e2[i] = env[i] * env[i];
    var c = decimateMean(movingAverage(e2, Math.max(1, Math.round(0.001 * fs))), D);
    var s0 = Math.min(Math.round(0.3 * fsC), Math.floor(c.length / 4));
    var s1 = Math.min(c.length, s0 + Math.round(20 * fsC));
    var mean = 0;
    for (i = s0; i < s1; i++) mean += c[i];
    mean /= Math.max(1, s1 - s0);
    for (i = 0; i < c.length; i++) c[i] -= mean;

    function corr(lag) {
      var sxy = 0, sxx = 0, syy = 0;
      for (var k = s0; k + lag < s1; k++) {
        var a = c[k], b = c[k + lag];
        sxy += a * b; sxx += a * a; syy += b * b;
      }
      return sxy / Math.sqrt(sxx * syy + 1e-30);
    }
    function peakNear(lagC, relTol, absTolS) {
      var tol = Math.max(lagC * relTol, absTolS * fsC);
      var lo = Math.max(1, Math.floor(lagC - tol)), hi = Math.ceil(lagC + tol);
      var best = -Infinity, bestLag = lo;
      for (var L = lo; L <= hi; L++) {
        var r = corr(L);
        if (r > best) { best = r; bestLag = L; }
      }
      var off = parabolicOffset(corr(bestLag - 1), best, corr(bestLag + 1));
      return { r: best, lag: bestLag + off };
    }

    var candidates = opts.bph ? [opts.bph] : CANDIDATE_BPH;
    var results = [];
    candidates.forEach(function (bph) {
      var T = 3600 / bph;
      var lagC = T * fsC;
      if (lagC * 3 > (s1 - s0)) return;
      // +-4 ms erlaubt, damit auch ein grosser Abfallfehler (geteilte Spitze) gefunden wird
      var pk = peakNear(lagC, 0.008, 0.004);
      results.push({ bph: bph, score: pk.r, periodS: pk.lag / fsC });
    });
    if (!results.length) return null;
    results.sort(function (a, b) { return b.score - a.score; });
    var top = results[0];
    var chosen = { bph: top.bph, score: top.score, periodS: top.periodS };

    // Liegt genau in der Mitte zwischen zwei Schlaegen noch ein Schlag? Dann ist die Schlagzahl doppelt so hoch.
    function hasMidBeat(period) {
      var Pn = period * fsC;
      var bins = Math.max(8, Math.round(Pn));
      var prof = new Float64Array(bins), cnt = new Float64Array(bins);
      var end = Math.min(s1, s0 + Math.round(6 * fsC));
      for (var k = s0; k < end; k++) {
        var bi = Math.min(bins - 1, Math.floor((((k - s0) % Pn) / Pn) * bins));
        prof[bi] += c[k]; cnt[bi]++;
      }
      for (var b = 0; b < bins; b++) prof[b] = cnt[b] ? prof[b] / cnt[b] : 0;
      var mi = 0;
      for (b = 1; b < bins; b++) if (prof[b] > prof[mi]) mi = b;
      var half = Math.round(bins / 2);
      var tol = Math.max(1, Math.round(0.008 * fsC));
      var midMax = -Infinity;
      var off = [];
      for (b = 0; b < bins; b++) {
        var dMain = Math.min(Math.abs(b - mi), bins - Math.abs(b - mi));
        var midIdx = (mi + half) % bins;
        var dMid = Math.min(Math.abs(b - midIdx), bins - Math.abs(b - midIdx));
        if (dMid <= tol && prof[b] > midMax) midMax = prof[b];
        if (dMain > tol && dMid > tol) off.push(prof[b]);
      }
      off.sort(function (a, b2) { return a - b2; });
      var base = off.length ? off[off.length >> 1] : 0;
      var dev = off.map(function (v) { return Math.abs(v - base); }).sort(function (a, b2) { return a - b2; });
      var sd = dev.length ? 1.4826 * dev[dev.length >> 1] : 0;
      return (midMax - base) >= Math.max(0.25 * (prof[mi] - base), 5 * sd);
    }

    for (var guard = 0; guard < 3 && !opts.bph; guard++) {
      var dbl = null;
      for (i = 0; i < CANDIDATE_BPH.length; i++) if (Math.abs(CANDIDATE_BPH[i] - 2 * chosen.bph) < 1) dbl = CANDIDATE_BPH[i];
      if (!dbl) break;
      var dr = null;
      for (i = 0; i < results.length; i++) if (results[i].bph === dbl) dr = results[i];
      if (!dr || dr.score < 0.3 * top.score) break;
      if (!hasMidBeat(chosen.periodS)) break;
      chosen = { bph: dbl, score: dr.score, periodS: chosen.periodS / 2 };
    }

    // Periode genauer: Korrelation ueber mehrere volle Schwingungen (Tick zu Tick, ohne Abfallfehler)
    var Tc = 3600 / chosen.bph;
    var m = Math.max(1, Math.floor(1.0 / (2 * Tc)));
    var lagFull = 2 * m * Tc * fsC;
    if (lagFull * 2 < (s1 - s0)) {
      var pf = peakNear(lagFull, 0.008, 0);
      chosen.periodS = pf.lag / fsC / (2 * m);
    }
    // Rauschniveau der Korrelation an Verschiebungen ohne Schlag (22-45 ms)
    var offs = [];
    for (var L = Math.round(0.022 * fsC); L <= Math.round(0.045 * fsC); L += Math.max(1, Math.round(0.0017 * fsC))) offs.push(corr(L));
    var om = offs.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, offs.length);
    var osd = Math.sqrt(offs.reduce(function (a, b) { return a + (b - om) * (b - om); }, 0) / Math.max(1, offs.length));
    return { bph: chosen.bph, score: chosen.score, periodS: chosen.periodS, noiseSd: osd, noiseMean: om, candidates: results };
  }

  /* ---------- Schlaege verfolgen (grob) ---------- */

  // Anker: Phase des staerksten periodischen Anteils ueber die ersten ~3 s (robust gegen einzelne Klicks)
  function findAnchor(env, fs, T) {
    var n = env.length;
    var Ts = T * fs;
    var start = Math.min(Math.round(0.25 * fs), Math.floor(n / 4));
    var Pn = 2 * Ts;
    var bins = Math.max(16, Math.round(Pn / Math.max(1, Math.round(0.0005 * fs))));
    var prof = new Float64Array(bins), cnt = new Float64Array(bins);
    var fEnd = Math.min(n, start + Math.round(3 * fs));
    for (var i = start; i < fEnd; i++) {
      var bi = Math.min(bins - 1, Math.floor((((i - start) % Pn) / Pn) * bins));
      prof[bi] += env[i]; cnt[bi]++;
    }
    var best = 0;
    for (var b = 0; b < bins; b++) {
      prof[b] = cnt[b] ? prof[b] / cnt[b] : 0;
      if (prof[b] > prof[best]) best = b;
    }
    var guess = start + (best + 0.5) / bins * Pn;
    var aw = Math.round(0.1 * Ts);
    return argmax(env, Math.max(0, Math.round(guess - aw)), Math.min(n, Math.round(guess + aw) + 1));
  }

  // env: Huellkurve (Energie ~1 ms geglaettet). Vorhersage aus einer Geraden durch die letzten
  // Schlaege gleicher Art (Tick bzw. Tack); einzelne Stoergeraeusche bringen die Spur so nicht weg.
  function trackBeats(env, fs, T, noiseFloor) {
    var n = env.length;
    var Ts = T * fs;
    var start = Math.min(Math.round(0.25 * fs), Math.floor(n / 4));

    // Anker: Phase des staerksten periodischen Anteils ueber die ersten ~3 s (robust gegen einzelne Klicks)
    var Pn = 2 * Ts;
    var bins = Math.max(16, Math.round(Pn / Math.max(1, Math.round(0.0005 * fs))));
    var prof = new Float64Array(bins), cnt = new Float64Array(bins);
    var fEnd = Math.min(n, start + Math.round(3 * fs));
    for (var i = start; i < fEnd; i++) {
      var bi = Math.min(bins - 1, Math.floor((((i - start) % Pn) / Pn) * bins));
      prof[bi] += env[i]; cnt[bi]++;
    }
    var best = 0;
    for (var b = 0; b < bins; b++) {
      prof[b] = cnt[b] ? prof[b] / cnt[b] : 0;
      if (prof[b] > prof[best]) best = b;
    }
    var phase = (best + 0.5) / bins * Pn;
    var guess = start + phase;
    var aw = Math.round(0.1 * Ts);
    var anchor = argmax(env, Math.max(0, Math.round(guess - aw)), Math.min(n, Math.round(guess + aw) + 1));

    var wideW = Math.round(0.25 * Ts);
    var narrowW = Math.max(Math.round(0.003 * fs), Math.min(Math.round(0.2 * Ts), Math.round(0.015 * fs)));
    var snrMin = 1.5;

    function search(pred, w) {
      var a = Math.max(0, Math.round(pred - w));
      var e = Math.min(n, Math.round(pred + w) + 1);
      if (e - a < 3) return null;
      var idx = argmax(env, a, e);
      return { i: idx, v: env[idx] };
    }

    // Vorhersage: Gerade durch die letzten (bis 16) erkannten Schlaege gleicher Paritaet
    function predict(hist, k, fallback) {
      var pts = hist[((k % 2) + 2) % 2];
      if (pts.length < 2) return fallback;
      var m = Math.min(16, pts.length);
      var sk = 0, sp = 0, skk = 0, skp = 0;
      for (var j = pts.length - m; j < pts.length; j++) {
        sk += pts[j].k; sp += pts[j].p; skk += pts[j].k * pts[j].k; skp += pts[j].k * pts[j].p;
      }
      var den = m * skk - sk * sk;
      if (Math.abs(den) < 1e-9) return fallback;
      var slope = (m * skp - sk * sp) / den;
      var icpt = (sp - slope * sk) / m;
      return icpt + slope * k;
    }

    function follow(dir) {
      var list = [];
      var hist = [[], []];
      hist[0].push({ k: 0, p: anchor });
      var p1 = anchor;
      var misses = 0;
      for (var k = 1; ; k++) {
        var kk = dir * k;
        var pred = predict(hist, kk, p1 + dir * Ts);
        if (pred < 0 || pred >= n) break;
        var w = (k <= 3 || misses > 0) ? wideW : narrowW;
        var hit = search(pred, w);
        if (!hit) break;
        var ok = hit.v >= snrMin * noiseFloor;
        var pos = ok ? hit.i : Math.round(pred);
        list.push({ k: kk, i: pos, v: hit.v, ok: ok });
        if (ok) hist[((kk % 2) + 2) % 2].push({ k: kk, p: pos });
        misses = ok ? 0 : misses + 1;
        if (misses > 12) break;
        p1 = pos;
      }
      return list;
    }

    var fwd = follow(1);
    var bwd = follow(-1);
    return bwd.reverse().concat([{ k: 0, i: anchor, v: env[anchor], ok: true }]).concat(fwd);
  }

  /* ---------- Schablonen (Templates) fuer Tick und Tack ---------- */

  function buildTemplates(env, beats, pre, post) {
    var n = env.length;
    var L = pre + post + 1;
    var tpl = [new Float64Array(L), new Float64Array(L)];
    var cnt = [0, 0];
    for (var b = 0; b < beats.length; b++) {
      var bt = beats[b];
      if (!bt.ok) continue;
      var c = Math.round(bt.pos != null ? bt.pos : bt.i);
      if (c - pre < 0 || c + post >= n) continue;
      var p = bt.parity;
      var t = tpl[p];
      for (var j = 0; j < L; j++) t[j] += env[c - pre + j];
      cnt[p]++;
    }
    for (var q = 0; q < 2; q++) {
      if (cnt[q] > 0) for (var j2 = 0; j2 < L; j2++) tpl[q][j2] /= cnt[q];
    }
    return { tpl: tpl, cnt: cnt, pre: pre, post: post, L: L };
  }

  // Aktiver Bereich einer Schablone (wo Ton ist)
  function activeRange(t) {
    var L = t.length, mx = 0, i;
    for (i = 0; i < L; i++) if (t[i] > mx) mx = t[i];
    var floor = percentile(t, 0.2);
    var thr = floor + 0.08 * (mx - floor);
    var a = 0, b = L - 1;
    while (a < L && t[a] < thr) a++;
    while (b > a && t[b] < thr) b--;
    return { a: a, b: b, max: mx, floor: floor };
  }

  function percentile(arr, p) {
    var c = Array.prototype.slice.call(arr).sort(function (x, y) { return x - y; });
    if (!c.length) return 0;
    var idx = Math.min(c.length - 1, Math.max(0, Math.round(p * (c.length - 1))));
    return c[idx];
  }

  // Beste Verschiebung eines Schlags gegenueber der Schablone (Kreuzkorrelation)
  function alignBeat(env, center, tpl, pre, range, maxLag) {
    var n = env.length;
    var best = -Infinity, bestLag = 0, vals = {};
    for (var lag = -maxLag; lag <= maxLag; lag++) {
      var base = center - pre + lag;
      if (base + range.a < 0 || base + range.b >= n) continue;
      var s = 0;
      for (var j = range.a; j <= range.b; j++) s += env[base + j] * tpl[j];
      vals[lag] = s;
      if (s > best) { best = s; bestLag = lag; }
    }
    if (best === -Infinity) return null;
    var off = 0;
    if (vals[bestLag - 1] != null && vals[bestLag + 1] != null) {
      off = parabolicOffset(vals[bestLag - 1], best, vals[bestLag + 1]);
    }
    return bestLag + off;
  }

  // Einzelne Geraeusche (Spitzen) in einer Schablone finden
  function templatePeaks(t, fs) {
    var L = t.length;
    var mx = 0, i;
    for (i = 0; i < L; i++) if (t[i] > mx) mx = t[i];
    // Rauschen aus den ruhigen Raendern der Schablone
    var edge = Math.max(4, Math.floor(L * 0.15));
    var ns = [];
    for (i = 0; i < edge; i++) { ns.push(t[i]); ns.push(t[L - 1 - i]); }
    var nMean = ns.reduce(function (a, b) { return a + b; }, 0) / ns.length;
    var nSd = Math.sqrt(ns.reduce(function (a, b) { return a + (b - nMean) * (b - nMean); }, 0) / ns.length);
    var floor = nMean;
    var thrFirst = nMean + Math.max(6 * nSd, 0.06 * (mx - nMean));
    var thrStrong = nMean + 0.2 * (mx - nMean);
    var r = Math.max(1, Math.round(0.0003 * fs));
    var minSep = Math.round(0.0004 * fs);
    var peaks = [];
    for (i = r; i < L - r; i++) {
      var v = t[i];
      if (v < thrFirst) continue;
      var isMax = true;
      for (var j = i - r; j <= i + r; j++) {
        if (t[j] > v) { isMax = false; break; }
      }
      if (!isMax) continue;
      var pos = i + parabolicOffset(t[i - 1], v, t[i + 1]);
      if (peaks.length && pos - peaks[peaks.length - 1].pos < minSep) {
        if (v > peaks[peaks.length - 1].v) peaks[peaks.length - 1] = { pos: pos, v: v };
        continue;
      }
      peaks.push({ pos: pos, v: v });
    }
    return { peaks: peaks, max: mx, floor: floor, thrStrong: thrStrong };
  }

  function median(arr) {
    if (!arr.length) return 0;
    var c = arr.slice().sort(function (a, b) { return a - b; });
    return c[c.length >> 1];
  }

  // Korrelationskoeffizient eines Schlags mit seiner Schablone (Qualitaet des einzelnen Schlags)
  function beatCorrelation(env, pos, tpl, pre, range) {
    var base = Math.round(pos) - pre;
    var n = env.length;
    if (base + range.a < 0 || base + range.b >= n) return 0;
    var m = range.b - range.a + 1;
    var se = 0, st = 0, j;
    for (j = range.a; j <= range.b; j++) { se += env[base + j]; st += tpl[j]; }
    se /= m; st /= m;
    var cov = 0, ve = 0, vt = 0;
    for (j = range.a; j <= range.b; j++) {
      var de = env[base + j] - se, dt = tpl[j] - st;
      cov += de * dt; ve += de * de; vt += dt * dt;
    }
    return cov / Math.sqrt(ve * vt + 1e-30);
  }

  // Schwelle fuer "echter Schlag": Aehnlichkeit, die reines Rauschen (genau zwischen zwei Schlaegen) nur selten erreicht
  function nullThreshold(env, beats, T, pre, ranges, Tsamp) {
    var vals = [];
    for (var j = 0; j < beats.length; j += 2) {
      var b = beats[j];
      var r = beatCorrelation(env, b.pos + 0.5 * Tsamp, T.tpl[b.parity], pre, ranges[b.parity]);
      if (r !== 0) vals.push(r);
    }
    if (vals.length < 8) return 0.3;
    var m = vals.reduce(function (a, c) { return a + c; }, 0) / vals.length;
    var sd = Math.sqrt(vals.reduce(function (a, c) { return a + (c - m) * (c - m); }, 0) / vals.length);
    return Math.min(0.5, Math.max(0.12, m + 3 * sd));
  }

  /* ---------- Lineare Ausgleichsrechnung: t_k = c + k*T + d*[k ungerade] ---------- */

  function solve3(A, b) {
    // Gauss mit Pivotsuche fuer 3x3
    var M = [A[0].slice(), A[1].slice(), A[2].slice()];
    var v = b.slice();
    for (var col = 0; col < 3; col++) {
      var piv = col;
      for (var r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      var tmp = M[col]; M[col] = M[piv]; M[piv] = tmp;
      var tv = v[col]; v[col] = v[piv]; v[piv] = tv;
      if (Math.abs(M[col][col]) < 1e-300) return null;
      for (var r2 = col + 1; r2 < 3; r2++) {
        var f = M[r2][col] / M[col][col];
        for (var c2 = col; c2 < 3; c2++) M[r2][c2] -= f * M[col][c2];
        v[r2] -= f * v[col];
      }
    }
    var x = [0, 0, 0];
    for (var i = 2; i >= 0; i--) {
      var s = v[i];
      for (var j = i + 1; j < 3; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  }

  function invert3(A) {
    var cols = [];
    for (var i = 0; i < 3; i++) {
      var e = [0, 0, 0]; e[i] = 1;
      cols.push(solve3(A, e));
    }
    if (cols.some(function (c) { return !c; })) return null;
    return [[cols[0][0], cols[1][0], cols[2][0]], [cols[0][1], cols[1][1], cols[2][1]], [cols[0][2], cols[1][2], cols[2][2]]];
  }

  function fitBeats(points, stepKs) {
    // points: [{k, t, parity}] ; Zentrierung von k fuer numerische Stabilitaet
    if (stepKs && stepKs.length) return fitBeatsSteps(points, stepKs);
    var use = points.slice();
    var result = null;
    for (var iter = 0; iter < 3; iter++) {
      if (use.length < 6) return result;
      var kMean = 0, tMean = 0;
      use.forEach(function (p) { kMean += p.k; tMean += p.t; });
      kMean /= use.length; tMean /= use.length;
      var A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
      use.forEach(function (p) {
        var row = [1, p.k - kMean, p.parity];
        var y = p.t - tMean;
        for (var i = 0; i < 3; i++) {
          b[i] += row[i] * y;
          for (var j = 0; j < 3; j++) A[i][j] += row[i] * row[j];
        }
      });
      var x = solve3(A, b);
      if (!x) return result;
      var res = use.map(function (p) {
        return (p.t - tMean) - (x[0] + x[1] * (p.k - kMean) + x[2] * p.parity);
      });
      var ss = 0;
      res.forEach(function (r) { ss += r * r; });
      var dof = Math.max(1, use.length - 3);
      var s2 = ss / dof;
      var inv = invert3(A);
      result = {
        c: x[0] + tMean - x[1] * kMean,
        T: x[1],
        d: x[2],
        sigmaT: inv ? Math.sqrt(Math.max(0, inv[1][1] * s2)) : NaN,
        sigmaD: inv ? Math.sqrt(Math.max(0, inv[2][2] * s2)) : NaN,
        residualS: Math.sqrt(s2),
        used: use.length
      };
      // Robuste Ausreisser-Grenze (Median der absoluten Abweichungen)
      var medR = median(res);
      var mad = median(res.map(function (r) { return Math.abs(r - medR); }));
      var lim = Math.max(4 * 1.4826 * mad, 0.0001);
      var next = use.filter(function (p, idx) { return Math.abs(res[idx] - medR) <= lim; });
      if (next.length === use.length) break;
      use = next;
    }
    return result;
  }

  /* Lineares Gleichungssystem (Gauss mit Pivotsuche) und Inverse, für die Gerade mit Sprüngen */
  function solveN(A, b) {
    var n = b.length, M = A.map(function (r, i) { return r.slice().concat([b[i]]); }), scale = 0, r, c;
    for (r = 0; r < n; r++) scale = Math.max(scale, Math.abs(A[r][r]));
    for (c = 0; c < n; c++) {
      var piv = c;
      for (r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (!(Math.abs(M[piv][c]) > 1e-13 * scale)) return null;
      var tmp = M[c]; M[c] = M[piv]; M[piv] = tmp;
      for (r = c + 1; r < n; r++) {
        var f = M[r][c] / M[c][c];
        if (f) for (var j = c; j <= n; j++) M[r][j] -= f * M[c][j];
      }
    }
    var x = new Array(n);
    for (r = n - 1; r >= 0; r--) {
      var s = M[r][n];
      for (c = r + 1; c < n; c++) s -= M[r][c] * x[c];
      x[r] = s / M[r][r];
    }
    return x;
  }
  function invertN(A) {
    var n = A.length, cols = [];
    for (var i = 0; i < n; i++) {
      var e = []; for (var j = 0; j < n; j++) e.push(i === j ? 1 : 0);
      var c = solveN(A, e); if (!c) return null; cols.push(c);
    }
    return cols.map(function (_, i) { return cols.map(function (c) { return c[i]; }); });
  }
  /* Wie fitBeats, aber mit je einem freien Versatz ab jedem Aussetzer (stepKs: Schlagnummer, ab der versetzt ist).
     Der Versatz wird aus allen Schlägen mitgeschätzt; seine Unsicherheit steckt in sigmaT. */
  function fitBeatsSteps(points, stepKs) {
    var use = points.slice(), result = null;
    for (var iter = 0; iter < 3; iter++) {
      var ks = stepKs.filter(function (s) {
        var nb = 0, na = 0;
        use.forEach(function (p) { if (p.k < s) nb++; else na++; });
        return nb >= 4 && na >= 4;
      });
      var P = 3 + ks.length;
      if (use.length < P + 6) return result;
      var kMean = 0, tMean = 0;
      use.forEach(function (p) { kMean += p.k; tMean += p.t; });
      kMean /= use.length; tMean /= use.length;
      var A = [], b = [], i, j;
      for (i = 0; i < P; i++) { A.push(new Array(P).fill(0)); b.push(0); }
      var rowOf = function (p) { var row = [1, p.k - kMean, p.parity]; ks.forEach(function (s) { row.push(p.k >= s ? 1 : 0); }); return row; };
      use.forEach(function (p) {
        var row = rowOf(p), y = p.t - tMean;
        for (i = 0; i < P; i++) { b[i] += row[i] * y; for (j = 0; j < P; j++) A[i][j] += row[i] * row[j]; }
      });
      var x = solveN(A, b);
      if (!x) return result;
      var res = use.map(function (p) { var row = rowOf(p), m = 0; for (var q = 0; q < P; q++) m += row[q] * x[q]; return (p.t - tMean) - m; });
      var ss = 0;
      res.forEach(function (r) { ss += r * r; });
      var s2 = ss / Math.max(1, use.length - P);
      var inv = invertN(A);
      result = {
        c: x[0] + tMean - x[1] * kMean, T: x[1], d: x[2],
        sigmaT: inv ? Math.sqrt(Math.max(0, inv[1][1] * s2)) : NaN,
        sigmaD: inv ? Math.sqrt(Math.max(0, inv[2][2] * s2)) : NaN,
        residualS: Math.sqrt(s2), used: use.length,
        steps: ks.map(function (s, q) { return { k: s, dt: x[3 + q] }; })
      };
      var medR = median(res);
      var mad = median(res.map(function (r) { return Math.abs(r - medR); }));
      var lim = Math.max(4 * 1.4826 * mad, 0.0001);
      var next = use.filter(function (p, idx) { return Math.abs(res[idx] - medR) <= lim; });
      if (next.length === use.length) break;
      use = next;
    }
    return result;
  }
  function stepModel(f, p) {
    var m = f.c + f.T * p.k + f.d * p.parity;
    if (f.steps) f.steps.forEach(function (s) { if (p.k >= s.k) m += s.dt; });
    return m;
  }
  /* Aussetzer der Aufnahme finden: Fällt im Handy ein Audiopuffer weg oder kommt einer doppelt (z. B. bei hoher
     Last), springen alle folgenden Schläge um einige Millisekunden. Eine echte Uhr kann das nicht. Ein Sprung
     zeigt sich als Unterschied der Mediane vor und nach einer Stelle; Drift oder einzelne gestörte Schläge nicht. */
  function findGaps(points) {
    var W = 8, pts = points.slice().sort(function (a, b) { return a.k - b.k; }), ks = [];
    if (pts.length < 4 * W) return ks;
    for (var iter = 0; iter < 6; iter++) {
      var f = fitBeats(pts, ks);
      if (!f || !(f.T > 0)) break;
      var res = pts.map(function (p) { return p.t - stepModel(f, p); }), dif = [], i;
      for (i = 1; i < res.length; i++) dif.push(Math.abs(res[i] - res[i - 1]));
      var sig = 1.4826 * median(dif) / Math.SQRT2;
      var stepAt = function (j) { return median(res.slice(j, Math.min(res.length, j + W))) - median(res.slice(Math.max(0, j - W), j)); };
      var best = null;
      for (var j = W; j <= res.length - W; j++) {
        var st = stepAt(j);
        if (!best || Math.abs(st) > Math.abs(best.st)) best = { j: j, st: st };
      }
      if (!best || Math.abs(best.st) < Math.max(0.0005, 6 * sig)) break;
      var jj = best.j, mx = 0;
      for (var q = Math.max(1, best.j - W); q < Math.min(res.length, best.j + W); q++) {
        var dq = res[q] - res[q - 1];
        if (dq * best.st > 0 && Math.abs(dq) > mx) { mx = Math.abs(dq); jj = q; }
      }
      if (ks.indexOf(pts[jj].k) >= 0) break;
      ks.push(pts[jj].k);
      ks.sort(function (a, b) { return a - b; });
    }
    return ks;
  }

  /* ---------- Hauptfunktion ---------- */

  /**
   * analyze(samples, sampleRate, opts)
   * opts: { liftAngle: 52, bph: null (automatisch), clockPpm: 0 }
   */
  function analyze(samples, fs, opts) {
    opts = opts || {};
    var x = samples instanceof Float32Array ? samples : Float32Array.from(samples);
    if (x.length / fs < 4) return { ok: false, reason: 'Aufnahme zu kurz (mindestens 4 Sekunden).' };
    if (opts.band) return analyzeBand(x, fs, opts, { lo: opts.band[0], hi: opts.band[1] || null });

    // Baender mit deutlichem Takt voll auswerten (hoechstens 3); es gewinnt das genaueste Ergebnis.
    var cb = chooseBand(x, fs, opts);
    var tried = cb.tried.slice().sort(function (a, b) { return b.z - a.z; });
    var zMax = tried.length ? tried[0].z : 0;
    var cands = tried.filter(function (t, i) { return i === 0 || t.z >= 0.6 * zMax; }).slice(0, 3);
    if (!cands.length) cands = [{ lo: 2000, hi: 10000 }];
    var best = null, firstFail = null, oks = [];
    cands.forEach(function (c) {
      var r = analyzeBand(x, fs, opts, { lo: c.lo, hi: c.hi });
      c.result = r.ok ? 'ok' : 'abgelehnt';
      if (r.ok) {
        c.rateSigma = +r.rateSigma.toFixed(3);
        c.rate = +r.rate.toFixed(2);
        c.beatErrorMs = +r.beatErrorMs.toFixed(2);
        c.liftTimeMs = r.liftTimeMs != null ? +r.liftTimeMs.toFixed(2) : null;
        oks.push(r);
      }
      if (r.ok && (!best || r.rateSigma < best.rateSigma)) best = r;
      if (!r.ok && !firstFail) firstFail = r;
    });
    if (best) {
      // Gegenprobe mit den anderen brauchbaren Baendern: die Uhr ist dieselbe, die Werte muessen passen
      var peers = oks.filter(function (r) { return r !== best && r.bph === best.bph && r.rateSigma <= 3 * best.rateSigma; });
      if (peers.length) {
        var lts = [best.liftTimeMs].concat(peers.map(function (r) { return r.liftTimeMs; })).filter(function (v) { return v != null; });
        if (best.liftTimeMs != null && lts.length >= 2 &&
            Math.max.apply(null, lts) - Math.min.apply(null, lts) > 0.15 * best.liftTimeMs) best.amplitudeReliable = false;
        var bes = [best.beatErrorMs].concat(peers.map(function (r) { return r.beatErrorMs; }));
        if (Math.max.apply(null, bes) - Math.min.apply(null, bes) > Math.max(0.3, 0.5 * best.beatErrorMs)) best.beatErrorReliable = false;
        peers.forEach(function (r) {
          var dd = Math.abs(r.rate - best.rate);
          if (dd > 2 * Math.sqrt(r.rateSigma * r.rateSigma + best.rateSigma * best.rateSigma)) best.rateSigma = Math.max(best.rateSigma, dd / 2);
        });
      }
      if (!(best.rateSigma <= 2)) {
        best = null;
        firstFail = { ok: false, reason: 'Signal zu schwach für eine verlässliche Messung. Mikrofon näher an die Krone, ruhiger Raum.' };
      }
    }
    var out = best || firstFail;
    out.bandsTried = cb.tried;
    return out;
  }

  function analyzeBand(x, fs, opts, band) {
    var liftAngle = opts.liftAngle || 52;
    var clockPpm = opts.clockPpm || 0;
    var duration = x.length / fs;
    var env = bandEnvelope(x, fs, band.lo, band.hi);

    var det = detectBph(env, fs, { bph: opts.bph });
    if (!det || det.score < Math.max(0.01, det.noiseMean + 5 * det.noiseSd)) {
      return { ok: false, reason: 'Kein regelmässiges Ticken gefunden. Mikrofon näher an die Krone, ruhiger Raum.', bphScore: det ? det.score : 0 };
    }
    var bph = det.bph;
    var Tn = 3600 / bph;
    var T0 = det.periodS;

    // 1) grobe Schlagpositionen (Energie ueber 1 ms geglaettet). Die Spitze kann auf irgendeinem
    //    Geraeusch des Schlags liegen; das korrigiert der erste Ausrichtungsdurchgang.
    var e2 = new Float32Array(env.length);
    for (var ii = 0; ii < env.length; ii++) e2[ii] = env[ii] * env[ii];
    var envS = movingAverage(e2, Math.max(1, Math.round(0.001 * fs)));
    for (ii = 0; ii < envS.length; ii++) envS[ii] = Math.sqrt(envS[ii]);
    var noiseS = approxMedian(envS) || 1e-12;
    // Die Periode ist aus der Korrelation sehr genau bekannt: alle Schlaege liegen auf einem Raster
    // ab dem Anker. So bekommt jeder Schlag denselben Bezugspunkt (kein Springen zwischen Geraeuschen).
    var anchor = findAnchor(envS, fs, T0);
    var Tsamp = T0 * fs;
    var beats = [];
    var kLo = -Math.floor(anchor / Tsamp), kHi = Math.floor((envS.length - 1 - anchor) / Tsamp);
    for (var kk = kLo; kk <= kHi; kk++) {
      var bi0 = Math.round(anchor + kk * Tsamp);
      beats.push({ k: kk, i: bi0, pos: bi0, ok: true, v: envS[bi0], parity: ((kk % 2) + 2) % 2 });
    }

    // 2) Schablonen bauen und Schlaege daran ausrichten
    var pre = Math.min(Math.round(0.032 * fs), Math.round(0.45 * T0 * fs));
    var post = pre;
    var T = null, ranges = null, rhoThr = 0.3;
    for (var pass = 0; pass < 4; pass++) {
      var maxLag = Math.round((pass === 0 ? Math.min(0.022, 0.2 * T0) : 0.0015) * fs);
      T = buildTemplates(env, beats, pre, post);
      if (T.cnt[0] < 3 || T.cnt[1] < 3) break;
      ranges = [activeRange(T.tpl[0]), activeRange(T.tpl[1])];
      for (var r = 0; r < 2; r++) {
        ranges[r].a = Math.max(0, ranges[r].a - Math.round(0.001 * fs));
        ranges[r].b = Math.min(T.L - 1, ranges[r].b + Math.round(0.001 * fs));
      }
      beats.forEach(function (b) {
        var lag = alignBeat(env, Math.round(b.pos), T.tpl[b.parity], pre, ranges[b.parity], maxLag);
        if (lag !== null) b.pos = Math.round(b.pos) + lag;
      });
      // nach der Ausrichtung: Schlaege mit klarer Aehnlichkeit fuer die naechste Schablone verwenden
      if (pass >= 1) {
        rhoThr = nullThreshold(env, beats, T, pre, ranges, T0 * fs);
        beats.forEach(function (b) {
          b.ok = beatCorrelation(env, b.pos, T.tpl[b.parity], pre, ranges[b.parity]) >= rhoThr;
        });
      }
    }
    if (!T || T.cnt[0] < 3 || T.cnt[1] < 3 || !ranges) {
      return { ok: false, reason: 'Zu wenige saubere Schläge erkannt. Mikrofon näher an die Krone, ruhiger Raum.', bph: bph };
    }
    T = buildTemplates(env, beats, pre, post);

    // Qualitaet jedes Schlags: Aehnlichkeit mit der Schablone (Schwelle aus reinem Rauschen zwischen den Schlaegen)
    rhoThr = nullThreshold(env, beats, T, pre, ranges, T0 * fs);
    beats.forEach(function (b) {
      b.rho = beatCorrelation(env, b.pos, T.tpl[b.parity], pre, ranges[b.parity]);
      b.ok = b.rho >= rhoThr;
    });

    // 3) Geraeusche in den Schablonen.
    //    Bezugspunkt fuer Gang und Abfallfehler ist das Hauptgeraeusch (der lauteste Ton, meist der
    //    Fall). Es ist bei Tick und Tack dasselbe Ereignis. Die leisen Geraeusche davor gehen in
    //    Handy-Aufnahmen oft unter und sind bei Tick und Tack verschieden (Eingangs-/Ausgangsklinke).
    //    Hebezeit = erstes Geraeusch (Ausloesung) bis Hauptgeraeusch.
    var tp = [templatePeaks(T.tpl[0], fs), templatePeaks(T.tpl[1], fs)];
    var P = 2 * Tn;
    var firstOff = [], mainOff = [], liftTimes = [], peakCounts = [], sigPeaks = [];
    for (var q = 0; q < 2; q++) {
      var pkAll = tp[q].peaks;
      if (!pkAll.length) {
        var mi0 = 0;
        for (var z0 = 1; z0 < T.L; z0++) if (T.tpl[q][z0] > T.tpl[q][mi0]) mi0 = z0;
        peakCounts.push(0); sigPeaks.push([]); firstOff.push(mi0); mainOff.push(mi0); liftTimes.push(null);
        continue;
      }
      var mainP = pkAll[0];
      pkAll.forEach(function (p) { if (p.v > mainP.v) mainP = p; });
      var minV = tp[q].floor + 0.08 * (tp[q].max - tp[q].floor);
      var pk = pkAll.filter(function (p) { return p.v >= minV && p.pos >= mainP.pos - 0.022 * fs && p.pos <= mainP.pos + 0.022 * fs; });
      sigPeaks.push(pk);
      peakCounts.push(pk.length);
      var first = pk[0];
      firstOff.push(first.pos);
      mainOff.push(mainP.pos);
      liftTimes.push(mainP.pos - first.pos >= 0.0008 * fs ? (mainP.pos - first.pos) / fs : null);
    }
    // Ist bei einem Schlag das lauteste Geraeusch die Ausloesung statt des Falls (kein Geraeusch davor),
    // suchen wir den Fall dort, wo ihn die Hebezeit des anderen Schlags erwarten laesst.
    var dropRepaired = false;
    for (var qq = 0; qq < 2; qq++) {
      var o2 = 1 - qq;
      if (liftTimes[qq] != null || liftTimes[o2] == null) continue;
      var want = mainOff[qq] + liftTimes[o2] * fs;
      var tolR = Math.max(0.0006 * fs, 0.15 * liftTimes[o2] * fs);
      var cand = null;
      sigPeaks[qq].forEach(function (p) {
        if (Math.abs(p.pos - want) <= tolR && p.v >= tp[qq].thrStrong && (!cand || p.v > cand.v)) cand = p;
      });
      if (cand) {
        firstOff[qq] = mainOff[qq];
        mainOff[qq] = cand.pos;
        liftTimes[qq] = (cand.pos - firstOff[qq]) / fs;
        dropRepaired = true;
      }
    }

    // Ausloesung (erstes Geraeusch) gezielt suchen. Sie ist oft sehr leise. Gesucht wird nur dort, wo sie bei
    // einer moeglichen Amplitude (140 bis 360 Grad) liegen kann, mit einer Schwelle knapp ueber dem Rauschen.
    // Passen Tick und Tack zusammen, gilt die Hebezeit als gesichert; von mehreren passenden Paaren gilt
    // das frueheste (die Ausloesung kommt vor dem Impuls).
    var ltMin = (P / Math.PI) * Math.asin(Math.min(1, liftAngle / (2 * 360)));
    var ltMax = (P / Math.PI) * Math.asin(Math.min(1, liftAngle / (2 * 140)));
    function unlockCands(q) {
      var t = T.tpl[q], L = T.L, m = Math.round(mainOff[q]), i, j;
      // Grundrauschen nur VOR dem Suchfenster schaetzen (nach dem Fall klingt es noch nach)
      var preEnd = m - Math.round((ltMax + 0.001) * fs);
      var ns = [];
      if (preEnd > Math.round(0.003 * fs)) { for (i = 0; i < preEnd; i++) ns.push(t[i]); }
      else { for (i = 0; i < Math.max(4, Math.floor(L * 0.15)); i++) ns.push(t[i]); }
      ns.sort(function (x, y) { return x - y; });
      var floor = ns[ns.length >> 1];
      var dev = ns.map(function (v) { return Math.abs(v - floor); }).sort(function (x, y) { return x - y; });
      var sdR = 1.4826 * dev[dev.length >> 1];
      var thr = floor + Math.max(5 * sdR, 0.3 * floor);
      var a = Math.max(1, m - Math.round(ltMax * fs)), b = Math.min(L - 2, m - Math.round(ltMin * fs));
      var rr = Math.max(1, Math.round(0.0003 * fs)), w = Math.round(0.0015 * fs);
      var out = [];
      for (i = a; i <= b; i++) {
        if (t[i] < thr) continue;
        var isMax = true;
        for (j = Math.max(0, i - rr); j <= Math.min(L - 1, i + rr); j++) if (t[j] > t[i]) { isMax = false; break; }
        if (!isMax) continue;
        // eigenstaendiges Geraeusch: davor und danach deutlich leiser (kein Anstieg, keine Verschmierung)
        var minB = Infinity, minA = Infinity;
        for (j = Math.max(0, i - w); j <= i; j++) if (t[j] < minB) minB = t[j];
        for (j = i; j <= Math.min(L - 1, i + w); j++) if (t[j] < minA) minA = t[j];
        if (t[i] < 1.2 * minB || t[i] < 1.1 * minA) continue;
        var pos = i + parabolicOffset(t[i - 1], t[i], t[i + 1]);
        if (out.length && pos - out[out.length - 1].pos < 0.0004 * fs) {
          if (t[i] > out[out.length - 1].v) out[out.length - 1] = { pos: pos, v: t[i], lt: (mainOff[q] - pos) / fs };
          continue;
        }
        out.push({ pos: pos, v: t[i], lt: (mainOff[q] - pos) / fs });
      }
      return out;
    }
    var uc = [unlockCands(0), unlockCands(1)];
    var unlock = null;
    uc[0].forEach(function (c0) {
      uc[1].forEach(function (c1) {
        var mLt = (c0.lt + c1.lt) / 2;
        if (Math.abs(c0.lt - c1.lt) <= Math.max(0.0006, 0.1 * mLt) && (!unlock || mLt > unlock.lt)) {
          unlock = { lt: mLt, both: true, pos: [c0.pos, c1.pos] };
        }
      });
    });
    if (!unlock) {
      var allC = uc[0].concat(uc[1]);
      allC.forEach(function (c) { if (!unlock || c.lt > unlock.lt) unlock = { lt: c.lt, both: false }; });
    }
    if (unlock && unlock.both) { firstOff[0] = unlock.pos[0]; firstOff[1] = unlock.pos[1]; }

    // Gegenprobe fuer den Abfallfehler: Liegen Tick und Tack am Hauptgeraeusch uebereinander, sollten
    // ihre Geraeuschmuster zusammenpassen. Passen sie verschoben deutlich besser, ist das Hauptgeraeusch
    // womoeglich nicht bei beiden dasselbe Ereignis -> Abfallfehler unsicher.
    var patternShift = (function () {
      var a = T.tpl[0], b = T.tpl[1], L = T.L;
      var ca = Math.round(mainOff[0]), cb = Math.round(mainOff[1]);
      var W = Math.round(0.008 * fs), maxL = Math.round(0.004 * fs);
      function r(lag) {
        var sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, n = 0;
        for (var j = -W; j <= W; j++) {
          var ia = ca + j, ib = cb + j + lag;
          if (ia < 0 || ia >= L || ib < 0 || ib >= L) continue;
          var xv = a[ia], yv = b[ib];
          sx += xv; sy += yv; sxx += xv * xv; syy += yv * yv; sxy += xv * yv; n++;
        }
        if (n < 10) return -1;
        var cov = sxy - sx * sy / n, vx = sxx - sx * sx / n, vy = syy - sy * sy / n;
        return cov / Math.sqrt(vx * vy + 1e-30);
      }
      var best = { lag: 0, r: -2 };
      for (var lag = -maxL; lag <= maxL; lag++) {
        var rv = r(lag);
        if (rv > best.r) best = { lag: lag, r: rv };
      }
      var r0 = r(0);
      return { lagMs: best.lag / fs * 1000, rBest: best.r, r0: r0 };
    })();
    var patternOk = !(Math.abs(patternShift.lagMs) > 0.4 && patternShift.rBest - patternShift.r0 > 0.08);

    // 4) Zeitpunkte der Schlaege (Bezug: Hauptgeraeusch)
    var points = [];
    beats.forEach(function (b) {
      if (!b.ok) return;
      var t = (b.pos - pre + mainOff[b.parity]) / fs;
      points.push({ k: b.k, t: t, parity: b.parity, v: b.v });
    });
    var fit = fitBeats(points, findGaps(points));
    if (!fit || !isFinite(fit.T) || fit.T <= 0) {
      return { ok: false, reason: 'Auswertung nicht stabil. Bitte nochmals aufnehmen.', bph: bph };
    }
    var gaps = (fit.steps || []).map(function (s) { return { k: s.k, ms: +(s.dt * 1000).toFixed(2) }; });
    if (gaps.length) {   // Zeitpunkte um die Aussetzer bereinigen: Hälften und Papierstreifen sehen eine durchgehende Aufnahme
      points = points.map(function (p) {
        var t = p.t;
        fit.steps.forEach(function (s) { if (p.k >= s.k) t -= s.dt; });
        return { k: p.k, t: t, parity: p.parity, v: p.v };
      });
    }

    // 5) Werte
    var rateRaw = 86400 * (Tn / fit.T - 1);
    var rate = rateRaw + clockPpm * 0.0864;
    var rateSigmaFit = 86400 * Tn * fit.sigmaT / (fit.T * fit.T);
    var beatErrorMs = Math.abs(fit.d) * 1000;

    // Gegenprobe: erste und zweite Haelfte getrennt auswerten. Weichen sie mehr voneinander ab, als die
    // Streuung erwarten laesst (z. B. weil das Tonformat die Zeitpunkte verschmiert), wird die
    // Unsicherheit entsprechend groesser angegeben. Bei gleich langen Haelften gilt:
    // Streuung(Differenz der Haelften) = 4 x Streuung(ganze Aufnahme).
    var kSorted = points.map(function (p) { return p.k; }).sort(function (a, b) { return a - b; });
    var kMid = kSorted[kSorted.length >> 1];
    var fH1 = fitBeats(points.filter(function (p) { return p.k < kMid; }));
    var fH2 = fitBeats(points.filter(function (p) { return p.k >= kMid; }));
    var halves = null;
    if (fH1 && fH2 && fH1.used >= 12 && fH2.used >= 12 && fH1.T > 0 && fH2.T > 0) {
      halves = {
        rate: [86400 * (Tn / fH1.T - 1) + clockPpm * 0.0864, 86400 * (Tn / fH2.T - 1) + clockPpm * 0.0864],
        beatErrorMs: [fH1.d * 1000, fH2.d * 1000]
      };
    }
    var rateSigma = rateSigmaFit;
    if (halves) rateSigma = Math.max(rateSigma, Math.abs(halves.rate[0] - halves.rate[1]) / 4);
    // Schwankt der Gang waehrend der Aufnahme deutlich mehr, als die Messgenauigkeit erklaert?
    var rateStable = !halves || Math.abs(halves.rate[0] - halves.rate[1]) <= Math.max(1.5, 12 * rateSigmaFit);
    var beHalvesOk = !halves || Math.abs(halves.beatErrorMs[0] - halves.beatErrorMs[1]) <= Math.max(0.3, 0.5 * beatErrorMs);
    function ampFrom(lt) {
      var sArg = Math.sin(Math.PI * lt / P);
      return sArg > 0 ? liftAngle / (2 * sArg) : null;
    }
    // Hebezeiten, die eine unmoegliche Amplitude ergaeben, verwerfen
    var lts = liftTimes.filter(function (v) { var a = v != null ? ampFrom(v) : null; return a != null && a <= 450 && a >= 90; });
    var liftTime = null, ltAgree = false;
    if (unlock) {
      liftTime = unlock.lt;
      ltAgree = unlock.both;
    } else if (lts.length === 2) {
      var ltMean = (lts[0] + lts[1]) / 2;
      ltAgree = Math.abs(lts[0] - lts[1]) <= 0.25 * ltMean;
      if (ltAgree) liftTime = ltMean;
      else {
        // Uneinig: meist ist bei einem Schlag die leise Ausloesung untergegangen (zu kurze Hebezeit)
        var ltLong = Math.max(lts[0], lts[1]), ltShort = Math.min(lts[0], lts[1]);
        liftTime = ampFrom(ltLong) >= 150 ? ltLong : ltShort;
      }
    } else if (lts.length === 1) liftTime = lts[0];
    var amplitude = liftTime != null ? ampFrom(liftTime) : null;
    var amplitudeReliable = !dropRepaired && ltAgree && amplitude != null && amplitude >= 120 && amplitude <= 360 &&
      (unlock ? unlock.both : (peakCounts[0] >= 2 && peakCounts[1] >= 2));

    // 6) Signalqualitaet
    var okBeats = beats.filter(function (b) { return b.ok; });
    var detectedFraction = beats.length ? okBeats.length / beats.length : 0;
    var vals = okBeats.map(function (b) {
      var c = Math.round(b.pos - pre + mainOff[b.parity]);
      var a = Math.max(0, c - Math.round(0.001 * fs)), z = Math.min(envS.length, c + Math.round(0.001 * fs) + 1);
      var mv = 0;
      for (var j = a; j < z; j++) if (envS[j] > mv) mv = envS[j];
      return mv;
    }).sort(function (a, b) { return a - b; });
    var medPeak = vals.length ? vals[vals.length >> 1] : 0;
    var snrDb = 20 * Math.log10((medPeak + 1e-30) / noiseS);
    var rhoMed = median(okBeats.map(function (b) { return b.rho; }));
    var residualMs = fit.residualS * 1000;
    var label = 'schwach';
    if (rhoMed >= 0.85 && detectedFraction >= 0.95 && residualMs <= 0.15) label = 'stark';
    else if (rhoMed >= 0.6 && detectedFraction >= 0.8 && residualMs <= 0.4) label = 'mittel';
    // Die leise Ausloesung geht in schwachen Aufnahmen zuerst unter: dann keine sichere Amplitude
    if (label === 'schwach') amplitudeReliable = false;

    // Lieber keine Zahl als eine falsche: zu unsicher -> ablehnen
    if (detectedFraction < 0.5 || fit.used < 20 || !(rateSigma <= 2)) {
      return {
        ok: false,
        reason: 'Signal zu schwach für eine verlässliche Messung. Mikrofon näher an die Krone, ruhiger Raum.',
        bph: bph,
        quality: { label: 'schwach', snrDb: snrDb, detectedFraction: detectedFraction, residualMs: residualMs, similarity: rhoMed }
      };
    }

    // 7) Papierstreifen: Abweichung vom Sollraster (positiv nach oben = Uhr geht vor)
    var kMin = Infinity;
    points.forEach(function (p) { if (p.k < kMin) kMin = p.k; });
    var t0 = fit.c + fit.T * kMin;
    var trace = points.map(function (p) {
      var ideal = t0 + (p.k - kMin) * Tn;
      return { t: +(p.t - t0).toFixed(5), devMs: +(-(p.t - ideal) * 1000).toFixed(4), parity: p.parity };
    });

    return {
      ok: true,
      bph: bph,
      bphScore: +det.score.toFixed(3),
      rate: rate,
      rateRaw: rateRaw,
      rateSigma: rateSigma,
      rateSigmaFit: rateSigmaFit,
      rateStable: rateStable,
      halves: halves,
      beatErrorMs: beatErrorMs,
      beatErrorReliable: !dropRepaired && beHalvesOk && patternOk,
      patternShift: { lagMs: +patternShift.lagMs.toFixed(2), rBest: +patternShift.rBest.toFixed(2), r0: +patternShift.r0.toFixed(2) },
      amplitude: amplitude,
      amplitudeReliable: amplitudeReliable,
      liftTimeMs: liftTime != null ? liftTime * 1000 : null,
      liftAngle: liftAngle,
      clockPpm: clockPpm,
      quality: { label: label, snrDb: snrDb, detectedFraction: detectedFraction, residualMs: residualMs, similarity: rhoMed },
      beatsUsed: fit.used,
      beatsTotal: beats.length,
      gaps: gaps,
      duration: duration,
      soundsPerBeat: peakCounts,
      band: [band.lo, band.hi],
      trace: trace,
      templates: [0, 1].map(function (q) {
        var t = T.tpl[q];
        var Dd = Math.max(1, Math.round(fs / 12000));
        var mxT = 0, j;
        for (j = 0; j < t.length; j++) if (t[j] > mxT) mxT = t[j];
        var out = [];
        for (j = 0; j + Dd <= t.length; j += Dd) {
          var mv = 0;
          for (var u = 0; u < Dd; u++) if (t[j + u] > mv) mv = t[j + u];
          out.push(+(mv / (mxT || 1)).toFixed(4));
        }
        // Bezug 0 ms = Hauptgeraeusch (Fall), wie bei der Zeitmessung
        var ref = mainOff[q];
        return {
          values: out,
          stepMs: Dd / fs * 1000,
          startMs: -ref / fs * 1000,
          firstMs: (firstOff[q] - ref) / fs * 1000,
          lastMs: 0,
          peaksMs: tp[q].peaks.map(function (pp) { return +((pp.pos - ref) / fs * 1000).toFixed(3); })
        };
      })
    };
  }

  /* ---------- Kalibrierung mit einer Quarzuhr (1 Schritt pro Sekunde) ---------- */

  function analyzeQuartz(samples, fs) {
    var x = samples instanceof Float32Array ? samples : Float32Array.from(samples);
    var duration = x.length / fs;
    if (duration < 30) return { ok: false, reason: 'Für die Kalibrierung mindestens 30 Sekunden aufnehmen (besser 2 Minuten).' };
    var hp = highpass(x, fs, Math.min(1000, 0.1 * fs));
    var n = hp.length, i;
    var e = new Float32Array(n);
    for (i = 0; i < n; i++) e[i] = hp[i] * hp[i];
    var env = movingAverage(e, Math.max(1, Math.round(0.0005 * fs)));
    for (i = 0; i < n; i++) env[i] = Math.sqrt(env[i]);
    var noise = approxMedian(env) || 1e-12;
    var Ts = fs; // 1 s
    var w = Math.round(0.15 * fs);
    var anchor = argmax(env, Math.round(0.2 * fs), Math.min(n, Math.round(1.25 * fs)));
    var pts = [];
    for (var dir = -1; dir <= 1; dir += 2) {
      var p = anchor;
      for (var k = 1; ; k++) {
        var pred = p + dir * Ts;
        if (pred - w < 0 || pred + w >= n) break;
        var idx = argmax(env, Math.round(pred - w), Math.round(pred + w) + 1);
        var ok = env[idx] >= 4 * noise;
        if (ok) {
          var off = parabolicOffset(env[idx - 1], env[idx], env[idx + 1]);
          pts.push({ k: dir * k, t: (idx + off) / fs });
          p = idx;
        } else {
          p = Math.round(pred);
        }
      }
    }
    pts.push({ k: 0, t: anchor / fs });
    if (pts.length < 20) return { ok: false, reason: 'Zu wenige Schritte der Quarzuhr erkannt.' };
    // einfache Gerade t = c + k*P mit Ausreissern entfernen
    var use = pts.slice(), P = 1, c = 0, s = 0;
    for (var iter = 0; iter < 3; iter++) {
      var nU = use.length, sk = 0, st = 0, skk = 0, skt = 0;
      use.forEach(function (q) { sk += q.k; st += q.t; skk += q.k * q.k; skt += q.k * q.t; });
      P = (nU * skt - sk * st) / (nU * skk - sk * sk);
      c = (st - P * sk) / nU;
      var res = use.map(function (q) { return q.t - (c + P * q.k); });
      var ss = 0;
      res.forEach(function (r) { ss += r * r; });
      s = Math.sqrt(ss / Math.max(1, nU - 2));
      var lim = Math.max(4 * s, 0.0005);
      var next = use.filter(function (q, j) { return Math.abs(res[j]) <= lim; });
      if (next.length === use.length) break;
      use = next;
    }
    var kMean = 0;
    use.forEach(function (q) { kMean += q.k; });
    kMean /= use.length;
    var sxx = 0;
    use.forEach(function (q) { sxx += (q.k - kMean) * (q.k - kMean); });
    var sigmaP = s / Math.sqrt(sxx);
    return { ok: true, periodS: P, ppm: (P - 1) * 1e6, sigmaPpm: sigmaP * 1e6, steps: use.length, duration: duration };
  }

  var api = {
    version: '0.2.1',
    analyze: analyze,
    analyzeQuartz: analyzeQuartz,
    detectBph: detectBph,
    CANDIDATE_BPH: CANDIDATE_BPH,
    _internal: { fineEnvelope: fineEnvelope, bandEnvelope: bandEnvelope, chooseBand: chooseBand, highpass: highpass, templatePeaks: templatePeaks, trackBeats: trackBeats, movingAverage: movingAverage, approxMedian: approxMedian, buildTemplates: buildTemplates }
  };
  root.Tickwerk = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
