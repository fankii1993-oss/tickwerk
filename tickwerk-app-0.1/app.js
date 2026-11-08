/* Tickwerk Web-App: Aufnahme, Auswertung, Verlauf, Uhren. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var KAL = window.TICKWERK_KALIBER || [];
  var KEYS = { watches: 'tickwerk.v1.watches', meas: 'tickwerk.v1.measurements', settings: 'tickwerk.v1.settings' };
  var POS = { ZO: 'Zifferblatt oben', ZU: 'Zifferblatt unten', KU: 'Krone unten', KO: 'Krone oben', KL: 'Krone links', KR: 'Krone rechts' };
  var C = { lume: '#B8F28A', tock: '#9FD8FF', faint: '#8A95A3', line: '#27303B', muted: '#AEB7C2', warn: '#F59B5E', text: '#EEF1F4' };
  var LIVE_FIRST = 6, LIVE_EVERY = 3, LIVE_WINDOW = 10;

  /* ---------- Speicher ---------- */
  function load(key, def) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* voll oder gesperrt */ } }
  var watches = load(KEYS.watches, []);
  var meas = load(KEYS.meas, []);
  var settings = Object.assign({ dur: 30, watchId: '', pos: 'ZO', ppm: 0 }, load(KEYS.settings, {}));
  function saveSettings() { store(KEYS.settings, settings); }

  /* ---------- Format ---------- */
  function fmt(v, d) { return v.toFixed(d).replace('.', ','); }
  function signed(v, d) { var s = fmt(Math.abs(v), d); return (v < 0 && s.replace(/[0,]/g, '') !== '' ? '−' : '+') + s; }
  function thousands(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '’'); }
  function dateStr(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function setStatus(text, kind) { var el = $('status'); el.textContent = text; el.setAttribute('data-kind', kind || ''); }

  /* ---------- Rechnen im Hintergrund ---------- */
  var worker = new Worker('worker.js');
  var jobs = {}, jobSeq = 0, engineVersion = '';
  worker.onmessage = function (e) {
    engineVersion = e.data.version || engineVersion;
    var cb = jobs[e.data.id]; delete jobs[e.data.id];
    if (cb) cb(e.data.r);
  };
  worker.onerror = function () { setStatus('Die Auswertung konnte nicht starten. Seite neu laden.', 'err'); };
  function runJob(payload) {
    return new Promise(function (resolve) { var id = ++jobSeq; jobs[id] = resolve; payload.id = id; worker.postMessage(payload); });
  }

  /* ---------- Uhren ---------- */
  function findWatch(id) { for (var i = 0; i < watches.length; i++) if (watches[i].id === id) return watches[i]; return null; }
  function currentWatch() { return findWatch(settings.watchId); }
  function watchOpts() {
    var w = currentWatch();
    return { liftAngle: w && w.liftAngle ? w.liftAngle : 52, bph: w && w.bph ? w.bph : null, clockPpm: settings.ppm || 0 };
  }
  function watchLabel(w) { return w ? w.name : 'Unbekannte Uhr'; }
  function calName(id) { for (var i = 0; i < KAL.length; i++) if (KAL[i].id === id) return KAL[i].name; return ''; }

  function renderWatchSelect() {
    var sel = $('watch');
    sel.innerHTML = '';
    watches.forEach(function (w) { var o = document.createElement('option'); o.value = w.id; o.textContent = w.name; sel.appendChild(o); });
    var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Unbekannte Uhr'; sel.appendChild(o0);
    var oa = document.createElement('option'); oa.value = '__add'; oa.textContent = '+ Uhr hinzufügen …'; sel.appendChild(oa);
    if (!findWatch(settings.watchId)) settings.watchId = watches.length ? watches[0].id : '';
    sel.value = settings.watchId;
    var op = watchOpts();
    $('watchHint').textContent = 'Hebewinkel ' + fmt(op.liftAngle, op.liftAngle % 1 ? 1 : 0) + '° · Schlagzahl ' +
      (op.bph ? thousands(op.bph) + ' A/h' : 'automatisch') + (op.clockPpm ? ' · Handy-Uhr ' + signed(op.clockPpm, 1) + ' ppm' : '');
    renderHistoryFilter();
  }

  $('watch').addEventListener('change', function () {
    if (this.value === '__add') { this.value = settings.watchId; showScreen('screen-watches'); $('wName').focus(); return; }
    settings.watchId = this.value; saveSettings(); renderWatchSelect();
  });
  $('position').value = POS[settings.pos] ? settings.pos : 'ZO';
  $('position').addEventListener('change', function () { settings.pos = this.value; saveSettings(); });

  /* Formular */
  var editingId = null;
  (function fillCalSelect() {
    var sel = $('wCal');
    var o = document.createElement('option'); o.value = ''; o.textContent = 'Unbekannt oder eigene Angaben'; sel.appendChild(o);
    KAL.forEach(function (k) { var x = document.createElement('option'); x.value = k.id; x.textContent = k.name; sel.appendChild(x); });
  })();
  $('wCal').addEventListener('change', function () {
    var k = null; KAL.forEach(function (x) { if (x.id === $('wCal').value) k = x; });
    if (!k) { $('wCalNote').textContent = ''; return; }
    $('wLift').value = k.hebewinkel || 52;
    $('wBph').value = k.bph ? String(k.bph) : '';
    $('wCalNote').textContent = (k.hebewinkel ? 'Hebewinkel ' + k.hebewinkel + '°' : 'Hebewinkel unbekannt, 52° angenommen') + (k.bph ? ', ' + thousands(k.bph) + ' A/h' : '') + (k.notiz ? '. ' + k.notiz : '');
  });
  function resetForm() {
    editingId = null; $('watchForm').reset(); $('wLift').value = 52; $('wCalNote').textContent = '';
    $('watchFormTitle').textContent = 'Uhr hinzufügen'; $('wSave').textContent = 'Speichern'; $('wCancel').hidden = true;
  }
  $('wCancel').addEventListener('click', resetForm);
  $('watchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('wName').value.trim();
    if (!name) return;
    var lift = parseFloat(String($('wLift').value).replace(',', '.'));
    var w = { id: editingId || ('w' + Date.now().toString(36)), name: name, kaliberId: $('wCal').value, liftAngle: isFinite(lift) && lift >= 30 && lift <= 70 ? lift : 52, bph: $('wBph').value ? parseInt($('wBph').value, 10) : null };
    if (editingId) watches = watches.map(function (x) { return x.id === editingId ? w : x; });
    else watches.push(w);
    store(KEYS.watches, watches);
    settings.watchId = w.id; saveSettings();
    resetForm(); renderWatches(); renderWatchSelect();
    showScreen('screen-measure');
  });
  function renderWatches() {
    var ul = $('watchList'); ul.innerHTML = '';
    if (!watches.length) { ul.innerHTML = '<li class="hint">Noch keine Uhr gespeichert. Unten hinzufügen.</li>'; return; }
    watches.forEach(function (w) {
      var n = meas.filter(function (m) { return m.watchId === w.id; }).length;
      var li = document.createElement('li'); li.className = 'item';
      li.innerHTML = '<span class="t">' + esc(w.name) + '</span>' +
        '<span class="s">' + esc((calName(w.kaliberId) || 'Werk unbekannt') + ' · ' + fmt(w.liftAngle, w.liftAngle % 1 ? 1 : 0) + '° · ' + (w.bph ? thousands(w.bph) + ' A/h' : 'Schlagzahl automatisch')) + '</span>' +
        '<span class="v">' + n + '<small>Messungen</small></span>' +
        '<span class="acts"><button type="button" data-act="edit">Bearbeiten</button><button type="button" data-act="del">Löschen</button></span>';
      li.querySelector('[data-act="edit"]').addEventListener('click', function () {
        editingId = w.id; $('wName').value = w.name; $('wCal').value = w.kaliberId || ''; $('wLift').value = w.liftAngle; $('wBph').value = w.bph ? String(w.bph) : '';
        $('watchFormTitle').textContent = 'Uhr bearbeiten'; $('wSave').textContent = 'Änderungen speichern'; $('wCancel').hidden = false;
        $('watchForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      li.querySelector('[data-act="del"]').addEventListener('click', function () {
        if (!window.confirm('«' + w.name + '» löschen? Die Messungen bleiben im Verlauf.')) return;
        watches = watches.filter(function (x) { return x.id !== w.id; }); store(KEYS.watches, watches);
        if (settings.watchId === w.id) { settings.watchId = ''; saveSettings(); }
        renderWatches(); renderWatchSelect();
      });
      ul.appendChild(li);
    });
  }

  /* ---------- Messdauer ---------- */
  var segBtns = Array.prototype.slice.call(document.querySelectorAll('.seg button'));
  function renderSeg() {
    segBtns.forEach(function (b) { b.setAttribute('aria-checked', String(parseInt(b.dataset.dur, 10) === settings.dur)); });
    if (!rec) $('startSub').textContent = settings.dur + ' Sekunden';
  }
  segBtns.forEach(function (b) {
    b.addEventListener('click', function () { if (rec) return; settings.dur = parseInt(b.dataset.dur, 10); saveSettings(); renderSeg(); });
  });

  /* ---------- Aufnahme ---------- */
  var rec = null, lastRec = null, lastResult = null, wakeLock = null;
  var RING = 339.3;

  function setRing(frac) { $('ringFg').style.strokeDashoffset = String(RING * (1 - Math.max(0, Math.min(1, frac)))); }

  async function start() {
    if (rec) { stopRec(true); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Dieser Browser erlaubt hier keine Mikrofon-Aufnahme. Tickwerk über https öffnen (z. B. in Chrome).', 'err'); return;
    }
    $('startBtn').disabled = true;
    setStatus('Mikrofon wird geöffnet …', 'busy');
    var stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
        video: false
      });
    } catch (e) {
      $('startBtn').disabled = false;
      setStatus(e && e.name === 'NotAllowedError'
        ? 'Mikrofon nicht erlaubt. In Chrome beim Schloss-Symbol neben der Adresse das Mikrofon zulassen.'
        : 'Mikrofon konnte nicht geöffnet werden.', 'err');
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    var ctx = new AC();
    try { await ctx.resume(); } catch (e) { /* egal */ }
    var r = { stream: stream, ctx: ctx, chunks: [], n: 0, fs: ctx.sampleRate, dur: settings.dur, peak: 0, nextLive: LIVE_FIRST, liveBusy: false };
    var src = ctx.createMediaStreamSource(stream);
    var sink = ctx.createGain(); sink.gain.value = 0; sink.connect(ctx.destination);
    function onChunk(samples, peak) {
      if (rec !== r) return;
      r.chunks.push(samples); r.n += samples.length;
      r.peak = Math.max(r.peak * 0.85, peak);
      if (r.n >= r.dur * r.fs) finish();
    }
    try {
      if (ctx.audioWorklet && window.AudioWorkletNode) {
        await ctx.audioWorklet.addModule('recorder-worklet.js');
        var node = new AudioWorkletNode(ctx, 'tw-recorder', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
        node.port.onmessage = function (e) { onChunk(e.data.samples, e.data.peak); };
        src.connect(node); node.connect(sink); r.node = node;
      } else {
        var sp = ctx.createScriptProcessor(4096, 1, 1);
        sp.onaudioprocess = function (e) {
          var d = new Float32Array(e.inputBuffer.getChannelData(0)), p = 0;
          for (var i = 0; i < d.length; i++) { var a = d[i] < 0 ? -d[i] : d[i]; if (a > p) p = a; }
          onChunk(d, p);
        };
        src.connect(sp); sp.connect(sink); r.node = sp;
      }
    } catch (e) {
      stream.getTracks().forEach(function (t) { t.stop(); }); ctx.close();
      $('startBtn').disabled = false;
      setStatus('Aufnahme konnte nicht starten: ' + (e && e.message), 'err'); return;
    }
    r.src = src; r.sink = sink;
    rec = r;
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
    $('startBtn').disabled = false;
    $('startBtn').classList.add('running');
    $('startSub').textContent = 'Tippen zum Abbrechen';
    segBtns.forEach(function (b) { b.disabled = true; });
    $('result').hidden = true;
    $('shareBtn').hidden = true;
    $('liveTape').hidden = false;
    drawTape($('liveTape'), null, 'Der Papierstreifen erscheint nach ein paar Sekunden.');
    setStatus('Aufnahme läuft. Nichts bewegen.', 'busy');
    r.timer = setInterval(tick, 150);
    tick();
  }

  function tick() {
    var r = rec; if (!r) return;
    var t = r.n / r.fs;
    $('startLabel').textContent = Math.max(0, Math.ceil(r.dur - t)) + ' s';
    setRing(t / r.dur);
    var db = 20 * Math.log10(r.peak + 1e-9);   // ca. -80 (still) bis -10 dBFS
    $('levelFill').style.width = Math.max(0, Math.min(100, (db + 80) / 60 * 100)) + '%';
    if (t >= r.nextLive && !r.liveBusy) {
      r.nextLive = t + LIVE_EVERY;
      r.liveBusy = true;
      var tail = tailSamples(r, LIVE_WINDOW);
      runJob({ samples: tail, fs: r.fs, opts: watchOpts(), live: true }).then(function (res) {
        r.liveBusy = false;
        if (rec !== r) return;
        if (res && res.ok) {
          setStatus('Ticken erkannt · ' + thousands(res.bph) + ' A/h · Signal ' + res.quality.label + ' · vorläufig ' + signed(res.rate, 1) + ' s/Tag', 'ok');
          drawTape($('liveTape'), res.trace);
        } else {
          setStatus('Noch kein klares Ticken. Unterkante des Handys näher an die Krone, Raum ruhig halten.', 'err');
        }
      });
    }
  }

  function tailSamples(r, seconds) {
    var want = Math.min(r.n, Math.round(seconds * r.fs));
    var out = new Float32Array(want), pos = want;
    for (var i = r.chunks.length - 1; i >= 0 && pos > 0; i--) {
      var c = r.chunks[i], take = Math.min(c.length, pos);
      out.set(c.subarray(c.length - take), pos - take);
      pos -= take;
    }
    return out;
  }
  function allSamples(r, maxN) {
    var n = Math.min(r.n, maxN), out = new Float32Array(n), pos = 0;
    for (var i = 0; i < r.chunks.length && pos < n; i++) {
      var c = r.chunks[i], take = Math.min(c.length, n - pos);
      out.set(c.subarray(0, take), pos); pos += take;
    }
    return out;
  }

  function cleanup(r) {
    clearInterval(r.timer);
    try { r.src.disconnect(); r.node.disconnect(); r.sink.disconnect(); } catch (e) { /* egal */ }
    r.stream.getTracks().forEach(function (t) { t.stop(); });
    try { r.ctx.close(); } catch (e) { /* egal */ }
    if (wakeLock) { try { wakeLock.release(); } catch (e) { /* egal */ } wakeLock = null; }
    $('startBtn').classList.remove('running');
    $('startLabel').textContent = 'Messen';
    $('startSub').textContent = settings.dur + ' Sekunden';
    $('levelFill').style.width = '0';
    $('liveTape').hidden = true;
    setRing(0);
    segBtns.forEach(function (b) { b.disabled = false; });
  }

  function stopRec(cancelled) {
    var r = rec; if (!r) return;
    rec = null; cleanup(r);
    if (cancelled) setStatus('Abgebrochen.', '');
  }

  function finish() {
    var r = rec; if (!r) return;
    rec = null; cleanup(r);
    var samples = allSamples(r, Math.round(r.dur * r.fs));
    var w = currentWatch();
    lastRec = { samples: samples, fs: r.fs, date: new Date(), watchName: watchLabel(w), pos: settings.pos };
    $('shareBtn').hidden = false;
    analyzeAndShow(samples, r.fs, 'Mikrofon');
  }

  function analyzeAndShow(samples, fs, source) {
    $('startBtn').disabled = true;
    setStatus('Rechne …', 'busy');
    var opts = watchOpts();
    runJob({ samples: samples, fs: fs, opts: opts }).then(function (res) {
      $('startBtn').disabled = false;
      render(res);
      if (res && res.ok) saveMeasurement(res, source);
    });
  }

  /* ---------- Ergebnis ---------- */
  function render(r) {
    lastResult = r;
    if (!r || !r.ok) {
      $('result').hidden = true;
      setStatus((r && r.reason) || 'Keine Messung möglich.', 'err');
      return;
    }
    $('result').hidden = false;
    $('rate').textContent = signed(r.rate, 1);
    $('sigma').textContent = '± ' + fmt(r.rateSigma, 2) + ' s/Tag' +
      (r.rateStable === false && r.halves ? ' · schwankt (' + signed(r.halves.rate[0], 1) + ' / ' + signed(r.halves.rate[1], 1) + ')' : '');
    var v = Math.max(-20, Math.min(20, r.rate));
    $('marker').style.left = ((v + 20) / 40 * 100) + '%';
    var verdict, weak = r.quality && r.quality.label === 'schwach';
    if (r.rateStable === false && !weak) verdict = 'Der Gang hat sich während der Messung verändert. Uhr ruhig liegen lassen und nochmals messen; bleibt es so, läuft das Werk unruhig.';
    else if (weak || r.rateSigma > 0.5) verdict = 'Nur ein grober Wert: das Signal ist schwach. Handy näher an die Krone und nochmals messen.';
    else if (r.rate >= -4 && r.rate <= 6) verdict = 'Im Chronometer-Bereich (−4 bis +6 s/Tag).';
    else if (Math.abs(r.rate) <= 15) verdict = 'Gut für eine Uhr ohne Chronometer-Zertifikat.';
    else verdict = 'Deutlich daneben. In einer anderen Lage nochmals messen; bleibt es so, regulieren lassen.';
    $('verdict').textContent = verdict;
    $('be').textContent = fmt(r.beatErrorMs, 2) + ' ms';
    $('beNote').textContent = r.beatErrorReliable === false ? 'unsicher' : (r.beatErrorMs <= 0.5 ? 'sehr gut' : (r.beatErrorMs <= 1 ? 'in Ordnung' : 'hoch'));
    $('amp').textContent = r.amplitude ? Math.round(r.amplitude) + '°' : '–';
    $('ampNote').textContent = r.amplitude ? (r.amplitudeReliable ? 'bei Hebewinkel ' + fmt(r.liftAngle, r.liftAngle % 1 ? 1 : 0) + '°' : 'unsicher') : '';
    $('bphOut').textContent = thousands(r.bph);
    var q = r.quality;
    $('quality').textContent = { stark: 'Stark', mittel: 'Mittel', schwach: 'Schwach' }[q.label] || q.label;
    $('qualityNote').textContent = Math.round(q.detectedFraction * 100) + ' % der Schläge';
    setStatus('Gemessen: ' + fmt(r.duration, 0) + ' s, ' + r.beatsUsed + ' Schläge' + (r.clockPpm ? ', Handy-Uhr korrigiert' : '') + '. Gespeichert im Verlauf.', 'ok');
    drawTape($('tape'), r.trace);
    drawBeat($('beat'), r.templates, r.liftTimeMs);
    setTimeout(function () { $('result').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }

  function saveMeasurement(r, source) {
    var w = currentWatch();
    meas.push({
      id: Date.now(), watchId: w ? w.id : '', watchName: watchLabel(w), pos: settings.pos, date: new Date().toISOString(), source: source,
      rate: +r.rate.toFixed(2), sigma: +r.rateSigma.toFixed(2), stable: r.rateStable !== false,
      be: +r.beatErrorMs.toFixed(2), beOk: r.beatErrorReliable !== false,
      amp: r.amplitude ? Math.round(r.amplitude) : null, ampOk: !!r.amplitudeReliable, lift: r.liftAngle,
      bph: r.bph, q: r.quality.label, dur: +r.duration.toFixed(1)
    });
    if (meas.length > 1000) meas = meas.slice(meas.length - 1000);
    store(KEYS.meas, meas);
    renderHistory(); renderWatches();
  }

  $('startBtn').addEventListener('click', function () { start(); });
  $('againBtn').addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); start(); });

  /* ---------- Aufnahme als WAV teilen ---------- */
  function encodeWav(samples, fs) {
    var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), i;
    function str(o, s) { for (var k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, fs, true);
    v.setUint32(28, fs * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    var peak = 0; for (i = 0; i < n; i++) { var a = samples[i] < 0 ? -samples[i] : samples[i]; if (a > peak) peak = a; }
    var g = peak > 0 ? 0.9 / peak : 1;   // Pegel anheben, damit die 16 Bit gut genutzt werden
    for (i = 0; i < n; i++) {
      var x = samples[i] * g; x = x > 1 ? 1 : (x < -1 ? -1 : x);
      v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7FFF, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }
  $('shareBtn').addEventListener('click', function () {
    if (!lastRec) return;
    var d = lastRec.date, pad = function (x) { return (x < 10 ? '0' : '') + x; };
    var name = ('tickwerk_' + lastRec.watchName + '_' + lastRec.pos + '_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()))
      .replace(/[^A-Za-z0-9_\-äöüÄÖÜ]+/g, '-') + '.wav';
    var blob = encodeWav(lastRec.samples, lastRec.fs);
    var file = null;
    try { file = new File([blob], name, { type: 'audio/wav' }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Tickwerk Aufnahme' }).catch(function () { /* abgebrochen */ });
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  });

  /* ---------- Dateien (Erweitert) ---------- */
  function decodeFile(file) {
    return file.arrayBuffer().then(function (buf) {
      var Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var ctx = new Ctx(1, 1, 48000);
      return new Promise(function (resolve, reject) {
        var p = ctx.decodeAudioData(buf, resolve, reject);
        if (p && p.then) p.then(resolve, reject);
      });
    }).then(function (ab) {
      var n = ab.length, ch = ab.numberOfChannels, out = new Float32Array(n);
      for (var c = 0; c < ch; c++) { var d = ab.getChannelData(c); for (var i = 0; i < n; i++) out[i] += d[i] / ch; }
      return { samples: out, sampleRate: ab.sampleRate };
    });
  }
  $('fileIn').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    showScreen('screen-measure');
    setStatus('Lese ' + f.name + ' …', 'busy');
    decodeFile(f).then(function (a) {
      var maxN = Math.round(120 * a.sampleRate);
      var s = a.samples.length > maxN ? a.samples.subarray(0, maxN) : a.samples;
      lastRec = { samples: s, fs: a.sampleRate, date: new Date(), watchName: watchLabel(currentWatch()), pos: settings.pos };
      analyzeAndShow(s, a.sampleRate, 'Datei');
    }).catch(function () { setStatus(f.name + ' konnte nicht gelesen werden. Am besten WAV verwenden.', 'err'); });
  });
  $('ppm').value = settings.ppm || 0;
  $('ppm').addEventListener('change', function () {
    var v = parseFloat(String(this.value).replace(',', '.'));
    settings.ppm = isFinite(v) && Math.abs(v) < 500 ? v : 0; saveSettings(); renderWatchSelect();
  });
  $('quartzFile').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    $('quartzOut').textContent = 'Lese ' + f.name + ' …';
    decodeFile(f).then(function (a) {
      return runJob({ kind: 'quartz', samples: a.samples, fs: a.sampleRate });
    }).then(function (q) {
      if (!q.ok) { $('quartzOut').textContent = q.reason; return; }
      settings.ppm = +q.ppm.toFixed(1); saveSettings(); $('ppm').value = settings.ppm; renderWatchSelect();
      $('quartzOut').textContent = 'Die Handy-Uhr weicht um ' + fmt(q.ppm, 1) + ' ppm ab (± ' + fmt(q.sigmaPpm, 1) + '), das sind ' + fmt(q.ppm * 0.0864, 2) + ' s/Tag. Wird ab jetzt korrigiert.';
    }).catch(function () { $('quartzOut').textContent = f.name + ' konnte nicht gelesen werden.'; });
  });

  /* ---------- Verlauf ---------- */
  function renderHistoryFilter() {
    var sel = $('historyFilter'), keep = sel.value;
    sel.innerHTML = '<option value="*">Alle Uhren</option>';
    var seen = {};
    watches.forEach(function (w) { seen[w.id] = true; var o = document.createElement('option'); o.value = w.id; o.textContent = w.name; sel.appendChild(o); });
    if (meas.some(function (m) { return !m.watchId || !seen[m.watchId]; })) {
      var o = document.createElement('option'); o.value = ''; o.textContent = 'Ohne Uhr / gelöschte'; sel.appendChild(o);
    }
    sel.value = keep && Array.prototype.some.call(sel.options, function (x) { return x.value === keep; }) ? keep : '*';
  }
  $('historyFilter').addEventListener('change', renderHistory);
  function filteredMeas() {
    var f = $('historyFilter').value || '*';
    var known = {}; watches.forEach(function (w) { known[w.id] = true; });
    return meas.filter(function (m) { return f === '*' || (f === '' ? (!m.watchId || !known[m.watchId]) : m.watchId === f); });
  }
  function renderHistory() {
    var list = filteredMeas();
    var ul = $('historyList'); ul.innerHTML = '';
    $('historyEmpty').hidden = list.length > 0;
    list.slice().reverse().forEach(function (m) {
      var li = document.createElement('li'); li.className = 'item';
      var parts = [dateStr(m.date), POS[m.pos] || '', 'Abfallfehler ' + fmt(m.be, 2) + ' ms' + (m.beOk ? '' : ' (unsicher)')];
      if (m.amp) parts.push('Amplitude ' + m.amp + '°' + (m.ampOk ? '' : ' (unsicher)'));
      parts.push('Signal ' + m.q);
      li.innerHTML = '<span class="t">' + esc(m.watchName || 'Unbekannte Uhr') + '</span>' +
        '<span class="s">' + esc(parts.join(' · ')) + '</span>' +
        '<span class="v">' + signed(m.rate, 1) + '<small>± ' + fmt(m.sigma, 2) + (m.stable ? '' : ', schwankt') + '</small></span>' +
        '<span class="acts"><button type="button">Löschen</button></span>';
      li.querySelector('button').addEventListener('click', function () {
        meas = meas.filter(function (x) { return x.id !== m.id; }); store(KEYS.meas, meas); renderHistory(); renderWatches();
      });
      ul.appendChild(li);
    });
    drawHistory(list.slice(-40));
  }

  /* ---------- Zeichnen ---------- */
  function setupCanvas(cv) {
    var dpr = window.devicePixelRatio || 1;
    if (!cv.dataset.h) cv.dataset.h = cv.getAttribute('height');   // logische Hoehe merken (Attribut wird mit dpr ueberschrieben)
    var w = cv.clientWidth || 320, h = parseInt(cv.dataset.h, 10);
    cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }
  function niceStep(range, target) {
    var raw = range / target, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  function emptyText(g, text) { g.ctx.fillStyle = C.faint; g.ctx.font = '13px Inter, sans-serif'; g.ctx.fillText(text, 14, g.h / 2 + 4); }

  function drawTape(cv, trace, emptyMsg) {
    var g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    var L = 50, R = 10, T = 10, B = 22;
    if (!trace || !trace.length) { emptyText(g, emptyMsg || 'Noch keine Messung'); return; }
    var tMax = 0, yMin = Infinity, yMax = -Infinity, ys0 = trace.map(function (p) { return p.devMs; }).sort(function (a, b) { return a - b; });
    trace.forEach(function (p) { if (p.t > tMax) tMax = p.t; });
    // Ausreisser nicht die Skala bestimmen lassen
    yMin = ys0[Math.floor(ys0.length * 0.02)]; yMax = ys0[Math.ceil(ys0.length * 0.98) - 1];
    var mid = (yMin + yMax) / 2, half = Math.max(0.8, (yMax - yMin) / 2 * 1.2);
    yMin = mid - half; yMax = mid + half;
    var X = function (t) { return L + (t / (tMax || 1)) * (w - L - R); };
    var Y = function (v) { return T + (1 - (v - yMin) / (yMax - yMin)) * (h - T - B); };
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.fillStyle = C.faint; ctx.font = '11px "IBM Plex Mono", monospace';
    var ys = niceStep(yMax - yMin, 4);
    for (var v = Math.ceil(yMin / ys) * ys; v <= yMax; v += ys) {
      var yy = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(w - R, yy); ctx.stroke();
      ctx.fillText((v > 0 ? '+' : '') + fmt(v, ys < 1 ? 1 : 0) + ' ms', 2, yy + 4);
    }
    var xs = niceStep(Math.max(tMax, 1), 5);
    for (var s = 0; s <= tMax + 1e-9; s += xs) ctx.fillText(fmt(s, 0) + ' s', Math.min(Math.round(X(s)) - 6, w - R - 28), h - 6);
    trace.forEach(function (p) {
      var yv = Math.max(yMin, Math.min(yMax, p.devMs));
      ctx.fillStyle = p.parity ? C.tock : C.lume;
      ctx.beginPath(); ctx.arc(X(p.t), Y(yv), 1.9, 0, Math.PI * 2); ctx.fill();
    });
  }

  function drawBeat(cv, tpls, liftTimeMs) {
    var g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    var L = 10, R = 10, T = 18, B = 24;
    if (!tpls) { emptyText(g, 'Noch keine Messung'); return; }
    var lt = liftTimeMs || 0;
    var x0 = -Math.max(6, lt + 3.5), x1 = 5;
    var X = function (ms) { return L + (ms - x0) / (x1 - x0) * (w - L - R); };
    var Y = function (v) { return T + (1 - v) * (h - T - B); };
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.setLineDash([3, 4]); ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
    (lt ? [-lt, 0] : [0]).forEach(function (ms) { var xx = Math.round(X(ms)) + 0.5; ctx.beginPath(); ctx.moveTo(xx, T - 6); ctx.lineTo(xx, h - B); ctx.stroke(); });
    ctx.setLineDash([]);
    ctx.fillStyle = C.muted;
    if (lt) ctx.fillText('Auslösung', X(-lt) + 4, T + 2);
    ctx.fillText('Fall', X(0) + 4, T + 2);
    ctx.fillStyle = C.faint;
    if (lt) ctx.fillText('Hebezeit ' + fmt(lt, 2) + ' ms', X(-lt) + 4, h - 7);
    [1, 0].forEach(function (q) {
      var tp = tpls[q];
      ctx.strokeStyle = q ? C.tock : C.lume; ctx.lineWidth = 1.5; ctx.beginPath();
      var started = false;
      tp.values.forEach(function (val, i) {
        var ms = tp.startMs + i * tp.stepMs;
        if (ms < x0 || ms > x1) return;
        if (!started) { ctx.moveTo(X(ms), Y(val)); started = true; } else ctx.lineTo(X(ms), Y(val));
      });
      ctx.stroke();
    });
  }

  function drawHistory(list) {
    var cv = $('historyChart'), g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    var L = 46, R = 10, T = 10, B = 20;
    if (!list.length) { emptyText(g, 'Noch keine Messungen'); return; }
    var lo = -8, hi = 10;
    list.forEach(function (m) { lo = Math.min(lo, m.rate - m.sigma); hi = Math.max(hi, m.rate + m.sigma); });
    lo = Math.max(lo, -60); hi = Math.min(hi, 60);
    var X = function (i) { return list.length === 1 ? (L + w - R) / 2 : L + i / (list.length - 1) * (w - L - R); };
    var Y = function (v) { return T + (1 - (v - lo) / (hi - lo)) * (h - T - B); };
    ctx.fillStyle = 'rgba(184, 242, 138, 0.10)';
    ctx.fillRect(L, Y(6), w - L - R, Y(-4) - Y(6));
    ctx.strokeStyle = C.line; ctx.fillStyle = C.faint; ctx.font = '11px "IBM Plex Mono", monospace';
    var st = niceStep(hi - lo, 4);
    for (var v = Math.ceil(lo / st) * st; v <= hi; v += st) {
      var yy = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(w - R, yy); ctx.stroke();
      ctx.fillText((v > 0 ? '+' : '') + fmt(v, 0) + ' s', 2, yy + 4);
    }
    ctx.fillText(dateStr(list[0].date), L, h - 5);
    list.forEach(function (m, i) {
      var x = X(i), y = Y(Math.max(lo, Math.min(hi, m.rate)));
      ctx.strokeStyle = C.faint; ctx.beginPath();
      ctx.moveTo(x, Y(Math.max(lo, m.rate - m.sigma))); ctx.lineTo(x, Y(Math.min(hi, m.rate + m.sigma))); ctx.stroke();
      ctx.fillStyle = m.q === 'schwach' ? C.faint : C.lume;
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    });
  }

  /* ---------- Bereiche ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabbar button'));
  function showScreen(id) {
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.screen === id)); });
    ['screen-measure', 'screen-history', 'screen-watches'].forEach(function (s) { $(s).hidden = s !== id; });
    if (id === 'screen-history') renderHistory();
    if (id === 'screen-measure' && lastResult && lastResult.ok) { drawTape($('tape'), lastResult.trace); drawBeat($('beat'), lastResult.templates, lastResult.liftTimeMs); }
    window.scrollTo(0, 0);
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { showScreen(t.dataset.screen); }); });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (lastResult && lastResult.ok && !$('result').hidden) { drawTape($('tape'), lastResult.trace); drawBeat($('beat'), lastResult.templates, lastResult.liftTimeMs); }
      if (!$('screen-history').hidden) renderHistory();
    }, 150);
  });

  /* ---------- Installieren ---------- */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; $('installBtn').hidden = false; });
  $('installBtn').addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () { deferredPrompt = null; $('installBtn').hidden = true; });
  });
  window.addEventListener('appinstalled', function () { $('installBtn').hidden = true; });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* ohne Offline-Modus weiter */ });
  }

  /* ---------- Start ---------- */
  renderSeg();
  renderWatchSelect();
  renderWatches();
  runJob({ samples: new Float32Array(48000 * 5), fs: 48000, opts: {} }).then(function () {
    $('versionInfo').textContent = 'Tickwerk Web-App 0.1 · Mess-Engine ' + (engineVersion || '?');
  });
})();
