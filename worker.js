/* Tickwerk: Auswertung im Hintergrund, damit die Oberflaeche fluessig bleibt. */
importScripts('engine/tickwerk-engine.js');
self.onmessage = function (e) {
  var d = e.data, r;
  try {
    if (d.kind === 'quartz') r = self.Tickwerk.analyzeQuartz(d.samples, d.fs);
    else if (d.kind === 'quartzProbe') r = self.Tickwerk.probeQuartz(d.samples, d.fs);
    else r = self.Tickwerk.analyze(d.samples, d.fs, d.opts || {});
  } catch (err) {
    r = { ok: false, reason: 'Fehler in der Auswertung: ' + (err && err.message) };
  }
  if (d.live && r && r.ok) {
    r = { ok: true, live: true, bph: r.bph, rate: r.rate, rateSigma: r.rateSigma, quality: r.quality, trace: r.trace };
  }
  self.postMessage({ id: d.id, r: r, version: self.Tickwerk.version });
};
