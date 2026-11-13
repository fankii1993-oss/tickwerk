/* Tickwerk: Auswertung im Hintergrund, damit die Oberflaeche fluessig bleibt. */
importScripts('engine/tickwerk-engine.js');
/* Halbe Schlagzahl (0.6.8): Ist bei einer Uhr einer der zwei Schläge deutlich leiser, hält die Engine manchmal nur jeden
   zweiten für einen Schlag und meldet die halbe Schlagzahl. Kennt Tickwerk die Schlagzahl der Uhr (opts.expectBph) und ist
   die erkannte genau die Hälfte, wird dieselbe Aufnahme nochmals mit der hinterlegten Schlagzahl ausgewertet. Findet die
   Engine dabei die übrigen Schläge (mindestens anderthalbmal so viele), gilt dieses Ergebnis; bphFrom merkt sich, was
   zuerst erkannt war. Sonst bleibt das erste Ergebnis, mit dem Vermerk bphHalf: Die Messung zählt dann nicht.
   Die doppelte Schlagzahl wird nicht angefasst: Dort hat die Engine mehr Schläge gehört, als hinterlegt sind. */
var BPH_KNOWN = [12000, 14400, 17280, 18000, 19800, 21600, 25200, 28800, 36000, 43200, 72000];   /* die Schlagzahlen, die die Engine kennt */
function fixHalfBph(r, d) {
  var o = d.opts || {}, exp = o.expectBph, o2 = {}, k, r2 = null;
  if (!r || !r.ok || typeof exp !== 'number' || BPH_KNOWN.indexOf(exp) < 0 || o.bph || r.bph * 2 !== exp) return r;
  for (k in o) o2[k] = o[k];
  o2.bph = exp;
  try { r2 = self.Tickwerk.analyze(d.samples, d.fs, o2); } catch (err) { r2 = null; }
  if (r2 && r2.ok && r2.bph === exp && (!(r.beatsUsed > 0) || !(r2.beatsUsed > 0) || r2.beatsUsed >= 1.5 * r.beatsUsed)) { r2.bphFrom = r.bph; return r2; }
  r.bphHalf = exp; r.beatErrorReliable = false; r.amplitudeReliable = false;
  return r;
}
/* Unmögliche Amplitude (0.6.8): Über etwa 330° schlägt die Unruh an; mehr als 360° kann keine Uhr haben. Solche Werte
   entstehen, wenn die Engine in einem leisen Schlag das falsche Teilgeräusch erwischt. Sie werden nicht gezeigt. */
function saneAmp(r) {
  if (r && r.ok && r.amplitude > 360) { r.amplitude = null; r.amplitudeReliable = false; }
  return r;
}
self.onmessage = function (e) {
  var d = e.data, r;
  try {
    if (d.kind === 'quartz') r = self.Tickwerk.analyzeQuartz(d.samples, d.fs);
    else if (d.kind === 'quartzProbe') r = self.Tickwerk.probeQuartz(d.samples, d.fs);
    else r = saneAmp(fixHalfBph(self.Tickwerk.analyze(d.samples, d.fs, d.opts || {}), d));
  } catch (err) {
    r = { ok: false, reason: 'Fehler in der Auswertung: ' + (err && err.message) };
  }
  if (d.find && r && r.ok) {   /* Position finden (0.7.0): dazu, ob beide Schläge da sind und ob sich die Amplitude bestimmen lässt */
    r = { ok: true, live: true, bph: r.bph, rate: r.rate, rateSigma: r.rateSigma, quality: r.quality, trace: r.trace, bphHalf: r.bphHalf, bphFrom: r.bphFrom,
      amplitude: r.amplitude, amplitudeReliable: r.amplitudeReliable };
  } else if (d.live && r && r.ok) {
    r = { ok: true, live: true, bph: r.bph, rate: r.rate, rateSigma: r.rateSigma, quality: r.quality, trace: r.trace, bphHalf: r.bphHalf };
  } else if (d.reg && r && r.ok) {   /* Regulieren: dazu Abfallfehler, Amplitude und das Frequenzband, ohne die Schlagbilder */
    r = { ok: true, live: true, bph: r.bph, rate: r.rate, rateSigma: r.rateSigma, quality: r.quality, trace: r.trace, band: r.band,
      beatErrorMs: r.beatErrorMs, beatErrorReliable: r.beatErrorReliable, amplitude: r.amplitude, amplitudeReliable: r.amplitudeReliable, liftAngle: r.liftAngle };
  }
  self.postMessage({ id: d.id, r: r, version: self.Tickwerk.version });
};
