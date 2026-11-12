/* Tickwerk Web-App 0.6: Messen, Lagen-Test, Regulieren, Gangreserve-Test, Uhren, Verlauf, Gang im Alltag, Werk-Detektiv, Pro.
   Deutsch, Englisch, Französisch und Italienisch. */
(function () {
  'use strict';

  /* ---------- Sprache: Deutsch ist die Quelle, die anderen kommen aus den Wörterbüchern en.js, fr.js und it.js
     (Schlüssel = deutscher Text). «Automatisch» folgt der Sprache des Handys: Deutsch, Französisch oder Italienisch,
     sonst Englisch. ---------- */
  var LANGS = ['de', 'en', 'fr', 'it'];
  var LANG = (function () {
    var cfg = window.TICKWERK_CONFIG || {}, v = 'auto';
    var pre = typeof cfg.storage === 'string' && /^[a-z][a-z0-9.]{2,30}$/.test(cfg.storage) ? cfg.storage : 'tickwerk.v1';
    try { var s0 = JSON.parse(localStorage.getItem(pre + '.settings') || '{}'); if (s0 && LANGS.indexOf(s0.lang) >= 0) v = s0.lang; } catch (e) { /* egal */ }
    if (v === 'auto') { var nl = String(navigator.language || '').toLowerCase().slice(0, 2); v = LANGS.indexOf(nl) >= 0 ? nl : 'en'; }
    return v;
  })();
  var I18N = window.TICKWERK_I18N || {};
  var EN = LANG !== 'de' && I18N[LANG] ? I18N[LANG] : {};   /* Wörterbuch der gewählten Sprache */
  var LOC = { de: 'de-CH', en: 'en-GB', fr: 'fr-CH', it: 'it-CH' }[LANG];
  var PRIVACY = { de: 'datenschutz.html', en: 'privacy.html', fr: 'privacy-fr.html', it: 'privacy-it.html' }[LANG];
  function hasKey(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  /* T('Text') übersetzt; T('Noch {n} Messungen', { n: 3 }) setzt Werte ein */
  function T(s, v) {
    var out = typeof s === 'string' && hasKey(EN, s) ? EN[s] : s;
    if (v) out = String(out).replace(/\{(\w+)\}/g, function (m, k) { return hasKey(v, k) ? String(v[k]) : m; });
    return out;
  }
  /* Feste Texte der Seite (Textknoten und Beschriftungen) einmal beim Start übersetzen */
  function translateStatic(root) {
    if (LANG === 'de') return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, nodes = [];
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var p = node.parentNode && node.parentNode.nodeName;
      if (p === 'SCRIPT' || p === 'STYLE') return;
      var raw = node.nodeValue, key = raw.replace(/\s+/g, ' ').trim();
      if (key && hasKey(EN, key)) node.nodeValue = raw.match(/^\s*/)[0] + EN[key] + raw.match(/\s*$/)[0];
      else if (LANG === 'en' && /^[\d’]+$/.test(key) && key.indexOf('’') > 0) node.nodeValue = raw.replace(/’/g, ',');   /* Zahlen wie 28’800 -> 28,800 */
    });
    Array.prototype.forEach.call(root.querySelectorAll('[placeholder],[aria-label],[title],[alt]'), function (el) {
      ['placeholder', 'aria-label', 'title', 'alt'].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && hasKey(EN, v.trim())) el.setAttribute(a, EN[v.trim()]);
      });
    });
  }
  document.documentElement.lang = { de: 'de-CH', en: 'en', fr: 'fr-CH', it: 'it-CH' }[LANG];
  if (LANG !== 'de') {
    document.title = T(document.title); translateStatic(document.body);
    Array.prototype.forEach.call(document.querySelectorAll('a[href="datenschutz.html"]'), function (a) { a.setAttribute('href', PRIVACY); });
  }

  /* Nicht eingebettet in fremden Seiten laufen (Schutz vor untergeschobenen Klicks) */
  if (window.top !== window.self) {
    document.documentElement.className += ' framed';
    var fm = document.createElement('p'), fa = document.createElement('a');
    fm.className = 'framed-msg'; fa.href = location.href; fa.target = '_blank'; fa.rel = 'noopener';
    fa.textContent = T('Tickwerk in einem eigenen Fenster öffnen');
    fm.appendChild(fa); document.body.appendChild(fm);
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var KAL = window.TICKWERK_KALIBER || [];
  var UHREN = window.TICKWERK_UHREN || [];
  var CFG = window.TICKWERK_CONFIG || {};
  var FLAVOR = CFG.flavor === 'store' ? 'store' : 'test';
  var APP_VERSION = '0.6.6';
  var PREFIX = typeof CFG.storage === 'string' && /^[a-z][a-z0-9.]{2,30}$/.test(CFG.storage) ? CFG.storage : 'tickwerk.v1';
  var KEYS = { watches: PREFIX + '.watches', meas: PREFIX + '.measurements', settings: PREFIX + '.settings', session: PREFIX + '.session', pro: PREFIX + '.pro', log: PREFIX + '.log' };
  var PRO_SKU = typeof CFG.proSku === 'string' && /^[a-z0-9._]{1,40}$/.test(CFG.proSku) ? CFG.proSku : 'tickwerk_pro';
  var BACKEND = typeof CFG.billingBackend === 'string' && /^https:\/\/[A-Za-z0-9.\-]+(:\d+)?(\/[A-Za-z0-9._\-\/]*)?$/.test(CFG.billingBackend) ? CFG.billingBackend : '';
  var PRICE = typeof CFG.price === 'string' ? CFG.price.slice(0, 20) : 'CHF 9.99';
  var FREE_PER_WEEK = 3, FREE_HISTORY = 5, FREE_DETAIL = 3, MAX_MEAS = 3000, MAX_WATCHES = 200, TRACE_KEEP = 40;
  var POS = { ZO: T('Zifferblatt oben'), ZU: T('Zifferblatt unten'), KU: T('Krone unten'), KO: T('Krone oben'), KL: T('Krone links'), KR: T('Krone rechts') };
  var POS_HINT = {
    ZO: T('Uhr flach hinlegen, Zifferblatt nach oben. Die Unterkante des Handys an die Krone.'),
    ZU: T('Uhr umdrehen, Zifferblatt nach unten, am besten auf ein weiches Tuch.'),
    KU: T('Uhr aufstellen, die Krone zeigt nach unten. Zum Beispiel zwischen zwei Bücher klemmen.'),
    KO: T('Uhr aufstellen, die Krone zeigt nach oben. Das Handy mit der Unterkante von oben an die Krone halten, nur leicht andrücken und den Arm aufstützen.'),
    KL: T('Uhr aufstellen, die Krone zeigt nach links. Die 6 steht oben.'),
    KR: T('Uhr aufstellen, die Krone zeigt nach rechts. Die 12 steht oben.')
  };
  var HORIZ = { ZO: true, ZU: true };
  var POS_ORDER = ['ZO', 'ZU', 'KU', 'KO', 'KL', 'KR'];
  var SETS = { 4: ['ZO', 'ZU', 'KU', 'KL'], 6: ['ZO', 'ZU', 'KU', 'KO', 'KL', 'KR'] };
  var C = { lume: '#B8F28A', tock: '#9FD8FF', faint: '#8A95A3', line: '#27303B', line2: '#3A4452', muted: '#AEB7C2', warn: '#F59B5E', text: '#EEF1F4', band: 'rgba(184, 242, 138, 0.10)' };
  var LIVE_FIRST = 6, LIVE_EVERY = 3, LIVE_WINDOW = 10, SETTLE = 5;
  /* Automatischer Start: zuhören, bis das Ticken in zwei kurzen Fenstern nacheinander klar ist */
  var SEARCH_WINDOW = 4.5, SEARCH_EVERY = 1.25, SEARCH_NEED = 2, SEARCH_KEEP = 6, SEARCH_MAX = 120;
  /* Countdown vor jeder Messung (statt Vibration): so lange hört Tickwerk schon zu, verwendet die Takte aber noch nicht */
  var COUNTDOWN = 3;
  /* Gezählt wird bis ±0,5 s/Tag. Sind die Klicks klar, schwankt aber der Gang während der Messung, bis ±1,5 s/Tag mit Vermerk */
  var SIGMA_COUNT = 1.5, SIGMA_SURE = 0.5;
  /* Unsichere Messung verlängern: Ist das Signal klar, der Wert nach der gewählten Dauer aber unsicherer als ±0,5 s/Tag
     (so viel verträgt eine Wertung), läuft die Aufnahme bis 60 s weiter. Die Unsicherheit sinkt mit der Dauer stark
     (bei doppelter Zeit auf etwa einen Drittel), und ein schwankender Gang mittelt sich besser. Bewusst einfach: eine
     Verlängerung auf die längste wählbare Dauer, statt in Schritten nachzurechnen. Bei schwachem Signal hilft mehr Zeit
     nicht (die Messung zählt dann ohnehin nicht): dort wird nicht verlängert, sondern gleich das Ergebnis gezeigt. */
  var EXTEND_TO = 60;

  /* ---------- Speicher ---------- */
  function load(key, def) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }
  function unstore(key) { try { localStorage.removeItem(key); } catch (e) { /* gesperrt */ } }
  function own(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }
  function finite(v, d) { v = typeof v === 'number' ? v : NaN; return isFinite(v) ? v : d; }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 200) : ''; }
  function cleanWatch(w) {
    if (!w || typeof w !== 'object' || !str(w.id) || !str(w.name)) return null;
    var lift = finite(w.liftAngle, 52), bph = finite(w.bph, 0);
    var out = { id: str(w.id, 40), name: str(w.name, 60), kaliberId: str(w.kaliberId, 60),
      liftAngle: lift >= 30 && lift <= 70 ? lift : 52, bph: bph >= 3600 && bph <= 72000 ? Math.round(bph) : null };
    /* Zeitvergleiche (Gang im Alltag): Zeitpunkt und Abweichung der Uhr in Sekunden */
    var tv = (Array.isArray(w.tv) ? w.tv : []).slice(-100).map(function (x) {
      var d = new Date(str(x && x.t, 40)), o = finite(x && x.o, NaN), u = finite(x && x.u, NaN);
      if (isNaN(d.getTime()) || !isFinite(o) || !(Math.abs(o) < 86400)) return null;
      var v = { t: d.toISOString(), o: Math.round(o * 100) / 100 };
      /* Quelle der Zeit: q «n» ist die genaue Zeit aus dem Internet, u ihre Unsicherheit in Sekunden. Ohne q: die Uhr des Handys. */
      if (x.q === 'n' && u >= 0 && u <= 1) { v.q = 'n'; v.u = Math.round(u * 1000) / 1000; }
      return v;
    }).filter(Boolean).sort(function (a, b) { return new Date(a.t) - new Date(b.t); });
    if (tv.length) out.tv = tv;
    /* Quarzuhr: Referenz für «Gang im Alltag» und für die Eichung. Mit dem Mikrofon wird sie nicht gemessen. */
    if (w.quarz === true) { out.quarz = true; out.kaliberId = ''; out.bph = null; }
    /* Gangreserve-Test: Kennung, Zeitpunkt der ersten Messung (voll aufgezogen), allenfalls «stehen geblieben» */
    if (w.gr && typeof w.gr === 'object' && typeof w.gr.id === 'string' && /^[A-Za-z0-9]{1,24}$/.test(w.gr.id)) {
      var g0 = new Date(str(w.gr.t0, 40)), gs = new Date(str(w.gr.stop, 40));
      out.gr = { id: str(w.gr.id, 24), t0: isNaN(g0.getTime()) ? '' : g0.toISOString() };
      if (out.gr.t0 && !isNaN(gs.getTime())) out.gr.stop = gs.toISOString();
    }
    return out;
  }
  function cleanTrace(tr) {
    if (!tr || !Array.isArray(tr.t) || !Array.isArray(tr.d) || typeof tr.p !== 'string') return undefined;
    var n = Math.min(tr.t.length, tr.d.length, tr.p.length, 2000), t = [], d = [], p = '';
    for (var i = 0; i < n; i++) {
      if (typeof tr.t[i] !== 'number' || typeof tr.d[i] !== 'number' || !isFinite(tr.t[i]) || !isFinite(tr.d[i])) return undefined;
      t.push(tr.t[i]); d.push(tr.d[i]); p += tr.p.charAt(i) === '1' ? '1' : '0';
    }
    return n ? { t: t, d: d, p: p } : undefined;
  }
  function cleanMeas(m) {
    if (!m || typeof m !== 'object') return null;
    var rate = finite(m.rate, NaN), sigma = finite(m.sigma, NaN), date = new Date(str(m.date, 40));
    if (!isFinite(rate) || !isFinite(sigma) || isNaN(date.getTime())) return null;
    var amp = finite(m.amp, 0), out = {
      id: finite(m.id, 0) || date.getTime(), watchId: str(m.watchId, 40), watchName: str(m.watchName, 60), pos: own(POS, m.pos) ? m.pos : 'ZO',
      date: date.toISOString(), source: m.source === 'Datei' ? 'Datei' : 'Mikrofon', rate: rate, sigma: Math.abs(sigma), stable: m.stable !== false,
      be: Math.abs(finite(m.be, 0)), beOk: m.beOk === true, amp: amp > 0 && amp < 400 ? amp : null, ampOk: m.ampOk === true,
      lift: finite(m.lift, 52), bph: Math.round(finite(m.bph, 0)), q: ['stark', 'mittel', 'schwach'].indexOf(m.q) >= 0 ? m.q : 'schwach', dur: finite(m.dur, 0)
    };
    if (typeof m.ppm === 'number' && isFinite(m.ppm)) out.ppm = m.ppm;
    /* Quelle der Eichung, mit der korrigiert wurde (q Quarzuhr, z Internetzeit, h von Hand), und ihre Unsicherheit in ppm */
    if (m.cq === 'q' || m.cq === 'z' || m.cq === 'h') { out.cq = m.cq; if (finite(m.cu, -1) >= 0 && m.cu < 100) out.cu = m.cu; }
    if (finite(m.fs, 0) > 0) out.fs = m.fs;
    if (str(m.eng, 20)) out.eng = str(m.eng, 20);
    if (str(m.app, 20)) out.app = str(m.app, 20);
    if (m.fp === true) out.fp = true;
    if (str(m.sess, 40)) out.sess = str(m.sess, 40);
    if (m.lset === 4 || m.lset === 6) out.lset = m.lset;
    if (typeof m.gr === 'string' && /^[A-Za-z0-9]{1,24}$/.test(m.gr)) { out.gr = m.gr; out.grs = m.grs === 1 || m.grs === 2 ? m.grs : 0; }
    var tr = cleanTrace(m.tr); if (tr) out.tr = tr;
    return out;
  }
  function list(v, fn) { return (Array.isArray(v) ? v : []).map(fn).filter(Boolean); }
  function cleanFree(f) {
    if (!f || typeof f !== 'object' || typeof f.week !== 'string') return { week: '', used: 0 };
    return { week: str(f.week, 10), used: Math.max(0, Math.min(FREE_PER_WEEK, Math.round(finite(f.used, 0)))) };
  }
  function cleanSession(s) {
    if (!s || typeof s !== 'object' || !str(s.id)) return null;
    var set = s.set === 4 ? 4 : 6;
    return { id: str(s.id, 40), watchId: str(s.watchId, 40), set: set, started: str(s.started, 40), cur: SETS[set].indexOf(s.cur) >= 0 ? s.cur : SETS[set][0] };
  }
  function cleanPro(p) {
    if (!p || typeof p !== 'object' || p.active !== true) return null;
    return { active: true, since: str(p.since, 40), via: p.via === 'backend' ? 'backend' : 'play' };
  }

  /* Klappkarten auf der Seite der Uhr: Kennung -> Element, und ob sie am Anfang offen sind */
  var FOLDS = { dt: 'dTimeCard', gr: 'dGrCard', lg: 'dLagenCard', ms: 'dListCard' }, FOLD_OPEN = { dt: false, gr: false, lg: false, ms: true };
  function cleanFold(f) {
    var out = {};
    Object.keys(FOLDS).forEach(function (k) { out[k] = f && typeof f === 'object' && typeof f[k] === 'boolean' ? f[k] : FOLD_OPEN[k]; });
    return out;
  }

  var watches = list(load(KEYS.watches, []), cleanWatch).slice(0, MAX_WATCHES);
  var meas = list(load(KEYS.meas, []), cleanMeas).slice(-MAX_MEAS);
  var S = load(KEYS.settings, {});
  if (!S || typeof S !== 'object') S = {};
  var settings = {
    dur: [20, 30, 60].indexOf(S.dur) >= 0 ? S.dur : 30,
    watchId: str(S.watchId, 40),
    pos: own(POS, S.pos) ? S.pos : 'ZO',
    ppm: Math.abs(finite(S.ppm, 0)) < 500 ? finite(S.ppm, 0) : 0,
    lagenSet: S.lagenSet === 4 ? 4 : 6,
    guideSeen: S.guideSeen === true || meas.length > 0,
    autoStart: S.autoStart !== false,
    lang: LANGS.indexOf(S.lang) >= 0 ? S.lang : 'auto',
    quartzRate: Math.abs(finite(S.quartzRate, 0)) <= 10 ? finite(S.quartzRate, 0) : 0,
    quartzRaw: Math.abs(finite(S.quartzRaw, NaN)) < 500 ? S.quartzRaw : null,
    quartzSrc: S.quartzSrc === 'uhr' ? 'uhr' : '',   /* woher der Gang der Quarzuhr stammt: «uhr» aus Gang im Alltag, «hand» eingetragen, leer unbekannt */
    quartzSig: finite(S.quartzSig, -1) >= 0 && S.quartzSig <= 5 ? S.quartzSig : null,   /* seine Unsicherheit in s/Tag */
    calSig: finite(S.calSig, -1) >= 0 && S.calSig < 50 ? S.calSig : null,   /* Unsicherheit der Messung an der Quarzuhr in ppm (eingebautes Mikrofon) */
    netTime: S.netTime === 'ja' || S.netTime === 'nein' ? S.netTime : '',   /* genaue Zeit aus dem Internet: ja, nein oder noch nicht gefragt */
    netFor: typeof S.netFor === 'string' ? str(S.netFor, 80) : S.netTime === 'ja' ? 'self' : '',   /* wem das «ja» galt (0.6.5: nur dem Server der App) */
    netPick: S.netPick === 'a' || S.netPick === 's' ? S.netPick : '',   /* nur Testversion: Zeitquelle fest wählen (a Zeitdienst, s Server der App), leer = automatisch */
    calSrc: S.calSrc === 'zeit' ? 'zeit' : '',   /* Quelle der Eichung des eingebauten Mikrofons: «zeit» = mit Internetzeit, sonst Quarzuhr oder von Hand */
    calZeit: cleanCalZeit(S.calZeit),   /* letzte Eichung mit Internetzeit, nur für die Diagnose */
    netLast: cleanNetLast(S.netLast),   /* letzte Zeitabfrage, nur für die Diagnose */
    testPro: S.testPro !== false,
    free: cleanFree(S.free),
    micId: str(S.micId, 200), micLabel: str(S.micLabel, 100),
    cal: cleanCal(S.cal),   /* Eichung je angestecktem Mikrofon; das eingebaute steht in ppm, quartzRaw und calAt */
    calAt: isoDate(S.calAt), calNag: isoDate(S.calNag),   /* wann geeicht; wann zuletzt an eine alte Eichung erinnert */
    fold: cleanFold(S.fold),   /* welche Karten auf der Seite der Uhr aufgeklappt sind */
    extend: S.extend !== false,   /* unsichere Messung von selbst verlängern (bis 60 s) */
    seenVersion: /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(str(S.seenVersion, 12)) ? S.seenVersion : ''   /* bis zu welcher Version «Was ist neu» gezeigt wurde */
  };
  if (settings.quartzSrc === 'uhr' && settings.quartzSig == null) settings.quartzSrc = '';
  if (!settings.quartzSrc && settings.quartzRate) settings.quartzSrc = 'hand';
  var session = cleanSession(load(KEYS.session, null));
  var proState = cleanPro(load(KEYS.pro, null));
  var lastId = meas.reduce(function (a, m) { return Math.max(a, m.id); }, 0);
  function nextId() { var t = Date.now(); lastId = t > lastId ? t : lastId + 1; return lastId; }
  function saveSettings() { store(KEYS.settings, settings); }
  function saveWatches() { store(KEYS.watches, watches); }
  function saveSession() { if (session) store(KEYS.session, session); else unstore(KEYS.session); }
  function saveMeas() {
    if (store(KEYS.meas, meas)) return;
    var kept = 0;   /* Speicher voll: zuerst die Papierstreifen älterer Messungen weglassen */
    for (var i = meas.length - 1; i >= 0; i--) { if (meas[i].tr && ++kept > 5) delete meas[i].tr; }
    if (!store(KEYS.meas, meas)) toast(T('Der Speicher ist voll. Alte Messungen löschen oder unter Einstellungen eine Sicherung speichern.'));
  }

  /* ---------- Fehlerprotokoll für «Diagnose teilen» ----------
     Die letzten 20 Fehler: Zeit, Art, fester Text der App (m, wird beim Anzeigen übersetzt) und allenfalls eine technische
     Angabe des Browsers oder Zahlen dazu (x). Nie Namen von Uhren oder Dateien. Das Protokoll bleibt im Handy, bis man
     die Diagnose selbst teilt. */
  var LOG_MAX = 20, LOG_KINDS = { js: 1, mikro: 1, mess: 1, eichen: 1, datei: 1, zeit: 1 };
  function logLine(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max || 160); }
  function cleanLog(v) {
    return (Array.isArray(v) ? v : []).slice(-LOG_MAX).map(function (e) {
      if (!e || typeof e !== 'object' || !own(LOG_KINDS, e.k)) return null;
      var d = new Date(str(e.t, 40)), m = logLine(str(e.m, 160)), x = logLine(str(e.x, 120), 120);
      if (isNaN(d.getTime()) || !m) return null;
      return x ? { t: d.toISOString(), k: e.k, m: m, x: x } : { t: d.toISOString(), k: e.k, m: m };
    }).filter(Boolean);
  }
  var errLog = cleanLog(load(KEYS.log, []));
  function logErr(kind, msg, extra) {
    var m = logLine(msg), x = logLine(extra, 120), last = errLog[errLog.length - 1];
    if (!own(LOG_KINDS, kind) || !m) return;
    if (last && last.k === kind && last.m === m && (last.x || '') === x && Date.now() - new Date(last.t).getTime() < 60000) return;   /* derselbe Fehler in Serie: einmal genügt */
    errLog.push(x ? { t: new Date().toISOString(), k: kind, m: m, x: x } : { t: new Date().toISOString(), k: kind, m: m });
    if (errLog.length > LOG_MAX) errLog = errLog.slice(-LOG_MAX);
    store(KEYS.log, errLog);
  }
  window.addEventListener('error', function (e) {
    var f = String((e && e.filename) || '').split('/').pop().split('?')[0].slice(0, 40);
    logErr('js', 'Fehler im Programm', ((e && e.message) || '?') + (f ? ' (' + f + ':' + (e.lineno || 0) + ')' : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    logErr('js', 'Fehler im Programm', 'Promise: ' + (r && r.message ? r.message : String(r)));
  });

  /* ---------- Format ---------- */
  function fmt(v, d) { var s = v.toFixed(d); return LANG === 'en' ? s : s.replace('.', ','); }
  function signed(v, d) { var s = fmt(Math.abs(v), d); return (v < 0 && s.replace(/[0,.]/g, '') !== '' ? '−' : '+') + s; }
  function thousands(n) { var sep = LANG === 'en' ? ',' : '’', s = String(Math.round(Math.abs(n))), o = ''; while (s.length > 3) { o = sep + s.slice(-3) + o; s = s.slice(0, -3); } return (n < 0 ? '−' : '') + s + o; }
  function dateStr(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(LOC, { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' });
  }
  function timeStr(d) { return d.toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' }); }
  function dayShort(iso) { var d = new Date(iso); return LANG === 'en' ? d.getDate() + '/' + (d.getMonth() + 1) : d.getDate() + '.' + (d.getMonth() + 1) + '.'; }
  function ago(iso) {
    var d = new Date(iso), now = new Date();
    var days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    if (days <= 0) return T('heute {t}', { t: timeStr(d) });
    if (days === 1) return T('gestern');
    if (days < 30) return T('vor {n} Tagen', { n: days });
    return T('am {d}', { d: d.toLocaleDateString(LOC, { day: 'numeric', month: 'short', year: 'numeric' }) });
  }
  function dLong(d) { return d.toLocaleDateString(LOC, { day: 'numeric', month: 'long', year: 'numeric' }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function deg(v) { return fmt(v, v % 1 ? 1 : 0) + '°'; }
  function plural(n, one, many) { return n + ' ' + T(n === 1 ? one : many); }
  function avg(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; }
  /* Fortschritt und Pegel als Verschiebung statt Breite: kein neues Layout, entlastet das Handy während der Aufnahme */
  function bar(el, frac) { el.style.transform = 'scaleX(' + Math.max(0, Math.min(1, frac)).toFixed(3) + ')'; }
  function setStatus(id, text, kind) { var el = $(id); el.textContent = text; el.setAttribute('data-kind', kind || ''); }
  var toastTimer = 0;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 4200);
  }

  /* ---------- Rechnen im Hintergrund ---------- */
  var worker = new Worker('worker.js');
  var jobs = {}, jobSeq = 0, engineVersion = '';
  worker.onmessage = function (e) {
    engineVersion = e.data.version || engineVersion;
    var cb = jobs[e.data.id]; delete jobs[e.data.id];
    if (cb) cb(e.data.r);
  };
  worker.onerror = function (e) { logErr('js', 'Die Auswertung konnte nicht starten. Seite neu laden.', e && e.message); setStatus('status', T('Die Auswertung konnte nicht starten. Seite neu laden.'), 'err'); };
  function runJob(payload) {
    return new Promise(function (resolve) { var id = ++jobSeq; jobs[id] = resolve; payload.id = id; worker.postMessage(payload); });
  }

  /* ---------- Uhren und Werke ---------- */
  function findWatch(id) { for (var i = 0; i < watches.length; i++) if (watches[i].id === id) return watches[i]; return null; }
  function currentWatch() { return findWatch(settings.watchId); }
  var UNKNOWN = { id: '', name: T('Unbekannte Uhr'), kaliberId: '', liftAngle: 52, bph: null };
  /* Die Schlagzahl wird immer erkannt; die gespeicherte gilt nur als Erwartung (Hinweis bei Abweichung). */
  /* ---------- Eichung der Uhr im Handy, je Mikrofon ----------
     '' ist das eingebaute (Standard-)Mikrofon, sonst die Kennung des gewählten. Ein angestecktes Mikrofon kann eine eigene
     Uhr haben; solange es nicht geeicht ist, korrigiert Tickwerk seine Messungen nicht. */
  var usedMic = '';   /* Mikrofon der laufenden oder letzten Aufnahme */
  function isoDate(v) {   /* gültiges Datum, nicht in der Zukunft: als ISO-Text, sonst leer */
    var d = new Date(typeof v === 'string' ? v.slice(0, 40) : NaN);
    return isNaN(d.getTime()) || d.getTime() > Date.now() + 86400000 ? '' : d.toISOString();
  }
  function cleanCal(c) {
    var out = Object.create(null), n = 0;
    if (c && typeof c === 'object' && !Array.isArray(c)) Object.keys(c).forEach(function (k) {
      var v = c[k];
      if (n >= 8 || k.length > 200 || !/^[\w.+\/=-]+$/.test(k) || k === '__proto__' || k === 'constructor' || k === 'prototype' || !v || typeof v !== 'object') return;
      var p = finite(v.ppm, NaN), r = finite(v.raw, NaN);
      if (!(Math.abs(p) < 500)) return;
      var sg = finite(v.sig, -1);
      out[k] = { ppm: p, raw: Math.abs(r) < 500 ? r : null, at: isoDate(v.at), sig: sg >= 0 && sg < 50 ? sg : null, src: v.src === 'zeit' ? 'zeit' : '' }; n++;
    });
    return out;
  }
  function cleanNetLast(v) {
    var at = v && typeof v === 'object' ? isoDate(v.at) : '';
    if (!at) return null;
    var num = function (x, lo, hi) { return Math.round(Math.max(lo, Math.min(hi, finite(x, 0)))); };
    return { at: at, ok: v.ok === true, src: v.src === 'a' || v.src === 'x' || v.src === 'd' ? v.src : '', n: num(v.n, 0, 99), unc: num(v.unc, 0, 9999), rtt: num(v.rtt, 0, 99999),
      ph: num(v.ph, -9e8, 9e8), why: logLine(str(v.why, 60), 60) };
  }
  function cleanCalZeit(v) {
    var at = v && typeof v === 'object' ? isoDate(v.at) : '';
    if (!at) return null;
    var f1 = function (x, lim) { var y = finite(x, 0); return Math.round(Math.max(-lim, Math.min(lim, y)) * 10) / 10; };
    return { at: at, ok: v.ok === true, min: f1(v.min, 999), k: Math.round(Math.max(0, Math.min(999, finite(v.k, 0)))), ppm: f1(v.ppm, 999), sig: f1(v.sig, 999),
      audio: f1(v.audio, 999), clock: f1(v.clock, 999), steps: Math.round(Math.max(0, Math.min(999, finite(v.steps, 0)))), grp: Math.round(Math.max(0, Math.min(9, finite(v.grp, 0)))),
      kind: v.kind === 'm' || v.kind === 'w' ? v.kind : '', src: v.src === 'a' || v.src === 'x' || v.src === 'd' ? v.src : '', why: logLine(str(v.why, 60), 60) };
  }
  function micKey() { return isPro() && settings.micId ? settings.micId : ''; }
  function calOf(key) { return key ? settings.cal[key] || null : { ppm: settings.ppm, raw: settings.quartzRaw, at: settings.calAt, sig: settings.calSig, src: settings.calSrc }; }
  function ppmOf(key) { var c = calOf(key); return c && c.ppm ? c.ppm : 0; }
  /* Eichung setzen, mit dem Datum von heute. Null von Hand (ohne Messung) heisst: keine Eichung. */
  function setClock(key, ppm, raw, sig, src) {
    src = src === 'zeit' && raw == null ? 'zeit' : '';   /* «zeit»: mit Internetzeit gemessen (kein Rohwert einer Quarzuhr) */
    var none = !ppm && raw == null && !src, at = none ? '' : new Date().toISOString();
    sig = (raw != null || src) && sig >= 0 && sig < 50 ? Math.round(sig * 100) / 100 : null;   /* Unsicherheit der Messung in ppm; von Hand eingetragen: unbekannt */
    if (!key) { settings.ppm = ppm; settings.quartzRaw = raw; settings.calAt = at; settings.calSig = sig; settings.calSrc = src; return; }
    if (none) { delete settings.cal[key]; return; }
    settings.cal[key] = { ppm: ppm, raw: raw, at: at, sig: sig, src: src };
    var ks = Object.keys(settings.cal);
    if (ks.length > 8) delete settings.cal[ks[0]];   /* höchstens 8 Mikrofone, das älteste fällt weg */
  }
  /* Geeicht? Und: älter als ein halbes Jahr? Die Uhr im Handy verändert sich mit der Zeit ein wenig. */
  var CAL_OLD_DAYS = 183, CAL_NAG_DAYS = 30;
  function isCal(c) { return !!c && (c.raw != null || !!c.ppm || c.src === 'zeit'); }
  function calKind(c) { return !isCal(c) ? '' : c.src === 'zeit' ? 'z' : c.raw != null ? 'q' : 'h'; }   /* Quelle: Internetzeit, Quarzuhr, von Hand */
  function calOld(c) { return isCal(c) && !!c.at && Date.now() - new Date(c.at).getTime() > CAL_OLD_DAYS * 86400000; }
  /* Wie genau ist die Eichung? Die Messung an der Quarzuhr selbst ist auf Zehntel ppm genau. Begrenzt wird die Eichung durch
     den Gang der Quarzuhr: unbekannt sind das typisch ±0,5 s/Tag (rund ±6 ppm); aus «Gang im Alltag» übernommen gilt dessen
     Unsicherheit. Von Hand eingetragene Werte: unbekannt (null). */
  var QUARTZ_UNKNOWN = 0.5, QUARTZ_OK = 0.05;   /* s/Tag: Gang einer unbekannten Quarzuhr; so genau muss ein übernommener Gang sein */
  function calAcc(c) {
    if (isCal(c) && c.src === 'zeit') return c.sig != null ? { ppm: Math.max(0.3, c.sig), src: 'zeit' } : null;
    if (!isCal(c) || c.raw == null) return null;
    var m = c.sig != null ? Math.max(0.1, c.sig) : 0.3;
    var q = settings.quartzSrc === 'uhr' ? settings.quartzSig : settings.quartzSrc === 'hand' ? null : QUARTZ_UNKNOWN;
    return { ppm: q == null ? m : Math.sqrt(m * m + (q / 0.0864) * (q / 0.0864)), src: settings.quartzSrc };
  }
  function calAccText(c) {
    var a = calAcc(c);
    if (!a) return T('Quelle: von Hand eingetragen. Wie genau der Wert ist, weiss Tickwerk nicht.');
    var v = { p: fmt(a.ppm, a.ppm < 2 ? 1 : 0), d: fmt(a.ppm * 0.0864, 2) };
    if (a.src === 'zeit') return T('Quelle: Internetzeit.') + ' ' + T('Genauigkeit: etwa ± {p} ppm (± {d} s/Tag).', v);
    return T('Quelle: Quarzuhr.') + ' ' + (a.src === 'hand' ? T('Genauigkeit der Messung: ± {p} ppm. Dazu kommt, wie genau du den Gang der Quarzuhr kennst.', v) :
      a.src === 'uhr' ? T('Genauigkeit: etwa ± {p} ppm (± {d} s/Tag), mit dem Gang der Quarzuhr aus «Gang im Alltag».', v) :
        T('Genauigkeit: etwa ± {p} ppm (± {d} s/Tag), weil Tickwerk den Gang der Quarzuhr nicht kennt. Genauer: siehe «Noch genauer eichen».', v));
  }
  function clockShort() {   /* eine Zeile für «Mehr», die Werkzeuge und die Einstellungen */
    var c = calOf(micKey());
    if (!isCal(c)) return T('Noch nicht geeicht');
    if (calOld(c)) return T('Eichung über sechs Monate alt: am besten neu eichen');
    return T('Geeicht: {p} ppm', { p: signed(c.ppm, 1) }) + (c.at ? ' · ' + dLong(new Date(c.at)) : '');
  }
  function watchOpts(w, key) { return { liftAngle: w && w.liftAngle ? w.liftAngle : 52, bph: null, clockPpm: ppmOf(key == null ? usedMic : key) }; }
  function kalById(id) { for (var i = 0; i < KAL.length; i++) if (KAL[i].id === id) return KAL[i]; return null; }
  function calName(id) { var k = kalById(id); return k ? kName(k) : ''; }
  /* Werknamen in den anderen Sprachen: Namen sind meist Eigennamen, nur einige Wörter werden ersetzt (längere zuerst).
     «Chronograph» nur als Angabe in der Klammer, nicht im Modellnamen («Navitimer B01 Chronograph» bleibt, wie es ist). */
  var KAL_WORDS = {
    en: [['Basis ', 'based on '], ['Nachbau ', 'clone of '], ['(auch ', '(also '], ['(Handaufzug, 80 h)', '(manual winding, 80 h)'], ['(Handaufzug)', '(manual winding)'],
      ['Handaufzug', 'manual winding'], ['mechanisch, z. B. ', 'mechanical, e.g. '], ['-Familie', ' family'], ['(aktuell, 72 h)', '(current, 72 h)'], ['(5 Tage)', '(5 days)'],
      ['Manufakturwerk', 'in-house movement'], ['Manufaktur, 5 Tage', 'in-house, 5 days'], ['Pellaton-Aufzug', 'Pellaton winding'], ['z. B. ', 'e.g. '],
      ['(Chronograph', '(chronograph'], ['-Chronograph)', ' chronograph)'], ['(3 Zeiger, ab ca. ', '(3 hands, from about '], ['ab ca. ', 'from about '], ['bis ca. ', 'until about '], ['ohne Datum', 'no date'], [' mit Datum', ' with date'],
      ['(ab ', '(from '], [', ab ', ', from '], [', bis ', ', until '], ['(aktuell)', '(current)'], ['ältere Ausführung', 'older version'], ['Kaliber ', 'caliber '],
      ['«', '“'], ['»', '”']],
    fr: [['Basis ', 'base '], ['Nachbau ', 'copie '], ['(auch ', '(aussi '], ['(Handaufzug, 80 h)', '(remontage manuel, 80 h)'], ['(Handaufzug)', '(remontage manuel)'],
      ['Handaufzug', 'remontage manuel'], ['mechanisch, z. B. ', 'mécanique, p. ex. '], ['-Familie', ' (famille)'], ['(aktuell, 72 h)', '(actuel, 72 h)'], ['(5 Tage)', '(5 jours)'],
      ['Manufakturwerk', 'mouvement manufacture'], ['Manufaktur, 5 Tage', 'manufacture, 5 jours'], ['Pellaton-Aufzug', 'remontage Pellaton'], ['z. B. ', 'p. ex. '],
      ['(Chronograph', '(chronographe'], ['-Chronograph)', ', chronographe)'], ['(3 Zeiger, ab ca. ', '(3 aiguilles, dès env. '], ['ab ca. ', 'dès env. '], ['bis ca. ', 'jusqu’à env. '], ['ohne Datum', 'sans date'], [' mit Datum', ' avec date'],
      ['(ab ', '(dès '], [', ab ', ', dès '], [', bis ', ', jusqu’à '], ['(aktuell)', '(actuel)'], ['ältere Ausführung', 'ancienne version'], ['Kaliber ', 'calibre ']],
    it: [['Basis ', 'base '], ['Nachbau ', 'copia '], ['(auch ', '(anche '], ['(Handaufzug, 80 h)', '(carica manuale, 80 h)'], ['(Handaufzug)', '(carica manuale)'],
      ['Handaufzug', 'carica manuale'], ['mechanisch, z. B. ', 'meccanico, ad es. '], ['-Familie', ' (famiglia)'], ['(aktuell, 72 h)', '(attuale, 72 h)'], ['(5 Tage)', '(5 giorni)'],
      ['Manufakturwerk', 'movimento di manifattura'], ['Manufaktur, 5 Tage', 'manifattura, 5 giorni'], ['Pellaton-Aufzug', 'carica Pellaton'], ['z. B. ', 'ad es. '],
      ['(Chronograph', '(cronografo'], ['-Chronograph)', ', cronografo)'], ['(3 Zeiger, ab ca. ', '(3 lancette, da ca. '], ['ab ca. ', 'da ca. '], ['bis ca. ', 'fino a ca. '], ['ohne Datum', 'senza data'], [' mit Datum', ' con data'],
      ['(ab ', '(da '], [', ab ', ', da '], [', bis ', ', fino a '], ['(aktuell)', '(attuale)'], ['ältere Ausführung', 'versione precedente'], ['Kaliber ', 'calibro ']]
  };
  function enName(s) { if (LANG === 'de' || !s) return s; (KAL_WORDS[LANG] || []).forEach(function (p) { s = s.split(p[0]).join(p[1]); }); return s; }
  function kName(k) { return k ? enName(k.name) : ''; }
  /* Quellenangaben der Werke (nur im Messprotokoll): Fachbegriffe ersetzen, Namen bleiben */
  var SRC_WORDS = {
    en: [['ETA Technische Mitteilung', 'ETA technical communication'], ['Omega Technische Anleitung', 'Omega technical guide'], ['watchguy.co.uk Hebewinkel-Liste', 'watchguy.co.uk lift angle list'],
      ['Watchguy-Hebewinkelliste', 'Watchguy lift angle list'], ['(als unbestätigt markiert)', '(marked as unconfirmed)'],
      ['(laut Forum mit ETA-Dokument)', '(per forum post with ETA document)'], ['Miyota-Datenblatt', 'Miyota data sheet'], ['Omega-Forum', 'Omega forum'],
      ['Rolex-Forum; Familie 32xx', 'Rolex forum; 32xx family'], [' bei Watchguy', ' at Watchguy'], ['Schlagzahl: ', 'Beat rate: '], ['(Schlagzahl)', '(beat rate)'],
      ['(Hebewinkel)', '(lift angle)'], ['vom Basiswerk', 'from the base movement'], ['vom verwandten', 'from the related'],
      ['von Omega 8800 / 2500 übernommen', 'taken from Omega 8800 / 2500'], ['Händlerangaben', 'dealer information'], ['Gangreserve', 'power reserve'],
      ['Messung Tickwerk', 'Tickwerk measurement'], ["25'200 A/h", '25,200 bph'], ['Basis ', 'based on '], [' bis ', ' to ']],
    fr: [['ETA Technische Mitteilung', 'communication technique ETA'], ['Omega Technische Anleitung', 'guide technique Omega'], ['watchguy.co.uk Hebewinkel-Liste', 'watchguy.co.uk, liste des angles de levée'],
      ['Watchguy-Hebewinkelliste', 'Watchguy, liste des angles de levée'], ['(als unbestätigt markiert)', '(marqué comme non confirmé)'],
      ['(laut Forum mit ETA-Dokument)', '(selon un forum, avec document ETA)'], ['Miyota-Datenblatt', 'fiche technique Miyota'], ['Omega-Forum', 'forum Omega'],
      ['Rolex-Forum; Familie 32xx', 'forum Rolex ; famille 32xx'], [' bei Watchguy', ' chez Watchguy'], ['Schlagzahl: ', 'Fréquence : '], ['(Schlagzahl)', '(fréquence)'],
      ['(Hebewinkel)', '(angle de levée)'], ['vom Basiswerk', 'du mouvement de base'], ['vom verwandten', 'du mouvement apparenté'],
      ['von Omega 8800 / 2500 übernommen', 'repris d’Omega 8800 / 2500'], ['Händlerangaben', 'indications du revendeur'], ['Gangreserve', 'réserve de marche'],
      ['Messung Tickwerk', 'mesure Tickwerk'], ['Basis ', 'base '], [' bis ', ' à ']],
    it: [['ETA Technische Mitteilung', 'comunicazione tecnica ETA'], ['Omega Technische Anleitung', 'guida tecnica Omega'], ['watchguy.co.uk Hebewinkel-Liste', 'watchguy.co.uk, elenco degli angoli di alzata'],
      ['Watchguy-Hebewinkelliste', 'Watchguy, elenco degli angoli di alzata'], ['(als unbestätigt markiert)', '(segnato come non confermato)'],
      ['(laut Forum mit ETA-Dokument)', '(secondo un forum, con documento ETA)'], ['Miyota-Datenblatt', 'scheda tecnica Miyota'], ['Omega-Forum', 'forum Omega'],
      ['Rolex-Forum; Familie 32xx', 'forum Rolex; famiglia 32xx'], [' bei Watchguy', ' su Watchguy'], ['Schlagzahl: ', 'Frequenza: '], ['(Schlagzahl)', '(frequenza)'],
      ['(Hebewinkel)', '(angolo di alzata)'], ['vom Basiswerk', 'dal movimento di base'], ['vom verwandten', 'dal movimento affine'],
      ['von Omega 8800 / 2500 übernommen', 'ripreso da Omega 8800 / 2500'], ['Händlerangaben', 'indicazioni del rivenditore'], ['Gangreserve', 'riserva di carica'],
      ['Messung Tickwerk', 'misurazione Tickwerk'], ['Basis ', 'base '], [' bis ', ' a ']]
  };
  function enSource(s) { if (LANG === 'de' || !s) return s; (SRC_WORDS[LANG] || []).forEach(function (p) { s = s.split(p[0]).join(p[1]); }); return s; }
  /* Woher der Hebewinkel stammt: '' (bestätigt oder eigene Angabe), 'unbestätigt' oder 'angenommen' */
  function liftState(w) {
    var lift = w && w.liftAngle ? w.liftAngle : 52;
    var k = w ? kalById(w.kaliberId) : null;
    if (k && k.hebewinkel != null && Math.abs(k.hebewinkel - lift) < 0.01) return k.sicher ? '' : 'unbestätigt';
    if (Math.abs(lift - 52) < 0.01 && !(k && k.hebewinkel != null)) return 'angenommen';
    return '';
  }
  function watchSub(w) {
    if (!w) return T('Hebewinkel 52° angenommen · Schlagzahl automatisch');
    if (w.quarz) return T('Quarzuhr');
    var k = kalById(w.kaliberId);
    if (k && k.messbar === false) return kName(k) + ' · ' + T('nicht messbar');
    return (k ? kName(k) : T('Werk unbekannt')) + ' · ' + (w.bph ? thousands(w.bph) + ' ' + T('A/h') : T('Schlagzahl automatisch')) + ' · ' + deg(w.liftAngle);
  }
  function measOf(w) { var id = w ? w.id : ''; return meas.filter(function (m) { return m.watchId === id; }); }
  /* Gewertet wird wie im Messprotokoll: gutes Signal, stabiler Gang, kleine Unsicherheit */
  function counted(m) { return m.q !== 'schwach' && m.sigma <= (m.stable === false ? SIGMA_COUNT : SIGMA_SURE); }
  /* Gezählt mit Vermerk: klare Klicks, aber der Gang schwankte während der Messung (Uhr oder Handhaltung) */
  function shaky(m) { return counted(m) && m.stable === false; }
  function shakyText() { return T('Gang könnte schwanken'); }
  /* Warum eine Messung nicht zählt */
  function whyNot(m) { return m.q === 'schwach' ? T('Signal schwach') : T(m.stable === false ? 'Gang schwankt zu stark' : 'zu unsicher'); }

  /* ---------- Pro ---------- */
  function isPro() { return FLAVOR === 'test' ? settings.testPro : !!proState; }
  function weekKey(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return t.getUTCFullYear() + '-W' + Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }
  function freeLeft() { return settings.free.week !== weekKey(new Date()) ? FREE_PER_WEEK : Math.max(0, FREE_PER_WEEK - settings.free.used); }
  function useFree() {
    var wk = weekKey(new Date());
    if (settings.free.week !== wk) settings.free = { week: wk, used: 0 };
    if (settings.free.used >= FREE_PER_WEEK) return false;
    settings.free.used++; saveSettings(); return true;
  }
  function showsPro(m) { return isPro() || !!(m && m.fp); }
  var PRO_WHY = {
    lagen: T('Der Lagen-Test misst die Uhr in bis zu sechs Lagen nacheinander, wie beim Uhrmacher, und zeigt die Lagendifferenz.'),
    pdf: T('Das Messprotokoll fasst alle Messungen einer Uhr als PDF zusammen, zum Drucken, Sammeln oder für den Uhrmacher.'),
    csv: T('Mit Pro lassen sich alle Messungen einer Uhr als Tabelle (CSV) speichern, zum Beispiel für Excel.'),
    watches: T('In der Gratis-Version lässt sich eine Uhr speichern. Mit Pro beliebig viele.'),
    wav: T('Mit Pro lassen sich Aufnahmen als WAV-Datei teilen, zum Beispiel mit einem Uhrmacher.'),
    values: T('Abfallfehler und Amplitude zeigt Tickwerk gratis bei {n} Messungen pro Woche. Mit Pro bei jeder Messung.', { n: FREE_PER_WEEK }),
    history: T('Gratis siehst du die letzten Messungen. Mit Pro den ganzen Verlauf.'),
    reg: T('Der Regulier-Modus zeigt den Gang laufend, alle zwei Sekunden neu, während du am Werk einstellst. Mit Abfallfehler, Amplitude und Verlauf.'),
    mic: T('Mit Pro wählst du das Mikrofon selbst, zum Beispiel ein angestecktes über USB-C.'),
    gr: T('Der Gangreserve-Test misst die Uhr voll aufgezogen und nach 24 Stunden und zeigt, wie viel Kraft die Zugfeder dann noch hat.')
  };
  function requirePro(feature) {
    if (isPro()) return true;
    $('psText').textContent = (PRO_WHY[feature] || '') + ' ' + T('Einmal {p}, kein Abo.', { p: priceText() });
    openSheet('proSheet');
    return false;
  }

  /* ---------- Kauf über Google Play (nur Store-Version) ---------- */
  var BILLING_URL = 'https://play.google.com/billing';
  var billing = { ready: null, svc: null, price: '' };
  function priceText() { return billing.price || PRICE; }
  function formatPrice(p) {
    var v = parseFloat(p && p.value);
    if (!isFinite(v)) return '';
    if (p.currency === 'CHF') return 'CHF ' + (v % 1 === 0 ? v + '.–' : v.toFixed(2));
    try { return new Intl.NumberFormat(LOC, { style: 'currency', currency: p.currency }).format(v); } catch (e) { return String(p.currency) + ' ' + v.toFixed(2); }
  }
  function billingInit() {
    if (FLAVOR !== 'store') return Promise.resolve(null);
    if (billing.ready) return billing.ready;
    billing.ready = (typeof window.getDigitalGoodsService !== 'function' ? Promise.resolve(null) :
      window.getDigitalGoodsService(BILLING_URL).then(function (s) { return s || null; }, function () { return null; })
    ).then(function (s) {
      billing.svc = s;
      if (!s) return null;
      return s.getDetails([PRO_SKU]).then(function (items) {
        var it = (items || []).filter(function (x) { return x.itemId === PRO_SKU; })[0];
        if (it && it.price) billing.price = formatPrice(it.price);
        return s;
      }, function () { return s; });
    });
    return billing.ready;
  }
  /* Ein Kauf muss innert 3 Tagen bestätigt werden, sonst erstattet Google ihn zurück.
     Mit eigenem Server (billingBackend) prüft und bestätigt dieser den Kauf; ohne Server wird er verbraucht (consume). */
  function settlePurchase(token) {
    if (!token || typeof token !== 'string') return Promise.resolve(false);
    if (BACKEND) {
      return fetch(BACKEND, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token, sku: PRO_SKU }),
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return !!(j && j.ok === true); }, function () { return false; });
    }
    if (!billing.svc) return Promise.resolve(false);
    return billing.svc.consume(token).then(function () { return true; }, function () { return false; });
  }
  function grantPro() {
    proState = { active: true, since: new Date().toISOString(), via: BACKEND ? 'backend' : 'play' };
    store(KEYS.pro, proState);
  }
  function restorePurchases() {
    return billingInit().then(function (s) {
      if (!s) return 'unavailable';
      return s.listPurchases().then(function (purchases) {
        var p = (purchases || []).filter(function (x) { return x.itemId === PRO_SKU; })[0];
        if (p) return settlePurchase(p.purchaseToken).then(function (ok) { if (ok) grantPro(); return ok ? 'restored' : 'pending'; });
        if (typeof s.listPurchaseHistory !== 'function') return 'none';
        return s.listPurchaseHistory().then(function (h) {
          var q = (h || []).filter(function (x) { return x.itemId === PRO_SKU; })[0];
          if (q) { grantPro(); return 'restored'; }
          return 'none';
        }, function () { return 'none'; });
      });
    }).catch(function () { return 'error'; });
  }
  function buyPro() {
    if (FLAVOR === 'test') {
      settings.testPro = true; saveSettings();
      toast(T('Testversion: Pro ist zum Ausprobieren freigeschaltet. Es wurde nichts gekauft.'));
      afterProChange(); return;
    }
    billingInit().then(function (s) {
      if (!s || typeof window.PaymentRequest !== 'function') { toast(T('Kaufen geht nur in der Tickwerk-App aus dem Google Play Store.')); return; }
      var req;
      try {
        req = new PaymentRequest([{ supportedMethods: BILLING_URL, data: { sku: PRO_SKU } }], { total: { label: 'Tickwerk Pro', amount: { currency: 'CHF', value: '0' } } });
      } catch (e) { toast(T('Der Kauf konnte nicht starten.')); return; }
      $('proBuy').disabled = true;
      return req.show().then(function (resp) {
        var token = resp.details && resp.details.purchaseToken;
        return settlePurchase(token).then(function (ok) {
          return Promise.resolve(resp.complete(ok ? 'success' : 'fail')).catch(function () { /* egal */ }).then(function () { return ok; });
        });
      }).then(function (ok) {
        if (ok) { grantPro(); toast(T('Danke! Tickwerk Pro ist freigeschaltet.')); }
        else toast(T('Der Kauf ist noch nicht bestätigt. Tickwerk prüft beim nächsten Start nochmals; sonst «Käufe wiederherstellen» tippen.'));
      }, function (e) {
        toast(e && e.name === 'AbortError' ? T('Kauf abgebrochen. Schon gekauft? Dann «Käufe wiederherstellen» tippen.') : T('Kauf nicht möglich') + (e && e.message ? ': ' + e.message : '.'));
      }).then(function () { $('proBuy').disabled = false; afterProChange(); });
    });
  }
  function afterProChange() {
    render();
    if (lastShown) showResult(lastShown.r, lastShown.m);
  }

  /* ---------- Navigation: Bildschirme als Stapel, Android-Zurück schliesst den obersten ---------- */
  var SCREENS = ['measure', 'watches', 'watch', 'edit', 'lagen', 'lpos', 'reg', 'zeit', 'detektiv', 'guide', 'more', 'pro', 'history', 'settings', 'eichen'];
  var NO_TABS = { edit: true, lagen: true, lpos: true, reg: true, zeit: true, detektiv: true, guide: true, eichen: true };
  var stack = [{ s: 'measure', p: {} }];
  var sheetOpen = null, afterPop = null, shownScreen = '';
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabbar button'));
  function top() { return stack[stack.length - 1]; }
  function topScreen() { return top().s; }
  function render(restoreScroll) {
    var t = top();
    if (rec && rec.owner !== t.s) recStop(true);
    if (t.s !== 'lpos') lpStop();
    if (t.s !== 'zeit') zStop();
    SCREENS.forEach(function (s) { $('scr-' + s).hidden = s !== t.s; });
    document.body.classList.toggle('no-tabs', !!NO_TABS[t.s]);
    document.body.classList.toggle('is-pro', isPro());
    tabs.forEach(function (b) { if (b.dataset.tab === stack[0].s) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    RENDER[t.s](t.p);
    if (shownScreen !== t.s || restoreScroll) window.scrollTo(0, restoreScroll ? (t.y || 0) : 0);
    shownScreen = t.s;
  }
  function go(s, p) {
    if (sheetOpen) { closeSheet(function () { go(s, p); }); return; }
    top().y = window.scrollY;
    stack.push({ s: s, p: p || {} });
    history.pushState({ tw: stack.length - 1 }, '');
    render();
  }
  function back() {
    if (sheetOpen) { closeSheet(); return; }
    if (stack.length <= 1) return;
    stack.pop(); render(true);
    history.back();
  }
  function popTo(s) {
    var i = stack.length - 1;
    while (i > 0 && stack[i].s !== s) i--;
    var k = stack.length - 1 - i;
    if (k <= 0) { render(); return; }
    stack = stack.slice(0, i + 1); render(true);
    history.go(-k);
  }
  function switchTab(t) {
    if (sheetOpen) { closeSheet(function () { switchTab(t); }); return; }
    var depth = stack.length - 1;
    if (!depth && stack[0].s === t) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    stack = [{ s: t, p: {} }]; render();
    if (depth) history.go(-depth);
  }
  function openSheet(id) {
    if (sheetOpen) { $(sheetOpen).hidden = true; sheetOpen = null; history.replaceState({ tw: stack.length - 1, sheet: id }, ''); }
    else history.pushState({ tw: stack.length - 1, sheet: id }, '');
    $(id).hidden = false; sheetOpen = id;
    var f = $(id).querySelector('button'); if (f) f.focus({ preventScroll: true });
  }
  function closeSheet(then) {
    if (!sheetOpen) { if (then) then(); return; }
    $(sheetOpen).hidden = true; sheetOpen = null;
    afterPop = then || null;
    history.back();
  }
  window.addEventListener('popstate', function (e) {
    var st = e.state || {}, d = typeof st.tw === 'number' ? st.tw : 0;
    if (sheetOpen && st.sheet !== sheetOpen) { $(sheetOpen).hidden = true; sheetOpen = null; }
    if (d < stack.length - 1) { stack = stack.slice(0, d + 1); render(true); }
    var fn = afterPop; afterPop = null;
    if (fn) fn();
  });
  history.replaceState({ tw: 0 }, '');
  tabs.forEach(function (b) { b.addEventListener('click', function () { switchTab(b.dataset.tab); }); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (b) { b.addEventListener('click', back); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function (b) { b.addEventListener('click', function () { go(b.dataset.go); }); });
  ['watchSheet', 'proSheet', 'infoSheet', 'toolSheet', 'missSheet', 'netSheet'].forEach(function (id) {
    $(id).addEventListener('click', function (e) { if (e.target === $(id)) closeSheet(); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetOpen) closeSheet(); });
  $('psClose').addEventListener('click', function () { closeSheet(); });
  $('psMore').addEventListener('click', function () { closeSheet(function () { go('pro'); }); });
  $('wsClose').addEventListener('click', function () { closeSheet(); });
  $('wsAdd').addEventListener('click', function () { closeSheet(addWatch); });

  /* ---------- Erklärungen: (i) neben einem Wert öffnet ein kurzes Blatt mit Richtwerten ---------- */
  var INFO = {
    rate: { t: 'Gangabweichung', s: 'So viele Sekunden geht die Uhr pro Tag vor (+) oder nach (−), hochgerechnet aus der Messung. Der Wert gilt für die gemessene Lage und den jetzigen Aufzug. Im Alltag wechseln beide; darum lohnt sich der Lagen-Test.',
      r: [['good', '−4 bis +6 s/Tag', 'Chronometer-Bereich (Norm der COSC)'], ['okay', 'bis ±30 s/Tag', 'in Ordnung; viele Werke sind ab Werk nur auf etwa ±10 bis ±40 s/Tag eingestellt'], ['warn', 'über ±30 s/Tag', 'regulieren lassen; bei sehr grossen Werten auf Magnetismus prüfen lassen'],
        ['', '±4 / ±7 / ±12 s/Tag', 'Vorgaben von ETA für die Stufen Top, Elaboré und Standard, als Mittel mehrerer Lagen. Den Vergleich zeigt der Lagen-Test.']],
      n: 'Das ± hinter dem Wert zeigt, wie genau die Messung selbst ist. Längere Messungen sind genauer.' },
    be: { t: 'Abfallfehler', s: 'Der Unterschied zwischen Tick und Tack in Millisekunden. Bei einer gut eingestellten Uhr schwingt die Unruh nach beiden Seiten gleich weit aus der Ruhelage; dann sind Tick und Tack gleich lang.',
      r: [['good', 'bis 0,5 ms', 'sehr gut'], ['okay', '0,5 bis 1,0 ms', 'in Ordnung'], ['warn', 'über 1,0 ms', 'hoch: beim nächsten Service einstellen lassen']],
      n: 'Ein kleiner Abfallfehler stört den Gang kaum. Ein grosser kann die Uhr in manchen Lagen ungleich laufen lassen, und sie bleibt leichter stehen, wenn die Feder fast abgelaufen ist.' },
    amp: { t: 'Amplitude', s: 'Wie weit die Unruh ausschwingt, in Grad von der Ruhelage aus. Sie zeigt, wie viel Kraft von der Feder bei der Unruh ankommt: Aufzug, Öl und Zustand des Werks.',
      r: [['good', 'über 270°', 'sehr gut (waagrecht, voll aufgezogen)'], ['okay', '220° bis 270°', 'gut'], ['okay', '200° bis 220°', 'knapp: Uhr voll aufziehen und später nochmals messen'], ['warn', 'unter 200°', 'Service prüfen lassen']],
      n: 'Senkrecht ist die Amplitude meist 20 bis 40° kleiner. Tickwerk rechnet sie aus dem Hebewinkel des Werks; ist er nur angenommen, ist der Wert ein Richtwert.' },
    bph: { t: 'Schlagzahl', s: 'Halbschwingungen der Unruh pro Stunde (A/h). 28’800 A/h sind 8 Schläge pro Sekunde (4 Hz). Je höher die Schlagzahl, desto feiner läuft der Sekundenzeiger und desto weniger stören Erschütterungen.',
      r: [['', '18’000 A/h', 'ältere Werke, z. B. Unitas 6497'], ['', '21’600 A/h', 'z. B. Seiko NH35, Miyota 8215, Powermatic 80'], ['', '25’200 A/h', 'z. B. Longines L888, Omega Co-Axial 8800'], ['', '28’800 A/h', 'die meisten heutigen Schweizer Werke'], ['', '36’000 A/h', 'Schnellschwinger, z. B. Zenith El Primero']],
      n: 'Tickwerk erkennt die Schlagzahl selbst. Passt sie nicht zum eingetragenen Werk, erscheint ein Hinweis.' },
    lift: { t: 'Hebewinkel', s: 'Der Winkel, um den sich die Unruh weiterdreht, während der Anker sie antreibt. Er ist eine Angabe des Herstellers. Tickwerk misst, wie lange dieser Antrieb dauert, und rechnet daraus die Amplitude.',
      r: [['', '50° bis 53°', 'viele Schweizer Werke (ETA, Sellita) und Seiko NH35'], ['', 'unbekannt', '52° lassen; die Amplitude ist dann ein Richtwert']],
      n: 'Ein falscher Hebewinkel verschiebt nur die Amplitude, nicht den Gang und nicht den Abfallfehler.' },
    grade: { t: 'ETA-Stufen', s: 'ETA liefert seine Werke in den Stufen Standard, Elaboré, Top und Chronomètre aus. Je Stufe ist vorgegeben, in wie vielen Lagen das Werk eingestellt wird und wie gross das Mittel der Gänge und die grösste Differenz zwischen diesen Lagen sein dürfen. Tickwerk vergleicht deinen Lagen-Test mit diesen Vorgaben.',
      n: 'Ein Vergleich, kein Zertifikat. Die Vorgaben gelten für Werke von ETA, wie sie das Werk verlassen; eine getragene Uhr kann anders laufen. Bei anderen Werken sind sie ein Massstab zum Einordnen. Gerechnet wird in den Lagen von ETA: Standard mit Zifferblatt oben und Krone links, Elaboré dazu mit Krone unten, Top dazu mit Zifferblatt unten und Krone oben.' },
    spread: { t: 'Lagendifferenz', s: 'Der Unterschied zwischen der schnellsten und der langsamsten Lage. Er zeigt, wie gleichmässig die Uhr in allen Lagen läuft.',
      r: [['good', 'bis 10 s/Tag', 'sehr gleichmässig (Chronometer-Norm)'], ['okay', '10 bis 20 s/Tag', 'üblich für eine Uhr ohne Zertifikat'], ['warn', 'über 20 s/Tag', 'ein Uhrmacher kann prüfen, ob ein Service nötig ist']] },
    hv: { t: 'Senkrecht − waagrecht', s: 'Der mittlere Gang der senkrechten Lagen minus das Mittel der waagrechten. So siehst du, wie sich die Uhr am Arm (eher senkrecht) gegenüber flach auf dem Tisch verhält.',
      r: [['good', '−6 bis +8 s/Tag', 'erlaubt nach der Chronometer-Norm'], ['warn', 'ausserhalb', 'die Uhr hängt stark von der Lage ab']],
      n: 'Tipp: Geht die Uhr am Tag vor, kann sie nachts in der Lage liegen, in der sie nachgeht, und umgekehrt.' },
    tape: { t: 'Papierstreifen', s: 'Jeder Punkt ist ein Schlag: grün der Tick, blau der Tack. Waagrecht läuft die Zeit, senkrecht steht die Abweichung vom genauen Takt. So zeichnet auch eine Zeitwaage beim Uhrmacher.',
      r: [['', 'Spur steigt', 'die Uhr geht vor'], ['', 'Spur fällt', 'die Uhr geht nach'], ['', 'zwei Spuren mit Abstand', 'Abfallfehler: Tick und Tack sind ungleich lang'], ['', 'Punkte streuen stark', 'unruhiges Signal oder unruhiger Gang'], ['', 'Spur wellig', 'der Gang schwankt während der Messung: wegen der Uhr oder weil das Handy nicht ruhig an der Krone liegt']] },
    daily: { t: 'Gang im Alltag', s: 'So viel geht die Uhr pro Tag vor oder nach, während du sie trägst: mit allen Lagen, Temperaturen und dem Aufzug durchs Tragen. Dazu vergleichst du die Uhr mit der genauen Zeit, heute und nach ein paar Tagen. Am genauesten ist die Zeit aus dem Internet; die Uhr des Handys allein kann bis etwa zwei Sekunden danebenliegen.',
      r: [['', 'nach 1 Tag', 'auf etwa ± 0,2 s/Tag genau'], ['', 'nach 7 Tagen', 'auf etwa ± 0,03 s/Tag genau'],
        ['', 'mit der Uhr des Handys', 'etwa dreimal so unsicher: ± 0,7 s/Tag nach 1 Tag, ± 0,1 s/Tag nach 7 Tagen']],
      n: 'Die Messung mit dem Mikrofon zeigt den Gang in einer Lage, in diesem Moment. Beide Werte ergänzen sich; ein Unterschied von ein paar Sekunden ist normal.' },
    gr: { t: 'Gangreserve-Test', s: 'Die Zugfeder gibt ihre Kraft nicht gleichmässig ab: Wenn sie abläuft, fällt die Amplitude, und der Gang kann sich ändern. Der Test misst die Uhr voll aufgezogen und nach 24 Stunden, freiwillig auch nach 36 Stunden. Dazwischen liegt die Uhr ruhig: nicht tragen, nicht aufziehen.',
      r: [['good', 'bis 50° weniger', 'kräftige Zugfeder, gute Schmierung'], ['okay', '50° bis 80° weniger', 'üblich bei vielen Uhren'], ['warn', 'über 80° weniger', 'beim nächsten Service ansprechen'],
        ['', '±10 / ±15 / ±20 s/Tag', 'so viel darf sich der Gang in 24 Stunden ändern: Vorgaben von ETA für die Stufen Top, Elaboré und Standard (Isochronismus)']],
      n: 'Faustregel für die Messung nach 24 Stunden. Der Gang sollte sich dabei um weniger als 5 s/Tag ändern. Gemessen wird immer mit dem Zifferblatt oben, damit die Werte vergleichbar sind.' },
    signal: { t: 'Signal', s: 'Wie klar Tickwerk das Ticken hört: wie viele Schläge es erkennt und wie deutlich sie sich vom Rauschen abheben.',
      r: [['good', 'stark', 'alle Werte sicher'], ['okay', 'mittel', 'Gang sicher, Amplitude und Abfallfehler meist auch'], ['warn', 'schwach', 'zählt nicht: Handy fester an die Krone halten, ruhiger Raum']] }
  };
  var INFO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6h.01"/></svg>';
  Array.prototype.forEach.call(document.querySelectorAll('button.info[data-info]'), function (b) { b.innerHTML = INFO_ICON; });
  function openInfo(key, rows, even) {
    var d = own(INFO, key) ? INFO[key] : null;
    if (!d) return;
    $('isTitle').textContent = T(d.t); $('isText').textContent = T(d.s);
    var ul = $('isRanges'); ul.innerHTML = '';
    ul.className = 'ranges' + (even ? ' even' : '');   /* Blatt «ETA-Stufen»: erste Spalte überall gleich breit */
    rows = rows || d.r || [];   /* eigene Zeilen sind schon übersetzt; T() lässt sie dann unverändert */
    rows.forEach(function (r) {
      var li = document.createElement('li'); li.className = r[0] || 'plain';
      var a = document.createElement('span'); a.className = 'rg-v'; a.textContent = T(r[1]);
      var b = document.createElement('span'); b.className = 'rg-t'; b.textContent = T(r[2]);
      li.appendChild(a); li.appendChild(b); ul.appendChild(li);
    });
    ul.hidden = !rows.length;
    $('isNote').textContent = d.n ? T(d.n) : ''; $('isNote').hidden = !d.n;
    openSheet('infoSheet');
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button.info[data-info]') : null;
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.dataset.info === 'grade') { openInfo('grade', gradeRows(gradeFor(b)), true); return; }
    if (b.dataset.info === 'rate') {   /* mit der Werksvorgabe des Werks der Uhr, wenn der Katalog eine kennt */
      var gg = gangOf(detailWatch() || currentWatch());
      if (gg) { openInfo('rate', INFO.rate.r.concat([['', gangRange(gg), gangWho(gg) + (own(GANG_ART, gg[3]) ? ' (' + GANG_ART[gg[3]] + ')' : '') + '. ' + T('Der Vergleich steht beim Gang im Alltag und im Lagen-Test, nicht bei der einzelnen Messung.')]])); return; }
    }
    openInfo(b.dataset.info);
  }, true);
  /* Welcher Lagen-Test gemeint ist: auf der Seite der Uhr der letzte dieser Uhr, sonst der laufende */
  function gradeFor(btn) {
    if (btn.closest('#dLagenCard')) {
      var w = detailWatch(), L = w ? lastLagenOf(measOf(w)) : null;
      if (L) return etaGrade(L.set, L.byPos);
    } else if (session) return etaGrade(SETS[session.set], sessByPos());
    return etaGrade([], {});
  }
  $('isClose').addEventListener('click', function () { closeSheet(); });

  /* ---------- Aufnahme ---------- */
  var rec = null, opening = false, wakeLock = null;
  function micError(e) {
    var n = e && e.name;
    logErr('mikro', 'Mikrofon konnte nicht geöffnet werden', n);
    if (n === 'NotAllowedError' || n === 'SecurityError') {
      return T('Mikrofon blockiert. In Chrome: Menü ⋮ → Einstellungen → Website-Einstellungen → Mikrofon → {host} auf «Zulassen» stellen, dann neu laden. Hilft das nicht: Android-Einstellungen → Apps → Chrome (oder Tickwerk) → Berechtigungen → Mikrofon.',
        { host: location.host || T('diese Seite') });
    }
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return T('Kein Mikrofon gefunden.');
    if (n === 'NotReadableError' || n === 'AbortError') {
      return T('Das Mikrofon ist gerade belegt, zum Beispiel durch einen Anruf oder eine Aufnahme-App. Diese beenden und nochmals tippen.');
    }
    return T('Mikrofon konnte nicht geöffnet werden') + (n ? ' (' + n + ')' : '') + '.';
  }
  /* o: { owner, dur, settle, opts, onOpening, onFail, onBegin, onSettle, onTick, onLive, onCancel, onDone, extend }
     extend: { opts(), onChecking(r), onExtended(res, r) } erlaubt, eine unsichere Messung zu verlängern (siehe recCheck).
     onDone(samples, fs, res, extFrom, first): res ist das schon gerechnete Ergebnis (nach der Prüfung ohne Verlängerung),
     extFrom die ursprünglich gewählte Dauer, wenn verlängert wurde, first dann { samples, res } der Prüfung (siehe extFallback). */
  async function recStart(o) {
    if (rec || opening) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      o.onFail(T('Dieser Browser erlaubt hier keine Mikrofon-Aufnahme. Tickwerk über https öffnen, zum Beispiel in Chrome.')); return;
    }
    opening = true;
    if (o.onOpening) o.onOpening();
    var stream, cons = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }, pick = isPro() && settings.micId, fell = false;
    if (pick) cons.deviceId = { exact: settings.micId };   /* Pro: gewähltes Mikrofon, zum Beispiel ein angestecktes */
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: cons, video: false });
    } catch (e) {
      if (!pick || !e || (e.name !== 'OverconstrainedError' && e.name !== 'NotFoundError')) { opening = false; o.onFail(micError(e)); return; }
      delete cons.deviceId; fell = true;   /* das gewählte ist nicht da (abgesteckt): das Standard-Mikrofon nehmen */
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: cons, video: false }); }
      catch (e2) { opening = false; o.onFail(micError(e2)); return; }
      toast(T('Das gewählte Mikrofon ist nicht da. Tickwerk nimmt das Standard-Mikrofon.'));
    }
    var trk = stream.getAudioTracks()[0], tid = trk && trk.getSettings ? trk.getSettings().deviceId : '';
    usedMic = pick && !fell && (!tid || tid === settings.micId) ? settings.micId : '';
    if (o.opts && typeof o.opts.clockPpm === 'number') o.opts.clockPpm = ppmOf(usedMic);   /* Korrektur des Mikrofons, das wirklich aufnimmt */
    var AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
    try { await ctx.resume(); } catch (e) { /* egal */ }
    var r = { o: o, owner: o.owner, stream: stream, ctx: ctx, chunks: [], n: 0, total: 0, ring: o.ring ? Math.round(o.ring * ctx.sampleRate) : 0, fs: ctx.sampleRate, dur: o.dur,
      phase: o.search ? 'search' : 'measure', heard: 0, good: 0, nextSearch: SEARCH_WINDOW, searchBusy: false,
      settleN: o.search ? 0 : Math.round((o.settle || 0) * ctx.sampleRate), skipped: 0, peak: 0, nextLive: LIVE_FIRST, liveBusy: false };
    var src = ctx.createMediaStreamSource(stream);
    var sink = ctx.createGain(); sink.gain.value = 0; sink.connect(ctx.destination);
    r.src = src; r.sink = sink;
    try {
      if (ctx.audioWorklet && window.AudioWorkletNode) {
        await ctx.audioWorklet.addModule('recorder-worklet.js');
        var node = new AudioWorkletNode(ctx, 'tw-recorder', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
        node.port.onmessage = function (e) { onChunk(r, e.data.samples, e.data.peak); };
        src.connect(node); node.connect(sink); r.node = node;
      } else {
        var sp = ctx.createScriptProcessor(4096, 1, 1);
        sp.onaudioprocess = function (e) {
          var d = new Float32Array(e.inputBuffer.getChannelData(0)), p = 0;
          for (var i = 0; i < d.length; i++) { var a = d[i] < 0 ? -d[i] : d[i]; if (a > p) p = a; }
          onChunk(r, d, p);
        };
        src.connect(sp); sp.connect(sink); r.node = sp;
      }
    } catch (e) {
      opening = false; teardown(r);
      logErr('mikro', 'Aufnahme konnte nicht starten', e && e.message);
      o.onFail(T('Aufnahme konnte nicht starten') + (e && e.message ? ': ' + e.message : '.')); return;
    }
    opening = false;
    if (topScreen() !== o.owner) { teardown(r); if (o.onCancel) o.onCancel(); return; }
    rec = r;
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
    if (rec !== r) return;
    if (o.onBegin) o.onBegin(r);
    r.timer = setInterval(tick, 150);
    tick();
  }
  function onChunk(r, samples, peak) {
    if (rec !== r) return;
    r.peak = Math.max(r.peak * 0.85, peak);
    if (r.phase === 'search') {   /* nur zuhören: die letzten Sekunden behalten, für die Prüfung des Signals */
      r.chunks.push(samples); r.n += samples.length; r.heard += samples.length;
      var keep = Math.round(SEARCH_KEEP * r.fs);
      while (r.chunks.length > 1 && r.n - r.chunks[0].length >= keep) r.n -= r.chunks.shift().length;
      return;
    }
    if (r.skipped < r.settleN) {   /* Beruhigungszeit: die Uhr liegt eben erst, diese Takte nicht verwenden */
      var drop = Math.min(r.settleN - r.skipped, samples.length);
      r.skipped += drop;
      if (drop >= samples.length) return;
      samples = samples.subarray(drop);
    }
    r.chunks.push(samples); r.n += samples.length; r.total += samples.length;
    /* Regulieren: nur die letzten Sekunden behalten, die Aufnahme läuft weiter */
    if (r.ring) while (r.chunks.length > 1 && r.n - r.chunks[0].length >= r.ring) r.n -= r.chunks.shift().length;
    if (r.total < r.dur * r.fs) return;
    if (r.o.extend && !r.ext && settings.extend && r.dur < EXTEND_TO) recCheck(r);
    else recFinish();
  }
  /* Lohnt sich mehr Zeit? Ja bei klarem Signal und einem ± über 0,5 s/Tag, und wenn die Engine den Wert ablehnt, weil der
     Gang schwankte (code 'wander': Die Klicks sind klar, ihr eigener Rat lautet «am besten 60 Sekunden»). */
  function needsMore(res) {
    if (!res) return false;
    if (!res.ok) return res.code === 'wander';
    return !!(res.quality && res.quality.label !== 'schwach' && res.rateSigma > SIGMA_SURE);
  }
  function extendText(res) {
    return res.ok ? T('Noch zu unsicher (± {s} s/Tag). Tickwerk misst weiter, bis 60 Sekunden um sind. Nichts bewegen.', { s: fmt(res.rateSigma, 1) }) :
      T('Der Gang schwankt noch zu stark für einen Wert. Tickwerk misst weiter, bis 60 Sekunden um sind. Nichts bewegen.');
  }
  /* f: { from, to } einer Verlängerung, die sich nicht auswerten liess */
  function extFailText(f) {
    return T('Die Verlängerung auf {b} s liess sich nicht auswerten. Es gilt der Wert der ersten {a} Sekunden.', { a: f.from, b: f.to });
  }
  /* Die gewählte Messdauer ist um: Wert rechnen, während die Aufnahme weiterläuft. Ist er sicher genug (oder abgelehnt,
     oder das Signal schwach), endet die Aufnahme, und es gilt dieses Ergebnis; die inzwischen aufgenommenen Sekunden
     fallen weg. Sonst läuft sie bis EXTEND_TO weiter und wird dann als Ganzes ausgewertet. Das erste Ergebnis und seine
     Aufnahme bleiben bis dahin stehen (r.ext.first), als Rückfall, falls sich das Ganze nicht auswerten lässt (extFallback). */
  function recCheck(r) {
    var first = allSamples(r, Math.round(r.dur * r.fs));
    r.ext = { state: 'checking', from: r.dur };
    r.dur = EXTEND_TO;
    if (r.o.extend.onChecking) r.o.extend.onChecking(r);
    runJob({ samples: first, fs: r.fs, opts: r.o.extend.opts() }).then(function (res) {
      if (rec !== r || r.ext.state !== 'checking') return;   /* abgebrochen oder schon fertig */
      if (needsMore(res)) {
        r.ext.state = 'extended';
        r.ext.first = { samples: first, res: res };
        if (r.o.extend.onExtended) r.o.extend.onExtended(res, r);
        return;
      }
      rec = null; teardown(r);
      r.o.onDone(first, r.fs, res || { ok: false }, 0);
    });
  }
  /* Eine verlängerte Messung darf nie schlechter sein als eine ohne Verlängerung. Ergibt die ganze Aufnahme keinen Wert
     (Handy in der Verlängerung bewegt oder weggenommen, Signal dort schwach, Gang über die ganze Zeit zu unruhig, ein
     Aussetzer der Aufnahme mitten in schwankendem Gang), gilt darum das Ergebnis der zuerst gewählten Dauer: unsicher und
     so gekennzeichnet, aber genau das, was ohne Verlängerung dastünde. Zuerst galt das nicht, wenn die Engine wegen
     schwankendem Gang ablehnt (code 'wander'); im Test endete dann eine Messung, die nach 30 s einen Wert hatte, nach
     60 s ohne Wert. Das ist schlechter als ohne Verlängerung, darum keine Ausnahme.
     res: Ergebnis der ganzen Aufnahme, first: { samples, res } aus der Prüfung. Rückgabe: first oder null. */
  function extFallback(res, first) {
    if (!first || !first.res || !first.res.ok) return null;
    if (res && res.ok) return null;
    return first;
  }
  function tick() {
    var r = rec; if (!r) return;
    var o = r.o;
    if (r.phase === 'search') { searchTick(r); return; }
    if (r.skipped < r.settleN) { if (o.onSettle) o.onSettle(Math.ceil((r.settleN - r.skipped) / r.fs), r); return; }
    if (!r.go) { r.go = true; if (o.onGo) o.onGo(r); }   /* Countdown vorbei: ab jetzt zählt die Messzeit */
    var t = r.total / r.fs;
    if (o.onTick) o.onTick(Math.max(0, Math.ceil(r.dur - t)), t / r.dur, r);
    if (o.onFrame) o.onFrame(t, r);
    if (!o.noLive && t >= r.nextLive && !r.liveBusy) {
      r.nextLive = t + LIVE_EVERY; r.liveBusy = true;
      runJob({ samples: tailSamples(r, LIVE_WINDOW), fs: r.fs, opts: probeOpts(o.opts), live: true }).then(function (res) {
        r.liveBusy = false;
        if (rec === r && o.onLive) o.onLive(res);
      });
    }
  }
  /* Wirklich Ticken gehört? Im Rauschen findet die schnelle Prüfung manchmal ein Scheinmuster: dann liegen die Schläge
     um Millisekunden neben dem Raster und heben sich kaum vom Rauschen ab. Echtes Ticken, auch leises: unter 2 ms, über 6 dB. */
  function heardOf(res) { return !!(res && res.ok && res.quality && res.quality.residualMs <= 2 && res.quality.snrDb >= 6); }
  function probeOpts(op) {
    var c = { probe: true };
    Object.keys(op || {}).forEach(function (k) { c[k] = op[k]; });
    return c;
  }
  function searchTick(r) {
    var o = r.o, t = r.heard / r.fs;
    if (o.onSearchTick) o.onSearchTick(t, r);
    if (t > SEARCH_MAX) { recStop(false); if (o.onTimeout) o.onTimeout(); return; }
    if (r.searchBusy || t < r.nextSearch || r.n < SEARCH_WINDOW * r.fs) return;
    r.nextSearch = t + SEARCH_EVERY; r.searchBusy = true;
    runJob({ samples: tailSamples(r, SEARCH_WINDOW), fs: r.fs, opts: probeOpts(o.opts), live: true }).then(function (res) {
      r.searchBusy = false;
      if (rec !== r || r.phase !== 'search') return;
      var good = heardOf(res) && res.quality.label !== 'schwach' && res.quality.detectedFraction >= 0.85;
      r.good = good ? r.good + 1 : 0;
      if (o.onSearch) o.onSearch(res, r.good, t);
      if (r.good >= SEARCH_NEED) { beginMeasure(r); return; }
      /* Kein Uhrwerk-Ticken: vielleicht eine Quarzuhr (ein Schritt pro Sekunde)? Zweimal nacheinander erkannt → Hinweis */
      if (!heardOf(res) && o.onQuartz && t >= 6 && !r.qBusy) {
        r.qBusy = true;
        runJob({ kind: 'quartzProbe', samples: tailSamples(r, 6), fs: r.fs }).then(function (qr) {
          r.qBusy = false;
          if (rec !== r || r.phase !== 'search') return;
          r.quartz = qr && qr.quartz ? (r.quartz || 0) + 1 : 0;
          if (r.quartz >= 2) { recStop(false); o.onQuartz(); }
        });
      }
    });
  }
  /* Signal klar: Countdown auf dem Bildschirm, danach zählt die Messzeit. Keine Vibration: Das Handy liegt an der Krone,
     ein Vibrieren würde es verschieben und das Mikrofon nähme es auf. */
  function beginMeasure(r) {
    if (rec !== r || r.phase !== 'search') return;
    r.phase = 'measure'; r.chunks = []; r.n = 0; r.total = 0; r.skipped = 0; r.settleN = Math.round(COUNTDOWN * r.fs); r.go = false;
    r.nextLive = LIVE_FIRST; r.liveBusy = false;
    if (r.o.onMeasureStart) r.o.onMeasureStart(r);
  }
  /* Grosser Countdown: vor dem Start 3, 2, 1; im Lagen-Test danach die restlichen Sekunden. n = null blendet ihn aus */
  function showCount(id, n, txt) {
    var box = $(id + 'Box');
    box.classList.toggle('counting', n != null);
    if (n != null) { $(id + 'N').textContent = String(n); $(id + 'T').textContent = txt; }
  }
  function recForceStart() { if (rec && rec.phase === 'search') beginMeasure(rec); }
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
  function teardown(r) {
    clearInterval(r.timer);
    try { r.src.disconnect(); if (r.node) r.node.disconnect(); r.sink.disconnect(); } catch (e) { /* egal */ }
    r.stream.getTracks().forEach(function (t) { t.stop(); });
    try { r.ctx.close(); } catch (e) { /* egal */ }
    if (wakeLock) { try { wakeLock.release(); } catch (e) { /* egal */ } wakeLock = null; }
  }
  function recStop(cancelled) {
    var r = rec; if (!r) return;
    rec = null; teardown(r);
    if (cancelled && r.o.onCancel) r.o.onCancel();
  }
  /* Datenschutz: Tickwerk hört nur zu, solange die App sichtbar ist. Geht sie in den Hintergrund
     (anderes App, Bildschirm aus), wird die Aufnahme abgebrochen und das Mikrofon geschlossen. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && rec) { recStop(true); toast(T('Aufnahme abgebrochen: Tickwerk war im Hintergrund.')); }
  });
  function recFinish() {
    var r = rec; if (!r) return;
    rec = null; teardown(r);
    var ext = r.ext && r.ext.state === 'extended' ? r.ext : null;
    r.o.onDone(allSamples(r, Math.round(r.dur * r.fs)), r.fs, null, ext ? ext.from : 0, ext ? ext.first : null);
  }

  /* Papierstreifen platzsparend: höchstens 300 Punkte, nur für die letzten Messungen (fürs Protokoll) */
  function compactTrace(trace) {
    if (!trace || !trace.length) return null;
    var step = Math.max(1, Math.ceil(trace.length / 300)), t = [], d = [], p = '';
    for (var i = 0; i < trace.length; i += step) { t.push(+trace[i].t.toFixed(2)); d.push(+trace[i].devMs.toFixed(3)); p += trace[i].parity ? '1' : '0'; }
    return { t: t, d: d, p: p };
  }
  /* c: { watch, pos, sess } */
  function saveMeasurement(r, source, fs, c) {
    var w = c.watch;
    var m = {
      id: nextId(), watchId: w ? w.id : '', watchName: w ? w.name : UNKNOWN.name, pos: c.pos, date: new Date().toISOString(), source: source,
      rate: +r.rate.toFixed(2), sigma: +r.rateSigma.toFixed(2), stable: r.rateStable !== false,
      be: +r.beatErrorMs.toFixed(2), beOk: r.beatErrorReliable !== false,
      amp: r.amplitude ? Math.round(r.amplitude) : null, ampOk: !!r.amplitudeReliable, lift: r.liftAngle,
      bph: r.bph, q: r.quality.label, dur: +r.duration.toFixed(1),
      ppm: r.clockPpm || 0, fs: fs || null, eng: engineVersion || '', app: APP_VERSION
    };
    var cc = calOf(usedMic), ca = calAcc(cc);
    if (m.ppm && isCal(cc) && Math.abs(cc.ppm - m.ppm) < 0.05) { m.cq = calKind(cc); if (ca) m.cu = Math.round(ca.ppm * 10) / 10; }   /* womit geeicht war */
    if (c.sess) { m.sess = c.sess; if (c.lset) m.lset = c.lset; }
    if (c.gr) { m.gr = c.gr.id; m.grs = c.gr.step; }
    if (!isPro() && useFree()) m.fp = true;
    var tr = compactTrace(r.trace); if (tr) m.tr = tr;
    meas.push(m);
    if (meas.length > MAX_MEAS) meas = meas.slice(meas.length - MAX_MEAS);
    var kept = 0;
    for (var i = meas.length - 1; i >= 0; i--) { if (meas[i].tr && ++kept > TRACE_KEEP) delete meas[i].tr; }
    saveMeas();
    return m;
  }

  /* ---------- Messen ---------- */
  var lastRec = null, lastShown = null, busy = false;
  function qLevel(q) {
    if (!q) return 0;
    if (q.label === 'stark') return 4;
    if (q.label === 'mittel') return q.detectedFraction >= 0.85 ? 3 : 2;
    return 1;
  }
  var LEVEL_TEXT = [T('kein Signal'), T('Signal schwach'), T('Signal mittel'), T('Signal gut'), T('Signal stark')];
  function qText(q) { return T('Signal ' + q); }
  function setSignal(level) { $('mSignal').setAttribute('data-level', String(level)); $('mSignalText').textContent = LEVEL_TEXT[level]; }
  function setMarker(rate, live) {
    var mk = $('mMarker');
    mk.hidden = false; mk.classList.toggle('live', !!live);
    mk.style.left = ((Math.max(-20, Math.min(20, rate)) + 20) / 40 * 100) + '%';
  }
  function setChipsDisabled(on) { ['mPos', 'mDur', 'mTools', 'mWatchPick'].forEach(function (id) { $(id).disabled = on; }); }
  function setLocks(locked) {
    ['mBe', 'mAmp'].forEach(function (id) { $(id).classList.toggle('locked', locked); });
    $('mBeTag').hidden = true; $('mAmpTag').hidden = true;   /* der Wert selbst zeigt «Pro» */
  }
  function clearReadout() {
    lastShown = null; lastRec = null;
    $('scr-measure').classList.remove('has-result');
    grInfo = null; renderGrNotice();
    $('mRate').textContent = '–'; $('mRate').classList.remove('live'); $('mSigma').textContent = '';
    $('mMarker').hidden = true; $('mVerdict').hidden = true; $('bphWarn').hidden = true; $('mQuartz').hidden = true;
    $('mBe').textContent = '–'; $('mBeNote').textContent = ''; $('mAmp').textContent = '–'; $('mLift').textContent = '';
    $('mBph').textContent = '–'; $('mBphNote').textContent = T('erkannt');
    setLocks(false); setSignal(0);
    $('shareBtn').hidden = true; $('imgBtn').hidden = true; $('mState').textContent = T('Bereit');
    $('mStartLabel').textContent = T('Messen');
    drawTape($('mTape'), null, T('Der Papierstreifen erscheint während der Messung.'));
    drawBeat($('mBeat'), null);
  }
  function idleHint() {
    return settings.autoStart ? T('«Messen» tippen und die Unterkante des Handys an die Krone halten. Tickwerk startet, sobald das Ticken klar ist.') :
      T('Unterkante des Handys an die Krone halten, dann «Messen» tippen.');
  }
  function renderMeasure() {
    var w = currentWatch(), k = w ? kalById(w.kaliberId) : null;
    renderGrNotice();
    if (settings.watchId && !w) { settings.watchId = ''; saveSettings(); }
    $('mWatchName').textContent = w ? w.name : UNKNOWN.name;
    $('mWatchSub').textContent = watchSub(w) + (ppmOf(micKey()) ? ' · ' + T('geeicht') : '') + micNote();   /* kurz, damit die Zeile selten umbricht */
    $('mPos').value = settings.pos; $('mDur').value = String(settings.dur);
    if (!rec && !busy && !lastShown && k && k.messbar === false) setStatus('status', T(k.notiz || 'Dieses Werk lässt sich mit dem Mikrofon nicht messen.'), 'err');
    renderFree();
    if (!rec) redrawMeasure();
  }
  function redrawMeasure() {
    if (lastShown) { drawTape($('mTape'), lastShown.r.trace); drawBeat($('mBeat'), lastShown.r.templates, lastShown.r.liftTimeMs); }
    else if (!busy) drawTape($('mTape'), null, T('Der Papierstreifen erscheint während der Messung.'));
  }
  function renderFree() {
    var el = $('mFree');
    if (isPro()) { el.hidden = true; return; }
    var left = freeLeft();
    el.hidden = false;
    el.textContent = left ? T('Abfallfehler und Amplitude: noch {n} von {m} Gratis-Messungen diese Woche.', { n: left, m: FREE_PER_WEEK }) :
      T('Die {m} Gratis-Messungen mit allen Werten sind diese Woche aufgebraucht. Gang und Schlagzahl misst Tickwerk weiter gratis.', { m: FREE_PER_WEEK });
  }
  function measureStart() {
    if (rec) { recStop(true); return; }
    if (busy || opening) return;
    var w = currentWatch(), grc = grPending && w && grPending.watchId === w.id ? grPending : null;
    function counting() {
      $('mSearch').hidden = true;
      $('mState').textContent = T('Gleich');
      setStatus('status', T('Signal gut. Die Messung beginnt nach dem Countdown. Nichts mehr bewegen.'), 'ok');
      showCount('mCount', COUNTDOWN, T('Gleich geht es los. Nichts mehr bewegen.'));
    }
    function measuring() {
      showCount('mCount', null);
      $('mState').textContent = T('Misst');
      setStatus('status', T('Messung läuft. Nichts bewegen.'), 'busy');
      drawTape($('mTape'), null, T('Der Papierstreifen erscheint nach ein paar Sekunden.'));
    }
    recStart({
      owner: 'measure', dur: settings.dur, search: settings.autoStart, settle: settings.autoStart ? 0 : COUNTDOWN, opts: watchOpts(w),
      onOpening: function () { $('mStart').disabled = true; setStatus('status', T('Mikrofon wird geöffnet …'), 'busy'); },
      onFail: function (msg) { $('mStart').disabled = false; setStatus('status', msg, 'err'); },
      onBegin: function (r) {
        clearReadout();
        $('mStart').disabled = false; $('mStart').classList.add('running'); setChipsDisabled(true);
        $('scr-measure').classList.add('is-running');   /* während der Aufnahme steht der Papierstreifen über den Werten */
        if (r.phase !== 'search') { $('mStartLabel').textContent = T('Abbrechen'); counting(); return; }
        $('mState').textContent = T('Sucht das Signal');
        $('mStartLabel').textContent = T('Abbrechen');
        $('mSearch').hidden = false;
        setStatus('status', T('Handy-Unterkante an die Krone halten und kurz ruhig bleiben. Sobald das Ticken klar ist, startet die Messung von selbst.'), 'busy');
        drawTape($('mTape'), null, T('Tickwerk hört zu …'));
      },
      onSearchTick: function (t, r) { bar($('levelFill'), (20 * Math.log10(r.peak + 1e-9) + 80) / 60); },
      onSearch: function (res, good, t) {
        var heard = heardOf(res);
        setSignal(heard ? qLevel(res.quality) : 0);
        if (heard) { drawTape($('mTape'), res.trace); $('mSigma').textContent = T('{bph} A/h erkannt', { bph: thousands(res.bph) }); }
        if (good) setStatus('status', T('Signal gut. Ruhig halten, die Messung startet gleich.'), 'ok');
        else if (heard) setStatus('status', T('Ticken erkannt, aber noch schwach. Das Handy etwas verschieben oder fester an die Krone halten.'), 'busy');
        else setStatus('status', t > 20 ? T('Noch kein klares Ticken. Ist die Uhr aufgezogen und der Raum ruhig? Sonst «Jetzt messen» tippen.') :
          T('Suche das Ticken … Handy-Unterkante an die Krone halten.'), 'busy');
      },
      onMeasureStart: counting,
      onSettle: function (left) { showCount('mCount', left, T('Gleich geht es los. Nichts mehr bewegen.')); },
      onGo: measuring,
      onQuartz: function () { measureIdle(); $('mState').textContent = T('Bereit'); showQuartzHint(); },
      onTimeout: function () {
        measureIdle(); $('mState').textContent = T('Bereit');
        setStatus('status', T('Zwei Minuten lang kein klares Ticken. Uhr aufziehen, Handy-Unterkante direkt an die Krone halten und nochmals versuchen.'), 'err');
      },
      onTick: function (left, frac, r) {
        var db = 20 * Math.log10(r.peak + 1e-9);
        bar($('levelFill'), (db + 80) / 60);
        if (r.ext && r.ext.state === 'checking') {   /* gewählte Dauer um: Der Wert wird gerechnet, die Aufnahme läuft weiter */
          $('mStartLabel').textContent = T('Abbrechen'); $('mState').textContent = T('Prüft den Wert'); bar($('mProg'), 1);
          return;
        }
        $('mStartLabel').textContent = T('Abbrechen') + ' · ' + left + ' s';
        $('mState').textContent = T('Misst · noch {n} s', { n: left });
        bar($('mProg'), frac);
      },
      extend: {
        opts: function () { return watchOpts(w); },
        onChecking: function () { setStatus('status', T('Die Messzeit ist um. Tickwerk prüft, ob der Wert sicher genug ist. Noch nichts bewegen.'), 'busy'); },
        onExtended: function (res) {
          setStatus('status', extendText(res), 'busy');
        }
      },
      onLive: function (res) {
        if (heardOf(res)) {
          $('mRate').textContent = signed(res.rate, 1); $('mRate').classList.add('live');
          $('mSigma').textContent = T('vorläufig') + ' · ' + thousands(res.bph) + ' ' + T('A/h');
          setMarker(res.rate, true); setSignal(qLevel(res.quality));
          drawTape($('mTape'), res.trace);
          /* während Prüfung und Verlängerung bleibt deren Hinweis stehen (er sagt, warum es länger dauert) */
          if (!(rec && rec.ext)) setStatus('status', T('Ticken erkannt. Nichts bewegen, bis die Zeit um ist.'), 'ok');
        } else {
          setSignal(0);
          setStatus('status', T('Noch kein klares Ticken. Unterkante des Handys näher an die Krone, Raum ruhig halten.'), 'err');
        }
      },
      onCancel: function () { measureIdle(); $('mState').textContent = T('Bereit'); setStatus('status', T('Abgebrochen.'), ''); },
      onDone: function (samples, fs, pre, extFrom, first) {
        measureIdle();
        lastRec = { samples: samples, fs: fs, date: new Date(), watchName: w ? w.name : UNKNOWN.name, pos: settings.pos };
        analyzeMeasure(samples, fs, 'Mikrofon', grc, pre, extFrom, first);
      }
    });
  }
  function showQuartzHint() {
    $('mQuartz').hidden = false; setSignal(0);
    setStatus('status', T('Quarzuhr erkannt. Die Messung ist für mechanische Uhren.'), '');
  }
  function measureIdle() {
    showCount('mCount', null);
    $('scr-measure').classList.remove('is-running');
    $('mStart').classList.remove('running'); $('mStart').disabled = false; setChipsDisabled(false); $('mSearch').hidden = true;
    bar($('mProg'), 0); bar($('levelFill'), 0);
    $('mStartLabel').textContent = lastShown ? T('Nochmals messen') : T('Messen');
  }
  /* Grund einer abgelehnten Auswertung als Text. Fehlte das Ticken 4 s oder länger (Engine: code 'silence', zum Beispiel
     Handy weggenommen), sagt die App, wo die Lücke lag, statt nur «Signal zu schwach». Sekunden zählen ab Beginn der Messzeit. */
  function failText(res) {
    var s = res && res.code === 'silence' ? res.silence : null;
    if (!s) return T((res && res.reason) || 'Keine Messung möglich.');
    var a = Math.max(1, Math.round(s.fromS)), b = Math.round(s.toS), n = Math.round(s.totalS);
    return (s.where === 'end' ? T('Nach {a} von {n} Sekunden war das Ticken nicht mehr zu hören.', { a: a, n: n }) :
      s.where === 'start' ? T('In den ersten {b} Sekunden war kein Ticken zu hören.', { b: b }) :
        T('Zwischen Sekunde {a} und {b} war das Ticken nicht zu hören.', { a: a, b: b })) +
      ' ' + T('Darum gibt es keinen Wert. Handy und Uhr während der ganzen Messung ruhig lassen und nochmals messen.');
  }
  /* Abgelehnte Auswertung fürs Fehlerprotokoll (Diagnose): der Grundtext der Engine, bei einer Lücke im Ticken deren Lage */
  function logFail(kind, res) {
    var s = res && res.code === 'silence' ? res.silence : null, why = (res && res.reason) || 'Keine Messung möglich.', pre = 'Fehler in der Auswertung: ';
    if (s) logErr(kind, 'Lücke im Ticken', s.fromS + '–' + s.toS + ' / ' + s.totalS + ' s');
    else if (why.indexOf(pre) === 0) logErr(kind, 'Fehler in der Auswertung', why.slice(pre.length));
    else logErr(kind, why);
  }
  /* Die Verlängerung liess sich nicht auswerten (dann gilt die zuerst gewählte Dauer, siehe extFallback): mit dem Grund ins Fehlerprotokoll */
  function logExtFail(res) {
    var s = res && res.code === 'silence' ? res.silence : null;
    logErr('mess', 'Verlängerung nicht auswertbar', s ? 'Lücke ' + s.fromS + '–' + s.toS + ' / ' + s.totalS + ' s' : (res && res.reason) || '');
  }
  /* pre: schon gerechnetes Ergebnis derselben Aufnahme (aus der Prüfung vor einer möglichen Verlängerung), dann wird nicht
     nochmals gerechnet. extFrom: ursprünglich gewählte Dauer, wenn die Messung verlängert wurde; first: Aufnahme und
     Ergebnis dieser Dauer als Rückfall (siehe extFallback). */
  function analyzeMeasure(samples, fs, source, grc, pre, extFrom, first) {
    var w = currentWatch(), pos = settings.pos, keepRec = lastRec;
    busy = true;
    $('mStart').disabled = true; $('mStartLabel').textContent = T('Rechnet …'); $('mState').textContent = T('Rechnet');
    setStatus('status', T('Rechne …'), 'busy');
    var op = watchOpts(w, source === 'Datei' ? '' : usedMic);
    /* Eine Datei hat oft einen Vor- oder Nachlauf ohne Ticken (Handy noch nicht an der Uhr): Die Engine wertet dann nur
       das Stück mit Ticken aus. Bei einer Messung übers Mikrofon gibt es das nicht; dort heisst eine Lücke «Handy bewegt». */
    if (source === 'Datei') op.trimSilence = true;
    (pre ? Promise.resolve(pre) : runJob({ samples: samples, fs: fs, opts: op })).then(function (res) {
      busy = false; $('mStart').disabled = false;
      var fb = extFallback(res, first);
      if (fb) {   /* die Verlängerung liess sich nicht auswerten: Es gilt die zuerst gewählte Dauer, auch als Aufnahme zum Teilen */
        logExtFail(res);
        res = fb.res; res.extFailed = { from: extFrom, to: EXTEND_TO }; samples = fb.samples;
        if (keepRec) keepRec.samples = samples;
      } else if (res && res.ok && extFrom) res.extFrom = extFrom;
      if (!res || !res.ok) {
        clearReadout(); lastRec = keepRec;
        $('shareBtn').hidden = !lastRec;
        logFail('mess', res);
        setStatus('status', failText(res), 'err');
        runJob({ kind: 'quartzProbe', samples: samples.subarray(0, Math.min(samples.length, Math.round(12 * fs))), fs: fs }).then(function (qr) {
          if (qr && qr.quartz && !rec && !busy) showQuartzHint();
        });
        return;
      }
      var m = saveMeasurement(res, source, fs, { watch: w, pos: pos, gr: grc && w && grc.watchId === w.id ? grc : null });
      lastRec = keepRec;
      showResult(res, m);
      renderFree();
      if (m.gr) grSaved(m);
    });
  }
  /* Wertung einer gespeicherten Messung: { kind: good | okay | warn, text } */
  function rateVerdict(m) {
    var kind, text, short;
    if (m.q === 'schwach') { kind = 'warn'; text = 'Nur ein grober Wert: das Signal ist schwach. Handy näher an die Krone und nochmals messen.'; short = 'Nur ein grober Wert: das Signal war schwach.'; }
    else if (m.stable === false && m.sigma > SIGMA_COUNT) { kind = 'warn'; text = 'Der Gang schwankte während der Messung zu stark. Dieser Wert zählt nicht. Uhr und Handy ruhig halten und nochmals messen, am besten 60 s.'; short = 'Zählt nicht: Der Gang schwankte während der Messung zu stark.'; }
    else if (m.stable === false) { kind = 'warn'; text = 'Die Klicks waren klar, aber der Gang schwankte während der Messung, darum das grössere ±. Der Wert zählt mit dem Vermerk «Gang könnte schwanken». Genauer wird er mit 60 s und ruhig gehaltenem Handy.'; short = 'Zählt mit dem Vermerk «Gang könnte schwanken».'; }
    else if (m.sigma > SIGMA_SURE) { kind = 'warn'; text = 'Zu unsicher für eine Wertung (mehr als ±0,5 s/Tag). Länger messen und das Handy ruhig an die Krone halten.'; short = 'Zu unsicher für eine Wertung (mehr als ±0,5 s/Tag).'; }
    else if (m.rate >= -4 && m.rate <= 6) { kind = 'good'; text = short = 'Im Chronometer-Bereich (−4 bis +6 s/Tag).'; }
    else if (Math.abs(m.rate) <= 15) { kind = 'okay'; text = short = 'Gut für eine Uhr ohne Chronometer-Zertifikat.'; }
    else { kind = 'warn'; text = 'Deutlich daneben. In einer anderen Lage nochmals messen; bleibt es so, regulieren lassen.'; short = 'Deutlich daneben: in anderen Lagen prüfen, sonst regulieren lassen.'; }
    return { kind: kind, text: T(text), short: T(short) };
  }
  function showResult(r, m) {
    lastShown = { r: r, m: m };
    $('scr-measure').classList.add('has-result');   /* «Gespeichert …» rückt unter den Papierstreifen */
    var w = findWatch(m.watchId), k = w ? kalById(w.kaliberId) : null, st = liftState(w);
    $('mRate').textContent = signed(r.rate, 1); $('mRate').classList.remove('live');
    $('mSigma').textContent = '± ' + fmt(r.rateSigma, 2) + ' ' + T('s/Tag') + ' · ' + fmt(r.duration, 0) + ' s · ' + T('{n} Schläge', { n: r.beatsUsed }) +
      (r.rateStable === false && r.halves ? ' · ' + T('schwankt') + ' (' + signed(r.halves.rate[0], 1) + ' / ' + signed(r.halves.rate[1], 1) + ')' : '');
    setMarker(r.rate, false);
    var vd = rateVerdict(m);
    $('mVerdict').hidden = false; $('mVerdict').setAttribute('data-kind', vd.kind); $('mVerdictText').textContent = vd.text;
    var full = showsPro(m);
    setLocks(!full);
    if (full) {
      $('mBe').textContent = fmt(r.beatErrorMs, 2) + ' ms';
      $('mBeNote').textContent = T(r.beatErrorReliable === false ? 'unsicher' : (r.beatErrorMs <= 0.5 ? 'sehr gut' : (r.beatErrorMs <= 1 ? 'in Ordnung' : 'hoch')));
      $('mAmp').textContent = r.amplitude ? Math.round(r.amplitude) + '°' : '–';
      $('mLift').textContent = !r.amplitude ? '' : !r.amplitudeReliable ? T('unsicher') : (k && k.coaxial ? T('Richtwert (Co-Axial)') : T('bei {a}', { a: deg(r.liftAngle) }) + (st ? ' (' + T(st) + ')' : ''));
    } else {
      $('mBe').textContent = 'Pro'; $('mBeNote').textContent = '';
      $('mAmp').textContent = 'Pro'; $('mLift').textContent = '';
    }
    $('mBph').textContent = thousands(r.bph);
    var expBph = w && w.bph ? w.bph : 0, mismatch = !!expBph && expBph !== r.bph;
    $('mBphNote').textContent = mismatch ? T('erwartet {bph}', { bph: thousands(expBph) }) : T('A/h');
    $('bphWarn').hidden = !mismatch;
    if (mismatch) {
      $('bphWarnText').textContent = T('Tickwerk hat {a} A/h erkannt, für «{w}» sind {b} A/h hinterlegt. Möglicherweise steckt eine andere Version des Werks in der Uhr.',
        { a: thousands(r.bph), w: w.name, b: thousands(expBph) });
      $('bphFix').textContent = T('{bph} A/h übernehmen', { bph: thousands(r.bph) });
      $('bphFix').onclick = function () { w.bph = r.bph; saveWatches(); $('bphWarn').hidden = true; $('mBphNote').textContent = T('A/h'); renderMeasure(); };
    }
    setSignal(qLevel(r.quality));
    $('mState').textContent = T('Gespeichert') + ' · ' + timeStr(new Date(m.date));   /* jede gezeigte Messung ist gespeichert; die Zeile dazu steht unter dem Papierstreifen */
    setStatus('status', (m.watchId ? T('Gespeichert bei «{w}»', { w: m.watchName }) : T('Gespeichert unter «Alle Messungen»')) + ', ' + T('Lage {p}', { p: POS[m.pos] }) +
      (r.clockPpm ? '. ' + T('Handy-Uhr korrigiert.') : '.') + (r.gaps && r.gaps.length ? ' ' + T('Ein kurzer Aussetzer der Aufnahme wurde ausgeglichen.') : '') +
      (r.trimmed ? ' ' + T('Ausgewertet ist nur das Stück mit Ticken (Sekunde {a} bis {b}).', { a: Math.round(r.trimmed.fromS), b: Math.round(r.trimmed.toS) }) : '') +
      (r.extFrom ? ' ' + T('Verlängert von {a} auf {b} s, weil der Wert noch zu unsicher war.', { a: r.extFrom, b: Math.round(r.duration) }) : '') +
      (r.extFailed ? ' ' + extFailText(r.extFailed) : ''), 'ok');
    $('mStartLabel').textContent = T('Nochmals messen');
    $('shareBtn').hidden = !lastRec; $('imgBtn').hidden = false;
    drawTape($('mTape'), r.trace);
    drawBeat($('mBeat'), r.templates, r.liftTimeMs);
  }
  $('mStart').addEventListener('click', measureStart);
  $('mForce').addEventListener('click', recForceStart);
  $('mQuartzGo').addEventListener('click', function () { $('mQuartz').hidden = true; go('eichen'); });
  $('mPos').addEventListener('change', function () { settings.pos = this.value; saveSettings(); });
  $('mDur').addEventListener('change', function () { settings.dur = parseInt(this.value, 10) || 30; saveSettings(); });
  $('mGuide').addEventListener('click', function () { go('guide'); });
  $('mWatchPick').addEventListener('click', openWatchSheet);
  ['mBe', 'mAmp'].forEach(function (id) {
    $(id).parentNode.parentNode.addEventListener('click', function () { if ($(id).classList.contains('locked')) requirePro('values'); });
  });
  function setWatch(id) {
    if (settings.watchId === id) return;
    settings.watchId = id; saveSettings();
    if (grPending && grPending.watchId !== id) grPending = null;
    clearReadout(); setStatus('status', idleHint(), '');
  }
  function openWatchSheet() {
    if (rec || busy) return;
    var ul = $('wsList'); ul.innerHTML = '';
    mechWatches().concat([null]).forEach(function (w) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<span>' + esc(w ? w.name : UNKNOWN.name) + '</span><small>' + esc(watchSub(w)) + '</small>';
      if ((w ? w.id : '') === settings.watchId) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', function () { setWatch(w ? w.id : ''); closeSheet(); renderMeasure(); });
      li.appendChild(b); ul.appendChild(li);
    });
    openSheet('watchSheet');
  }

  /* ---------- Werkzeuge: dieselbe Liste unter «Messen» (Auswahl) und unter «Mehr» ---------- */
  var TOOLS = [
    { id: 'lagen', t: T('Lagen-Test'), s: T('Die Uhr in bis zu sechs Lagen messen, wie beim Uhrmacher'), pro: true },
    { id: 'reg', t: T('Regulieren'), s: T('Der Gang laufend, während du am Werk einstellst'), pro: true },
    { id: 'gr', t: T('Gangreserve-Test'), s: T('Voll aufgezogen und nach 24 Stunden: Wie viel Kraft bleibt?'), pro: true },
    { id: 'zeit', t: T('Gang im Alltag'), s: T('Die Uhr über Tage mit der Atomzeit vergleichen') },
    { id: 'det', t: T('Werk-Detektiv'), s: T('Herausfinden, welches Werk in der Uhr steckt') },
    { id: 'eichen', t: T('Handy-Uhr eichen'), s: '' }
  ];
  /* Die Uhr, für die ein Werkzeug gilt: die unter «Messen» gewählte, sonst die einzige gespeicherte */
  function mechWatches() { return watches.filter(function (w) { return !w.quarz; }); }
  function toolWatch() { var m = mechWatches(); return currentWatch() || (m.length === 1 ? m[0] : null); }
  function toolSub(tool) {
    var w = toolWatch();
    if (tool.id === 'eichen') return { text: clockShort(), due: calOld(calOf(micKey())) };
    if (tool.id === 'gr' && w && isPro()) {
      var g = grNext(w);
      if (g && g.due) return { text: T('Messung «{s}» fällig', { s: GR_NAMES[g.step] }), due: true };
      if (g) return { text: T('läuft') + ' · ' + T('ab {d}', { d: whenText(g.at) }), due: false };
    }
    if (tool.id === 'zeit' && w) { var z = zeitNext(w); if (z && z.due) return { text: T('Zeitvergleich fällig'), due: true }; }
    return { text: tool.s, due: false };
  }
  function renderTools(ul) {
    ul.innerHTML = '';
    TOOLS.forEach(function (tool) {
      var li = document.createElement('li'), b = document.createElement('button'), sub = toolSub(tool);
      b.type = 'button'; b.setAttribute('data-tool', tool.id);
      if (sub.due) b.setAttribute('data-due', '1');
      b.innerHTML = '<span class="menu-t">' + esc(tool.t) + (tool.pro ? '<span class="pro-tag">Pro</span>' : '') + '</span><span class="menu-s">' + esc(sub.text) + '</span>';
      b.addEventListener('click', function () { openTool(tool.id); });
      li.appendChild(b); ul.appendChild(li);
    });
  }
  function openWatch(id, focus) { switchTab('watches'); go('watch', { id: id, focus: focus || '' }); }
  function openTool(id) {
    if (sheetOpen) { closeSheet(function () { openTool(id); }); return; }
    if (rec || busy) return;
    var w = toolWatch();
    if (id === 'lagen') lagenOpen(settings.watchId);
    else if (id === 'reg') { if (requirePro('reg')) go('reg'); }
    else if (id === 'eichen') go('eichen');
    else if (id === 'det') {
      if (w) go('detektiv', { from: 'watch', id: w.id, tool: true });
      else { go('edit', {}); go('detektiv', { from: 'edit', id: '' }); }   /* keine Uhr gewählt: das Werk kommt in eine neue Uhr */
    } else if (id === 'gr' || id === 'zeit') {
      if (id === 'gr' && !requirePro('gr')) return;
      if (w) { openWatch(w.id, id === 'gr' ? 'gr' : 'dt'); return; }
      switchTab('watches');
      toast(watches.length ? T('Uhr antippen: Das Werkzeug steht auf der Seite der Uhr.') : T('Zuerst eine Uhr hinzufügen: Das Werkzeug gehört zu einer Uhr.'));
    }
  }
  $('mTools').addEventListener('click', function () { if (rec || busy) return; renderTools($('tsList')); openSheet('toolSheet'); });
  $('tsClose').addEventListener('click', function () { closeSheet(); });

  /* ---------- Aufnahme als WAV teilen (Pro) ---------- */
  function encodeWav(samples, fs) {
    var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), i;
    function wstr(o, s) { for (var k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); }
    wstr(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); wstr(8, 'WAVE'); wstr(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, fs, true);
    v.setUint32(28, fs * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); wstr(36, 'data'); v.setUint32(40, n * 2, true);
    var peak = 0; for (i = 0; i < n; i++) { var a = samples[i] < 0 ? -samples[i] : samples[i]; if (a > peak) peak = a; }
    var g = peak > 0 ? 0.9 / peak : 1;   // Pegel anheben, damit die 16 Bit gut genutzt werden
    for (i = 0; i < n; i++) {
      var x = samples[i] * g; x = x > 1 ? 1 : (x < -1 ? -1 : x);
      v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7FFF, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }
  function shareOrDownload(blob, name, title) {
    var file = null;
    try { file = new File([blob], name, { type: blob.type }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: title }).catch(function () { /* abgebrochen */ });
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }
  $('shareBtn').addEventListener('click', function () {
    if (!lastRec || !requirePro('wav')) return;
    var d = lastRec.date, pad = function (x) { return (x < 10 ? '0' : '') + x; };
    var name = ('tickwerk_' + lastRec.watchName + '_' + lastRec.pos + '_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()))
      .replace(/[^A-Za-z0-9_\-äöüÄÖÜ]+/g, '-') + '.wav';
    shareOrDownload(encodeWav(lastRec.samples, lastRec.fs), name, T('Tickwerk Aufnahme'));
  });

  /* ---------- Ergebnis als Bild teilen (gratis) ----------
     1080 × 1350 Pixel (Hochformat 4:5, passt für Chats und Instagram). Gezeichnet mit den Schriften der App, ohne Bilder
     von aussen. Abfallfehler und Amplitude nur, wenn die Messung sie zeigen darf (Pro oder Gratis-Messung mit allen Werten). */
  var IMG_W = 1080, IMG_H = 1350, IMG_M = 72;
  var IC = { bg: '#0B0E12', inset: '#0F1318', surface: '#141920', line: '#27303B', line2: '#3A4452', text: '#EEF1F4', muted: '#AEB7C2', faint: '#8A95A3',
    lume: '#B8F28A', tock: '#9FD8FF', warn: '#F59B5E', okay: '#D3DAE2', band: 'rgba(184, 242, 138, 0.16)' };
  var F_DISPLAY = '"Space Grotesk", Inter, sans-serif', F_BODY = 'Inter, system-ui, sans-serif', F_MONO = '"IBM Plex Mono", monospace';
  function imgFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['600 80px "Space Grotesk"', '600 40px Inter', '400 30px Inter', '400 28px "IBM Plex Mono"'].map(function (f) {
      return document.fonts.load(f).catch(function () { return null; });
    }));
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fitText(ctx, text, maxW) {
    text = String(text);
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text.replace(/\s+$/, '') + '…';
  }
  function wrapText(ctx, text, maxW, maxLines) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (wd) {
      var t = cur ? cur + ' ' + wd : wd;
      if (!cur || ctx.measureText(t).width <= maxW) cur = t; else { lines.push(cur); cur = wd; }
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) lines = lines.slice(0, maxLines - 1).concat([fitText(ctx, lines.slice(maxLines - 1).join(' '), maxW)]);
    return lines;
  }
  function imgText(ctx, text, x, y, font, color, align) { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.fillText(text, x, y); ctx.textAlign = 'left'; }
  function imgLogo(ctx, x, y, s) {
    var L = window.TICKWERK_LOGO;
    if (!L) { imgText(ctx, 'Tickwerk', x, y + 70 * s, '600 ' + Math.round(64 * s) + 'px ' + F_DISPLAY, IC.text); return; }
    var pal = L.dark || L.palette;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    L.mark.forEach(function (it) {
      var p = new Path2D(it.d);
      if (it.stroke) { ctx.strokeStyle = pal[it.role]; ctx.lineWidth = it.w; ctx.lineCap = it.cap; ctx.lineJoin = it.join; ctx.stroke(p); }
      else { ctx.fillStyle = pal[it.role]; ctx.fill(p); }
    });
    ctx.translate(124, 50 + L.wordmark.capHeight / 2);
    ctx.fillStyle = pal.text; ctx.fill(new Path2D(L.wordmark.d));
    ctx.restore();
  }
  /* Kopf: Logo, Datum, Uhr und eine Zeile darunter. Gibt die y-Position nach dem Kopf zurück */
  function imgHead(ctx, date, title, sub) {
    ctx.fillStyle = IC.bg; ctx.fillRect(0, 0, IMG_W, IMG_H);
    imgLogo(ctx, IMG_M, 64, 0.9);
    imgText(ctx, date, IMG_W - IMG_M, 118, '400 28px ' + F_MONO, IC.muted, 'right');
    ctx.fillStyle = IC.line; ctx.fillRect(IMG_M, 186, IMG_W - 2 * IMG_M, 2);
    ctx.font = '600 58px ' + F_BODY;
    imgText(ctx, fitText(ctx, title, IMG_W - 2 * IMG_M), IMG_M, 270, '600 58px ' + F_BODY, IC.text);
    ctx.font = '400 28px ' + F_MONO;
    imgText(ctx, fitText(ctx, sub, IMG_W - 2 * IMG_M), IMG_M, 322, '400 28px ' + F_MONO, IC.muted);
    return 330;
  }
  function imgFoot(ctx) {
    ctx.fillStyle = IC.line; ctx.fillRect(IMG_M, IMG_H - 92, IMG_W - 2 * IMG_M, 2);
    var txt = T('Gemessen mit Tickwerk · Selbstmessung mit dem Handy-Mikrofon'), size = 24, maxW = IMG_W - 2 * IMG_M;
    for (; size > 17; size--) { ctx.font = '400 ' + size + 'px ' + F_MONO; if (ctx.measureText(txt).width <= maxW) break; }   /* längere Sprachen: kleiner statt abgeschnitten */
    ctx.font = '400 ' + size + 'px ' + F_MONO;
    imgText(ctx, fitText(ctx, txt, maxW), IMG_M, IMG_H - 46, '400 ' + size + 'px ' + F_MONO, IC.faint);
  }
  /* Grosse Zahl mit Einheit, waagrecht zentriert */
  function imgBig(ctx, value, unit, y, size) {
    ctx.font = '600 ' + size + 'px ' + F_DISPLAY; var w1 = ctx.measureText(value).width;
    ctx.font = '400 ' + Math.round(size * 0.22) + 'px ' + F_BODY; var w2 = ctx.measureText(unit).width, gap = size * 0.08;
    var x = (IMG_W - w1 - gap - w2) / 2;
    imgText(ctx, value, x, y, '600 ' + size + 'px ' + F_DISPLAY, IC.text);
    imgText(ctx, unit, x + w1 + gap, y, '400 ' + Math.round(size * 0.22) + 'px ' + F_BODY, IC.muted);
  }
  /* Skala −20 … +20 s/Tag mit Chronometer-Band (−4 bis +6) und Marke; h: Höhe der Spur */
  function imgScale(ctx, x, y, w, h, rate, labels) {
    var X = function (v) { return x + (Math.max(-20, Math.min(20, v)) + 20) / 40 * w; };
    ctx.fillStyle = IC.band; rrect(ctx, X(-4), y, X(6) - X(-4), h, Math.min(10, h / 4)); ctx.fill();
    for (var v = -20; v <= 20; v += 2) {
      var major = v % 10 === 0, th = major ? h * 0.62 : h * 0.3;
      ctx.fillStyle = major ? IC.faint : IC.line2; ctx.fillRect(Math.round(X(v)) - 1, y + h - th, 2, th);
    }
    if (rate != null && isFinite(rate)) {
      var mx = X(rate);
      ctx.fillStyle = IC.lume; ctx.fillRect(mx - 2.5, y - h * 0.12, 5, h * 1.12);
      ctx.beginPath(); ctx.moveTo(mx - h * 0.2, y - h * 0.32); ctx.lineTo(mx + h * 0.2, y - h * 0.32); ctx.lineTo(mx, y - h * 0.06); ctx.closePath(); ctx.fill();
    }
    if (labels) [-20, -10, 0, 10, 20].forEach(function (v) { imgText(ctx, v ? signed(v, 0) : '0', X(v), y + h + 40, '400 26px ' + F_MONO, IC.faint, 'center'); });
  }
  function imgTape(ctx, x, y, w, h, trace) {
    imgText(ctx, T('Papierstreifen · Tick und Tack').toUpperCase(), x, y - 14, '500 22px ' + F_MONO, IC.faint);
    ctx.fillStyle = IC.inset; rrect(ctx, x, y, w, h, 16); ctx.fill();
    ctx.strokeStyle = IC.line; ctx.lineWidth = 2; ctx.stroke();
    if (!trace || trace.length < 4) return;
    var ys = trace.map(function (p) { return p.devMs; }).sort(function (a, b) { return a - b; });
    var lo = ys[Math.floor(ys.length * 0.02)], hi = ys[Math.ceil(ys.length * 0.98) - 1], mid = (lo + hi) / 2, half = Math.max(0.8, (hi - lo) / 2 * 1.25);
    var tMax = trace[trace.length - 1].t || 1, P = Math.min(24, h / 5);
    trace.forEach(function (p) {
      var px = x + P + p.t / tMax * (w - 2 * P), py = y + h / 2 - (Math.max(mid - half, Math.min(mid + half, p.devMs)) - mid) / half * (h / 2 - P);
      ctx.fillStyle = p.parity ? IC.tock : IC.lume; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    });
  }
  function imgTiles(ctx, tiles, y, h) {
    var gap = 20, n = tiles.length, tw = (IMG_W - 2 * IMG_M - gap * (n - 1)) / n, P = 20;
    tiles.forEach(function (t, i) {
      var x = IMG_M + i * (tw + gap);
      ctx.fillStyle = IC.surface; rrect(ctx, x, y, tw, h, 20); ctx.fill(); ctx.strokeStyle = IC.line; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = '500 20px ' + F_MONO;
      imgText(ctx, fitText(ctx, t.label.toUpperCase(), tw - 2 * P), x + P, y + 44, '500 20px ' + F_MONO, IC.faint);
      ctx.font = '600 50px ' + F_DISPLAY;
      var vw = ctx.measureText(t.value).width;
      imgText(ctx, t.value, x + P, y + 104, '600 50px ' + F_DISPLAY, IC.text);
      if (t.unit) { ctx.font = '400 26px ' + F_BODY; imgText(ctx, fitText(ctx, t.unit, Math.max(20, tw - 2 * P - 10 - vw)), x + P + 10 + vw, y + 104, '400 26px ' + F_BODY, IC.muted); }
      if (t.note) { ctx.font = '400 20px ' + F_MONO; imgText(ctx, fitText(ctx, t.note, tw - 2 * P), x + P, y + h - 20, '400 20px ' + F_MONO, IC.faint); }
    });
  }
  function imgVerdict(ctx, kind, text, y, maxLines) {
    ctx.font = '400 32px ' + F_BODY;
    var lines = wrapText(ctx, text, IMG_W - 2 * IMG_M - 40, maxLines);
    ctx.fillStyle = kind === 'warn' ? IC.warn : kind === 'okay' ? IC.okay : IC.lume;
    ctx.beginPath(); ctx.arc(IMG_M + 10, y - 11, 9, 0, Math.PI * 2); ctx.fill();
    lines.forEach(function (ln, i) { imgText(ctx, ln, IMG_M + 40, y + i * 44, '400 32px ' + F_BODY, IC.text); });
    return y + lines.length * 44;
  }
  function imgName(name, d, suffix) {
    var pad = function (x) { return (x < 10 ? '0' : '') + x; };
    return ('Tickwerk_' + String(name).slice(0, 40) + (suffix ? '_' + suffix : '') + '_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()))
      .replace(/[^A-Za-z0-9_\-äöüÄÖÜàâçéèêëîïôùûÀÉÈ]+/g, '-') + '.png';
  }
  function imgShare(draw, name, btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    imgFonts().then(function () {
      var cv = document.createElement('canvas'); cv.width = IMG_W; cv.height = IMG_H;
      draw(cv.getContext('2d'));
      cv.toBlob(function (blob) {
        btn.disabled = false;
        if (blob) shareOrDownload(blob, name, T('Tickwerk Messung'));
        else toast(T('Das Bild konnte nicht erstellt werden.'));
      }, 'image/png');
    }).catch(function (e) { btn.disabled = false; toast(T('Das Bild konnte nicht erstellt werden.')); if (window.console) console.error(e); });
  }
  function imgTrace(r, m) { return r && r.trace ? r.trace : m && m.tr ? traceOf(m.tr) : null; }
  function drawMeasureImage(ctx, m, r) {
    var w = findWatch(m.watchId), k = w ? kalById(w.kaliberId) : null, d = new Date(m.date);
    imgHead(ctx, dLong(d) + ' · ' + timeStr(d), m.watchName || UNKNOWN.name, [k ? kName(k) : '', thousands(m.bph) + ' ' + T('A/h'), POS[m.pos]].filter(Boolean).join(' · '));
    imgText(ctx, T('Gangabweichung').toUpperCase(), IMG_W / 2, 396, '500 26px ' + F_MONO, IC.faint, 'center');
    imgBig(ctx, signed(m.rate, 1), T('s/Tag'), 568, 200);
    imgText(ctx, '± ' + fmt(m.sigma, 2) + ' ' + T('s/Tag') + ' · ' + T('{n} s gemessen', { n: Math.round(m.dur) }), IMG_W / 2, 630, '400 28px ' + F_MONO, IC.muted, 'center');
    imgScale(ctx, IMG_M, 690, IMG_W - 2 * IMG_M, 52, m.rate, true);
    var vd = rateVerdict(m), y = imgVerdict(ctx, vd.kind, vd.short, 850, 2);
    var tiles = [];
    if (showsPro(m)) {
      tiles.push({ label: T('Abfallfehler'), value: m.be != null ? fmt(m.be, 1) : '–', unit: T('ms'), note: m.beOk ? '' : T('unsicher') });
      tiles.push({ label: T('Amplitude'), value: m.amp ? m.amp + '°' : '–', unit: '', note: !m.amp ? '' : m.ampOk ? T('bei {a}', { a: deg(m.lift || 52) }) : T('unsicher') });
    }
    tiles.push({ label: T('Schlagzahl'), value: thousands(m.bph), unit: T('A/h'), note: '' });
    var ty = Math.max(y + 6, 900);
    imgTiles(ctx, tiles, ty, 156);
    imgTape(ctx, IMG_M, ty + 210, IMG_W - 2 * IMG_M, IMG_H - 92 - 26 - (ty + 210), imgTrace(r, m));
    imgFoot(ctx);
  }
  function drawLagenImage(ctx, w, st, setN, started) {
    var d = new Date(started || Date.now()), k = w ? kalById(w.kaliberId) : null;
    imgHead(ctx, dLong(d), w ? w.name : UNKNOWN.name, [T('Lagen-Test in {n} Lagen', { n: setN }), k ? kName(k) : ''].filter(Boolean).join(' · '));
    imgText(ctx, T('Mittel der Lagen').toUpperCase(), IMG_M, 396, '500 26px ' + F_MONO, IC.faint);
    ctx.font = '600 120px ' + F_DISPLAY;
    var mv = st.mean == null ? '–' : signed(st.mean, 1), mw = ctx.measureText(mv).width;
    imgText(ctx, mv, IMG_M, 510, '600 120px ' + F_DISPLAY, IC.text);
    imgText(ctx, T('s/Tag'), IMG_M + mw + 14, 510, '400 34px ' + F_BODY, IC.muted);
    imgText(ctx, T('Lagendifferenz').toUpperCase(), IMG_W - IMG_M, 396, '500 26px ' + F_MONO, IC.faint, 'right');
    ctx.font = '400 34px ' + F_BODY; var uw = ctx.measureText(T('s/Tag')).width;
    imgText(ctx, T('s/Tag'), IMG_W - IMG_M, 510, '400 34px ' + F_BODY, IC.muted, 'right');
    imgText(ctx, st.spread == null ? '–' : fmt(st.spread, 1), IMG_W - IMG_M - uw - 14, 510, '600 120px ' + F_DISPLAY, IC.text, 'right');
    var y = 560, rowH = st.rows.length > 4 ? 66 : 80, nameW = 330, sx = IMG_M + nameW, sw = IMG_W - 2 * IMG_M - nameW - 210;
    st.rows.forEach(function (row, i) {
      var yy = y + i * rowH, m = row.m, ok = m && counted(m);
      if (i) { ctx.fillStyle = IC.line; ctx.fillRect(IMG_M, yy, IMG_W - 2 * IMG_M, 1); }
      ctx.font = '500 30px ' + F_BODY;
      imgText(ctx, fitText(ctx, POS[row.pos], nameW - 20), IMG_M, yy + rowH / 2 + 4, '500 30px ' + F_BODY, IC.text);
      var extra = m && showsPro(m) ? ampBe(m).join(' · ') : '';
      if (extra) imgText(ctx, extra, IMG_M, yy + rowH / 2 + 30, '400 20px ' + F_MONO, IC.faint);
      imgScale(ctx, sx, yy + rowH / 2 - 14, sw, 24, ok ? m.rate : null, false);
      if (m && !ok) { ctx.fillStyle = IC.warn; ctx.beginPath(); ctx.arc(sx + (Math.max(-20, Math.min(20, m.rate)) + 20) / 40 * sw, yy + rowH / 2 - 2, 7, 0, Math.PI * 2); ctx.fill(); }
      var val = m ? signed(m.rate, 1) : '–';
      imgText(ctx, val, IMG_W - IMG_M, yy + rowH / 2 + 14, '600 44px ' + F_DISPLAY, ok ? IC.text : IC.faint, 'right');
    });
    y += st.rows.length * rowH + 24;
    var tiles = [{ label: T('Senkrecht − waagrecht'), value: st.hv == null ? '–' : signed(st.hv, 1), unit: T('s/Tag'), note: '' }];
    var pro = st.ok.some(function (r) { return showsPro(r.m); });
    if (pro) {
      tiles.push({ label: T('Abfallfehler'), value: st.be == null ? '–' : fmt(st.be, 1), unit: T('ms'), note: T('Mittel') });
      tiles.push({ label: T('Amplitude'), value: st.ampH == null ? '–' : Math.round(st.ampH) + '°', unit: st.ampV == null ? '' : '/ ' + Math.round(st.ampV) + '°', note: T('waagrecht / senkrecht') });
    }
    imgTiles(ctx, tiles, y, 156);
    var kind = st.n < 2 ? 'warn' : st.spread <= 10 ? 'good' : st.spread <= 20 ? 'okay' : 'warn';
    var short = st.n < 2 ? T('Zu wenige sichere Lagen für eine Aussage.') : st.spread <= 10 ? T('Kleine Lagendifferenz: Das Werk läuft in allen Lagen gleichmässig.') :
      st.spread <= 20 ? T('Eine Lagendifferenz wie bei einer guten Uhr ohne Chronometer-Zertifikat.') : T('Grosse Lagendifferenz: Ein Uhrmacher kann prüfen, ob ein Service nötig ist.');
    imgVerdict(ctx, kind, short, y + 214, 2);
    imgFoot(ctx);
  }
  $('imgBtn').addEventListener('click', function () {
    if (!lastShown) return;
    var m = lastShown.m, r = lastShown.r;
    imgShare(function (ctx) { drawMeasureImage(ctx, m, r); }, imgName(m.watchName || 'Uhr', new Date(m.date)), this);
  });
  function shareLagenImage(w, set, byPos, started, btn) {
    var st = lagenStats(set, byPos);
    imgShare(function (ctx) { drawLagenImage(ctx, w, st, set.length, started); }, imgName(w ? w.name : T('Uhr'), new Date(started || Date.now()), T('Lagen')), btn);
  }
  $('lgImg').addEventListener('click', function () {
    if (session) shareLagenImage(lagenWatch(), SETS[session.set], sessByPos(), session.started, this);
  });

  /* ---------- Lagen-Test (Pro) ----------
     Auswahl (scr-lagen): eine Kachel je Lage. Gemessene Lagen sind grau und zeigen ihr Ergebnis, die nächste
     offene ist hervorgehoben. Lage antippen → Messung (scr-lpos): oben, wie die Uhr liegt, unten live das Ticken.
     Die Messung startet von selbst, sobald das Ticken klar ist. Danach kurz das Ergebnis, dann zurück zur Auswahl. */
  var RESULT_SECONDS = 3;
  function lagenOpen(watchId) {
    if (rec || busy || !requirePro('lagen')) return;
    watchId = watchId || '';
    if (!session || session.watchId !== watchId || lagenStats(SETS[session.set], sessByPos()).done) newSession(watchId);
    go('lagen');
  }
  function newSession(watchId) {
    var set = SETS[settings.lagenSet];
    session = { id: 's' + Date.now().toString(36), watchId: watchId, set: settings.lagenSet, started: new Date().toISOString(), cur: set[0] };
    saveSession();
  }
  function sessMeas() { return session ? meas.filter(function (m) { return m.sess === session.id; }) : []; }
  function byPosOf(list) {
    var out = Object.create(null);
    list.forEach(function (m) { var o = out[m.pos]; if (!o || counted(m) || !counted(o)) out[m.pos] = m; });
    return out;
  }
  function sessByPos() { return byPosOf(sessMeas()); }
  /* ---------- Vergleich mit den Qualitätsstufen von ETA (0.6.4) ----------
     ETA liefert seine Werke in Stufen aus. Je Stufe ist vorgegeben, in welchen Lagen eingestellt wird, wie gross das Mittel
     der Gänge und wie gross die grösste Differenz zwischen diesen Lagen sein dürfen:
       Standard  CH, 6H              Mittel ±12 s/Tag, Differenz höchstens 30 s/Tag
       Elaboré   CH, 6H, 9H          Mittel ±7 s/Tag,  Differenz höchstens 20 s/Tag
       Top       CH, FH, 6H, 9H, 3H  Mittel ±4 s/Tag,  Differenz höchstens 15 s/Tag
     (CH = Zifferblatt oben, FH = Zifferblatt unten, 6H = Krone links, 9H = Krone unten, 3H = Krone oben.)
     Tickwerk rechnet je Stufe genau in deren Lagen, mit den Werten, wie sie angezeigt werden (auf 0,1 s/Tag gerundet).
     Die vierte Stufe «Chronomètre» braucht das Zertifikat der COSC und wird nicht vergeben. Ein Vergleich, kein Zertifikat. */
  var ETA_GRADES = [
    { name: 'Top', pos: ['ZO', 'ZU', 'KL', 'KU', 'KO'], mean: 4, spread: 15 },
    { name: 'Elaboré', pos: ['ZO', 'KL', 'KU'], mean: 7, spread: 20 },
    { name: 'Standard', pos: ['ZO', 'KL'], mean: 12, spread: 30 }
  ];
  function etaGrade(set, byPos) {
    var out = { grade: null, rows: [], any: false };
    ETA_GRADES.forEach(function (g) {
      var miss = g.pos.filter(function (p) { var m = byPos[p]; return set.indexOf(p) < 0 || !(m && counted(m)); });
      var row = { g: g, miss: miss, mean: null, spread: null, ok: false };
      if (!miss.length) {
        var rates = g.pos.map(function (p) { return byPos[p].rate; });
        row.mean = Math.round(avg(rates) * 10) / 10;
        row.spread = Math.round((Math.max.apply(null, rates) - Math.min.apply(null, rates)) * 10) / 10;
        row.ok = Math.abs(row.mean) <= g.mean && row.spread <= g.spread;
        out.any = true;
        if (row.ok && !out.grade) out.grade = g;
      }
      out.rows.push(row);
    });
    return out;
  }
  /* Kachel «ETA-Stufe zum Vergleich»: Wert und kleine Zeile darunter */
  function gradeTile(set, eta, dd, small) {
    var top = eta.rows[0];
    dd.textContent = eta.grade ? eta.grade.name : eta.any ? T('keine Stufe') : '–';
    small.textContent = !eta.any ? T('nicht prüfbar: Lagen fehlen oder zählen nicht') :
      (eta.grade ? T('Vorgabe von ETA in {n} Lagen erfüllt', { n: eta.grade.pos.length }) : T('Vorgaben von ETA nicht erfüllt')) +
      (eta.grade !== top.g && top.miss.length && set.indexOf('KO') < 0 ? ' · ' + T('«Top» nicht prüfbar: Test mit 6 Lagen nötig.') : '');
  }
  /* Zeilen für das Erklärblatt: je Stufe die Vorgabe und was gemessen wurde */
  function gradeRows(eta) {
    var rows = eta.rows.map(function (r) {
      var txt = T('{n} Lagen: Mittel innerhalb ±{a} s/Tag, Differenz höchstens {b} s/Tag.', { n: r.g.pos.length, a: r.g.mean, b: r.g.spread }) + ' ' +
        (r.miss.length ? T('Nicht prüfbar, es fehlt: {p}.', { p: r.miss.map(function (p) { return POS[p]; }).join(', ') }) :
          T(r.ok ? 'Erfüllt: Mittel {m}, Differenz {d}.' : 'Nicht erfüllt: Mittel {m}, Differenz {d}.', { m: signed(r.mean, 1), d: fmt(r.spread, 1) }));
      return [r.miss.length ? 'plain' : r.ok ? 'good' : 'warn', r.g.name, txt];
    });
    rows.push(['plain', 'Chronomètre', T('Wie Top, dazu geprüft und zertifiziert von der COSC. Das kann Tickwerk nicht ersetzen.')]);
    return rows;
  }
  function lagenStats(set, byPos) {
    var rows = set.map(function (p) { return { pos: p, m: byPos[p] || null }; });
    var ok = rows.filter(function (r) { return r.m && counted(r.m); });
    var rate = function (r) { return r.m.rate; };
    var h = ok.filter(function (r) { return HORIZ[r.pos]; }), v = ok.filter(function (r) { return !HORIZ[r.pos]; });
    var st = { rows: rows, ok: ok, n: ok.length, mean: avg(ok.map(rate)), spread: null, hi: null, lo: null, hv: null,
      be: avg(ok.filter(function (r) { return r.m.beOk; }).map(function (r) { return r.m.be; })),
      ampH: avg(h.filter(function (r) { return r.m.ampOk && r.m.amp; }).map(function (r) { return r.m.amp; })),
      ampV: avg(v.filter(function (r) { return r.m.ampOk && r.m.amp; }).map(function (r) { return r.m.amp; })),
      weak: rows.filter(function (r) { return r.m && !counted(r.m); }).length,
      wobble: rows.filter(function (r) { return r.m && counted(r.m) && r.m.stable === false; }).length,
      done: rows.every(function (r) { return !!r.m; }) };
    if (ok.length >= 2) {
      st.hi = ok.reduce(function (a, r) { return r.m.rate > a.m.rate ? r : a; });
      st.lo = ok.reduce(function (a, r) { return r.m.rate < a.m.rate ? r : a; });
      st.spread = st.hi.m.rate - st.lo.m.rate;
    }
    if (h.length && v.length) st.hv = avg(v.map(rate)) - avg(h.map(rate));
    st.eta = etaGrade(set, byPos);
    return st;
  }
  /* Nächste Lage: zuerst eine offene, sonst eine schwache zum Wiederholen */
  function nextPos(set, byPos) {
    return set.filter(function (p) { return !byPos[p]; })[0] || set.filter(function (p) { return byPos[p] && !counted(byPos[p]); })[0] || null;
  }
  function lagenVerdict(st) {
    if (st.n < 2) return T('Zu wenige sichere Lagen für eine Aussage. Die schwachen Lagen nochmals messen.');
    var p = [T(st.mean >= -4 && st.mean <= 6 ? 'Mittel {v} s/Tag, im Chronometer-Bereich (−4 bis +6).' : 'Mittel {v} s/Tag.', { v: signed(st.mean, 1) })];
    if (st.spread <= 10) p.push(T('Die Lagendifferenz von {v} s/Tag ist klein: das Werk läuft in allen Lagen gleichmässig.', { v: fmt(st.spread, 1) }));
    else if (st.spread <= 20) p.push(T('Eine Lagendifferenz von {v} s/Tag ist üblich für eine Uhr ohne Chronometer-Zertifikat.', { v: fmt(st.spread, 1) }));
    else p.push(T('Die Lagendifferenz von {v} s/Tag ist gross. Ein Uhrmacher kann prüfen, ob ein Service nötig ist.', { v: fmt(st.spread, 1) }));
    if (st.hv != null) p.push(T('Senkrecht gegenüber waagrecht: {v} s/Tag (die Chronometer-Norm erlaubt −6 bis +8).', { v: signed(st.hv, 1) }));
    if (st.wobble) p.push(st.wobble === 1 ? T('In einer Lage schwankte der Gang während der Messung; ihr Wert ist ungenauer.') : T('In {n} Lagen schwankte der Gang während der Messung; ihre Werte sind ungenauer.', { n: st.wobble }));
    if (st.weak) p.push(st.weak === 1 ? T('Eine Lage zählt nicht: Signal zu schwach oder Gang zu unsicher.') : T('{n} Lagen zählen nicht: Signal zu schwach oder Gang zu unsicher.', { n: st.weak }));
    return p.join(' ');
  }
  function posIcon(pos) {
    var face = pos !== 'ZU';
    var g = '<rect x="-12" y="-40" width="24" height="16" rx="4" class="pi-strap"/><rect x="-12" y="24" width="24" height="16" rx="4" class="pi-strap"/>' +
      '<rect x="24" y="-5" width="9" height="10" rx="2" class="pi-crown"/><circle r="26" class="pi-case"/>';
    g += face ? '<circle r="20" class="pi-ring"/><path d="M0 -18v4M18 0h-4M0 18v-4M-18 0h4" class="pi-idx"/><path d="M0 0V-14M0 0L9 5" class="pi-hand"/><circle r="2.4" class="pi-pin"/>'
      : '<circle r="18" class="pi-ring"/><circle r="10" class="pi-ring"/><path d="M-5 -14h10" class="pi-idx"/>';
    if (HORIZ[pos]) {
      return '<ellipse cx="55" cy="78" rx="52" ry="15" class="pi-table"/>' +
        '<g transform="translate(55 60) scale(' + (face ? '1.3' : '-1.3') + ' 0.72)">' + g + '</g>';
    }
    var rot = { KR: 0, KU: 90, KL: 180, KO: 270 }[pos], ext = rot % 180 ? 34 : 40, cy = 50;
    return '<g transform="translate(55 ' + cy + ') rotate(' + rot + ')">' + g + '</g>' +
      '<path d="M12 ' + (cy + ext + 2) + 'H98" class="pi-ground"/>';
  }
  /* Kurzer Text mit Amplitude und Abfallfehler einer Messung (nur wenn die Werte gezeigt werden dürfen) */
  function ampBe(m) {
    var a = [];
    if (showsPro(m)) {
      if (m.ampOk && m.amp) a.push(m.amp + '°');
      if (m.beOk && m.be != null) a.push(fmt(m.be, 2) + ' ms');
    }
    return a;
  }
  function lagenWatch() { return session ? findWatch(session.watchId) : null; }
  function renderLagen() {
    if (!session) { newSession(settings.watchId); }
    var w = lagenWatch(), set = SETS[session.set], byPos = sessByPos(), st = lagenStats(set, byPos);
    var next = nextPos(set, byPos), finished = st.done;
    if (next && session.cur !== next) { session.cur = next; saveSession(); }
    var measured = st.rows.filter(function (r) { return !!r.m; }).length;
    $('lBackLabel').textContent = stack.length > 1 && stack[stack.length - 2].s === 'watch' ? (w ? w.name : T('Zurück')) : T('Messen');
    $('lStep').textContent = finished ? T('Fertig · {n} Lagen', { n: set.length }) : T('{a} von {b} gemessen', { a: measured, b: set.length });
    var mins = Math.max(1, Math.round(set.length * (settings.dur + (settings.autoStart ? 8 : SETTLE) + 15) / 60));
    $('lLead').textContent = finished ? T('Alle Lagen gemessen. Eine Lage antippen, um ihr Ergebnis zu sehen oder sie nochmals zu messen.') :
      T(settings.autoStart ? 'Lage antippen. Tickwerk zeigt, wie die Uhr liegt, und misst von selbst, sobald das Ticken klar ist.' : 'Lage antippen. Tickwerk zeigt, wie die Uhr liegt, und misst nach «Messen».') +
      ' ' + T('Je {d} s, zusammen etwa {m} Minuten.', { d: settings.dur, m: mins });
    Array.prototype.forEach.call($('lSet').children, function (b) {
      b.setAttribute('aria-checked', String(+b.dataset.set === session.set)); b.disabled = !!rec;
    });
    var prog = $('lProgress'); prog.innerHTML = ''; prog.style.setProperty('--n', String(set.length));
    set.forEach(function (p) {
      var i = document.createElement('i'), m = byPos[p];
      if (m) i.className = counted(m) ? 'done' : 'weak'; else if (p === next) i.className = 'cur';
      prog.appendChild(i);
    });
    var tl = $('lTiles'); tl.innerHTML = '';
    set.forEach(function (p) {
      var m = byPos[p], b = document.createElement('button'), cls = ['ltile'];
      b.type = 'button'; b.dataset.pos = p;
      if (!m) cls.push(p === next ? 'next' : 'open'); else cls.push(counted(m) ? 'done' : 'weak');
      b.className = cls.join(' ');
      var sub = !m ? T(p === next ? 'als Nächstes' : 'offen') : !counted(m) ? whyNot(m) :
        shaky(m) ? shakyText(m) : (ampBe(m).join(' · ') || '± ' + fmt(m.sigma, 2) + ' ' + T('s/Tag'));
      b.innerHTML = '<svg class="pos-icon lt-icon" viewBox="0 0 110 110" aria-hidden="true">' + posIcon(p) + '</svg>' +
        '<span class="lt-txt"><span class="lt-h">' + esc(POS[p]) + '</span>' +
        '<span class="lt-v">' + (m ? esc(signed(m.rate, 1)) + '<small> ' + esc(T('s/Tag')) + '</small>' : '–') + '</span>' +
        '<span class="lt-s">' + esc(sub) + '</span></span>' + (m && counted(m) ? ICON.check : '');
      b.setAttribute('aria-label', POS[p] + ': ' + (m ? T('{v} Sekunden pro Tag', { v: signed(m.rate, 1) }) : sub));
      b.addEventListener('click', function () { if (rec || busy) return; go('lpos', { pos: p }); });
      tl.appendChild(b);
    });
    $('lDiffCard').hidden = finished;
    $('lDiff').textContent = st.spread == null ? '–' : fmt(st.spread, 1) + ' s';
    $('lDiffSub').textContent = st.spread == null ? T('noch zu wenige Lagen') : T('zwischen {a} und {b}', { a: POS[st.hi.pos], b: POS[st.lo.pos] });
    $('lResult').hidden = !finished;
    if (finished) {
      $('lgMean').textContent = st.mean == null ? '–' : signed(st.mean, 1);
      $('lgSpread').textContent = st.spread == null ? '–' : fmt(st.spread, 1);
      $('lgHV').textContent = st.hv == null ? '–' : signed(st.hv, 1);
      $('lgBe').textContent = st.be == null ? '–' : fmt(st.be, 2);
      $('lgAmp').textContent = st.ampH == null && st.ampV == null ? '–' : (st.ampH != null ? Math.round(st.ampH) + '°' : '–') + ' / ' + (st.ampV != null ? Math.round(st.ampV) + '°' : '–');
      gradeTile(set, st.eta, $('lgGrade'), $('lgGradeSub'));
      gangTile(w, st, $('lgGangBox'), $('lgGang'), $('lgGangSub'));
      $('lgVerdict').textContent = lagenVerdict(st);
      drawLagenChart(st);
    }
    $('lNext').hidden = !next;
    if (next) $('lNextLabel').textContent = T(byPos[next] ? 'Nochmals messen: {p}' : 'Messen: {p}', { p: POS[next] });
    $('lCancel').textContent = finished ? T('Neuer Lagen-Test') : T('Abbrechen');
  }
  $('lNext').addEventListener('click', function () {
    if (rec || busy || !session) return;
    var p = nextPos(SETS[session.set], sessByPos());
    if (p) go('lpos', { pos: p });
  });
  $('lBack').addEventListener('click', back);
  $('lCancel').addEventListener('click', function () {
    if (rec || !session) return;
    var st = lagenStats(SETS[session.set], sessByPos());
    if (st.done) { newSession(session.watchId); setStatus('lStatus', '', ''); renderLagen(); window.scrollTo(0, 0); return; }
    if (sessMeas().length && !window.confirm(T('Lagen-Test abbrechen? Die bisherigen Messungen bleiben im Verlauf.'))) return;
    session = null; saveSession(); setStatus('lStatus', '', '');
    back();
  });
  Array.prototype.forEach.call($('lSet').children, function (b) {
    b.addEventListener('click', function () {
      if (rec || !session) return;
      settings.lagenSet = +b.dataset.set === 4 ? 4 : 6; saveSettings();
      session.set = settings.lagenSet;
      if (SETS[session.set].indexOf(session.cur) < 0) session.cur = SETS[session.set][0];
      saveSession(); renderLagen();
    });
  });
  $('lgPdf').addEventListener('click', function () {
    if (!session) return;
    var w = lagenWatch() || UNKNOWN, set = SETS[session.set];
    var list = sessMeas().filter(function (m) { return set.indexOf(m.pos) >= 0; });
    makeReport(w, $('lgPdfBar'), { list: list, kind: 'lagen', subtitle: T('Lagen-Test in {n} Lagen vom {d}', { n: set.length, d: dLong(new Date(session.started)) }) });
  });

  /* ---------- Eine Lage messen ---------- */
  var lpTimer = 0;
  function lpStop() { clearInterval(lpTimer); lpTimer = 0; }
  function setPSignal(level) { $('pSignal').setAttribute('data-level', String(level)); $('pSignalText').textContent = LEVEL_TEXT[level]; }
  function lpReady(p) {
    lpStop();
    showCount('pCount', null);
    $('pState').textContent = T('Bereit');
    $('pRate').textContent = '–'; $('pRate').classList.remove('live'); $('pSub').textContent = '';
    $('pMetrics').hidden = true; setPSignal(0); bar($('pLevel'), 0); bar($('pProg'), 0);
    $('pSearch').hidden = true; $('pAlt').hidden = true;
    $('pStart').classList.remove('running'); $('pStart').disabled = false;
    $('pStartLabel').textContent = T('Messen');
    drawTape($('pTape'), null, T(settings.autoStart ? 'Tickwerk hört gleich zu …' : '«Messen» tippen, wenn die Uhr liegt.'));
    setStatus('pStatus', settings.autoStart ? '' : T('Uhr so hinlegen, Handy-Unterkante an die Krone halten, dann «Messen» tippen.'), '');
  }
  function renderLpos(p) {
    var set = session ? SETS[session.set] : null;
    if (!set || set.indexOf(p.pos) < 0) { setTimeout(function () { popTo('lagen'); }, 0); return; }
    $('pStep').textContent = T('Lage {a} von {b}', { a: set.indexOf(p.pos) + 1, b: set.length });
    $('pIcon').innerHTML = posIcon(p.pos); $('pIcon').setAttribute('aria-label', POS[p.pos]);
    $('pName').textContent = POS[p.pos]; $('pHint').textContent = POS_HINT[p.pos];
    if (p.init) { if (p.res) drawTape($('pTape'), p.res.trace); return; }
    p.init = true;
    var m = sessByPos()[p.pos];
    if (m) { lpShowResult(p, m, null, false); return; }   /* schon gemessen: Ergebnis zeigen, nochmals auf Wunsch */
    lpReady(p);
    if (settings.autoStart) lpStart();
  }
  function lpStart() {
    var t = top();
    if (t.s !== 'lpos') return;
    if (rec) { recStop(true); return; }
    if (busy || opening || !session) return;
    var p = t.p, pos = p.pos, sess = session.id, setN = session.set, w = lagenWatch();
    lpReady(p); p.res = null;
    recStart({
      owner: 'lpos', dur: settings.dur, search: settings.autoStart, settle: settings.autoStart ? 0 : SETTLE, opts: watchOpts(w),
      onOpening: function () { $('pStart').disabled = true; setStatus('pStatus', T('Mikrofon wird geöffnet …'), 'busy'); },
      onFail: function (msg) { $('pStart').disabled = false; setStatus('pStatus', msg, 'err'); },
      onBegin: function (r) {
        $('pStart').disabled = false; $('pStart').classList.add('running'); $('pStartLabel').textContent = T('Abbrechen');
        if (r.phase !== 'search') {
          $('pState').textContent = T('Ruhe'); setStatus('pStatus', T('Hände weg: Die Uhr soll ruhig liegen.'), 'busy');
          showCount('pCount', SETTLE, T('Gleich geht es los. Nichts mehr bewegen.')); return;
        }
        $('pState').textContent = T('Sucht das Signal'); $('pSearch').hidden = false;
        drawTape($('pTape'), null, T('Tickwerk hört zu …'));
        setStatus('pStatus', T('Uhr so hinlegen und die Handy-Unterkante an die Krone halten. Sobald das Ticken klar ist, startet die Messung von selbst.'), 'busy');
      },
      onSearchTick: function (tt, r) { bar($('pLevel'), (20 * Math.log10(r.peak + 1e-9) + 80) / 60); },
      onSearch: function (res, good, tt) {
        var heard = heardOf(res);
        setPSignal(heard ? qLevel(res.quality) : 0);
        if (heard) { drawTape($('pTape'), res.trace); $('pSub').textContent = T('{bph} A/h erkannt', { bph: thousands(res.bph) }); }
        if (good) setStatus('pStatus', T('Signal gut. Ruhig halten, die Messung startet gleich.'), 'ok');
        else if (heard) setStatus('pStatus', T('Ticken erkannt, aber noch schwach. Das Handy etwas verschieben oder fester an die Krone halten.'), 'busy');
        else setStatus('pStatus', tt > 20 ? T('Noch kein klares Ticken. Ist die Uhr aufgezogen und der Raum ruhig? Sonst «Jetzt messen» tippen.') :
          T('Suche das Ticken … Handy-Unterkante an die Krone halten.'), 'busy');
      },
      onMeasureStart: function () {
        $('pSearch').hidden = true; $('pState').textContent = T('Gleich');
        setStatus('pStatus', T('Signal gut. Die Messung beginnt nach dem Countdown. Nichts mehr bewegen.'), 'ok');
        showCount('pCount', COUNTDOWN, T('Gleich geht es los. Nichts mehr bewegen.'));
      },
      onGo: function () {
        $('pState').textContent = T('Misst');
        setStatus('pStatus', T('Messung läuft. Nichts bewegen.'), 'busy');
      },
      onQuartz: function () {
        lpReady(p);
        setStatus('pStatus', T('Das klingt nach einer Quarzuhr (ein Schritt pro Sekunde). Den Lagen-Test gibt es nur für mechanische Uhren.'), 'err');
      },
      onTimeout: function () {
        lpReady(p);
        setStatus('pStatus', T('Zwei Minuten lang kein klares Ticken. Uhr aufziehen, Handy-Unterkante direkt an die Krone halten und nochmals versuchen.'), 'err');
      },
      onSettle: function (left) {
        if (!settings.autoStart) $('pState').textContent = T('Ruhe') + ' · ' + left + ' s';
        showCount('pCount', left, T('Gleich geht es los. Nichts mehr bewegen.'));
      },
      onTick: function (left, frac, r) {
        bar($('pLevel'), (20 * Math.log10(r.peak + 1e-9) + 80) / 60);
        if (r.ext && r.ext.state === 'checking') {   /* gewählte Dauer um: Der Wert wird gerechnet, die Aufnahme läuft weiter */
          showCount('pCount', null); $('pState').textContent = T('Prüft den Wert'); $('pStartLabel').textContent = T('Abbrechen'); bar($('pProg'), 1);
          return;
        }
        showCount('pCount', left, T(left === 1 ? 'Sekunde · Handy ruhig halten' : 'Sekunden · Handy ruhig halten'));
        $('pState').textContent = T('Misst · noch {n} s', { n: left });
        $('pStartLabel').textContent = T('Abbrechen') + ' · ' + left + ' s';
        bar($('pProg'), frac);
      },
      extend: {
        opts: function () { return watchOpts(w); },
        onChecking: function () { setStatus('pStatus', T('Die Messzeit ist um. Tickwerk prüft, ob der Wert sicher genug ist. Noch nichts bewegen.'), 'busy'); },
        onExtended: function (res) {
          setStatus('pStatus', extendText(res), 'busy');
        }
      },
      onLive: function (res) {
        if (heardOf(res)) {
          $('pRate').textContent = signed(res.rate, 1); $('pRate').classList.add('live');
          $('pSub').textContent = T('vorläufig') + ' · ' + thousands(res.bph) + ' ' + T('A/h');
          setPSignal(qLevel(res.quality)); drawTape($('pTape'), res.trace);
          if (!(rec && rec.ext)) setStatus('pStatus', T('Ticken erkannt. Nichts bewegen, bis die Zeit um ist.'), 'ok');
        } else {
          setPSignal(0);
          setStatus('pStatus', T('Noch kein klares Ticken. Handy-Unterkante näher an die Krone, ohne die Uhr zu bewegen.'), 'err');
        }
      },
      onCancel: function () { lpReady(p); setStatus('pStatus', T('Abgebrochen.'), ''); },
      onDone: function (samples, fs, pre, extFrom, first) {
        busy = true; showCount('pCount', null);
        $('pStart').classList.remove('running'); $('pStart').disabled = true; $('pSearch').hidden = true;
        $('pStartLabel').textContent = T('Rechnet …'); $('pState').textContent = T('Rechnet'); bar($('pProg'), 0); bar($('pLevel'), 0);
        setStatus('pStatus', T('Rechne …'), 'busy');
        (pre ? Promise.resolve(pre) : runJob({ samples: samples, fs: fs, opts: watchOpts(w) })).then(function (res) {
          busy = false; $('pStart').disabled = false;
          var here = top().s === 'lpos' && top().p === p, fb = extFallback(res, first);
          if (!session || session.id !== sess) { if (here) lpReady(p); return; }
          if (fb) {   /* die Verlängerung liess sich nicht auswerten: Es gilt die zuerst gewählte Dauer (siehe extFallback) */
            logExtFail(res); res = fb.res;
            if (here) toast(extFailText({ from: extFrom, to: EXTEND_TO }));
          }
          if (!res || !res.ok) {
            logFail('mess', res);
            if (here) { lpReady(p); $('pStartLabel').textContent = T('Nochmals messen'); setStatus('pStatus', res && res.code === 'silence' ? failText(res) : T((res && res.reason) || 'Keine Messung möglich.') + ' ' + T('Nochmals messen.'), 'err'); }
            return;
          }
          var m = saveMeasurement(res, 'Mikrofon', fs, { watch: w, pos: pos, sess: sess, lset: setN });
          if (here) lpShowResult(p, m, res, true);
        });
      }
    });
  }
  /* Ergebnis einer Lage. fresh: eben gemessen → nach RESULT_SECONDS von selbst zurück zur Auswahl (wenn es zählt) */
  function lpShowResult(p, m, res, fresh) {
    lpStop(); showCount('pCount', null); p.res = res;
    var ok = counted(m), extra = ampBe(m);
    $('pState').textContent = fresh ? T('Ergebnis') : T('Gemessen') + ' · ' + dateStr(m.date);
    $('pRate').textContent = signed(m.rate, 1); $('pRate').classList.remove('live');
    $('pSub').textContent = '± ' + fmt(m.sigma, 2) + ' ' + T('s/Tag') + ' · ' + Math.round(m.dur) + ' s · ' + thousands(m.bph) + ' ' + T('A/h');
    setPSignal(m.q === 'stark' ? 4 : m.q === 'mittel' ? 3 : 1);
    var pro = showsPro(m);
    $('pMetrics').hidden = false;
    $('pAmp').textContent = !pro ? 'Pro' : m.ampOk && m.amp ? m.amp + '°' : '–';
    $('pAmpNote').textContent = pro && m.lift ? T('bei {a}', { a: deg(m.lift) }) : '';
    $('pBe').textContent = !pro ? 'Pro' : m.beOk ? fmt(m.be, 2) : '–';
    $('pSearch').hidden = true; bar($('pProg'), 0); bar($('pLevel'), 0);
    $('pStart').classList.remove('running'); $('pStart').disabled = false;
    if (res) drawTape($('pTape'), res.trace); else drawTape($('pTape'), m.tr ? traceOf(m.tr) : null, T('Gemessen am {d}', { d: dateStr(m.date) }));
    $('pAlt').hidden = false;
    var swing = res && res.halves ? ' ' + T('In den beiden Hälften der Messung: {a} und {b} s/Tag.', { a: signed(res.halves.rate[0], 1), b: signed(res.halves.rate[1], 1) }) : '';
    if (!ok) {
      $('pStartLabel').textContent = T('Nochmals messen'); $('pAlt').textContent = T('Zur Auswahl'); $('pAlt').dataset.act = 'back';
      if (m.q === 'schwach') setStatus('pStatus', T('Signal schwach (± {s} s/Tag): Diese Lage zählt nicht. Nochmals messen, Handy fester an die Krone.', { s: fmt(m.sigma, 2) }), 'err');
      else if (m.stable === false) setStatus('pStatus', T('Das Signal war gut, aber der Gang schwankte während der Messung zu stark (± {s} s/Tag). Diese Lage zählt nicht. Nochmals messen: Handy nur leicht an die Krone halten, Arm aufstützen, am besten 60 s.', { s: fmt(m.sigma, 2) }) + swing, 'err');
      else setStatus('pStatus', T('Zu unsicher (± {s} s/Tag): Diese Lage zählt nicht. Nochmals messen, am besten 60 s, Handy ruhig an der Krone.', { s: fmt(m.sigma, 2) }), 'err');
      return;
    }
    if (!fresh) {
      $('pStartLabel').textContent = T('Nochmals messen'); $('pAlt').textContent = T('Zur Auswahl'); $('pAlt').dataset.act = 'back';
      setStatus('pStatus', POS[p.pos] + ': ' + signed(m.rate, 1) + ' ' + T('s/Tag') + (extra.length ? ' · ' + extra.join(' · ') : '') +
        (shaky(m) ? ' · ' + shakyText(m) + ' (± ' + fmt(m.sigma, 2) + ' ' + T('s/Tag') + ')' : '') + '.', shaky(m) ? 'warn' : 'ok');
      return;
    }
    $('pAlt').textContent = T('Nochmals messen'); $('pAlt').dataset.act = 'again';
    var left = RESULT_SECONDS;
    var label = function () { $('pStartLabel').textContent = T('Weiter') + ' · ' + left; };
    label();
    if (shaky(m)) setStatus('pStatus', T('{p} gemessen. Die Klicks waren klar, aber der Gang schwankte während der Messung, darum ± {s} s/Tag. Die Lage zählt mit dem Vermerk «Gang könnte schwanken».', { p: POS[p.pos], s: fmt(m.sigma, 2) }) + swing, 'warn');
    else setStatus('pStatus', T('{p} gemessen. Gleich geht es zurück zur Auswahl.', { p: POS[p.pos] }), 'ok');
    lpTimer = setInterval(function () {
      if (top().s !== 'lpos' || top().p !== p) { lpStop(); return; }
      left--;
      if (left <= 0) { lpStop(); back(); return; }
      label();
    }, 1000);
  }
  /* Gespeicherter (gekürzter) Papierstreifen zurück in die Form für drawTape */
  function traceOf(tr) {
    var out = [];
    for (var i = 0; i < tr.t.length; i++) out.push({ t: tr.t[i], devMs: tr.d[i], parity: tr.p.charAt(i) === '1' ? 1 : 0 });
    return out;
  }
  $('pStart').addEventListener('click', function () {
    var t = top(); if (t.s !== 'lpos') return;
    if (lpTimer) { lpStop(); back(); return; }             /* «Weiter» */
    if (rec) { recStop(true); return; }                    /* «Abbrechen» */
    if (busy) return;
    lpStart();                                             /* «Messen» / «Nochmals messen» */
  });
  $('pAlt').addEventListener('click', function () {
    var t = top(); if (t.s !== 'lpos' || rec || busy) return;
    if (lpTimer) { lpStop(); lpStart(); return; }          /* «Nochmals messen» während der Rückkehr */
    if ($('pAlt').dataset.act === 'back') { back(); return; }
    lpStart();
  });
  $('pForce').addEventListener('click', recForceStart);

  /* ---------- Meine Uhren ---------- */
  function watchStatus(w, list) {
    var ok = list.filter(counted), last = ok[ok.length - 1];
    if (!list.length) return { cls: 'none', text: T('Noch nicht gemessen') };
    if (!last) return { cls: 'none', text: T('Kein sicherer Wert') };
    var pro = showsPro(last);
    if (Math.abs(last.rate) > 30 || (pro && last.ampOk && last.amp && last.amp < 200) || (pro && last.beOk && last.be > 2)) return { cls: 'warn', text: T('Service prüfen'), last: last };
    if (last.rate >= -4 && last.rate <= 6) return { cls: 'good', text: T('Chronometer-Bereich'), last: last };
    return { cls: 'okay', text: T('In Ordnung'), last: last };
  }
  var PILL_ICON = {
    good: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    okay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6"/><path d="M12 17h.01"/></svg>',
    none: ''
  };
  function sparkline(list, cls) {
    var pts = list.slice(-10);
    if (pts.length < 2) return '';
    var lo = Math.min(-4, Math.min.apply(null, pts.map(function (m) { return m.rate; }))), hi = Math.max(6, Math.max.apply(null, pts.map(function (m) { return m.rate; })));
    var X = function (i) { return 4 + i / (pts.length - 1) * 102; }, Y = function (v) { return 36 - (v - lo) / (hi - lo) * 32; };
    var col = cls === 'good' ? C.lume : cls === 'warn' ? C.warn : C.muted;
    return '<svg class="spark" viewBox="0 0 110 40" aria-hidden="true"><path d="M4 ' + Y(0).toFixed(1) + 'H106" stroke="' + C.line2 + '" stroke-width="1" stroke-dasharray="2 3"/>' +
      '<polyline points="' + pts.map(function (m, i) { return X(i).toFixed(1) + ',' + Y(m.rate).toFixed(1); }).join(' ') + '" stroke="' + col + '"/>' +
      '<circle cx="' + X(pts.length - 1).toFixed(1) + '" cy="' + Y(pts[pts.length - 1].rate).toFixed(1) + '" r="3" fill="' + col + '" stroke="none"/></svg>';
  }
  function renderWatches() {
    $('wCount').textContent = plural(watches.length, 'Uhr', 'Uhren');
    var box = $('watchCards'); box.innerHTML = '';
    $('watchEmpty').hidden = watches.length > 0;
    watches.forEach(function (w) {
      var list = measOf(w), st = watchStatus(w, list), show = st.last || list[list.length - 1];
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'wcard';
      if (w.quarz) {   /* Quarzuhr: statt Messungen der Gang im Alltag */
        var qd = dailyRate(w.tv || []), qn = (w.tv || []).length;
        b.innerHTML = '<span class="wcard-top"><span><span class="wcard-name">' + esc(w.name) + '</span><span class="mono-sub">' + esc(T('Quarzuhr')) + '</span></span>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span>' +
          '<span class="wcard-mid"><span class="wcard-rate"><span class="wcard-num"><b>' + (qd ? esc(signed(qd.rate, 2)) : '–') + '</b><span>' + esc(T('s/Tag')) + '</span></span></span></span>' +
          '<span class="wcard-foot">' + esc(qn ? T('Gang im Alltag') + ' · ' + plural(qn, 'Vergleich', 'Vergleiche') : T('Noch kein Vergleich')) + '</span>' +
          (dueText(w) ? '<span class="wcard-due">' + esc(dueText(w)) + '</span>' : '');
        b.addEventListener('click', function () { go('watch', { id: w.id }); });
        box.appendChild(b);
        return;
      }
      b.innerHTML = '<span class="wcard-top"><span><span class="wcard-name">' + esc(w.name) + '</span><span class="mono-sub">' + esc(calName(w.kaliberId) || T('Werk unbekannt')) + '</span></span>' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span>' +
        '<span class="wcard-mid"><span class="wcard-rate"><span class="wcard-num"><b>' + (show ? esc(signed(show.rate, 1)) : '–') + '</b><span>' + esc(T('s/Tag')) + '</span></span>' +
        '<span class="pill ' + st.cls + '">' + PILL_ICON[st.cls] + esc(st.text) + '</span></span>' + sparkline(list, st.cls) + '</span>' +
        '<span class="wcard-foot">' + esc(list.length ? plural(list.length, 'Messung', 'Messungen') + ' · ' + T('zuletzt {d}', { d: ago(list[list.length - 1].date) }) : T('Noch keine Messung')) + '</span>' +
        (dueText(w) ? '<span class="wcard-due">' + esc(dueText(w)) + '</span>' : '');
      b.addEventListener('click', function () { go('watch', { id: w.id }); });
      box.appendChild(b);
    });
  }
  /* Gratis: eine Uhr zum Messen. Dazu darf eine Quarzuhr als Referenz kommen (für «Gang im Alltag» und die Eichung). */
  function addWatch() {
    if (!isPro() && mechWatches().length >= 1) { requirePro('watches'); return; }
    go('edit', {});
  }
  function addQuartz() {
    if (!isPro() && watches.length > mechWatches().length) { requirePro('watches'); return; }
    go('edit', { quartz: true });
  }
  $('wAdd').addEventListener('click', addWatch);
  $('wAddFirst').addEventListener('click', addWatch);

  /* ---------- Uhr mit Verlauf ---------- */
  var ICON = {
    check: '<svg class="lt-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    good: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.5h.01"/></svg>',
    neutral: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>'
  };
  function insightFor(list) {
    var ok = list.filter(counted), last = ok[ok.length - 1];
    if (!list.length) return { kind: 'neutral', t: 'Noch keine Messung', s: T('Am besten morgens nach dem Aufziehen messen und am Abend nochmals. So siehst du, wie stark der Gang mit dem Aufzug schwankt.') };
    if (!last) return { kind: 'neutral', t: 'Noch kein sicherer Wert', s: T('Die bisherigen Messungen hatten ein schwaches Signal. Handy näher an die Krone halten und in einem ruhigen Raum messen.') };
    var pro = showsPro(last);
    if (pro && last.ampOk && last.amp && last.amp < 200 && HORIZ[last.pos]) {
      return { kind: 'warn', t: 'Amplitude niedrig', s: T('Unter 200° in waagrechter Lage. Ist die Uhr voll aufgezogen? Bleibt es so, braucht das Werk vermutlich einen Service.') };
    }
    if (pro && last.beOk && last.be > 2) return { kind: 'warn', t: 'Abfallfehler hoch', s: T('Über 2 ms: Tick und Tack sind ungleich lang. Ein Uhrmacher kann das bei der nächsten Regulierung einstellen.') };
    if (Math.abs(last.rate) > 30) return { kind: 'warn', t: 'Deutlich daneben', s: T('Mehr als 30 s/Tag. Möglicherweise ist die Uhr magnetisiert. Ein Uhrmacher kann das schnell prüfen und regulieren.') };
    var recent = ok.filter(function (m) { return Date.now() - new Date(m.date) < 14 * 86400000; }), byPos = Object.create(null);
    recent.forEach(function (m) { (byPos[m.pos] = byPos[m.pos] || []).push(m.rate); });
    var pm = Object.keys(byPos).map(function (p) { return { p: p, r: avg(byPos[p]) }; });
    if (pm.length >= 2) {
      var hi = pm.reduce(function (a, x) { return x.r > a.r ? x : a; }), lo = pm.reduce(function (a, x) { return x.r < a.r ? x : a; });
      if (hi.r - lo.r > 20) return { kind: 'warn', t: 'Grosse Lagendifferenz', s: T('{a} und {b} liegen {v} s/Tag auseinander. Ein Lagen-Test zeigt das ganze Bild.', { a: POS[hi.p], b: POS[lo.p], v: fmt(hi.r - lo.r, 0) }) };
    }
    var rng = ok.slice(-5), rlo = Math.min.apply(null, rng.map(function (m) { return m.rate; })), rhi = Math.max.apply(null, rng.map(function (m) { return m.rate; }));
    var spanTxt = rng.length > 1 ? ' ' + T('Die letzten {n} sicheren Messungen liegen zwischen {a} und {b} s/Tag.', { n: rng.length, a: signed(rlo, 1), b: signed(rhi, 1) }) : '';
    if (last.rate >= -4 && last.rate <= 6) return { kind: 'good', t: 'Im Chronometer-Bereich', s: T('Die letzte sichere Messung liegt bei {v} s/Tag.', { v: signed(last.rate, 1) }) + spanTxt };
    if (Math.abs(last.rate) <= 15) return { kind: 'neutral', t: 'In Ordnung', s: T('Für eine Uhr ohne Chronometer-Zertifikat sind bis etwa ±15 s/Tag üblich.') + spanTxt };
    return { kind: 'warn', t: last.rate > 0 ? 'Geht deutlich vor' : 'Geht deutlich nach', s: T('{v} s/Tag. Ein Uhrmacher kann die Uhr regulieren. Vorher in einer zweiten Lage messen.', { v: signed(last.rate, 1) }) + spanTxt };
  }
  function renderBars(list) {
    var el = $('dBars'), pts = list.slice(-8);
    el.innerHTML = ''; $('dBarLabels').innerHTML = '';
    if (!pts.length) { el.innerHTML = '<p class="hint bars-empty">' + esc(T('Noch keine Messung.')) + '</p>'; return; }
    var lo = Math.min(-4, Math.min.apply(null, pts.map(function (m) { return m.rate; }))), hi = Math.max(6, Math.max.apply(null, pts.map(function (m) { return m.rate; })));
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    var Y = function (v) { return (hi - v) / (hi - lo) * 100; };
    var grid = document.createElement('div'); grid.className = 'grid';
    [[0, 'zero', ''], [6, 'lim', '+6'], [-4, 'lim', '−4']].forEach(function (g) {
      var ln = document.createElement('div'); ln.className = g[1]; ln.style.top = Y(g[0]) + '%';
      if (g[2]) { var sp = document.createElement('span'); sp.textContent = g[2]; ln.appendChild(sp); }
      grid.appendChild(ln);
    });
    el.appendChild(grid);
    pts.forEach(function (m, i) {
      var col = document.createElement('div'), bar = document.createElement('i'), lab = document.createElement('b');
      col.className = 'bar-col' + (i === pts.length - 1 ? ' last' : '') + (counted(m) ? '' : ' weak');
      var y0 = Y(Math.max(m.rate, 0)), y1 = Y(Math.min(m.rate, 0));
      bar.style.top = y0 + '%'; bar.style.height = Math.max(0.8, y1 - y0) + '%';
      lab.textContent = signed(m.rate, 1);
      if (m.rate >= 0) lab.style.top = 'calc(' + y0 + '% - 15px)'; else lab.style.top = 'calc(' + y1 + '% + 2px)';
      col.appendChild(bar); col.appendChild(lab); el.appendChild(col);
      var xl = document.createElement('span'); xl.textContent = dayShort(m.date); $('dBarLabels').appendChild(xl);
    });
  }
  function renderDetail(p) {
    var w = findWatch(p.id);
    if (!w) { setTimeout(function () { popTo('watches'); }, 0); return; }
    var k = kalById(w.kaliberId), list = measOf(w), st = liftState(w);
    $('dName').textContent = w.name;
    $('scr-watch').classList.toggle('quartz', !!w.quarz);   /* Quarzuhr: nur «Gang im Alltag», der Rest der Seite gilt mechanischen Uhren */
    $('dCal').textContent = w.quarz ? T('Quarzuhr') : (k ? kName(k) : T('Werk unbekannt')) + (k && k.messbar === false ? ' · ' + T('nicht messbar') : '');
    $('dDetective').hidden = !!k || !!w.quarz;
    var bphSeen = list.length ? list[list.length - 1].bph : 0;
    $('dBph').innerHTML = esc(w.bph ? thousands(w.bph) : bphSeen ? thousands(bphSeen) : '–') + '<small>' + esc(T(w.bph ? 'A/h hinterlegt' : bphSeen ? 'A/h erkannt' : 'automatisch')) + '</small>';
    $('dLift').innerHTML = esc(deg(w.liftAngle)) + '<small>' + esc(T(st || 'bestätigt')) + '</small>';
    $('dCount').textContent = String(list.length);
    $('dRange').textContent = list.length > 8 ? T('letzte 8') : list.length ? plural(list.length, 'Messung', 'Messungen') : '';
    renderBars(list);
    var ins = insightFor(list), box = $('dInsight');
    box.hidden = false; box.className = 'insight' + (ins.kind === 'good' ? '' : ' ' + ins.kind);
    box.innerHTML = ICON[ins.kind] + '<div><span class="insight-t">' + esc(T(ins.t)) + '</span><span class="insight-s">' + esc(ins.s) + '</span></div>';
    var ul = $('dList'); ul.innerHTML = '';
    var max = isPro() ? 10 : FREE_DETAIL, rows = list.slice(-max).reverse();
    rows.forEach(function (m) {
      var li = document.createElement('li'), full = showsPro(m);
      var extra = [POS[m.pos], !counted(m) ? T('nicht gewertet') : shaky(m) ? shakyText(m) : qText(m.q)];
      if (full && m.amp) extra.push(m.amp + '°');
      if (full && m.beOk && m.be != null) extra.push(fmt(m.be, 2) + ' ms');
      if (m.sess) extra.push(T('Lagen-Test'));
      li.innerHTML = '<span class="r-l">' + esc(dateStr(m.date)) + '<small>' + esc(extra.join(' · ')) + '</small></span>' +
        '<span class="r-r' + (counted(m) ? '' : ' dim') + '">' + esc(signed(m.rate, 1) + ' ' + T('s/Tag')) + '</span>';
      ul.appendChild(li);
    });
    if (!rows.length) ul.innerHTML = '<li><span class="r-l">' + esc(T('Noch keine Messung')) + '<small>' + esc(T('Mit «Jetzt messen» beginnen')) + '</small></span></li>';
    var more = list.length - rows.length;
    $('dMore').hidden = more <= 0;
    $('dMore').textContent = isPro() ? T('Alle {n} Messungen unter Mehr → Alle Messungen.', { n: list.length }) : T(more === 1 ? '{n} ältere Messung ist gespeichert. Den ganzen Verlauf zeigt Tickwerk Pro.' : '{n} ältere Messungen sind gespeichert. Den ganzen Verlauf zeigt Tickwerk Pro.', { n: more });
    $('dListSub').textContent = list.length ? String(list.length) : '';
    $('dPdf').disabled = !list.length; $('dShare').disabled = !list.length; $('dCsv').disabled = !list.length;
    $('dPdfBar').hidden = true; $('dShareBar').hidden = true; $('dCsvBar').hidden = true;
    renderLagenCard(w, list);
    renderTimeCard(w, list);
    renderGrCard(w);
    renderDue(w);
    /* Klappkarten: beim Öffnen der Seite so, wie zuletzt gelassen; ein Werkzeug klappt seine Karte auf und zeigt sie */
    if (!p.folds) {
      p.folds = true;
      Object.keys(FOLDS).forEach(function (k) { setFold(k, p.focus === k || (w.quarz && k === 'dt') ? true : settings.fold[k]); });
      if (own(FOLDS, p.focus)) setTimeout(function () { if (topScreen() === 'watch') $(FOLDS[p.focus]).scrollIntoView({ block: 'start' }); }, 0);
    }
  }
  /* Aufklappen ohne dass es als Wunsch des Nutzers gespeichert wird */
  var foldSkip = {};
  function setFold(k, open) {
    var el = $(FOLDS[k]);
    if (el.open === !!open) return;
    foldSkip[k] = true; el.open = !!open;
  }
  Object.keys(FOLDS).forEach(function (k) {
    $(FOLDS[k]).addEventListener('toggle', function () {
      if (foldSkip[k]) { foldSkip[k] = false; return; }
      if (settings.fold[k] !== this.open) { settings.fold[k] = this.open; saveSettings(); }
    });
  });
  /* Was jetzt fällig ist, steht zuoberst und lässt sich von dort starten */
  function renderDue(w) {
    var box = $('dDue'), g = isPro() ? grNext(w) : null, z = zeitNext(w), items = [];
    if (g && g.due) items.push({ text: T('Gangreserve-Test: Messung «{s}» fällig', { s: GR_NAMES[g.step] }), btn: T('Jetzt messen: {s}', { s: GR_NAMES[g.step] }), fn: function () { grMeasure(w); } });
    if (z && z.due) items.push({ text: T('Zeitvergleich fällig'), btn: T('Jetzt nochmals vergleichen'), fn: function () { go('zeit', { id: w.id }); } });
    box.innerHTML = ''; box.hidden = !items.length;
    items.forEach(function (it) {
      var n = document.createElement('div'), t = document.createElement('p'), b = document.createElement('button');
      n.className = 'notice gr-notice'; t.textContent = it.text;
      b.type = 'button'; b.className = 'btn-primary small'; b.textContent = it.btn; b.addEventListener('click', it.fn);
      n.appendChild(t); n.appendChild(b); box.appendChild(n);
    });
  }
  /* Letzter Lagen-Test dieser Uhr: aus den Messungen mit derselben Sitzung */
  function lastLagenOf(list) {
    var sid = '';
    for (var i = list.length - 1; i >= 0; i--) if (list[i].sess) { sid = list[i].sess; break; }
    if (!sid) return null;
    var ms = list.filter(function (m) { return m.sess === sid; }), n;
    if (session && session.id === sid) n = session.set;
    else n = ms.some(function (m) { return m.lset === 6 || m.pos === 'KO' || m.pos === 'KR'; }) ? 6 : ms.some(function (m) { return m.lset === 4; }) ? 4 : (ms.length > 4 ? 6 : 4);
    var set = SETS[n];
    ms = ms.filter(function (m) { return set.indexOf(m.pos) >= 0; });
    return { id: sid, set: set, list: ms, byPos: byPosOf(ms), started: ms.length ? ms[0].date : '' };
  }
  function renderLagenCard(w, list) {
    var L = lastLagenOf(list), card = $('dLagenCard');
    card.hidden = !L;
    if (!L) return;
    var st = lagenStats(L.set, L.byPos), pro = isPro(), current = session && session.id === L.id;
    $('dlDate').textContent = dateStr(L.started) + ' · ' + T('{n} Lagen', { n: L.set.length });
    $('dlSub').textContent = st.mean == null ? dayShort(L.started) : signed(st.mean, 1) + ' ' + T('s/Tag');
    $('dlMean').textContent = st.mean == null ? '–' : signed(st.mean, 1);
    $('dlSpread').textContent = st.spread == null ? '–' : fmt(st.spread, 1);
    $('dlBe').textContent = !pro ? 'Pro' : st.be == null ? '–' : fmt(st.be, 2);
    $('dlAmp').textContent = !pro ? 'Pro' : st.ampH == null && st.ampV == null ? '–' : (st.ampH != null ? Math.round(st.ampH) + '°' : '–') + ' / ' + (st.ampV != null ? Math.round(st.ampV) + '°' : '–');
    gradeTile(L.set, st.eta, $('dlGrade'), $('dlGradeSub'));
    gangTile(w, st, $('dlGangBox'), $('dlGang'), $('dlGangSub'));
    var ul = $('dlRows'); ul.innerHTML = '';
    st.rows.forEach(function (r) {
      var li = document.createElement('li'), m = r.m;
      var sub = !m ? T('nicht gemessen') : !counted(m) ? T('{r}, zählt nicht', { r: whyNot(m) }) :
        ((shaky(m) ? [shakyText(m)] : []).concat(ampBe(m)).join(' · ') || qText(m.q));
      li.innerHTML = '<span class="r-l">' + esc(POS[r.pos]) + '<small>' + esc(sub) + '</small></span>' +
        '<span class="r-r' + (m && counted(m) ? '' : ' dim') + '">' + (m ? esc(signed(m.rate, 1) + ' ' + T('s/Tag')) : '–') + '</span>';
      ul.appendChild(li);
    });
    $('dlNote').hidden = st.done;
    $('dlNote').textContent = st.done ? '' : T(current ? 'Noch nicht fertig: {x}.' : 'Nicht fertig gemessen: {x}.', { x: plural(st.rows.filter(function (r) { return !r.m; }).length, 'Lage fehlt', 'Lagen fehlen') });
    $('dlOpen').hidden = !(current && !st.done);
    $('dlPdf').disabled = !st.n; $('dlImg').disabled = !st.n;
    $('dlPdfBar').hidden = true;
  }
  $('dlImg').addEventListener('click', function () {
    var w = detailWatch(); if (!w) return;
    var L = lastLagenOf(measOf(w)); if (L) shareLagenImage(w, L.set, L.byPos, L.started, this);
  });
  $('dlPdf').addEventListener('click', function () {
    var w = detailWatch(); if (!w) return;
    var L = lastLagenOf(measOf(w)); if (!L) return;
    makeReport(w, $('dlPdfBar'), { list: L.list, kind: 'lagen', subtitle: T('Lagen-Test in {n} Lagen vom {d}', { n: L.set.length, d: dLong(new Date(L.started)) }) });
  });
  $('dlOpen').addEventListener('click', function () { var w = detailWatch(); if (w && session && session.watchId === w.id) lagenOpen(w.id); });
  function detailWatch() { var t = top(); return t.s === 'watch' ? findWatch(t.p.id) : null; }
  $('dPdf').addEventListener('click', function () { var w = detailWatch(); if (w) makeReport(w, $('dPdfBar'), {}); });
  $('dCsv').addEventListener('click', function () { var w = detailWatch(); if (w) makeCsv(w, $('dCsvBar')); });
  $('dShare').addEventListener('click', function () { var w = detailWatch(); if (w) makeReport(w, $('dShareBar'), { share: true }); });
  $('dMeasure').addEventListener('click', function () { var w = detailWatch(); if (!w) return; setWatch(w.id); switchTab('measure'); });
  $('dEdit').addEventListener('click', function () { var w = detailWatch(); if (w) go('edit', { id: w.id }); });
  $('dLagen').addEventListener('click', function () { var w = detailWatch(); if (w) lagenOpen(w.id); });

  /* ---------- Regulieren (Pro): der Gang laufend, solange am Werk eingestellt wird. Gespeichert wird nichts. ----------
     Ausgewertet wird ein wachsendes Fenster von 6 bis 15 Sekunden. Stört etwas (kein klares Ticken) oder ändert sich der Gang
     deutlich, beginnt das Fenster neu: So folgt die Anzeige einer Verstellung schnell und wird in Ruhe genau. */
  var REG_MIN = 6, REG_MAX = 15, REG_EVERY = 2, REG_LIMIT = 600, REG_SPAN = 180;
  var reg = null;
  function mmss(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); }
  function setRSignal(level) { $('rSignal').setAttribute('data-level', String(level)); $('rSignalText').textContent = LEVEL_TEXT[level]; }
  function setRMarker(rate) {
    var mk = $('rMarker');
    mk.hidden = rate == null;
    if (rate != null) mk.style.left = ((Math.max(-20, Math.min(20, rate)) + 20) / 40 * 100) + '%';
  }
  function regReady() {
    $('rState').textContent = T('Bereit');
    $('rRate').textContent = '–'; $('rRate').classList.remove('live'); $('rSub').textContent = ''; setRMarker(null);
    $('rBe').textContent = '–'; $('rBeNote').textContent = T('ms'); $('rAmp').textContent = '–'; $('rAmpNote').textContent = '';
    setRSignal(0); bar($('rLevel'), 0); bar($('rProg'), 0);
    $('rStart').classList.remove('running'); $('rStart').disabled = false; $('rStartLabel').textContent = T('Starten');
    drawTape($('rTape'), null, T('Der Papierstreifen erscheint nach ein paar Sekunden.'));
    drawTrend($('rTrend'), [], 0);
    setStatus('rStatus', T('Uhr hinlegen und die Handy-Unterkante an die Krone halten, dann «Starten» tippen.'), '');
  }
  function renderReg(p) {
    var w = currentWatch();
    $('rWatch').textContent = (w ? w.name : UNKNOWN.name) + ' · ' + watchSub(w) + micNote();
    if (rec && rec.owner === 'reg') return;
    if (!p.init) { p.init = true; reg = null; regReady(); return; }
    if (reg) { drawTrend($('rTrend'), reg.pts, reg.t); drawTape($('rTape'), reg.last ? reg.last.trace : null, T('Der Papierstreifen erscheint nach ein paar Sekunden.')); }
  }
  function regIdle(g, msg) {
    $('rStart').classList.remove('running'); $('rStart').disabled = false; $('rStartLabel').textContent = T('Starten');
    bar($('rLevel'), 0); bar($('rProg'), 0);
    $('rState').textContent = g.last ? T('Angehalten') + ' · ' + mmss(g.t) : T('Bereit');
    if (g.last) $('rRate').classList.add('live');
    setStatus('rStatus', msg, '');
  }
  function regStart() {
    if (topScreen() !== 'reg') return;
    if (rec) { recStop(true); return; }
    if (busy || opening) return;
    if (!requirePro('reg')) return;
    var w = currentWatch(), g = { start: 0, next: REG_MIN, busy: false, band: null, bph: null, miss: 0, pts: [], last: null, t: 0, changed: false };
    reg = g;
    regReady();
    recStart({
      owner: 'reg', dur: REG_LIMIT, ring: REG_MAX + 1, settle: 0, noLive: true, opts: watchOpts(w),
      onOpening: function () { $('rStart').disabled = true; setStatus('rStatus', T('Mikrofon wird geöffnet …'), 'busy'); },
      onFail: function (msg) { $('rStart').disabled = false; setStatus('rStatus', msg, 'err'); },
      onBegin: function () {
        $('rStart').disabled = false; $('rStart').classList.add('running'); $('rStartLabel').textContent = T('Stoppen');
        $('rState').textContent = T('Hört zu');
        drawTape($('rTape'), null, T('Tickwerk hört zu …'));
        setStatus('rStatus', T('Tickwerk hört zu. Der erste Wert kommt nach etwa {n} Sekunden.', { n: REG_MIN }), 'busy');
      },
      onTick: function (left, frac, r) {
        var t = r.total / r.fs;
        if (g.last) $('rState').textContent = T('Live') + ' · ' + mmss(t);
        bar($('rProg'), frac);
        bar($('rLevel'), (20 * Math.log10(r.peak + 1e-9) + 80) / 60);
      },
      onFrame: function (t, r) { regFrame(g, t, r, w); },
      onCancel: function () { regIdle(g, T('Angehalten.')); },
      onDone: function () { regIdle(g, T('Nach 10 Minuten angehalten. «Starten» tippen, um weiterzumachen.')); }
    });
  }
  function regFrame(g, t, r, w) {
    if (reg !== g || g.busy || t < g.next) return;
    var win = Math.min(REG_MAX, t - g.start);
    if (win < REG_MIN) { g.next = g.start + REG_MIN; return; }
    g.busy = true; g.next = t + REG_EVERY;
    var op = watchOpts(w);
    op.probe = true;   /* auch einen unsicheren Wert zeigen (mit grossem ±), statt gar keinen */
    if (g.band) { op.band = g.band; op.bph = g.bph; }   /* Frequenzband und Schlagzahl sind bekannt: viel schneller */
    runJob({ samples: tailSamples(r, win), fs: r.fs, opts: op, reg: true }).then(function (res) {
      g.busy = false;
      if (rec !== r || reg !== g) return;
      regResult(g, res, t, win);
    });
  }
  /* Steigung des Papierstreifens in s/Tag, Tick und Tack je für sich zentriert; Ausreisser fallen im zweiten Durchgang weg */
  function traceRate(pts) {
    function fit(use) {
      var c = [{ n: 0, t: 0, d: 0 }, { n: 0, t: 0, d: 0 }];
      use.forEach(function (p) { var q = c[p.parity ? 1 : 0]; q.n++; q.t += p.t; q.d += p.devMs; });
      use = use.filter(function (p) { return c[p.parity ? 1 : 0].n >= 3; });
      if (use.length < 12) return null;
      var sxy = 0, sxx = 0;
      use.forEach(function (p) { var q = c[p.parity ? 1 : 0], dt = p.t - q.t / q.n; sxy += dt * (p.devMs - q.d / q.n); sxx += dt * dt; });
      if (!(sxx > 0)) return null;
      var b = sxy / sxx, res = use.map(function (p) { var q = c[p.parity ? 1 : 0]; return (p.devMs - q.d / q.n) - b * (p.t - q.t / q.n); });
      var ss = 0; res.forEach(function (e) { ss += e * e; });
      return { b: b, se: Math.sqrt(ss / Math.max(1, use.length - 3) / sxx), use: use, res: res };
    }
    var f = fit(pts); if (!f) return null;
    var abs = f.res.map(Math.abs).sort(function (a, b) { return a - b; }), lim = Math.max(0.05, 4 * 1.4826 * abs[abs.length >> 1]);
    var f2 = fit(f.use.filter(function (p, i) { return Math.abs(f.res[i]) <= lim; }));
    f = f2 || f;
    return { rate: f.b * 86.4, se: f.se * 86.4 };
  }
  /* Summe der Fehlerquadrate einer Geraden (Tick und Tack je für sich zentriert) */
  function traceSse(use) {
    var c = [{ n: 0, t: 0, d: 0 }, { n: 0, t: 0, d: 0 }], sxy = 0, sxx = 0, n = 0, ss = 0;
    use.forEach(function (p) { var q = c[p.parity ? 1 : 0]; q.n++; q.t += p.t; q.d += p.devMs; });
    use.forEach(function (p) { var q = c[p.parity ? 1 : 0]; if (q.n < 3) return; var dt = p.t - q.t / q.n; sxy += dt * (p.devMs - q.d / q.n); sxx += dt * dt; n++; });
    if (n < 6 || !(sxx > 0)) return null;
    var b = sxy / sxx;
    use.forEach(function (p) { var q = c[p.parity ? 1 : 0]; if (q.n < 3) return; var e = (p.devMs - q.d / q.n) - b * (p.t - q.t / q.n); ss += e * e; });
    return ss;
  }
  /* Hat sich der Gang in den letzten Sekunden deutlich verändert? Dann: vor wie vielen Sekunden (dort knickt der Papierstreifen).
     null: keine deutliche Änderung */
  function regBreak(trace, lastS) {
    if (!trace || trace.length < 24) return null;
    var tEnd = trace[trace.length - 1].t;
    var all = traceRate(trace), now = traceRate(trace.filter(function (p) { return p.t >= tEnd - lastS; }));
    if (!all || !now || !(Math.abs(now.rate - all.rate) > Math.max(3, 4 * Math.sqrt(now.se * now.se + all.se * all.se)))) return null;
    var best = null;
    for (var tau = trace[0].t + 1.5; tau <= tEnd - 1.5; tau += 0.25) {
      var a = traceSse(trace.filter(function (p) { return p.t < tau; })), b = traceSse(trace.filter(function (p) { return p.t >= tau; }));
      if (a == null || b == null) continue;
      if (!best || a + b < best.sse) best = { sse: a + b, tau: tau };
    }
    return best ? tEnd - best.tau : lastS;
  }
  function regResult(g, res, t, win) {
    g.t = t;
    var heard = heardOf(res), ok = heard && res.quality.label !== 'schwach';
    if (!ok) {   /* gestört, zum Beispiel beim Verstellen: alle 2 s die letzten 6 s prüfen, bis es wieder sauber tickt */
      g.miss++; g.start = t - REG_MIN + REG_EVERY;
      if (g.miss >= 3) { g.band = null; g.bph = null; }   /* länger nichts: Frequenzband neu suchen */
      g.pts.push({ t: t, gap: true });
      setRSignal(heard ? 1 : 0);
      if (g.last) $('rRate').classList.add('live');
      setStatus('rStatus', g.last ? T('Kein klares Ticken. Sobald die Uhr wieder ruhig tickt, zeigt Tickwerk neue Werte.') :
        T('Noch kein klares Ticken. Handy-Unterkante an die Krone halten, die Uhr nicht berühren.'), 'err');
      drawTrend($('rTrend'), g.pts, t);
      return;
    }
    g.miss = 0;
    if (!g.band) { g.band = res.band; g.bph = res.bph; }
    var since = win >= REG_MIN + REG_EVERY ? regBreak(res.trace, REG_MIN) : null;
    if (since != null) {   /* der Gang hat sich verändert: ab der Änderung neu mitteln, die alten Sekunden nicht mehr verwenden */
      g.start = t - since; g.next = g.start + REG_MIN; g.changed = true;
      if (g.last) $('rRate').classList.add('live');
      setStatus('rStatus', T('Der Gang hat sich verändert. Tickwerk mittelt ab der Änderung neu …'), 'busy');
      return;
    }
    g.last = res;
    g.pts.push({ t: t, rate: res.rate, sigma: res.rateSigma });
    while (g.pts.length && g.pts[0].t < t - REG_SPAN - 5) g.pts.shift();
    $('rRate').textContent = signed(res.rate, 1); $('rRate').classList.remove('live');
    $('rSub').textContent = '± ' + fmt(res.rateSigma, 1) + ' ' + T('s/Tag') + ' · ' + T('aus {n} s', { n: Math.round(win) }) + ' · ' + thousands(res.bph) + ' ' + T('A/h');
    setRMarker(res.rate);
    $('rBe').textContent = res.beatErrorMs != null ? fmt(res.beatErrorMs, 1) : '–';
    $('rBeNote').textContent = T('ms') + (res.beatErrorReliable === false ? ' · ' + T('unsicher') : '');
    $('rAmp').textContent = res.amplitude ? Math.round(res.amplitude) + '°' : '–';
    $('rAmpNote').textContent = !res.amplitude ? '' : res.amplitudeReliable ? T('bei {a}', { a: deg(res.liftAngle) }) : T('unsicher');
    setRSignal(qLevel(res.quality));
    $('rState').textContent = T('Live') + ' · ' + mmss(t);
    setStatus('rStatus', g.changed ? T('Neuer Gang nach der Änderung. Der Wert wird genauer, solange die Uhr ruhig tickt.') :
      T('Live. Nach einer Verstellung die Uhr ein paar Sekunden ruhig lassen.'), 'ok');
    g.changed = false;
    drawTape($('rTape'), res.trace);
    drawTrend($('rTrend'), g.pts, t);
  }
  $('rStart').addEventListener('click', regStart);

  /* ---------- Werk-Detektiv: Schlagzahl und Merkmale grenzen das Werk ein ---------- */
  var DET_Q = ['auto', 'hand', 'stopp', 'datum', 'chrono'];
  var DET_TXT = { auto: [T('Automatik'), T('kein Rotor')], hand: [T('Handaufzug'), T('kein Handaufzug')], stopp: [T('Sekundenstopp'), T('kein Sekundenstopp')], chrono: [T('Chronograph'), T('kein Chronograph')] };
  var DATUM_TXT = { kein: T('ohne Datum'), datum: T('Datum'), tag: T('Datum und Tag') };
  function detective(bph, ans) {
    var out = [];
    KAL.forEach(function (k) {
      if (k.messbar === false || !k.merkmale) return;
      var m = k.merkmale, score = 0, why = [];
      if (bph) {
        var can = k.bph ? [k.bph] : m.bphs || null;
        if (can && can.indexOf(bph) < 0) return;
        if (can) { score += 2; why.push(thousands(bph) + ' ' + T('A/h')); }
      }
      for (var i = 0; i < DET_Q.length; i++) {
        var q = DET_Q[i], a = ans[q];
        if (!a) continue;
        if (q === 'datum') {
          if (!m.datum) continue;
          if (m.datum.indexOf(a) < 0) return;
          score += 1; why.push(DATUM_TXT[a]);
        } else {
          if (m[q] == null) continue;
          if (m[q] !== (a === 'ja')) return;
          score += 1; why.push(DET_TXT[q][a === 'ja' ? 0 : 1]);
        }
      }
      out.push({ k: k, score: score, why: why, pop: m.verbreitet || 0 });
    });
    out.sort(function (a, b) { return b.score - a.score || b.pop - a.pop || byName(a.k.name, b.k.name); });
    return out;
  }
  function renderDetektiv(p) {
    if (!p.init) {
      p.init = true; p.ans = {};
      var w = p.id ? findWatch(p.id) : null, list = w ? measOf(w).filter(counted) : [];
      p.measured = list.length ? list[list.length - 1].bph : 0;
      p.bph = p.measured || (w && w.bph) || 0;
    }
    $('xBackLabel').textContent = T(p.tool ? 'Zurück' : p.from === 'watch' ? 'Uhr' : 'Uhr bearbeiten');
    $('xBph').value = p.bph ? String(p.bph) : '';
    $('xBphNote').textContent = p.measured ? T('Von Tickwerk gemessen: {bph} A/h.', { bph: thousands(p.measured) }) :
      T('Am sichersten: die Uhr zuerst einmal messen. Tickwerk erkennt die Schlagzahl dabei selbst.');
    Array.prototype.forEach.call(document.querySelectorAll('#scr-detektiv .qcard[data-q]'), function (c) {
      var v = p.ans[c.dataset.q] || '';
      Array.prototype.forEach.call(c.querySelectorAll('button[data-v]'), function (b) { b.setAttribute('aria-checked', String(b.dataset.v === v)); });
    });
    var res = detective(p.bph, p.ans), asked = DET_Q.filter(function (q) { return p.ans[q]; }).length + (p.bph ? 1 : 0);
    var ul = $('xList'); ul.innerHTML = '';
    if (!asked) {
      $('xHead').textContent = T('Passende Werke');
      $('xNote').textContent = T('Schlagzahl wählen oder Fragen beantworten. Die Liste grenzt sich mit jeder Antwort weiter ein.');
      return;
    }
    $('xHead').textContent = res.length ? (res.length === 1 ? T('1 passendes Werk') : T('{n} passende Werke', { n: res.length })) + (res.length > 8 ? T(', die wahrscheinlichsten zuerst') : '') : T('Kein Werk passt');
    res.slice(0, 8).forEach(function (r) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="r-l">' + esc(kName(r.k)) + '<small>' + esc(r.why.length ? T('passt: {x}', { x: r.why.join(' · ') }) : calShort(r.k)) + '</small></span>';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn-ghost small'; b.textContent = T('Übernehmen');
      b.addEventListener('click', function () { detectivePick(p, r.k); });
      var rr = document.createElement('span'); rr.className = 'r-r'; rr.appendChild(b); li.appendChild(rr);
      ul.appendChild(li);
    });
    $('xNote').textContent = !res.length ? T('Keines der {n} Werke im Katalog passt zu allen Antworten. Eine unsichere Antwort auf «Weiss nicht» stellen.', { n: KAL.length }) :
      T('Werke mit gleichem Aufbau (z. B. ETA 2824-2, Sellita SW200-1 und ihre Nachbauten) lassen sich so nicht unterscheiden. Für die Messung ist das egal: Schlagzahl und Hebewinkel sind gleich.');
  }
  function detectivePick(p, k) {
    if (p.from === 'watch') {
      var w = findWatch(p.id);
      if (w) {
        w.kaliberId = k.id; w.liftAngle = k.hebewinkel != null ? k.hebewinkel : 52; if (k.bph) w.bph = k.bph;
        saveWatches(); toast(T('Werk übernommen: {k}.', { k: kName(k) }));
      }
      back();
      return;
    }
    back();
    if (topScreen() === 'edit') { setCal(k); applyCal(k); $('wFindNote').textContent = T('Werk übernommen: {k}.', { k: kName(k) }); }
  }
  $('xBph').addEventListener('change', function () { var t = top(); if (t.s !== 'detektiv') return; t.p.bph = parseInt(this.value, 10) || 0; renderDetektiv(t.p); });
  Array.prototype.forEach.call(document.querySelectorAll('#scr-detektiv .qcard[data-q]'), function (c) {
    Array.prototype.forEach.call(c.querySelectorAll('button[data-v]'), function (b) {
      b.addEventListener('click', function () { var t = top(); if (t.s !== 'detektiv') return; t.p.ans[c.dataset.q] = b.dataset.v; renderDetektiv(t.p); });
    });
  });
  $('wDetective').addEventListener('click', function () { var t = top(); if (t.s === 'edit') go('detektiv', { from: 'edit', id: t.p.id || '' }); });
  $('dDetective').addEventListener('click', function () { var w = detailWatch(); if (w) go('detektiv', { from: 'watch', id: w.id }); });

  /* ---------- Gang im Alltag: Zeitvergleich mit der genauen Zeit ----------
     Die genaue Zeit kommt, wenn der Nutzer einverstanden ist, aus dem Internet (siehe «Genaue Zeit aus dem Internet»),
     sonst von der Uhr des Handys. Man tippt, wenn der Sekundenzeiger der Uhr auf der 12 steht;
     die Abweichung (Uhr minus genaue Zeit) wird gespeichert. Aus mehreren Vergleichen über Tage folgt der Gang im
     Alltag (Gerade durch die Abweichungen). Die Reaktionszeit beim Tippen ist jedes Mal ähnlich und hebt sich auf. */
  var TAP_SIGMA = 0.15;   /* Streuung eines Tipps in Sekunden (geschätzt) */
  var HANDY_SIGMA = 0.5;  /* so genau ist die Uhr des Handys etwa (Sekunden, geschätzt): Android stellt sie erst nach, wenn sie rund 2 s danebenliegt */
  var MIN_SPAN_H = 6;     /* Gang erst ab 6 Stunden zwischen erstem und letztem Vergleich (zwei Tipps mit genauer Zeit: etwa ±0,9 s/Tag) */
  var REPLACE_MIN = 10;   /* ein neuer Vergleich innert 10 Minuten ersetzt den vorherigen */
  /* Unsicherheit eines Vergleichs (Varianz in s²): der Tipp, dazu die Uhr, gegen die verglichen wurde (genaue Zeit: ihre
     eigene kleine Unsicherheit; Handy-Uhr: HANDY_SIGMA). Die Gerade durch die Vergleiche wird damit gewichtet: Ein Vergleich
     mit genauer Zeit zählt rund zwölfmal so viel wie einer mit der Handy-Uhr. */
  function tvVar(v) { var c = v.q === 'n' ? (v.u || 0) : HANDY_SIGMA; return TAP_SIGMA * TAP_SIGMA + c * c; }
  function dailyRate(tv) {
    if (!tv || tv.length < 2) return null;
    var t0 = new Date(tv[0].t).getTime();
    if (new Date(tv[tv.length - 1].t).getTime() - t0 < MIN_SPAN_H * 3600000) return null;
    var xs = tv.map(function (v) { return (new Date(v.t).getTime() - t0) / 86400000; }), ys = tv.map(function (v) { return v.o; }), ws = tv.map(function (v) { return 1 / tvVar(v); });
    var n = xs.length, sw = 0, mx = 0, my = 0, sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { sw += ws[i]; mx += ws[i] * xs[i]; my += ws[i] * ys[i]; }
    mx /= sw; my /= sw;
    for (i = 0; i < n; i++) { sxx += ws[i] * (xs[i] - mx) * (xs[i] - mx); sxy += ws[i] * (xs[i] - mx) * (ys[i] - my); }
    if (!(sxx > 0)) return null;
    var rate = sxy / sxx, chi = 0;
    for (i = 0; i < n; i++) { var r = ys[i] - (my + rate * (xs[i] - mx)); chi += ws[i] * r * r; }
    var f = n > 2 ? Math.max(1, Math.sqrt(chi / (n - 2))) : 1;   /* streuen die Vergleiche stärker als erwartet, zählt die beobachtete Streuung */
    return { rate: rate, sigma: f / Math.sqrt(sxx), days: xs[n - 1] - xs[0], n: n, net: tv.filter(function (v) { return v.q === 'n'; }).length };
  }
  function daysText(d) {
    if (d < 1) { var h = Math.max(1, Math.round(d * 24)); return plural(h, 'Stunde', 'Stunden'); }
    var r = Math.round(d * 10) / 10;
    return fmt(r, r % 1 ? 1 : 0) + ' ' + T(r === 1 ? 'Tag' : 'Tage');
  }
  function renderTimeCard(w, list) {
    var tv = w.tv || [], dr = dailyRate(tv), last = tv[tv.length - 1];
    var dec = w.quarz ? 2 : 1;   /* der Gang einer Quarzuhr ist klein: zwei Stellen */
    $('dtSub').textContent = dr ? signed(dr.rate, dec) + ' ' + T('s/Tag') : tv.length ? plural(tv.length, 'Vergleich', 'Vergleiche') : '';
    $('dtRateRow').hidden = !dr;
    $('dtSigma').hidden = !dr;
    if (dr) {
      $('dtRate').textContent = signed(dr.rate, dec);
      $('dtSigma').textContent = '± ' + fmt(dr.sigma, dr.sigma < 0.1 ? 2 : 1) + ' ' + T('s/Tag') + ' · ' + T('über {d}', { d: daysText(dr.days) });
    }
    var ok = list.filter(counted), lastM = ok[ok.length - 1], txt;
    if (!tv.length) txt = T('Wie geht die Uhr, wenn du sie trägst? Vergleiche sie heute mit der genauen Zeit und nach 1 bis 7 Tagen nochmals. Tickwerk rechnet daraus den Gang im Alltag.');
    else if (!dr && tv.length === 1) txt = T('Erster Vergleich am {d}: Uhr {o} s. Nach mindestens einem Tag nochmals vergleichen, die Uhr bis dahin nicht stellen.', { d: dateStr(last.t), o: signed(last.o, 1) });
    else if (!dr) txt = T('Die Vergleiche liegen noch zu nahe beieinander. Den Gang zeigt Tickwerk, sobald zwischen dem ersten und dem letzten mindestens {h} Stunden liegen. Am besten morgen nochmals vergleichen.', { h: MIN_SPAN_H });
    else txt = (gangOf(w) ? T(gangFit(gangOf(w), dr.rate) ? 'Das liegt innerhalb der Vorgabe ({t}).' : 'Das liegt ausserhalb der Vorgabe ({t}).', { t: gangText(gangOf(w)) }) + ' ' : '') +
      (dr.days < 1 ? T('Noch weniger als ein Tag: Nach ein paar Tagen wird der Wert genauer.') + ' ' : '') +
      (lastM ? T('Zum Vergleich die letzte Messung mit dem Mikrofon: {v} s/Tag ({p}).', { v: signed(lastM.rate, 1), p: POS[lastM.pos] }) + ' ' : '') +
      (w.quarz ? T(dr.sigma <= QUARTZ_OK ? 'Genau genug für die Eichung: Unter Mehr → Einstellungen → Handy-Uhr eichen → «Noch genauer eichen» lässt sich dieser Gang übernehmen.' :
        'Für die Eichung der Handy-Uhr braucht es ± {m} s/Tag oder besser: weiter vergleichen.', { m: fmt(QUARTZ_OK, 2) }) + ' ' : '') +
      (dr.net < dr.n && !netOn() ? T('Mit der genauen Zeit aus dem Internet wird der Wert genauer: Mehr → Einstellungen.') : '');
    txt = txt.trim();
    $('dtText').textContent = txt; $('dtText').hidden = !txt;
    var ul = $('dtRows'); ul.innerHTML = '';
    tv.slice(-5).reverse().forEach(function (v) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="r-l">' + esc(dateStr(v.t)) + '<small>' + esc(T(v.q === 'n' ? 'Internetzeit' : 'Handy-Uhr')) + '</small></span>' +
        '<span class="r-r">' + esc(T('Uhr {o} s', { o: signed(v.o, 1) })) + '</span>';
      ul.appendChild(li);
    });
    $('dtReset').hidden = !tv.length;
    $('dtNow').textContent = T(tv.length ? 'Jetzt nochmals vergleichen' : 'Mit der Atomzeit vergleichen');
    var zn = zeitNext(w);
    setRemind('dt', zn ? zn.at : null, zn && zn.due, T('Tickwerk: Zeitvergleich «{w}»', { w: w.name }),
      T('Die Uhr mit der Atomzeit vergleichen: in Tickwerk unter «Meine Uhren», {w}, «Jetzt nochmals vergleichen».', { w: w.name }));
  }
  $('dtNow').addEventListener('click', function () { var w = detailWatch(); if (w) go('zeit', { id: w.id }); });
  $('dtReset').addEventListener('click', function () {
    var w = detailWatch(); if (!w) return;
    if (!window.confirm(T('Neue Reihe beginnen? Das braucht es, wenn du die Uhr gestellt hast oder sie stehen geblieben ist. Die bisherigen Vergleiche werden gelöscht.'))) return;
    delete w.tv; saveWatches(); renderDetail(top().p);
  });

  /* ---------- Erinnerungen: Kalender (Google oder Datei) und Hinweis in der App ---------- */
  function calStamp(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function gcalUrl(title, details, at) {
    var end = new Date(at.getTime() + 15 * 60000);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + calStamp(at) + '/' + calStamp(end) +
      '&details=' + encodeURIComponent(details);
  }
  /* Kalenderdatei nach RFC 5545: Steuerzeichen weg, \ ; , und Zeilenumbrüche maskiert, Zeilen nach 75 Byte gefaltet */
  function icsText(title, details, at) {
    var clean = function (v) { return String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,'); };
    var enc = new TextEncoder();
    var fold = function (line) {
      var out = '', cur = '', n = 0;
      Array.from(line).forEach(function (ch) {
        var b = enc.encode(ch).length;
        if (n + b > (out ? 74 : 75)) { out += (out ? '\r\n ' : '') + cur; cur = ''; n = 0; }
        cur += ch; n += b;
      });
      return out ? out + '\r\n ' + cur : cur;
    };
    var end = new Date(at.getTime() + 15 * 60000);
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tickwerk//Tickwerk ' + APP_VERSION + '//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + calStamp(at) + '-' + Math.random().toString(36).slice(2, 10) + '@tickwerk', 'DTSTAMP:' + calStamp(new Date()), 'DTSTART:' + calStamp(at), 'DTEND:' + calStamp(end),
      'SUMMARY:' + clean(title), 'DESCRIPTION:' + clean(details), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + clean(title), 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
  }
  function whenText(d) { return d.toLocaleDateString(LOC, { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + timeStr(d); }
  var remindData = {};
  function setRemind(prefix, at, due, title, details) {
    var box = $(prefix + 'Remind');
    box.hidden = !at;
    if (!at) { delete remindData[prefix]; return; }
    $(prefix + 'Due').textContent = due ? T('Jetzt fällig (seit {d})', { d: whenText(at) }) : T('Fällig: {d}. Als Erinnerung eintragen:', { d: whenText(at) });
    $(prefix + 'Due').classList.toggle('due', !!due);
    $(prefix + 'Cal').href = gcalUrl(title, details, at);
    $(prefix + 'Cal').hidden = !!due; $(prefix + 'Ics').hidden = !!due;
    remindData[prefix] = { title: title, details: details, at: at };
  }
  function downloadBlob(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }
  ['dt', 'gr'].forEach(function (prefix) {
    $(prefix + 'Ics').addEventListener('click', function () {
      var d = remindData[prefix]; if (!d) return;
      downloadBlob(new Blob([icsText(d.title, d.details, d.at)], { type: 'text/calendar' }), T('tickwerk-erinnerung') + '.ics');
    });
  });
  /* Nächster Zeitvergleich: einen Tag nach dem letzten, solange die Reihe jünger als eine Woche ist */
  function zeitNext(w) {
    var tv = w && w.tv; if (!tv || !tv.length) return null;
    var first = new Date(tv[0].t).getTime(), last = new Date(tv[tv.length - 1].t).getTime(), now = Date.now(), at = last + 24 * 3600000;
    if (now - first > 8 * 86400000 || now > at + 3 * 86400000) return null;
    return { at: new Date(at), due: now >= at - 2 * 3600000 };
  }

  /* ---------- Gangreserve-Test (Pro) ----------
     Voll aufgezogen messen, dann die Uhr liegen lassen (nicht tragen, nicht aufziehen) und nach 24 Stunden nochmals messen,
     freiwillig auch nach 36 Stunden. Verglichen werden Amplitude und Gang, immer mit dem Zifferblatt oben. */
  var GR_H = [0, 24, 36], GR_EARLY = 0.5, GR_NAMES = [T('voll aufgezogen'), T('nach 24 Stunden'), T('nach 36 Stunden')];
  var grPending = null;   /* { watchId, id, step, retry }: die nächste Messung gehört zum Test */
  var grInfo = null;      /* { watchId, text }: Hinweis nach einer Messung des Tests, bis zur nächsten Messung */
  function grMeas(w) {   /* je Schritt die letzte Messung, die zählt */
    var out = [null, null, null];
    if (w && w.gr) measOf(w).forEach(function (m) { if (m.gr === w.gr.id && counted(m)) out[m.grs] = m; });
    return out;
  }
  function grNext(w) {   /* nächster offener Schritt: { step, at, due } */
    if (!w || !w.gr || !w.gr.t0 || w.gr.stop) return null;
    var ms = grMeas(w), t0 = new Date(w.gr.t0).getTime(), now = Date.now();
    for (var st = 1; st < 3; st++) {
      if (ms[st]) continue;
      if (st === 2 && now > t0 + 48 * 3600000) return null;   /* der freiwillige Schritt verfällt nach zwei Tagen */
      var at = t0 + GR_H[st] * 3600000;
      return { step: st, at: new Date(at), due: now >= at - GR_EARLY * 3600000 };
    }
    return null;
  }
  function hoursText(h) { return plural(Math.round(h), 'Stunde', 'Stunden'); }
  function grVerdict(w) {
    var ms = grMeas(w), a = ms[0];
    if (!a) return null;
    if (w.gr.stop) {
      var hs = (new Date(w.gr.stop) - new Date(w.gr.t0)) / 3600000;
      return ms[1] ? { kind: 'okay', text: T('Nach 24 Stunden lief die Uhr noch; stehen geblieben ist sie vor {h}.', { h: hoursText(hs) }) } :
        { kind: 'warn', text: T('Stehen geblieben, bemerkt nach {h}. War die Uhr voll aufgezogen, ist das zu kurz: Die meisten Werke laufen 38 Stunden oder länger. Zugfeder prüfen lassen.', { h: hoursText(hs) }) };
    }
    var st = ms[2] ? 2 : ms[1] ? 1 : 0;
    if (!st) return null;
    var b = ms[st], h = (new Date(b.date) - new Date(a.date)) / 3600000, dr = b.rate - a.rate;
    var drop = a.ampOk && b.ampOk && a.amp && b.amp ? a.amp - b.amp : null, f = st === 2 ? 1.4 : 1;
    var ak = drop == null ? 'good' : drop <= 50 * f ? 'good' : drop <= 80 * f ? 'okay' : 'warn';
    var rk = Math.abs(dr) <= 5 * f ? 'good' : Math.abs(dr) <= 10 * f ? 'okay' : 'warn';
    var kind = ak === 'warn' || rk === 'warn' ? 'warn' : ak === 'okay' || rk === 'okay' ? 'okay' : 'good';
    var head = T('Nach {h}: Amplitude {a}, Gang {r} s/Tag.', { h: hoursText(h), a: drop == null ? T('ohne sicheren Wert') : signed(-drop, 0) + '°', r: signed(dr, 1) });
    var tail = kind === 'good' ? T('Die Zugfeder hat noch genug Kraft. So soll es sein.') :
      kind === 'okay' ? T('Die Kraft lässt merklich nach. Das ist bei vielen Uhren üblich; nach einem frischen Service wäre es eher viel.') :
      ak === 'warn' ? T('Die Amplitude fällt stark. Das deutet auf eine müde Zugfeder oder alte Schmierung: beim nächsten Service ansprechen.') :
      T('Der Gang ändert sich stark, wenn die Kraft nachlässt. Ein Uhrmacher kann das beim Service verbessern.');
    return { kind: kind, text: head + ' ' + tail + (drop == null ? ' ' + T('Ohne sichere Amplitude zählt nur der Gang.') : '') };
  }
  /* Isochronismus (0.6.4): ETA gibt je Stufe vor, wie stark sich der Gang zwischen voll aufgezogen und 24 Stunden später
     ändern darf (Top ±10, Elaboré ±15, Standard ±20 s/Tag). Der Test misst genau diese beiden Zeitpunkte. Ein Vergleich:
     Tickwerk misst nur mit dem Zifferblatt oben. Nicht, wenn die Uhr stehen geblieben ist. */
  var ETA_ISO = [['Top', 10], ['Elaboré', 15], ['Standard', 20]];
  function grIso(w) {
    var ms = grMeas(w);
    if (!ms[0] || !ms[1] || (w.gr && w.gr.stop)) return '';
    var d = Math.round((ms[1].rate - ms[0].rate) * 10) / 10, g = ETA_ISO.filter(function (x) { return Math.abs(d) <= x[1]; })[0];
    return g ? T('Zum Vergleich: Der Gang hat sich in 24 Stunden um {v} s/Tag geändert. Das erfüllt die Vorgabe von ETA für die Stufe «{g}» (±{x} s/Tag).', { v: signed(d, 1), g: g[0], x: g[1] }) :
      T('Zum Vergleich: Der Gang hat sich in 24 Stunden um {v} s/Tag geändert. Das liegt ausserhalb der Vorgaben von ETA (Standard: ±20 s/Tag).', { v: signed(d, 1) });
  }
  function renderGrCard(w) {
    var ms = grMeas(w), nx = grNext(w), vd = grVerdict(w), started = !!(w.gr && w.gr.t0), ul = $('grRows');
    $('grSub').textContent = !started ? '' : nx ? T('läuft') : T('abgeschlossen');
    $('grText').textContent = started ? (nx && !nx.due ? T('Die Uhr bis dahin ruhig liegen lassen: nicht tragen, nicht aufziehen.') : '') :
      T('Wie viel Kraft hat die Zugfeder nach einem Tag noch? Uhr voll aufziehen und gleich messen, dann 24 Stunden liegen lassen und nochmals messen.');
    $('grText').hidden = !$('grText').textContent;
    ul.innerHTML = ''; ul.hidden = !started;
    if (started) {
      [0, 1, 2].forEach(function (st) {
        var m = ms[st], li = document.createElement('li'), sub;
        if (st === 2 && !m && !(nx && nx.step === 2)) return;
        sub = m ? [dateStr(m.date)].concat(m.ampOk && m.amp ? [m.amp + '°'] : []).join(' · ') : st === 0 ? '' : nx && nx.step === st ? (nx.due ? T('jetzt fällig') : T('ab {d}', { d: whenText(nx.at) })) : '–';
        li.innerHTML = '<span class="r-l">' + esc(capF(GR_NAMES[st]) + (st === 2 ? ' (' + T('freiwillig') + ')' : '')) + '<small>' + esc(sub) + '</small></span>' +
          '<span class="r-r' + (m ? '' : ' dim') + '">' + (m ? esc(signed(m.rate, 1) + ' ' + T('s/Tag')) : '–') + '</span>';
        ul.appendChild(li);
      });
    }
    $('grVerdict').hidden = !vd;
    if (vd) { $('grVerdict').setAttribute('data-kind', vd.kind); $('grVerdictText').textContent = vd.text; }
    var iso = started ? grIso(w) : '';
    $('grIso').textContent = iso; $('grIso').hidden = !iso;
    var go = $('grGo');
    go.hidden = started && (!nx || !nx.due);
    go.textContent = !started ? T('Voll aufgezogen: jetzt messen') : nx ? T('Jetzt messen: {s}', { s: GR_NAMES[nx.step] }) : '';
    $('grStop').hidden = !started || !nx;
    $('grReset').hidden = !started;
    setRemind('gr', nx && !nx.due ? nx.at : null, false, T('Tickwerk: Gangreserve-Test «{w}»', { w: w.name }),
      T('Messung «{s}»: Uhr mit dem Zifferblatt nach oben hinlegen und mit Tickwerk messen.', { s: nx ? GR_NAMES[nx.step] : '' }));
  }
  function capF(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
  function grMeasure(w) {
    if (!w || rec || busy || !requirePro('gr')) return;
    var nx = grNext(w), step = w.gr && w.gr.t0 ? (nx && nx.due ? nx.step : -1) : 0;
    if (step < 0) return;
    if (step === 0 && !w.gr) { w.gr = { id: 'g' + Date.now().toString(36), t0: '' }; saveWatches(); }
    grPending = { watchId: w.id, id: w.gr.id, step: step };
    settings.watchId = w.id; settings.pos = 'ZO'; saveSettings();
    clearReadout();
    switchTab('measure');
    setStatus('status', idleHint(), '');
    if (settings.autoStart) measureStart();
  }
  function renderGrNotice() {
    var on = !!grPending && grPending.watchId === settings.watchId, info = !on && grInfo && grInfo.watchId === settings.watchId ? grInfo : null;
    $('mGr').hidden = !on && !info;
    $('mGrX').hidden = !on; $('mGrOpen').hidden = !info;
    if (on) $('mGrText').textContent = (grPending.retry ? T('Für den Gangreserve-Test zählt diese Messung nicht. Nochmals messen.') + ' ' : '') +
      T('Gangreserve-Test, Messung «{s}»: Uhr mit dem Zifferblatt nach oben hinlegen, Handy-Unterkante an die Krone.', { s: GR_NAMES[grPending.step] });
    else if (info) $('mGrText').textContent = info.text;
  }
  /* Eine Messung des Tests ist gespeichert: zählt sie, ist der Schritt erledigt. Der Hinweis steht im Kasten unter dem Ergebnis. */
  function grSaved(m) {
    var w = findWatch(m.watchId);
    if (!w || !w.gr || w.gr.id !== m.gr) return;
    if (!counted(m)) { if (grPending) grPending.retry = true; renderGrNotice(); return; }
    if (m.grs === 0) { w.gr.t0 = m.date; delete w.gr.stop; saveWatches(); }
    grPending = null;
    grInfo = { watchId: w.id, text: m.grs === 0 ? T('Gangreserve-Test begonnen. Die Uhr jetzt 24 Stunden liegen lassen: nicht tragen, nicht aufziehen.') :
      T('Gangreserve-Test: Messung «{s}» gespeichert. Das Ergebnis steht bei der Uhr.', { s: GR_NAMES[m.grs] }) };
    renderGrNotice();
  }
  $('mGrOpen').addEventListener('click', function () { if (grInfo && findWatch(grInfo.watchId) && !rec && !busy) openWatch(grInfo.watchId, 'gr'); });
  $('grGo').addEventListener('click', function () { grMeasure(detailWatch()); });
  $('grStop').addEventListener('click', function () {
    var w = detailWatch(); if (!w || !w.gr || !w.gr.t0) return;
    if (!window.confirm(T('Ist die Uhr stehen geblieben? Tickwerk schliesst den Test damit ab.'))) return;
    w.gr.stop = new Date().toISOString(); saveWatches(); renderDetail(top().p);
  });
  $('grReset').addEventListener('click', function () {
    var w = detailWatch(); if (!w || !w.gr) return;
    if (!window.confirm(T('Neuen Gangreserve-Test beginnen? Die bisherigen Messungen bleiben im Verlauf.'))) return;
    delete w.gr; saveWatches();
    if (grPending && grPending.watchId === w.id) grPending = null;
    renderDetail(top().p);
  });
  $('mGrX').addEventListener('click', function () { grPending = null; renderGrNotice(); });
  /* Kurzer Hinweis für die Uhren-Liste und beim Öffnen der App */
  function dueText(w) {
    var g = isPro() ? grNext(w) : null, z = zeitNext(w);
    if (g && g.due) return T('Gangreserve-Test: Messung «{s}» fällig', { s: GR_NAMES[g.step] });
    if (z && z.due) return T('Zeitvergleich fällig');
    return '';
  }

  /* ---------- Genaue Zeit aus dem Internet (0.6.5) ----------
     Android stellt die Uhr des Handys nur ab und zu; sie kann bis rund zwei Sekunden danebenliegen. Für den Zeitvergleich
     fragt Tickwerk darum, wenn der Nutzer einverstanden ist, die Zeit bei dem Server ab, von dem die App selbst kommt:
     eine leere Anfrage (HEAD, am Service Worker vorbei, nichts aus dem Zwischenspeicher). Jede Antwort grenzt den
     Unterschied «Zeit des Servers minus eigene Uhr» ein, denn der Server hat sie zwischen Absenden und Ankunft gestempelt:
       Kopfzeile X-Timer (Auslieferungsnetz Fastly, auf Mikrosekunden): der Unterschied liegt in einem Bereich von der Breite
         der Laufzeit.
       Kopfzeile Date (nur ganze Sekunden): der Bereich ist eine Sekunde breiter. Die Abfragen werden darum so gelegt, dass
         sie den Sekundenwechsel des Servers einkreisen; jede halbiert den Bereich etwa.
     Der Schnitt aller Bereiche ist das Ergebnis, seine halbe Breite die Unsicherheit. Widersprechen sich die Antworten
     (leerer Schnitt, etwa wegen einer zwischengespeicherten Antwort), gilt die Abfrage als gescheitert, und Tickwerk nimmt
     wie bisher die Uhr des Handys. Gerechnet wird gegen die laufende Uhr der Seite (performance.now): Sie springt nicht,
     wenn Android die Handy-Uhr stellt. Verschieben sich die zwei Uhren gegeneinander (Handy-Uhr gestellt, Handy hat
     geschlafen), gilt die Abfrage nicht mehr. */
  var PERF0 = Date.now() - performance.now();
  function pClock(t) { return PERF0 + (t == null ? performance.now() : t); }   /* die Uhr der Seite als Zeit in ms */
  var NET_URL = 'config.js', NET_TIMEOUT = 4000, NET_MAX_AGE = 10 * 60000, NET_SKEW = 100, NET_FLOOR = 10, NET_SLACK = 25, NET_COARSE = 400;
  /* Seit 0.6.6 zuerst ein öffentlicher Zeitdienst (aus der Konfiguration; liefert die Zeit auf die Millisekunde als Text),
     erst wenn er nicht antwortet der Server der App. Die Zustimmung gilt für genau diese Empfänger (settings.netFor):
     Kommt einer dazu, fragt Tickwerk nochmals. */
  var NET_SVC = typeof CFG.zeitdienst === 'string' && /^(https:\/\/[a-z0-9.-]{4,80}|http:\/\/127\.0\.0\.1:\d{2,5})\/[\w\/?&=.-]{0,60}$/i.test(CFG.zeitdienst) ? CFG.zeitdienst : '';
  var NET_SVC_HOST = NET_SVC ? NET_SVC.split('/')[2] : '', NET_KEY = (NET_SVC_HOST ? NET_SVC_HOST + ',' : '') + 'self';
  var netSvcBad = -Infinity;   /* wann der Zeitdienst zuletzt nicht geantwortet hat (Uhr der Seite): dann eine halbe Stunde lang gleich den Server der App fragen */
  var netNeedUniq = false, netNoXTimer = false;   /* beim Server der App gelernt (gilt, bis die App neu geladen wird): nur eindeutige Anfragen stimmen; X-Timer taugt nicht */
  var net = null;      /* letzte gelungene Abfrage: off (Zeit des Servers minus Uhr der Seite), unc, lo, hi, at, skew, src, n, rtt; alles in ms */
  var netRun = null;   /* laufende Abfrage */
  /* Uhr des Handys minus Uhr der Seite. Zwischen dem Ablesen der zwei Uhren kann das Programm kurz stehen (das ergäbe einen
     scheinbaren Sprung): darum die Uhr der Seite davor und danach ablesen und die engste von bis zu drei Ablesungen nehmen. */
  function netSkew() {
    for (var i = 0, best = 0, gap = Infinity; i < 3 && gap >= 2; i++) {
      var a = performance.now(), d = Date.now(), b = performance.now();
      if (b - a < gap) { gap = b - a; best = d - (PERF0 + (a + b) / 2); }
    }
    return best;
  }
  function netOn() { return settings.netTime === 'ja' && settings.netFor === NET_KEY; }
  function netAsked() { return netOn() || settings.netTime === 'nein'; }
  function netFor(perfTs, skew) { return net && Math.abs(net.at - perfTs) < NET_MAX_AGE && Math.abs(net.skew - skew) < NET_SKEW ? net : null; }
  function netValid() { return !!netFor(performance.now(), netSkew()); }
  function netHost() { return location.hostname || T('dieser Server'); }
  function netNote(ok, why) {
    settings.netLast = cleanNetLast({ at: new Date().toISOString(), ok: ok, src: ok ? net.src : '', n: ok ? net.n : 0, unc: ok ? net.unc : 0, rtt: ok ? net.rtt : 0,
      ph: ok ? netSkew() - net.off : 0, why: ok ? '' : why });
    saveSettings();
  }
  /* Antwort des Zeitdiensts lesen: Sekunden seit 1970 («1794450000.123») oder Datum und Zeit nach ISO 8601
     («2026-11-12T02:03:04.123Z»; ohne Angabe einer Zeitzone gilt UTC), beides mit Bruchteilen der Sekunde: Ohne sie
     wäre die Angabe nur auf die Sekunde genau. Ergebnis in ms seit 1970 oder NaN. */
  function netParse(txt) {
    var s = String(txt).slice(0, 60), m = /^\s*(\d{9,11})\.(\d{3,6})\s*$/.exec(s), t, f;
    if (m) { t = parseInt(m[1], 10) * 1000; f = m[2]; }
    else {
      m = /^\s*(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)\.(\d{3,6})(?:Z|([+-])(\d\d):?(\d\d))?\s*$/.exec(s);
      if (!m) return NaN;
      t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]); f = m[7];
      if (m[8]) t -= (m[8] === '-' ? -1 : 1) * (+m[9] * 60 + +m[10]) * 60000;
    }
    return t > 1.5e12 && t < 4.2e12 ? t + parseFloat('0.' + f) * 1000 : NaN;   /* nur plausible Zeiten (2017 bis 2103) */
  }
  function netProbe(unique, svc) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, NET_TIMEOUT);
    var url = NET_URL + (unique ? '?zeit=' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) : '');
    var t0 = performance.now();
    if (svc) {   /* öffentlicher Zeitdienst: die Zeit steht als Text in der Antwort, auf die Millisekunde */
      return fetch(NET_SVC, { method: 'GET', mode: 'cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl ? ctl.signal : undefined }).then(function (res) {
        if (!res.ok) throw new Error('Status');
        return res.text();
      }).then(function (txt) {
        var t1 = performance.now();
        clearTimeout(timer);
        return { t0: pClock(t0), t1: pClock(t1), a: netParse(txt), x: NaN, d: NaN };
      }, function (e) { clearTimeout(timer); throw e; });
    }
    return fetch(url, { method: 'HEAD', cache: 'no-store', credentials: 'omit', signal: ctl ? ctl.signal : undefined }).then(function (res) {
      var t1 = performance.now(); clearTimeout(timer);
      var h = res.headers.get('x-timer') || '', x = /^S(\d{9,11}(?:\.\d{1,9})?)(?:,|$)/.exec(h), ve = /,VE(\d{1,6})\s*$/.exec(h), d = Date.parse(res.headers.get('date') || '');
      return { t0: pClock(t0), t1: pClock(t1), a: NaN, x: x ? parseFloat(x[1]) * 1000 : NaN, ve: ve ? parseInt(ve[1], 10) : 0, d: isFinite(d) ? d : NaN };
    }, function (e) { clearTimeout(timer); throw e; });
  }
  /* Eine Abfrage. Ergebnis (auch für die Eichung mit Internetzeit): das Objekt wie in net, oder null, wenn sie scheitert. */
  function netStart() {
    if (netRun) return netRun;
    var lo = -Infinity, hi = Infinity, n = 0, bad = 0, rtt = Infinity, mode = '', maxN = 8, first = NaN, moved = false, got = null, uniq = netNeedUniq, noX = netNoXTimer;
    function again() { lo = -Infinity; hi = Infinity; n = 0; bad = 0; rtt = Infinity; mode = ''; maxN = 8; first = NaN; moved = false; }
    var pick = FLAVOR === 'test' ? settings.netPick : '';   /* in der Testversion lässt sich die Quelle fest wählen, um beide zu vergleichen */
    var svc = !!NET_SVC && pick !== 's' && (pick === 'a' || performance.now() - netSvcBad > 30 * 60000);   /* zuerst der öffentliche Zeitdienst, sonst gleich der Server der App */
    function fail(why) {
      if (navigator.onLine !== false) logErr('zeit', 'Zeitabfrage gescheitert', why + ' · ' + (mode || '-') + ' · ' + n + '/' + bad);
      netNote(false, why);
    }
    function take(p) {
      var r = p.t1 - p.t0, v = mode === 'a' ? p.a : mode === 'x' ? p.x : p.d, e = mode === 'a' ? 1 : 0;   /* der Zeitdienst nennt ganze Millisekunden: 1 ms Spielraum */
      if (!isFinite(v) || !(r >= 0)) { bad++; return; }
      /* gestempelt zwischen Absenden (t0) und Ankunft der Antwort (t1); Date nennt nur die begonnene Sekunde.
         X-Timer nennt dazu, wie lange der Server gebraucht hat (VE, ganze ms): Die Antwort ging frühestens dann ab. Das
         engt die untere Grenze ein, wenn der Server die Datei erst holen musste. Ein VE, das länger wäre als der ganze
         Weg hin und zurück, gehört nicht zu dieser Anfrage und zählt nicht. */
      var ve = mode === 'x' && p.ve > 0 && p.ve <= r ? p.ve : 0;
      lo = Math.max(lo, v - e + ve - p.t1); hi = Math.min(hi, v + e + (mode === 'd' ? 1000 : 0) - p.t0);
      /* Die Zeit des Servers muss sich von Antwort zu Antwort bewegen. Bleibt sie stehen (zwischengespeicherte Antwort), sähe
         das eine Sekunde lang aus wie ein Sekundenwechsel, der gleich kommt: Der Bereich würde von selbst immer enger. */
      if (!n) first = v; else if (v > first) moved = true;
      n++; if (r < rtt) rtt = r;
    }
    function pause() {
      if (mode !== 'd' || !isFinite(lo) || !isFinite(hi)) return n ? 40 : 0;   /* X-Timer und Zeitdienst: kurz nacheinander */
      /* nur mit Date: so absenden, dass der Sekundenwechsel des Servers in die Mitte des offenen Bereichs fällt */
      var ph = (pClock() + Math.min(rtt, 1000) / 2 + (lo + hi) / 2) % 1000;
      return (1000 - (ph < 0 ? ph + 1000 : ph)) % 1000;
    }
    function finish() {
      var w = hi - lo, why = !n ? 'keine Antwort' : w < -NET_SLACK ? 'Antworten widersprechen sich' : n < 3 ? 'zu wenige Antworten' : !moved ? 'Zeit des Servers steht' : w / 2 > NET_COARSE ? 'zu ungenau' : '';
      if (why && svc && pick !== 'a') {
        /* Der Zeitdienst hat geantwortet, aber nichts Brauchbares geliefert: von vorn, mit dem Server der App */
        if (navigator.onLine !== false) logErr('zeit', 'Zeitabfrage gescheitert', why + ' · ' + (mode || '-') + ' · ' + n + '/' + bad + ' · weiter: Server der App');
        svc = false; netSvcBad = performance.now();
        again(); return step();
      }
      if (!svc && mode === 'x' && !uniq && (why === 'Antworten widersprechen sich' || why === 'Zeit des Servers steht')) {
        /* Kam X-Timer aus einem Zwischenspeicher statt frisch vom Server? Von vorn, jede Anfrage mit eindeutigem Zusatz:
           Die kann kein Zwischenspeicher beantworten. */
        if (navigator.onLine !== false) logErr('zeit', 'Zeitabfrage gescheitert', why + ' · x · ' + n + '/' + bad + ' · weiter: eindeutige Anfragen');
        uniq = true; again(); return step();
      }
      if (!svc && mode === 'x' && uniq && !noX && (why === 'Antworten widersprechen sich' || why === 'Zeit des Servers steht')) {
        /* Auch frisch beantwortet passt X-Timer nicht zusammen: letzter Versuch mit der Kopfzeile Date (ganze Sekunden) */
        if (navigator.onLine !== false) logErr('zeit', 'Zeitabfrage gescheitert', why + ' · x · ' + n + '/' + bad + ' · weiter: Date');
        noX = true; again(); return step();
      }
      if (why) return fail(why);
      if (!svc && uniq) netNeedUniq = true;   /* so hat es geklappt: die nächsten Abfragen gleich so beginnen */
      if (!svc && noX) netNoXTimer = true;
      net = got = { off: (lo + hi) / 2, unc: Math.max(NET_FLOOR, Math.abs(w) / 2 + (w < 0 ? NET_FLOOR : 0)), lo: Math.min(lo, hi), hi: Math.max(lo, hi),
        at: performance.now(), skew: netSkew(), src: mode, n: n, rtt: Math.round(rtt) };
      netNote(true, '');
    }
    function step() {
      if (n + bad >= maxN || bad > 2 || hi - lo < -NET_SLACK || (n >= 4 && moved && hi - lo < (mode === 'd' ? Math.min(rtt, 300) + 30 : 30))) return finish();
      return new Promise(function (ok) { setTimeout(ok, pause()); }).then(function () { return netProbe(mode !== 'x' || uniq, svc); }).then(function (p) {
        if (!mode) {
          mode = svc ? (isFinite(p.a) ? 'a' : '') : isFinite(p.x) && !noX ? 'x' : isFinite(p.d) ? 'd' : '';
          if (!mode) throw new Error('Kopfzeilen');
          maxN = mode === 'd' ? 12 : 8;
        }
        take(p);
      }, function (e) { if (!n) throw e; bad++; }).then(step, function (e) {
        if (!svc || n || pick === 'a') throw e;
        svc = false; netSvcBad = performance.now();   /* der Zeitdienst antwortet nicht (oder nicht brauchbar): den Server der App fragen */
        return step();
      });
    }
    netRun = step().then(null, function (e) { fail(e && e.message === 'Kopfzeilen' ? 'keine Zeit in der Antwort' : n ? 'abgebrochen' : 'keine Antwort'); })
      .then(function () { netRun = null; zNet(); return got; });
    return netRun;
  }
  /* Einmal fragen, ob Tickwerk die Zeit im Internet abfragen darf; später unter «Einstellungen» zu ändern */
  function netWho() {
    return NET_SVC_HOST ? T('Dafür gehen leere Anfragen an den öffentlichen Zeitdienst {a}. Antwortet er nicht, fragt Tickwerk {h}, den Server, von dem die App kommt. Beide sehen dabei die IP-Adresse deines Handys, wie bei jedem Aufruf einer Website. Über dich und deine Uhren wird nichts übertragen.', { a: NET_SVC_HOST, h: netHost() }) :
      T('Dafür geht eine leere Anfrage an {h}: den Server, von dem die App kommt. Er sieht dabei die IP-Adresse deines Handys, wie bei jedem Aufruf einer Website. Über dich und deine Uhren wird nichts übertragen.', { h: netHost() });
  }
  var netAskFor = '';   /* Anlass der Frage: «zeit» (Zeitvergleich) oder «eichen» (Eichung mit Internetzeit) */
  function netAsk(why) {
    if (topScreen() !== why || sheetOpen) return;
    netAskFor = why;
    $('ntEyebrow').textContent = T(why === 'eichen' ? 'Handy-Uhr eichen' : 'Gang im Alltag');
    $('ntLead').textContent = T(why === 'eichen' ? 'Für die Eichung ohne Quarzuhr vergleicht Tickwerk den Takt des Mikrofons mit der genauen Zeit. Dafür fragt es die Zeit im Internet ab.' :
      'Die Uhr im Handy wird nur ab und zu gestellt und kann bis etwa zwei Sekunden danebenliegen. Genauer wird der Vergleich, wenn Tickwerk die Zeit im Internet abfragt.');
    $('ntHost').textContent = netWho();
    $('ntNo').textContent = T(why === 'eichen' ? 'Nein, abbrechen' : 'Nein, Handy-Uhr nehmen');
    openSheet('netSheet');
  }
  function netChoose(yes) {
    settings.netTime = yes ? 'ja' : 'nein'; settings.netFor = yes ? NET_KEY : ''; saveSettings();
    closeSheet(function () {
      if (netAskFor === 'eichen') { if (yes) calNetStart(); return; }
      if (yes) netStart();
      zNet();
    });
  }
  $('ntYes').addEventListener('click', function () { netChoose(true); });
  $('ntNo').addEventListener('click', function () { netChoose(false); });

  var zTimer = 0;
  function zStop() { clearInterval(zTimer); zTimer = 0; }
  function pad2(x) { return (x < 10 ? '0' : '') + x; }
  function hms(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }
  function hm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function secs(ms) { return fmt(ms / 1000, 2); }
  function zTick() { $('zClock').textContent = hms(new Date(netValid() ? pClock() + net.off : Date.now())); }
  /* Stand der Zeitquelle: Text über der Uhr, Beschriftung der Uhr, «Nochmals versuchen» */
  function zNet() {
    var t = top(); if (t.s !== 'zeit') return;
    var ok = netValid(), txt;
    if (ok) {
      var ph = netSkew() - net.off;
      txt = T('Die genaue Zeit kommt aus dem Internet (± {u} s).', { u: secs(net.unc) }) + ' ' +
        (Math.abs(ph) <= Math.max(net.unc, 50) ? T('Die Uhr des Handys stimmt damit überein.') :
          T(ph > 0 ? 'Die Uhr des Handys geht {s} s vor.' : 'Die Uhr des Handys geht {s} s nach.', { s: secs(Math.abs(ph)) }));
    } else if (netRun) txt = T('Tickwerk holt die genaue Zeit aus dem Internet …');
    else if (!netOn()) txt = T('Tickwerk nimmt die Uhr des Handys; sie kann bis etwa zwei Sekunden danebenliegen. Genauer geht es mit der Zeit aus dem Internet: Mehr → Einstellungen.');
    else txt = T(navigator.onLine === false ? 'Kein Internet: Tickwerk nimmt die Uhr des Handys. Sie kann bis etwa zwei Sekunden danebenliegen.' :
      'Die genaue Zeit liess sich nicht holen: Tickwerk nimmt die Uhr des Handys. Sie kann bis etwa zwei Sekunden danebenliegen.');
    $('zLead').textContent = txt;
    $('zClockT').textContent = T(ok ? 'Genaue Zeit' : 'Zeit des Handys');
    $('zRetry').hidden = ok || !!netRun || !netOn();
    if (t.p.tapP != null) zShow(t.p);
  }
  function renderZeit(p) {
    var w = findWatch(p.id);
    if (!w) { setTimeout(back, 0); return; }
    $('zBackLabel').textContent = w.name;
    zShow(p);
    zStop(); zTick(); zTimer = setInterval(zTick, 100);
    if (!netAsked() && !p.asked) { p.asked = true; setTimeout(function () { netAsk('zeit'); }, 0); }
    else if (netOn() && !netValid()) netStart();
    zNet();
  }
  /* Welche Zeit gilt für den Tipp? Die genaue, wenn eine Abfrage zu ihm passt (auch eine kurz danach); sonst die Uhr des Handys */
  function zTime(p) {
    var a = netOn() ? netFor(p.tapP, p.skew) : null;
    return a ? { t: pClock(p.tapP) + a.off, q: 'n', u: a.unc / 1000 } : { t: p.tapW, q: '', u: 0 };
  }
  function zShow(p) {
    var has = p.tapP != null;
    $('zStep1').hidden = has; $('zStep2').hidden = !has;
    if (!has) return;
    var z = zTime(p), wait = !z.q && netOn() && !!netRun;   /* die Abfrage läuft noch: kurz warten, statt mit der Handy-Uhr zu rechnen */
    p.tap = z.t; p.q = z.q; p.u = z.u;
    p.min = Math.round(z.t / 60000) * 60000 + (p.adj || 0) * 60000;   /* die Uhr zeigt die nächste volle Minute; mit − und + verschoben */
    $('zWatch').textContent = hm(new Date(p.min));
    var off = (p.min - p.tap) / 1000;
    $('zOff').textContent = wait ? '…' : signed(off, 1);
    $('zOffText').textContent = wait ? T('Tickwerk holt noch die genaue Zeit …') :
      Math.abs(off) < 0.05 ? T('Die Uhr geht auf die Sekunde genau.') : T(off > 0 ? 'Die Uhr geht {s} s vor.' : 'Die Uhr geht {s} s nach.', { s: fmt(Math.abs(off), 1) });
    $('zSrc').textContent = wait ? '' : z.q ? T('Verglichen mit der genauen Zeit aus dem Internet (± {u} s).', { u: secs(z.u * 1000) }) : T('Verglichen mit der Uhr des Handys.');
    $('zSave').disabled = wait;
  }
  /* Zeitpunkt des Tippens: Berührung (pointerdown), mit der Zeit des Ereignisses statt der Zeit der Verarbeitung.
     Gemerkt wird er auf der Uhr der Seite (für die genaue Zeit) und auf der Uhr des Handys (falls es keine genaue gibt). */
  $('zTap').addEventListener('pointerdown', function (e) {
    var t = top(); if (t.s !== 'zeit' || t.p.tapP != null) return;
    var now = performance.now(), lag = now - e.timeStamp;
    if (!(lag > 0 && lag < 1000)) lag = 0;
    t.p.tapP = now - lag; t.p.tapW = Date.now() - lag; t.p.skew = netSkew(); t.p.adj = 0;
    if (netOn() && !netFor(t.p.tapP, t.p.skew) && !netRun) netStart();   /* Abfrage fehlt oder gilt nicht mehr: gleich holen, sie gilt auch für diesen Tipp */
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (err) { /* egal */ }
    zNet(); zShow(t.p);
  });
  $('zMinus').addEventListener('click', function () { var t = top(); if (t.s === 'zeit' && t.p.tapP != null) { t.p.adj = (t.p.adj || 0) - 1; zShow(t.p); } });
  $('zPlus').addEventListener('click', function () { var t = top(); if (t.s === 'zeit' && t.p.tapP != null) { t.p.adj = (t.p.adj || 0) + 1; zShow(t.p); } });
  $('zAgain').addEventListener('click', function () { var t = top(); if (t.s === 'zeit') { t.p.tapP = null; zShow(t.p); } });
  $('zRetry').addEventListener('click', function () { if (topScreen() === 'zeit' && netOn() && !netRun) { netStart(); zNet(); } });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || topScreen() !== 'zeit') return;
    if (netOn() && !netValid() && !netRun) netStart();
    zNet();
  });
  $('zSave').addEventListener('click', function () {
    var t = top(); if (t.s !== 'zeit' || t.p.tapP == null) return;
    var w = findWatch(t.p.id); if (!w) return;
    zShow(t.p); if ($('zSave').disabled) return;
    var off = Math.round((t.p.min - t.p.tap) / 10) / 100, tv = (w.tv || []).slice();
    /* Kurz nacheinander nochmals verglichen: der neue Vergleich ersetzt den vorherigen (sonst ergäben zwei Tipps im Minutenabstand einen unsinnigen Gang) */
    if (tv.length && t.p.tap - new Date(tv[tv.length - 1].t).getTime() < REPLACE_MIN * 60000) tv.pop();
    if (tv.length) {
      var dr = dailyRate(tv), prev = tv[tv.length - 1];
      var expect = prev.o + (dr ? dr.rate * (t.p.tap - new Date(prev.t).getTime()) / 86400000 : 0);
      if (Math.abs(off - expect) > 60 && window.confirm(T('Die Abweichung hat sich stark verändert ({d} s). Hast du die Uhr gestellt, oder ist sie stehen geblieben? «OK» beginnt eine neue Reihe mit diesem Vergleich.', { d: signed(off - prev.o, 0) }))) tv = [];
    }
    var v = { t: new Date(t.p.tap).toISOString(), o: off };
    if (t.p.q === 'n') { v.q = 'n'; v.u = Math.round(t.p.u * 1000) / 1000; }
    w.tv = tv.concat([v]).slice(-100);
    saveWatches();
    toast(T('Gespeichert: Uhr {o} s.', { o: signed(off, 1) }));
    back();
  });

  /* ---------- Uhr hinzufügen und bearbeiten ---------- */
  var nameAuto = false;
  function byName(a, b) { return a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' }); }
  /* ---------- Werksvorgabe für den Gang (0.6.5) ----------
     Manche Hersteller nennen, wie viel ihr Werk pro Tag vor- oder nachgehen darf. Steht das im Katalog (Feld «gang»:
     [von, bis, wer, art]), zeigt Tickwerk die Vorgabe beim Werk und vergleicht dort, wo es ehrlich ist: beim Gang im
     Alltag und beim Mittel des Lagen-Tests. Eine einzelne Messung in einer Lage wird nicht daran gemessen. */
  var GANG_ART = { arm: T('am Arm getragen'), aufzug: T('kurz nach vollem Aufzug gemessen'), zo: T('voll aufgezogen, Zifferblatt oben'), uhr: T('für die fertige Uhr'),
    cosc: T('Mittel aus fünf Lagen'), lagen5: T('in fünf Lagen geprüft') };
  function gangOfCal(k) { var g = k && k.messbar !== false ? k.gang : null; return Array.isArray(g) && g.length >= 3 && isFinite(g[0]) && isFinite(g[1]) && g[0] < g[1] ? g : null; }
  function gangOf(w) { return w ? gangOfCal(kalById(w.kaliberId)) : null; }
  function gangNum(v) { return v === 0 ? '0' : signed(v, 0); }
  function gangRange(g) { return T('{a} bis {b} s/Tag', { a: gangNum(g[0]), b: gangNum(g[1]) }); }
  function gangWho(g) { return g[2] === 'COSC' ? T('Chronometer-Norm der COSC') : T('Werksvorgabe von {v}', { v: String(g[2]).slice(0, 30) }); }
  function gangText(g) { return T('{w}: {r}', { w: gangWho(g), r: gangRange(g) }) + (own(GANG_ART, g[3]) ? ' (' + GANG_ART[g[3]] + ')' : ''); }
  function gangFit(g, rate) { var r = Math.round(rate * 10) / 10; return r >= g[0] && r <= g[1]; }
  /* Kachel «Werksvorgabe» im Lagen-Test: nur, wenn das Werk eine Vorgabe hat und es ein Mittel gibt */
  function gangTile(w, st, box, dd, small) {
    var g = gangOf(w);
    box.hidden = !g || st.mean == null;
    if (box.hidden) return;
    dd.textContent = T(gangFit(g, st.mean) ? 'erfüllt' : 'nicht erfüllt');
    small.textContent = gangText(g) + ' · ' + T('Mittel der Lagen {m} s/Tag', { m: signed(st.mean, 1) });
  }
  function calInfo(k) {
    if (!k) return '';
    if (k.messbar === false) return T(k.notiz || 'Dieses Werk lässt sich nicht messen.');
    var s = (k.hebewinkel != null ? T('Hebewinkel {a}', { a: deg(k.hebewinkel) }) + (k.sicher ? '' : ' (' + T('unbestätigt') + ')') : T('Hebewinkel unbekannt, 52° angenommen')) +
      ' · ' + (k.bph ? thousands(k.bph) + ' ' + T('A/h') : T('Schlagzahl wird erkannt'));
    var g = gangOfCal(k);
    return s + (k.notiz ? '. ' + T(k.notiz) : '') + (g ? (k.notiz ? ' ' : '. ') + gangText(g) + '.' : '');
  }
  function applyCal(k, keepValues) {
    $('wCalNote').textContent = calInfo(k);
    $('wCalNote').setAttribute('data-kind', k && k.messbar === false ? 'warn' : '');
    if (!k || keepValues) return;
    $('wLift').value = k.hebewinkel != null ? k.hebewinkel : 52;
    $('wBph').value = k.bph ? String(k.bph) : '';
  }
  $('wName').addEventListener('input', function () { nameAuto = false; });

  /* Modellsuche: Marke, Modell, Spitzname oder Werk */
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[’'´`«»"()\/.,:+]/g, ' ').replace(/[-–_]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /* Modellname ohne doppelte Marke («Seiko 5 Sports», nicht «Seiko Seiko 5 Sports») */
  function fullName(u) { return (' ' + norm(u.modell) + ' ').indexOf(' ' + norm(u.marke) + ' ') >= 0 ? u.modell : u.marke + ' ' + u.modell; }
  /* Suchtext: p = eigener Name (zählt mehr), s = verbautes Werk (zählt weniger) */
  var INDEX = [];
  UHREN.forEach(function (u) {
    var k = kalById(u.kaliber);
    INDEX.push({ kind: 'uhr', u: u, k: k, p: ' ' + norm(u.marke + ' ' + u.modell + ' ' + (u.such || '')), s: ' ' + norm(k ? k.name : ''),
      m: ' ' + norm(u.marke + ' ' + u.modell.split('(')[0]) + ' ' });
  });
  KAL.forEach(function (k) {
    INDEX.push({ kind: 'werk', k: k, p: ' ' + norm(k.name + ' ' + (k.auch || []).join(' ')), s: ' werk kaliber', m: ' ' + norm(k.name.split('(')[0]) + ' ' });
  });
  INDEX.forEach(function (e, i) { e.order = i; e.pc = e.p.replace(/ /g, ''); });
  function search(q) {
    var toks = norm(q).split(' ').filter(Boolean);
    if (!toks.length || (toks.length === 1 && toks[0].length < 2)) return [];
    var hits = [];
    INDEX.forEach(function (e) {
      var score = 0;
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i];
        if (e.p.indexOf(' ' + t) >= 0) score += 3;                         /* Wortanfang im Namen */
        else if (e.p.indexOf(t) >= 0 || e.pc.indexOf(t) >= 0) score += 2;  /* auch «blackbay» */
        else if (e.s.indexOf(' ' + t) >= 0) score += 1;                    /* nur im Werk */
        else if (e.s.indexOf(t) >= 0) score += 0.5;
        else return;
        if (e.m.indexOf(' ' + t) >= 0) score += 1;                         /* im Hauptnamen, nicht in Klammern */
        if (e.m.indexOf(' ' + t + ' ') >= 0) score += 0.5;                 /* ganzes Wort */
      }
      if (e.kind === 'uhr' && norm(e.u.marke).indexOf(toks[0]) === 0) score += 1;
      hits.push({ e: e, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score || (a.e.kind === b.e.kind ? 0 : a.e.kind === 'uhr' ? -1 : 1) || a.e.order - b.e.order; });
    return hits.slice(0, 8).map(function (h) { return h.e; });
  }
  function calShort(k) {
    if (!k) return T('Werk unbekannt');
    if (k.messbar === false) return T('nicht messbar');
    return (k.bph ? thousands(k.bph) + ' ' + T('A/h') : T('Schlagzahl wird erkannt')) + ' · ' +
      (k.hebewinkel != null ? deg(k.hebewinkel) + (k.sicher ? '' : ' (' + T('unbestätigt') + ')') : T('Hebewinkel unbekannt'));
  }
  var found = [], foundSel = -1;
  function hideSuggest() { $('wFindList').hidden = true; $('wFind').setAttribute('aria-expanded', 'false'); found = []; foundSel = -1; }
  function showSuggest(items) {
    var ul = $('wFindList'); ul.innerHTML = ''; found = items; foundSel = -1;
    if (!items.length) ul.innerHTML = '<li class="none">' + esc(T('Nichts gefunden. Name und Werk unten selbst eintragen.')) + '</li>';
    items.forEach(function (e, i) {
      var li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = 'wFind-' + i;
      li.innerHTML = e.kind === 'uhr'
        ? '<span class="t">' + esc(enName(fullName(e.u))) + '</span><span class="s">' + esc((e.k ? kName(e.k) : '') + ' · ' + calShort(e.k)) + '</span>'
        : '<span class="t"><span class="tag">' + esc(T('Werk')) + '</span>' + esc(kName(e.k)) + '</span><span class="s">' + esc(calShort(e.k)) + '</span>';
      li.addEventListener('pointerdown', function (ev) { ev.preventDefault(); });
      li.addEventListener('click', function () { pick(e); });
      ul.appendChild(li);
    });
    ul.hidden = false; $('wFind').setAttribute('aria-expanded', 'true');
  }
  function markSel(i) {
    foundSel = i;
    Array.prototype.forEach.call($('wFindList').children, function (li, j) { li.setAttribute('aria-selected', String(j === i)); });
    if (i >= 0) { $('wFind').setAttribute('aria-activedescendant', 'wFind-' + i); $('wFind-' + i).scrollIntoView({ block: 'nearest' }); }
    else $('wFind').removeAttribute('aria-activedescendant');
  }
  function modelName(u) { return fullName(u).replace(/\s*\([^)]*\)\s*$/, '').trim().slice(0, 60); }
  function pick(e) {
    setCal(e.k);
    applyCal(e.k);
    if (e.kind === 'uhr') {
      if (!$('wName').value.trim() || nameAuto) { $('wName').value = enName(modelName(e.u)); nameAuto = true; }
      $('wFindNote').textContent = T('Übernommen: {m}.', { m: enName(fullName(e.u)) }) + (e.u.notiz ? ' ' + T(e.u.notiz) : '') + ' ' + T('Alles lässt sich unten noch ändern.');
    } else {
      $('wFindNote').textContent = T('Werk übernommen: {k}.', { k: kName(e.k) }) + ($('wName').value.trim() ? '' : ' ' + T('Jetzt noch einen Namen eingeben.'));
      if (!$('wName').value.trim()) $('wName').focus();
    }
    $('wFind').value = '';
    hideSuggest();
  }
  function defaultFindNote() {
    $('wFindNote').textContent = T('{u} beliebte Modelle und {k} Werke. Nicht dabei? Die Felder unten selbst ausfüllen.', { u: UHREN.length, k: KAL.length });
  }
  var hideTimer = 0;
  $('wFind').addEventListener('input', function () {
    clearTimeout(hideTimer);
    if (norm(this.value).length < 2) { hideSuggest(); return; }
    showSuggest(search(this.value));
  });
  $('wFind').addEventListener('keydown', function (ev) {
    if ($('wFindList').hidden) return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); markSel(Math.min(found.length - 1, foundSel + 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); markSel(Math.max(-1, foundSel - 1)); }
    else if (ev.key === 'Enter') { ev.preventDefault(); if (found.length) pick(found[Math.max(0, foundSel)]); }
    else if (ev.key === 'Escape') { hideSuggest(); }
  });
  $('wFind').addEventListener('blur', function () { clearTimeout(hideTimer); hideTimer = setTimeout(hideSuggest, 150); });
  $('wFind').addEventListener('focus', function () { clearTimeout(hideTimer); });

  /* Werk (Kaliber): Suchfeld mit Vorschlägen wie bei den Modellen. Leer angetippt: alle Werke nach Hersteller. */
  var calSel = null, calFound = [], calIdx = -1, calTimer = 0;
  var CAL_INDEX = KAL.map(function (k, i) {
    var p = ' ' + norm(k.name + ' ' + (k.auch || []).join(' ') + ' ' + (k.hersteller || ''));
    return { k: k, p: p, pc: p.replace(/ /g, ''), m: ' ' + norm(k.name.split('(')[0]) + ' ', order: i };
  });
  function searchCal(q) {
    var toks = norm(q).split(' ').filter(Boolean), hits = [];
    if (!toks.length) return [];
    CAL_INDEX.forEach(function (e) {
      var score = 0;
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i];
        if (e.p.indexOf(' ' + t) >= 0) score += 3;
        else if (e.p.indexOf(t) >= 0 || e.pc.indexOf(t) >= 0) score += 2;
        else return;
        if (e.m.indexOf(' ' + t) >= 0) score += 1;
      }
      hits.push({ e: e, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score || byName(a.e.k.name, b.e.k.name); });
    return hits.slice(0, 12).map(function (h) { return h.e.k; });
  }
  function setCal(k) {
    calSel = k || null;
    $('wCal').value = k ? k.id : '';
    $('wCalFind').value = k ? kName(k) : '';
    $('wCalClear').hidden = !k;
  }
  function hideCalList() { $('wCalList').hidden = true; $('wCalFind').setAttribute('aria-expanded', 'false'); calFound = []; calIdx = -1; }
  function calItem(k, i) {
    var li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = 'wCal-' + i;
    li.innerHTML = k ? '<span class="t">' + esc(kName(k)) + '</span><span class="s">' + esc(calShort(k)) + '</span>' :
      '<span class="t">' + esc(T('Unbekannt oder eigene Angaben')) + '</span><span class="s">' + esc(T('Hebewinkel 52°, Schlagzahl erkennt Tickwerk selbst')) + '</span>';
    if (k && calSel && k.id === calSel.id) li.classList.add('picked');
    li.addEventListener('pointerdown', function (ev) { ev.preventDefault(); });
    li.addEventListener('click', function () { pickCal(k); });
    return li;
  }
  function showCalList(q) {
    var ul = $('wCalList'); ul.innerHTML = ''; calFound = []; calIdx = -1;
    var typed = norm(q) && !(calSel && q === kName(calSel));
    if (typed) {
      calFound = searchCal(q);
      if (!calFound.length) ul.innerHTML = '<li class="none">' + esc(T('Kein Werk gefunden. Leer lassen und Hebewinkel unten selbst eintragen.')) + '</li>';
      calFound.forEach(function (k, i) { ul.appendChild(calItem(k, i)); });
    } else {
      calFound = [null];
      ul.appendChild(calItem(null, 0));
      var groups = Object.create(null);
      KAL.forEach(function (k) { var g = k.hersteller || k.name.split(' ')[0]; (groups[g] = groups[g] || []).push(k); });
      Object.keys(groups).sort(byName).forEach(function (g) {
        var h = document.createElement('li'); h.className = 'group'; h.setAttribute('role', 'presentation'); h.textContent = g; ul.appendChild(h);
        groups[g].sort(function (a, b) { return byName(a.name, b.name); }).forEach(function (k) { ul.appendChild(calItem(k, calFound.length)); calFound.push(k); });
      });
    }
    ul.hidden = false; $('wCalFind').setAttribute('aria-expanded', 'true');
    var picked = ul.querySelector('.picked'); if (picked) picked.scrollIntoView({ block: 'nearest' });
  }
  function pickCal(k) {
    setCal(k); applyCal(k); hideCalList();
    $('wCalFind').blur();
  }
  function markCal(i) {
    calIdx = i;
    calFound.forEach(function (k, j) { var li = $('wCal-' + j); if (li) li.setAttribute('aria-selected', String(j === i)); });
    if (i >= 0 && $('wCal-' + i)) { $('wCalFind').setAttribute('aria-activedescendant', 'wCal-' + i); $('wCal-' + i).scrollIntoView({ block: 'nearest' }); }
    else $('wCalFind').removeAttribute('aria-activedescendant');
  }
  $('wCalFind').addEventListener('focus', function () { clearTimeout(calTimer); this.select(); showCalList(this.value); });
  $('wCalFind').addEventListener('input', function () { clearTimeout(calTimer); showCalList(this.value); });
  $('wCalFind').addEventListener('keydown', function (ev) {
    if ($('wCalList').hidden) return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); markCal(Math.min(calFound.length - 1, calIdx + 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); markCal(Math.max(-1, calIdx - 1)); }
    else if (ev.key === 'Enter') { ev.preventDefault(); if (calFound.length && norm(this.value)) pickCal(calFound[Math.max(0, calIdx)]); }
    else if (ev.key === 'Escape') { hideCalList(); }
  });
  /* Verlassen ohne Auswahl: wieder das gewählte Werk anzeigen (oder leer) */
  $('wCalFind').addEventListener('blur', function () {
    clearTimeout(calTimer);
    calTimer = setTimeout(function () { hideCalList(); setCal(calSel); }, 150);
  });
  $('wCalClear').addEventListener('click', function () { pickCal(null); });

  function renderEdit(p) {
    if (p.init) return;
    p.init = true;
    var w = p.id ? findWatch(p.id) : null;
    nameAuto = false; $('watchForm').reset(); $('wFind').value = ''; hideSuggest(); hideCalList(); setCal(null); defaultFindNote();
    $('wQuartz').checked = w ? !!w.quarz : !!p.quartz; quartzForm();
    if (w) {
      $('wName').value = w.name; setCal(kalById(w.kaliberId)); $('wLift').value = w.liftAngle; $('wBph').value = w.bph ? String(w.bph) : '';
      applyCal(kalById(w.kaliberId), true);
      $('watchFormTitle').textContent = T('Uhr bearbeiten'); $('wSave').textContent = T('Änderungen speichern'); $('wDelete').hidden = false;
    } else {
      $('wLift').value = 52; applyCal(null);
      $('watchFormTitle').textContent = T('Uhr hinzufügen'); $('wSave').textContent = T('Speichern'); $('wDelete').hidden = true;
    }
  }
  /* Quarzuhr: Werk, Hebewinkel und Schlagzahl gibt es nicht */
  function quartzForm() { var q = $('wQuartz').checked; $('wMech').hidden = q; $('wFindBox').hidden = q; }
  $('wQuartz').addEventListener('change', quartzForm);
  $('watchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = top(); if (t.s !== 'edit') return;
    var name = $('wName').value.trim();
    if (!name) return;
    var lift = parseFloat(String($('wLift').value).replace(',', '.'));
    var editing = t.p.id && findWatch(t.p.id), isQ = $('wQuartz').checked;
    var w = cleanWatch({ id: editing ? editing.id : 'w' + Date.now().toString(36), name: name, kaliberId: isQ ? '' : $('wCal').value, quarz: isQ,
      liftAngle: isFinite(lift) && !isQ ? lift : 52, bph: $('wBph').value && !isQ ? parseInt($('wBph').value, 10) : null, tv: editing ? editing.tv : undefined, gr: editing && !isQ ? editing.gr : undefined });
    /* Gratis: eine Uhr zum Messen und eine Quarzuhr als Referenz. Geprüft wird beim Anlegen und wenn eine Uhr die Art wechselt. */
    if (!isPro() && (!editing || !!editing.quarz !== isQ) && watches.filter(function (x) { return !!x.quarz === isQ && x !== editing; }).length >= 1) { requirePro('watches'); return; }
    if (editing) watches = watches.map(function (x) { return x.id === editing.id ? w : x; });
    else {
      if (watches.length >= MAX_WATCHES) { toast(T('Tickwerk speichert höchstens {n} Uhren.', { n: MAX_WATCHES })); return; }
      watches.push(w);
    }
    saveWatches();
    if (isQ && settings.watchId === w.id) setWatch('');   /* eine Quarzuhr ist nie die Uhr unter «Messen» */
    if (!editing && !isQ) setWatch(w.id);
    toast(editing ? T('Gespeichert.') : T('«{w}» hinzugefügt.', { w: w.name }));
    back();
  });
  $('wDelete').addEventListener('click', function () {
    var t = top(), w = t.p.id ? findWatch(t.p.id) : null;
    if (!w || !window.confirm(T('«{w}» löschen? Die Messungen bleiben unter «Alle Messungen».', { w: w.name }))) return;
    watches = watches.filter(function (x) { return x.id !== w.id; }); saveWatches();
    if (settings.watchId === w.id) setWatch('');
    if (session && session.watchId === w.id) { session = null; saveSession(); }
    popTo('watches');
  });

  /* ---------- Alle Messungen ---------- */
  function renderHistoryFilter() {
    var sel = $('historyFilter'), keep = sel.value;
    sel.innerHTML = '<option value="*">' + esc(T('Alle Uhren')) + '</option>';
    var seen = Object.create(null);
    watches.forEach(function (w) { seen[w.id] = true; var o = document.createElement('option'); o.value = w.id; o.textContent = w.name; sel.appendChild(o); });
    if (meas.some(function (m) { return !m.watchId || !seen[m.watchId]; })) {
      var o = document.createElement('option'); o.value = ''; o.textContent = T('Ohne Uhr / gelöschte'); sel.appendChild(o);
    }
    sel.value = keep && Array.prototype.some.call(sel.options, function (x) { return x.value === keep; }) ? keep : '*';
  }
  $('historyFilter').addEventListener('change', function () { renderHistory(); });
  function filteredMeas() {
    var f = $('historyFilter').value || '*';
    var known = Object.create(null); watches.forEach(function (w) { known[w.id] = true; });
    return meas.filter(function (m) { return f === '*' || (f === '' ? (!m.watchId || !known[m.watchId]) : m.watchId === f); });
  }
  function renderHistory() {
    renderHistoryFilter();
    var all = filteredMeas(), shown = isPro() ? all : all.slice(-FREE_HISTORY);
    var ul = $('historyList'); ul.innerHTML = '';
    $('historyEmpty').hidden = all.length > 0;
    shown.slice().reverse().forEach(function (m) {
      var li = document.createElement('li'), full = showsPro(m);
      var parts = [POS[m.pos] || ''];
      if (full) { parts.push(T('Abfallfehler {v} ms', { v: fmt(m.be, 2) }) + (m.beOk ? '' : ' (' + T('unsicher') + ')')); if (m.amp) parts.push(m.amp + '°' + (m.ampOk ? '' : ' (' + T('unsicher') + ')')); }
      parts.push(!counted(m) ? T('nicht gewertet') : shaky(m) ? shakyText(m) : qText(m.q));
      if (m.sess) parts.push(T('Lagen-Test'));
      li.innerHTML = '<span class="r-l">' + esc((m.watchName || UNKNOWN.name) + ' · ' + dateStr(m.date)) + '<small>' + esc(parts.join(' · ')) + '</small></span>' +
        '<span class="r-r' + (counted(m) ? '' : ' dim') + '">' + esc(signed(m.rate, 1)) + '<button type="button" class="del" aria-label="' + esc(T('Messung löschen')) + '">' + esc(T('Löschen')) + '</button></span>';
      li.querySelector('button').addEventListener('click', function () {
        meas = meas.filter(function (x) { return x.id !== m.id; }); saveMeas(); renderHistory();
      });
      ul.appendChild(li);
    });
    var hidden = all.length - shown.length;
    $('historyPro').hidden = hidden <= 0;
    $('historyPro').textContent = T(hidden === 1 ? '{n} ältere Messung ist gespeichert. Den ganzen Verlauf zeigt Tickwerk Pro.' : '{n} ältere Messungen sind gespeichert. Den ganzen Verlauf zeigt Tickwerk Pro.', { n: hidden });
    drawHistory(shown.slice(-40));
  }
  $('historyPro').addEventListener('click', function () { requirePro('history'); });

  /* ---------- Einstellungen ---------- */
  var MAX_FILE = 150 * 1024 * 1024;
  function decodeFile(file) {
    if (file.size > MAX_FILE) return Promise.reject(new Error('zu gross'));
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
  function renderSettings() {
    $('langSel').value = settings.lang; $('autoStart').checked = settings.autoStart; $('extendOn').checked = settings.extend;
    $('netOn').checked = netOn();
    $('netPickBox').hidden = !(FLAVOR === 'test' && NET_SVC); $('netPick').value = settings.netPick;
    $('netHint').textContent = NET_SVC_HOST ? T('Für «Gang im Alltag» und «Mit Internetzeit eichen» fragt Tickwerk die Zeit beim öffentlichen Zeitdienst {a} ab und, wenn er nicht antwortet, bei {h}, dem Server, von dem die App kommt. Beide sehen dabei die IP-Adresse deines Handys, sonst nichts. Ausgeschaltet nimmt Tickwerk die Uhr des Handys; sie kann bis etwa zwei Sekunden danebenliegen.', { a: NET_SVC_HOST, h: netHost() }) :
      T('Für «Gang im Alltag» und «Mit Internetzeit eichen» fragt Tickwerk die Zeit bei {h} ab, dem Server, von dem die App kommt. Er sieht dabei die IP-Adresse deines Handys, sonst nichts. Ausgeschaltet nimmt Tickwerk die Uhr des Handys; sie kann bis etwa zwei Sekunden danebenliegen.', { h: netHost() });
    renderMic(); renderPpm();
  }
  /* ---------- Mikrofon wählen (Pro) ---------- */
  var micList = null;
  function micOption(id, label) { var o = document.createElement('option'); o.value = id; o.textContent = label; return o; }
  function renderMic() {
    var sel = $('micSel'), seen = Object.create(null), n = 0;
    sel.innerHTML = '';
    sel.appendChild(micOption('', T('Standard (vom Handy gewählt)')));
    (micList || []).forEach(function (d) {
      if (!d.deviceId || d.deviceId === 'default' || d.deviceId === 'communications' || seen[d.deviceId]) return;
      seen[d.deviceId] = true; n++;
      sel.appendChild(micOption(str(d.deviceId, 200), str(d.label, 100) || T('Mikrofon {n}', { n: n })));
    });
    if (settings.micId && !seen[settings.micId]) sel.appendChild(micOption(settings.micId, settings.micLabel || T('Gewähltes Mikrofon')));
    sel.value = isPro() ? settings.micId : '';
    return n;
  }
  $('micScan').addEventListener('click', function () {
    if (!requirePro('mic') || rec || opening) return;
    var md = navigator.mediaDevices;
    if (!md || !md.getUserMedia || !md.enumerateDevices) { $('micOut').textContent = T('Dieser Browser zeigt keine Liste der Mikrofone.'); return; }
    $('micOut').textContent = T('Suche Mikrofone …');
    /* Die Namen der Mikrofone gibt der Browser erst nach der Erlaubnis heraus: kurz öffnen, Liste holen, gleich wieder schliessen */
    md.getUserMedia({ audio: true, video: false }).then(function (st) {
      return md.enumerateDevices().then(function (devs) {
        st.getTracks().forEach(function (t) { t.stop(); });
        micList = devs.filter(function (d) { return d.kind === 'audioinput'; });
        var n = renderMic();
        $('micOut').textContent = n > 1 ? T('{n} Mikrofone gefunden. Ein angestecktes erscheint erst, wenn es eingesteckt ist.', { n: n }) :
          T('Nur das eingebaute Mikrofon gefunden. Ein angestecktes zuerst einstecken, dann nochmals suchen.');
      }, function (e) { st.getTracks().forEach(function (t) { t.stop(); }); throw e; });
    }).catch(function (e) { $('micOut').textContent = micError(e); });
  });
  $('micSel').addEventListener('change', function () {
    if (!isPro()) { this.value = ''; requirePro('mic'); return; }
    settings.micId = str(this.value, 200);
    settings.micLabel = settings.micId ? str(this.options[this.selectedIndex].textContent, 100) : '';
    saveSettings();
    $('micOut').textContent = settings.micId ? T('Tickwerk nimmt ab jetzt «{m}».', { m: settings.micLabel }) : T('Tickwerk nimmt das Standard-Mikrofon des Handys.');
    renderPpm();
  });
  function micNote() {
    if (!micKey()) return '';
    var m = settings.micLabel || T('gewählt');
    return ' · ' + (calOf(micKey()) ? T('Mikrofon: {m}', { m: m }) : T('Mikrofon: {m}, ungeeicht', { m: m }));
  }
  /* ---------- Handy-Uhr eichen: eigene Seite. Stand der Eichung für das gewählte Mikrofon, mit Datum ---------- */
  function renderPpm() {
    var key = micKey(), m = settings.micLabel || T('gewählt'), c = calOf(key), has = isCal(c);
    var noMic = T('Das Mikrofon «{m}» ist noch nicht geeicht. Tickwerk korrigiert seine Messungen erst nach «Quarzuhr messen» mit diesem Mikrofon.', { m: m });
    $('ppm').value = ppmOf(key);
    $('ppmFor').textContent = !key ? T('Gilt für das Standard-Mikrofon.') : c ? T('Gilt für das Mikrofon «{m}».', { m: m }) : noMic;
    $('calMic').textContent = key ? T('Mikrofon: {m}', { m: m }) : T('Standard-Mikrofon');
    $('calVal').textContent = has ? signed(c.ppm, 1) : '–';
    $('calSub').textContent = !has ? (key ? noMic : T('Noch nicht geeicht. Der Fehler der Handy-Uhr steckt dann in jedem Wert; er kann einige Sekunden pro Tag betragen.')) :
      T(c.ppm >= 0 ? 'Die Handy-Uhr geht {d} s/Tag vor' : 'Die Handy-Uhr geht {d} s/Tag nach', { d: fmt(Math.abs(c.ppm) * 0.0864, 2) }) + ' · ' +
      (c.at ? T(c.raw != null || c.src === 'zeit' ? 'geeicht am {d}' : 'eingetragen am {d}', { d: dLong(new Date(c.at)) }) : T('Datum der Eichung unbekannt'));
    $('calAge').hidden = !calOld(c);
    $('calAcc').hidden = !has; $('calAcc').textContent = has ? calAccText(c) : '';
    $('setCal').textContent = clockShort(); $('setCal').setAttribute('data-kind', calOld(c) ? 'warn' : '');
  }
  function quartzIdle() {
    $('quartzRec').classList.remove('running'); $('quartzRec').disabled = false;
    $('quartzLabel').textContent = QUARTZ_LABEL; bar($('quartzProg'), 0);
  }
  /* Gang der Quarzuhr aus «Gang im Alltag»: Ist er für eine als Quarzuhr angelegte Uhr genau genug, lässt er sich übernehmen */
  function renderQuartzOffer() {
    var box = $('qOffer'), qs = watches.filter(function (w) { return w.quarz; });
    box.innerHTML = '';
    qs.forEach(function (w) {
      var dr = dailyRate(w.tv || []), p = document.createElement('p');
      p.className = 'hint';
      if (dr && dr.sigma <= QUARTZ_OK) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'btn-ghost small qtake';
        b.textContent = T('Gang von «{w}» übernehmen: {v} s/Tag', { w: w.name, v: signed(dr.rate, 2) });
        b.addEventListener('click', function () { quartzTake(w.id); });
        box.appendChild(b);
        p.textContent = T('{n} über {d}, ± {s} s/Tag. Nur richtig, wenn du die Handy-Uhr mit dieser Quarzuhr geeicht hast.', { n: plural(dr.n, 'Vergleich', 'Vergleiche'), d: daysText(dr.days), s: fmt(dr.sigma, 2) });
      } else if (dr) {
        p.textContent = T('«{w}»: Der Gang ist noch nicht genau genug (± {s} s/Tag, nötig sind ± {m}). Weiter vergleichen, am besten über eine Woche und mit der genauen Zeit aus dem Internet.',
          { w: w.name, s: fmt(dr.sigma, 2), m: fmt(QUARTZ_OK, 2) });
      } else p.textContent = T('«{w}»: Noch kein Gang. Die Uhr unter «Meine Uhren» zweimal im Abstand von einigen Tagen vergleichen (Gang im Alltag).', { w: w.name });
      box.appendChild(p);
    });
    $('qNone').hidden = qs.length > 0; $('qAdd').hidden = qs.length > 0;
    /* Stammt die Eichung von der Internetzeit, ändert der Gang der Quarzuhr nichts an ihr: das sagen, sonst wirkt «übernehmen» oder Eintragen wie ohne Folge */
    var cz = calOf(micKey()), from = settings.quartzSrc === 'uhr' ? T('Übernommen aus «Gang im Alltag» (± {s} s/Tag).', { s: fmt(settings.quartzSig, 2) }) : '';
    var zn = cz && cz.src === 'zeit' && settings.quartzSrc ? T('Die Eichung stammt zurzeit von der Internetzeit: Der Gang der Quarzuhr wirkt erst, wenn du wieder mit der Quarzuhr eichst.') : '';
    $('qFrom').hidden = !from && !zn;
    $('qFrom').textContent = from + (from && zn ? ' ' : '') + zn;
  }
  function quartzTake(id) {
    var w = findWatch(id), dr = w ? dailyRate(w.tv || []) : null;
    if (!dr || dr.sigma > QUARTZ_OK) return;
    var v = Math.round(dr.rate * 100) / 100;
    if (Math.abs(v) > 10) { toast(T('Mehr als 10 s/Tag ist für eine Quarzuhr unüblich: Bitte die Vergleiche prüfen.')); return; }
    settings.quartzRate = v; settings.quartzSrc = 'uhr'; settings.quartzSig = Math.round(dr.sigma * 1000) / 1000;
    $('quartzRate').value = v;
    quartzRecalc(); renderQuartzOffer();
    toast(T('Übernommen: Die Quarzuhr geht {v} s/Tag.', { v: signed(v, 2) }));
  }
  $('qAdd').addEventListener('click', addQuartz);
  function renderEichen() {
    $('quartzRate').value = settings.quartzRate || 0;
    renderQuartzOffer();
    renderPpm();
    if (!(rec && rec.owner === 'eichen')) quartzIdle();
    if (!(rec && rec.kind === 'zeit')) calIdle();
  }
  $('autoStart').addEventListener('change', function () { settings.autoStart = this.checked; saveSettings(); if (!rec && !lastShown) setStatus('status', idleHint(), ''); });
  $('extendOn').addEventListener('change', function () { settings.extend = this.checked; saveSettings(); });
  $('netOn').addEventListener('change', function () { settings.netTime = this.checked ? 'ja' : 'nein'; settings.netFor = this.checked ? NET_KEY : ''; saveSettings(); });
  $('netPick').addEventListener('change', function () { settings.netPick = this.value === 'a' || this.value === 's' ? this.value : ''; net = null; saveSettings(); });
  $('fileIn').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f || rec || busy) return;
    switchTab('measure');
    clearReadout();
    setStatus('status', T('Lese {f} …', { f: f.name }), 'busy');
    decodeFile(f).then(function (a) {
      var maxN = Math.round(120 * a.sampleRate);
      var s = a.samples.length > maxN ? a.samples.subarray(0, maxN) : a.samples;
      lastRec = { samples: s, fs: a.sampleRate, date: new Date(), watchName: (currentWatch() || UNKNOWN).name, pos: settings.pos };
      analyzeMeasure(s, a.sampleRate, 'Datei');
    }).catch(function () {
      logErr('datei', f.size > MAX_FILE ? 'Aufnahme zu gross' : 'Aufnahme nicht lesbar', String(f.type || '').replace(/[^a-z0-9\/+.-]/gi, '').slice(0, 30));   /* ohne Dateinamen */
      setStatus('status', f.size > MAX_FILE ? T('{f} ist zu gross (höchstens 150 MB).', { f: f.name }) : T('{f} konnte nicht gelesen werden. Am besten WAV verwenden.', { f: f.name }), 'err');
    });
  });
  $('ppm').addEventListener('change', function () {
    var v = parseFloat(String(this.value).replace(',', '.'));
    setClock(micKey(), isFinite(v) && Math.abs(v) < 500 ? v : 0, null); saveSettings(); renderPpm(); renderQuartzOffer();
  });
  /* Eichung mit einer Quarzuhr: gemessene Abweichung plus eigener Gang der Quarzuhr (geht sie vor, sind ihre Schritte kürzer).
     Sie gilt für das Mikrofon, das aufgenommen hat (bei einer Datei: das eingebaute). */
  function quartzPpm(raw) { return +(raw + settings.quartzRate / 0.0864).toFixed(1); }
  function applyQuartz(q, key) {
    if (!q || !q.ok) { logErr('eichen', (q && q.reason) || 'Keine Auswertung möglich.'); setStatus('quartzOut', T((q && q.reason) || 'Keine Auswertung möglich.'), 'err'); return; }
    var raw = +q.ppm.toFixed(2), ppm = quartzPpm(raw);
    setClock(key, ppm, raw, q.sigmaPpm); saveSettings(); renderPpm(); renderQuartzOffer();
    setStatus('quartzOut', T(ppm >= 0 ? 'Die Handy-Uhr geht {p} ppm vor (± {s} ppm), das sind {d} s/Tag' : 'Die Handy-Uhr geht {p} ppm nach (± {s} ppm), das sind {d} s/Tag',
      { p: fmt(Math.abs(ppm), 1), s: fmt(Math.max(0.1, q.sigmaPpm), 1), d: fmt(Math.abs(ppm) * 0.0864, 2) }) +
      (settings.quartzRate ? T(', mit dem Gang der Quarzuhr verrechnet') : '') + '. ' + T('Tickwerk korrigiert das ab jetzt bei jeder Messung ({n} Schritte erkannt).', { n: q.steps }) +
      (q.inhibition ? ' ' + T('Deine Quarzuhr gleicht ihren Gang alle {n} s mit einem kleinen Sprung aus ({j} ms); das ist berücksichtigt.', { n: q.inhibition.everyS, j: fmt(Math.abs(q.inhibition.jumpMs), 1) }) : '') +
      (key ? ' ' + T('Gilt für das Mikrofon «{m}».', { m: settings.micLabel || T('gewählt') }) : ''), 'ok');
  }
  /* ---------- Mit Internetzeit eichen (0.6.6): ohne Quarzuhr ----------
     Das Handy liegt ruhig, der Bildschirm bleibt an. Tickwerk zählt, wie viele Samples das Mikrofon liefert (der Ton selbst
     wird weder angesehen noch gespeichert), und stempelt jeden Block mit der Uhr der Seite. Jede Minute kommt eine
     Zeitabfrage dazu. Daraus rechnet app/eichzeit.js, um wie viel der Takt des Mikrofons von der wahren Zeit abweicht.
     Gezählt werden die Samples der Mikrofon-Spur selbst (MediaStreamTrackProcessor): Das ist der Takt, in dem auch die
     Messungen aufgenommen werden, auch bei einem angesteckten Mikrofon. Wo der Browser das nicht kann, zählt Tickwerk
     die Blöcke des Aufnahme-Worklets; die laufen im Takt der Tonausgabe, der beim eingebauten Mikrofon derselbe ist.
     Für die automatischen Tests lässt sich der Ablauf in der Testversion beschleunigen (calSpeed in config.js) und die
     Schwelle für das Übernehmen lockern (calMaxSig): In einer Minute lässt sich kein Takt auf 5 ppm bestimmen. */
  var EZ = window.TickwerkEichzeit;
  var CAL_SPEED = FLAVOR === 'test' && CFG.calSpeed > 1 && CFG.calSpeed <= 600 ? CFG.calSpeed : 1;
  var CAL = { total: 3600 / CAL_SPEED, sync: 60 / CAL_SPEED, win: 10 / CAL_SPEED, first: 600 / CAL_SPEED, maxSig: FLAVOR === 'test' && CFG.calMaxSig > 5 ? CFG.calMaxSig : 5, maxFail: 5 };
  var CAL_LABEL = T('Eichung starten (60 Minuten)');
  function netSrcName(k) { return k === 'a' ? (NET_SVC_HOST || 'Zeitdienst') : k === 'x' ? 'X-Timer' : k === 'd' ? 'Date' : '?'; }
  function calIdle() {
    $('ncRec').classList.remove('running'); $('ncRec').disabled = !EZ;
    $('ncLabel').textContent = CAL_LABEL; bar($('ncProg'), 0);
    $('ncTake').hidden = true;
  }
  function calPts(c) { return c.cur ? c.pts.concat([c.cur]) : c.pts; }
  function calEst(c) { return c.syncs.length >= 3 ? EZ.result(EZ.slope(calPts(c)), EZ.line(c.syncs)) : null; }
  function calUsable(e) { return !!e && isFinite(e.ppm) && Math.abs(e.ppm) < 300 && isFinite(e.sigma); }
  function calNote(c, ok, e, why) {
    settings.calZeit = cleanCalZeit({ at: new Date().toISOString(), ok: ok, min: (performance.now() - c.start) / 60000, k: c.syncs.length, ppm: e ? e.ppm : 0, sig: e ? e.sigma : 0,
      audio: e ? e.audio : 0, clock: e ? e.clock : 0, steps: e ? e.steps : 0, grp: e ? e.groups : 0, kind: c.kind, src: c.src, why: ok ? '' : why });
    saveSettings();
  }
  /* Samples zählen: n Samples sind angekommen, jetzt. Je Zeitfenster bleibt der Block mit der kleinsten Verspätung. */
  function calBlock(r, n, fs) {
    var c = r.cal, t = performance.now();
    if (rec !== r || !(n > 0) || !(fs > 0)) return;
    if (!c.fs) c.fs = fs;
    else if (fs !== c.fs) { c.bad = 'Abtastrate wechselt'; return; }
    c.n += n; c.last = t;
    if (t - c.start < 3000) return;   /* die ersten Sekunden nur mitzählen: Beim Öffnen des Mikrofons kommen die Blöcke noch unregelmässig */
    var v = t - c.n * 1000 / c.fs;
    if (t >= c.wEnd) { if (c.cur) c.pts.push(c.cur); c.cur = null; c.wEnd = t + CAL.win * 1000; }
    if (!c.cur || v < c.cur.r) c.cur = { t: t, r: v };
  }
  function calFrames(r) {
    var c = r.cal, track = r.stream.getAudioTracks()[0];
    if (typeof window.MediaStreamTrackProcessor === 'function') {
      var reader = new window.MediaStreamTrackProcessor({ track: track, maxBufferSize: 300 }).readable.getReader();
      c.kind = 'm';
      c.stop = function () { c.off = true; try { reader.cancel().catch(function () { /* egal */ }); } catch (e) { /* egal */ } };
      (function pump() {
        reader.read().then(function (x) {
          if (c.off || !x || x.done) return;
          var f = x.value, n = f.numberOfFrames, fs = f.sampleRate;
          try { f.close(); } catch (e) { /* egal */ }
          calBlock(r, n, fs); pump();
        }, function () { c.bad = 'Mikrofon liefert nichts'; });
      })();
      return Promise.resolve();
    }
    var AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
    r.ctx = ctx; c.kind = 'w';
    return Promise.resolve(ctx.resume()).catch(function () { /* egal */ }).then(function () { return ctx.audioWorklet.addModule('recorder-worklet.js'); }).then(function () {
      var src = ctx.createMediaStreamSource(r.stream), sink = ctx.createGain(), node = new AudioWorkletNode(ctx, 'tw-recorder', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
      sink.gain.value = 0; sink.connect(ctx.destination);
      node.port.onmessage = function (e) { calBlock(r, e.data.samples.length, ctx.sampleRate); };
      src.connect(node); node.connect(sink);
      r.src = src; r.node = node; r.sink = sink;
    });
  }
  function calEnd(r) {   /* Aufnahme schliessen (falls sie noch läuft) und die Oberfläche zurücksetzen */
    var c = r.cal;
    if (rec === r) { rec = null; teardown(r); }
    if (c.stop) c.stop();
    calIdle();
  }
  function calFail(r, why, text) {
    var c = r.cal;
    logErr('eichen', 'Eichung mit Internetzeit abgebrochen', why);
    calNote(c, false, null, why);
    calEnd(r);
    setStatus('ncOut', text, 'err');
  }
  function calDone(r) {
    var c = r.cal, e = calEst(c), min = Math.max(1, Math.round((performance.now() - c.start) / 60000));
    calEnd(r);
    if (!calUsable(e)) {
      logErr('eichen', 'Eichung mit Internetzeit abgebrochen', 'kein Wert');
      calNote(c, false, null, 'kein Wert');
      setStatus('ncOut', T('Aus den Daten liess sich kein Wert rechnen. Bitte nochmals versuchen, am besten im WLAN.'), 'err'); return;
    }
    var sig = Math.max(0.3, e.sigma), ppm = +e.ppm.toFixed(1), old = calOf(c.key);
    if (sig > CAL.maxSig) {
      calNote(c, false, e, 'zu unsicher');
      setStatus('ncOut', T('Zu unsicher (± {s} ppm): Der Wert {p} ppm wurde nicht übernommen. Am besten im WLAN wiederholen und das Handy liegen lassen.', { s: fmt(sig, 1), p: signed(ppm, 1) }), 'err'); return;
    }
    calNote(c, true, e, '');
    setClock(c.key, ppm, null, sig, 'zeit'); saveSettings(); renderPpm(); renderQuartzOffer();
    setStatus('ncOut', T(ppm >= 0 ? 'Die Handy-Uhr geht {p} ppm vor (± {s} ppm), das sind {d} s/Tag' : 'Die Handy-Uhr geht {p} ppm nach (± {s} ppm), das sind {d} s/Tag',
      { p: fmt(Math.abs(ppm), 1), s: fmt(sig, 1), d: fmt(Math.abs(ppm) * 0.0864, 2) }) + '. ' +
      T('Gemessen mit der Zeit aus dem Internet über {m} Minuten ({k} Zeitabfragen). Tickwerk korrigiert das ab jetzt bei jeder Messung.', { m: min, k: c.syncs.length }) +
      (old && old.raw != null ? ' ' + T('Zum Vergleich: Mit der Quarzuhr waren es {q} ppm.', { q: signed(old.ppm, 1) }) : '') +
      (c.key ? ' ' + T('Gilt für das Mikrofon «{m}».', { m: settings.micLabel || T('gewählt') }) : ''), 'ok');
  }
  function calTick(r) {
    if (rec !== r) return;
    var c = r.cal, now = performance.now(), el = (now - c.start) / 1000;
    if (c.bad || (c.last ? now - c.last > 5000 : el > 8)) { calFail(r, c.bad || 'keine Samples', T('Das Mikrofon lieferte keine Daten mehr. Die Eichung wurde abgebrochen.')); return; }
    if (!c.syncing && now >= c.next) {
      c.next = now + CAL.sync * 1000; c.syncing = true;
      netStart().then(function (g) {
        c.syncing = false;
        if (rec !== r) return;
        if (g) { c.syncs.push({ t: g.at, lo: g.lo, hi: g.hi, g: g.src }); c.fails = 0; c.src = g.src; c.est = calEst(c); }   /* g: die Quelle; wechselt sie, rechnet eichzeit.js jede für sich */
        else if (++c.fails >= CAL.maxFail) calFail(r, 'Zeitabfragen', T('Die Zeit aus dem Internet liess sich nicht holen. Die Eichung wurde abgebrochen.'));
      });
    }
    if (el >= CAL.total && !c.syncing) { calDone(r); return; }
    var e = el >= CAL.first && calUsable(c.est) ? c.est : null, sig = e ? Math.max(0.3, e.sigma) : 0;
    $('ncLabel').textContent = T('Abbrechen') + ' · ' + mmss(el * CAL_SPEED) + ' / ' + mmss(CAL.total * CAL_SPEED);
    bar($('ncProg'), el / CAL.total);
    $('ncTake').hidden = !(e && sig <= CAL.maxSig);
    if (e) $('ncTake').textContent = T('Jetzt übernehmen: {p} ppm (± {s})', { p: signed(e.ppm, 1), s: fmt(sig, 1) });
    setStatus('ncOut', T('Eichung läuft. Handy liegen lassen, Tickwerk nicht verlassen.') + ' ' + plural(c.syncs.length, 'Zeitabfrage', 'Zeitabfragen') + (c.src ? ' (' + netSrcName(c.src) + ')' : '') + '. ' +
      (e ? T('Vorläufig: {p} ppm (± {s}).', { p: signed(e.ppm, 1), s: fmt(sig, 1) }) : T('Ein erster Wert kommt nach {n} Minuten.', { n: Math.round(CAL.first * CAL_SPEED / 60) })), 'busy');
  }
  async function calNetStart() {
    if (rec || busy || opening || !EZ) return;
    if (!netOn()) { netAsk('eichen'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('ncOut', T('Dieser Browser erlaubt hier keine Mikrofon-Aufnahme. Tickwerk über https öffnen, zum Beispiel in Chrome.'), 'err'); return;
    }
    opening = true; $('ncRec').disabled = true;
    setStatus('ncOut', T('Mikrofon wird geöffnet …'), 'busy');
    var stream, cons = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }, pick = isPro() && settings.micId, fell = false;
    if (pick) cons.deviceId = { exact: settings.micId };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: cons, video: false });
    } catch (e) {
      if (!pick || !e || (e.name !== 'OverconstrainedError' && e.name !== 'NotFoundError')) { opening = false; calIdle(); setStatus('ncOut', micError(e), 'err'); return; }
      delete cons.deviceId; fell = true;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: cons, video: false }); }
      catch (e2) { opening = false; calIdle(); setStatus('ncOut', micError(e2), 'err'); return; }
      toast(T('Das gewählte Mikrofon ist nicht da. Tickwerk nimmt das Standard-Mikrofon.'));
    }
    var trk = stream.getAudioTracks()[0], tid = trk && trk.getSettings ? trk.getSettings().deviceId : '';
    usedMic = pick && !fell && (!tid || tid === settings.micId) ? settings.micId : '';
    var c = { key: usedMic, fs: 0, n: 0, pts: [], cur: null, wEnd: 0, syncs: [], fails: 0, start: performance.now(), next: 0, last: 0, kind: '', src: '', est: null, syncing: false, bad: '', stop: null, off: false };
    var r = { owner: 'eichen', kind: 'zeit', stream: stream, ctx: null, timer: 0, cal: c,
      o: { onCancel: function () { if (c.stop) c.stop(); calIdle(); setStatus('ncOut', T('Abgebrochen.'), ''); } } };
    try { await calFrames(r); }
    catch (e) {
      opening = false; teardown(r); calIdle();
      logErr('mikro', 'Aufnahme konnte nicht starten', e && e.message);
      setStatus('ncOut', T('Aufnahme konnte nicht starten') + (e && e.message ? ': ' + e.message : '.'), 'err'); return;
    }
    opening = false;
    if (topScreen() !== 'eichen') { teardown(r); if (c.stop) c.stop(); calIdle(); return; }
    rec = r; c.start = performance.now();
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
    if (rec !== r) return;
    $('ncRec').disabled = false; $('ncRec').classList.add('running');
    r.timer = setInterval(function () { calTick(r); }, 500);
    calTick(r);
  }
  $('ncRec').addEventListener('click', function () {
    if (rec && rec.kind === 'zeit') { recStop(true); return; }
    calNetStart();
  });
  $('ncTake').addEventListener('click', function () { if (rec && rec.kind === 'zeit') calDone(rec); });

  $('langSel').addEventListener('change', function () {
    settings.lang = LANGS.indexOf(this.value) >= 0 ? this.value : 'auto'; saveSettings();
    location.reload();
  });
  /* Alle Eichungen, die an einer Quarzuhr gemessen sind, mit ihrem Gang neu rechnen */
  function quartzRecalc() {
    if (settings.quartzRaw != null) settings.ppm = quartzPpm(settings.quartzRaw);
    Object.keys(settings.cal).forEach(function (k) { var c = settings.cal[k]; if (c.raw != null) c.ppm = quartzPpm(c.raw); });
    saveSettings(); renderPpm();
  }
  $('quartzRate').addEventListener('change', function () {
    var v = parseFloat(String(this.value).replace(',', '.'));
    settings.quartzRate = isFinite(v) && Math.abs(v) <= 10 ? v : 0; this.value = settings.quartzRate;
    settings.quartzSrc = settings.quartzRate ? 'hand' : ''; settings.quartzSig = null;
    quartzRecalc(); renderQuartzOffer();
  });
  var QUARTZ_LABEL = T('Quarzuhr messen (2½ Minuten)');
  $('quartzRec').addEventListener('click', function () {
    if (rec && rec.kind === 'zeit') return;   /* es läuft eine Eichung mit Internetzeit */
    if (rec && rec.owner === 'eichen') { recStop(true); return; }
    if (rec || busy || opening) return;
    recStart({
      owner: 'eichen', dur: 150, settle: 1, noLive: true, opts: {},
      onOpening: function () { $('quartzRec').disabled = true; setStatus('quartzOut', T('Mikrofon wird geöffnet …'), 'busy'); },
      onFail: function (msg) { $('quartzRec').disabled = false; setStatus('quartzOut', msg, 'err'); },
      onBegin: function () {
        $('quartzRec').disabled = false; $('quartzRec').classList.add('running'); $('quartzLabel').textContent = T('Abbrechen');
        setStatus('quartzOut', T('Aufnahme läuft. Handy ruhig an die Quarzuhr halten, nicht reden.'), 'busy');
      },
      onTick: function (left, frac) { $('quartzLabel').textContent = T('Abbrechen') + ' · ' + left + ' s'; bar($('quartzProg'), frac); },
      onCancel: function () { quartzIdle(); setStatus('quartzOut', T('Abgebrochen.'), ''); },
      onDone: function (samples, fs) {
        quartzIdle(); setStatus('quartzOut', T('Rechne …'), 'busy');
        var key = usedMic;
        runJob({ kind: 'quartz', samples: samples, fs: fs }).then(function (q) { applyQuartz(q, key); });
      }
    });
  });
  $('quartzFile').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f || rec || busy) return;
    setStatus('quartzOut', T('Lese {f} …', { f: f.name }), 'busy');
    decodeFile(f).then(function (a) {
      var maxQ = Math.round(300 * a.sampleRate);
      return runJob({ kind: 'quartz', samples: a.samples.length > maxQ ? a.samples.subarray(0, maxQ) : a.samples, fs: a.sampleRate });
    }).then(function (q) { applyQuartz(q, ''); }).catch(function () {
      setStatus('quartzOut', f.size > MAX_FILE ? T('{f} ist zu gross (höchstens 150 MB).', { f: f.name }) : T('{f} konnte nicht gelesen werden.', { f: f.name }), 'err');
    });
  });
  $('exportBtn').addEventListener('click', function () {
    var now = new Date(), pad = function (x) { return (x < 10 ? '0' : '') + x; };
    var data = { app: 'Tickwerk', format: 1, version: APP_VERSION, exported: now.toISOString(), watches: watches, measurements: meas, settings: { ppm: settings.ppm, calAt: settings.calAt } };
    var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    shareOrDownload(blob, ({ de: 'tickwerk-sicherung-', en: 'tickwerk-backup-', fr: 'tickwerk-sauvegarde-', it: 'tickwerk-backup-' }[LANG]) + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '.json', T('Tickwerk Sicherung'));
    $('backupOut').textContent = T('{w} und {m} gesichert. Die Datei liegt bei den Downloads.', { w: plural(watches.length, 'Uhr', 'Uhren'), m: plural(meas.length, 'Messung', 'Messungen') });
  });
  $('importIn').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { $('backupOut').textContent = T('Die Datei ist zu gross für eine Tickwerk-Sicherung.'); return; }
    f.text().then(function (txt) {
      var d = JSON.parse(txt);
      if (!d || typeof d !== 'object' || d.app !== 'Tickwerk') throw new Error(T('keine Tickwerk-Sicherung'));
      var ws = list(d.watches, cleanWatch), ms = list(d.measurements, cleanMeas);
      var haveW = Object.create(null), haveM = Object.create(null);
      watches.forEach(function (w) { haveW[w.id] = true; }); meas.forEach(function (m) { haveM[m.id] = true; });
      /* doppelte Einträge auch innerhalb der Datei nur einmal übernehmen, höchstens MAX_WATCHES Uhren */
      var addW = ws.filter(function (w) { if (haveW[w.id]) return false; haveW[w.id] = true; return true; }).slice(0, Math.max(0, MAX_WATCHES - watches.length));
      var addM = ms.filter(function (m) { if (haveM[m.id]) return false; haveM[m.id] = true; return true; });
      watches = watches.concat(addW);
      meas = meas.concat(addM).sort(function (a, b) { return new Date(a.date) - new Date(b.date); }).slice(-MAX_MEAS);
      lastId = meas.reduce(function (a, m) { return Math.max(a, m.id); }, lastId);
      var calTaken = false;   /* die Eichung gilt nur für das Handy, auf dem sie gemessen wurde: beim Übernehmen darauf hinweisen */
      if (d.settings && typeof d.settings.ppm === 'number' && isFinite(d.settings.ppm) && Math.abs(d.settings.ppm) < 500 && !settings.ppm) {
        settings.ppm = d.settings.ppm; settings.calAt = settings.ppm ? isoDate(d.settings.calAt) : ''; calTaken = !!settings.ppm;
      }
      saveWatches(); saveMeas(); saveSettings(); renderSettings();
      var dup = (ws.length - addW.length) + (ms.length - addM.length);
      $('backupOut').textContent = T('{w} und {m} übernommen', { w: plural(addW.length, 'Uhr', 'Uhren'), m: plural(addM.length, 'Messung', 'Messungen') }) + (dup ? ' (' + T('{n} waren schon vorhanden', { n: dup }) + ')' : '') + '.' +
        (calTaken ? ' ' + T('Die Eichung der Handy-Uhr stammt aus der Sicherung. Ist das ein anderes Handy, neu eichen.') : '');
    }).catch(function (err) {
      $('backupOut').textContent = T('Die Sicherung konnte nicht geladen werden') + (err && err.message ? ' (' + err.message + ')' : '') + '.';
    });
  });
  $('wipeBtn').addEventListener('click', function () {
    if (!window.confirm(T('Alle Uhren und Messungen auf diesem Handy löschen? Das lässt sich nicht rückgängig machen. Tipp: vorher eine Sicherung speichern.'))) return;
    watches = []; meas = []; session = null; settings.watchId = '';
    saveWatches(); saveMeas(); saveSession(); saveSettings();
    errLog = []; unstore(KEYS.log);   /* auch das Fehlerprotokoll (Diagnose): «alles» heisst alles, was die App über die Benutzung weiss */
    clearReadout();
    $('backupOut').textContent = T('Alle Uhren und Messungen sind gelöscht.');
  });

  /* ---------- Mehr, Pro, Anleitung ---------- */
  function renderMore() {
    $('moreVersion').textContent = T('Version') + ' ' + APP_VERSION + (FLAVOR === 'test' ? ' · ' + T('Testversion') : '');
    $('moreProState').textContent = isPro() ? T('Freigeschaltet') : T('Gratis · noch {n} von {m} Messungen mit allen Werten diese Woche', { n: freeLeft(), m: FREE_PER_WEEK });
    $('moreHistory').textContent = plural(meas.length, 'Messung', 'Messungen');
    renderTools($('moreTools'));
    $('newsSub').textContent = T('Die Neuerungen von Version {v}', { v: APP_VERSION });
    renderUpd();
    $('versionInfo').textContent = 'Tickwerk ' + APP_VERSION + (FLAVOR === 'test' ? ' (' + T('Testversion') + ')' : '') + ' · ' + T('Mess-Engine') + ' ' + (engineVersion || '?');
  }
  function renderPro() {
    var pro = isPro(), card = $('proState'), store = FLAVOR === 'store';
    $('proFree').textContent = T('Gratis bleiben Gangabweichung, Schlagzahl und Papierstreifen für eine Uhr, dazu {n} Messungen pro Woche mit allen Werten.', { n: FREE_PER_WEEK });
    var txt;
    if (pro) txt = FLAVOR === 'test' ? T('Testversion: Pro ist zum Ausprobieren freigeschaltet. Es wurde nichts gekauft.') : T('Tickwerk Pro ist freigeschaltet. Danke für die Unterstützung!');
    else if (!store) txt = T('Testversion: «Pro kaufen» schaltet Pro hier nur zum Ausprobieren frei. Es wird nichts verrechnet.');
    else if (billing.svc) txt = T('Preis: {p} einmalig. Der Kauf gilt für dein Google-Konto, auch auf einem neuen Handy.', { p: priceText() });
    else txt = T('Kaufen lässt sich Pro in der Tickwerk-App aus dem Google Play Store. In dieser Browser-Version gibt es die Gratis-Funktionen.');
    card.textContent = txt;
    $('proBuy').hidden = pro;
    $('proBuy').textContent = T('Pro kaufen') + ' · ' + priceText();
    $('proBuy').disabled = store && !billing.svc;
    $('proRestore').hidden = !store || pro;
    $('proRestore').disabled = !billing.svc;
    $('proTest').hidden = store;
    $('proTestToggle').checked = settings.testPro;
  }
  $('proBuy').addEventListener('click', buyPro);
  $('proRestore').addEventListener('click', function () {
    $('proRestore').disabled = true;
    restorePurchases().then(function (res) {
      toast(T(res === 'restored' ? 'Pro ist wiederhergestellt.' : res === 'pending' ? 'Der Kauf ist noch nicht abgeschlossen. Später nochmals versuchen.' :
        res === 'unavailable' ? 'Google Play ist hier nicht erreichbar.' : res === 'error' ? 'Wiederherstellen hat nicht geklappt. Später nochmals versuchen.' : 'Kein Kauf von Tickwerk Pro auf diesem Google-Konto gefunden.'));
      afterProChange();
    });
  });
  $('proTestToggle').addEventListener('change', function () { settings.testPro = this.checked; saveSettings(); afterProChange(); });
  $('proTestReset').addEventListener('click', function () { settings.free = { week: '', used: 0 }; saveSettings(); toast(T('Gratis-Messungen zurückgesetzt: wieder {n} diese Woche.', { n: FREE_PER_WEEK })); render(); });
  $('gStart').addEventListener('click', function () {
    settings.guideSeen = true; saveSettings();
    if (stack.length > 1) back(); else switchTab('measure');
    measureStart();
  });

  /* ---------- Messprotokoll (PDF, Pro) ---------- */
  var lastReportUrl = null;
  function makeReport(w, bar, opt) {
    if (!requirePro('pdf')) return;
    var items = opt.list || measOf(w.id ? w : null);
    bar.hidden = false;
    if (!items.length || !window.TickwerkReport) { bar.textContent = T('Für diese Uhr gibt es noch keine Messung.'); return; }
    var out;
    try {
      var rk = kalById(w.kaliberId);
      out = window.TickwerkReport.build({
        watch: w, kal: rk, liftState: liftState(w.id ? w : null), meas: items, appVersion: APP_VERSION + (FLAVOR === 'test' ? ' (Test)' : ''),
        engineVersion: engineVersion, logo: window.TICKWERK_LOGO || null, now: new Date(), subtitle: opt.subtitle, kind: opt.kind,
        lang: LANG, tr: T, kalName: rk ? kName(rk) : '', kalSource: rk ? enSource(rk.quelle) : ''
      });
    } catch (e) {
      bar.textContent = T('Das Protokoll konnte nicht erstellt werden') + ' (' + (e && e.message || e) + ').'; return;
    }
    var blob = new Blob([out.bytes], { type: 'application/pdf' }), file = null;
    try { file = new File([blob], out.filename, { type: 'application/pdf' }); } catch (e) { /* alte Browser */ }
    if (lastReportUrl) URL.revokeObjectURL(lastReportUrl);
    lastReportUrl = URL.createObjectURL(blob);
    var canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    var share = function () { navigator.share({ files: [file], title: 'Tickwerk ' + T('Messprotokoll') + ' ' + w.name }).catch(function () { /* abgebrochen */ }); };
    bar.innerHTML = '<span class="pdfinfo">' + esc(T('Protokoll') + ' ' + out.number + ' · ' + plural(out.pages, 'Seite', 'Seiten') + ' · ' +
      Math.max(1, Math.round(out.bytes.length / 1024)) + ' KB') + '</span>' +
      (canShare ? '<button type="button" data-p="share">' + esc(T('Teilen oder speichern')) + '</button>' : '') +
      '<button type="button" data-p="open">' + esc(T('Öffnen und drucken')) + '</button><button type="button" data-p="dl">' + esc(T('Herunterladen')) + '</button>';
    if (canShare) bar.querySelector('[data-p="share"]').addEventListener('click', share);
    bar.querySelector('[data-p="open"]').addEventListener('click', function () { window.open(lastReportUrl, '_blank', 'noopener'); });
    bar.querySelector('[data-p="dl"]').addEventListener('click', function () {
      var a = document.createElement('a'); a.href = lastReportUrl; a.download = out.filename;
      document.body.appendChild(a); a.click(); a.remove();
    });
    if (opt.share && canShare) share();
  }

  /* ---------- Messungen als Tabelle (CSV, Pro) ----------
     Alle Messungen einer Uhr für Excel, Numbers oder Google Tabellen. Entscheide, damit die Datei ohne Nacharbeit aufgeht:
     - UTF-8 mit BOM: nur so liest Excel Umlaute richtig.
     - Dezimalzeichen wie auf diesem Handy eingestellt (Intl), nicht nach der Sprache der App: Excel liest Zahlen nach der
       Region des Computers, und die ist meist dieselbe wie die des Handys (Schweiz: Punkt, Deutschland: Komma).
     - Trennzeichen Strichpunkt, ausser auf Englisch mit Dezimalpunkt (dort erwartet Excel das Komma). Bewusst ohne die
       Zeile «sep=;»: Mit ihr übergeht Excel das BOM, und andere Programme zeigen sie als Datenzeile.
     - Datum und Zeit als 2026-11-10 und 21:14:05: das versteht jede Region gleich.
     - Text, der mit = + - @ beginnt (der Name der Uhr ist frei wählbar), bekommt ein Hochkomma davor: Sonst würde ihn
       Excel als Formel ausführen. Zahlen schreibt Tickwerk selbst; ein Minus dort bleibt ein Minus.
     - Zeilenende CRLF, Felder mit Trennzeichen, Anführungszeichen oder Umbruch in Anführungszeichen (RFC 4180). */
  var lastCsvUrl = '';
  function csvFormat() {
    var dec = '.';
    try { dec = new Intl.NumberFormat(undefined).format(1.5).replace(/[0-9]/g, '').charAt(0) === ',' ? ',' : '.'; } catch (e) { dec = LANG === 'en' ? '.' : ','; }
    return { dec: dec, sep: dec === '.' && LANG === 'en' ? ',' : ';' };
  }
  function csvText(v) {
    var s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
    return /^[=+\-@\t\r]/.test(s) ? '\'' + s : s;
  }
  function buildCsv(w, list) {
    var f = csvFormat(), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    function num(v, d) { return v == null || !isFinite(v) ? '' : v.toFixed(d).replace('.', f.dec); }
    function cell(v) { var s = String(v); return s.indexOf(f.sep) >= 0 || /["\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    var head = [T('Datum'), T('Zeit'), T('Uhr'), T('Lage'), T('Gang (s/Tag)'), T('Unsicherheit ± (s/Tag)'), T('Gewertet'), T('Abfallfehler (ms)'), T('Amplitude (°)'),
      T('Hebewinkel (°)'), T('Schlagzahl (A/h)'), T('Signal'), T('Dauer (s)'), T('Quelle'), T('Korrektur Handy-Uhr (ppm)'), T('Geeicht mit'), T('Eichung genau auf ± (ppm)'), T('Hinweis'), T('App'), T('Mess-Engine')];
    var CQ = { q: T('Quarzuhr'), z: T('Internetzeit'), h: T('von Hand') };
    var rows = [head.map(function (h) { return csvText(h.charAt(0).toUpperCase() + h.slice(1)); })];
    list.forEach(function (m) {
      var d = new Date(m.date), notes = [];
      if (m.stable === false) notes.push(counted(m) ? shakyText(m) : T('Gang schwankt zu stark'));
      else if (!counted(m)) notes.push(whyNot(m));
      if (m.amp && !m.ampOk) notes.push(T('Amplitude unsicher'));
      if (!m.beOk) notes.push(T('Abfallfehler unsicher'));
      if (m.sess) notes.push(T('Lagen-Test'));
      if (m.gr) notes.push(T('Gangreserve-Test') + ' ' + [T('voll aufgezogen'), T('nach 24 h'), T('nach 36 h')][m.grs || 0]);
      rows.push([
        d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()), p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()),
        csvText(m.watchName || w.name), csvText(POS[m.pos] || m.pos), num(m.rate, 2), num(m.sigma, 2), csvText(T(counted(m) ? 'ja' : 'nein')),
        num(m.be, 2), m.amp ? String(Math.round(m.amp)) : '', num(m.lift, 1), m.bph ? String(m.bph) : '', csvText(T(m.q)), num(m.dur, 1), csvText(T(m.source)),
        m.ppm ? num(m.ppm, 1) : '', csvText(m.ppm && own(CQ, m.cq) ? CQ[m.cq] : ''), m.ppm && m.cu != null ? num(m.cu, 1) : '', csvText(notes.join(', ')), csvText(m.app || ''), csvText(m.eng || '')
      ]);
    });
    return { text: '\uFEFF' + rows.map(function (r) { return r.map(cell).join(f.sep); }).join('\r\n') + '\r\n', format: f, rows: list.length };
  }
  function makeCsv(w, bar) {
    if (!requirePro('csv')) return;
    var items = measOf(w.id ? w : null);
    bar.hidden = false;
    if (!items.length) { bar.textContent = T('Für diese Uhr gibt es noch keine Messung.'); return; }
    var out = buildCsv(w, items), now = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var safe = w.name.replace(/[^\wäöüÄÖÜéèàçùìòâêîôû-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || T('Uhr');
    var name = 'Tickwerk_' + safe + '_' + now.getFullYear() + '-' + p2(now.getMonth() + 1) + '-' + p2(now.getDate()) + '.csv';
    var blob = new Blob([out.text], { type: 'text/csv;charset=utf-8' }), file = null;
    try { file = new File([blob], name, { type: 'text/csv' }); } catch (e) { /* alte Browser */ }
    if (lastCsvUrl) URL.revokeObjectURL(lastCsvUrl);
    lastCsvUrl = URL.createObjectURL(blob);
    var canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    bar.innerHTML = '<span class="pdfinfo">' + esc(T('Tabelle mit {n} · Trennzeichen «{s}», Dezimalzeichen «{d}»', { n: plural(out.rows, 'Messung', 'Messungen'), s: out.format.sep, d: out.format.dec })) + '</span>' +
      (canShare ? '<button type="button" data-p="share">' + esc(T('Teilen oder speichern')) + '</button>' : '') +
      '<button type="button" data-p="dl">' + esc(T('Herunterladen')) + '</button>';
    if (canShare) bar.querySelector('[data-p="share"]').addEventListener('click', function () {
      navigator.share({ files: [file], title: 'Tickwerk ' + w.name }).catch(function () { /* abgebrochen */ });
    });
    bar.querySelector('[data-p="dl"]').addEventListener('click', function () {
      var a = document.createElement('a'); a.href = lastCsvUrl; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
    });
  }

  /* ---------- Zeichnen ---------- */
  function setupCanvas(cv) {
    var dpr = window.devicePixelRatio || 1;
    if (!cv.dataset.h) cv.dataset.h = cv.getAttribute('height');   // logische Höhe merken (Attribut wird mit dpr überschrieben)
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
  function axisNum(v, d) { return Math.abs(v) < 1e-9 ? '0' : signed(v, d); }
  /* Hinweis in einer leeren Grafik: mittig, und auf schmalen Handys auf mehrere Zeilen verteilt statt abgeschnitten */
  function emptyText(g, text) {
    var ctx = g.ctx, max = g.w - 24, lines = [], line = '';
    ctx.save();
    ctx.fillStyle = C.faint; ctx.font = '13px Inter, sans-serif'; ctx.textAlign = 'center';
    String(text).split(' ').forEach(function (word) {
      var t = line ? line + ' ' + word : word;
      if (line && ctx.measureText(t).width > max) { lines.push(line); line = word; } else line = t;
    });
    if (line) lines.push(line);
    lines.forEach(function (l, i) { ctx.fillText(l, g.w / 2, g.h / 2 + 4 + (i - (lines.length - 1) / 2) * 17); });
    ctx.restore();
  }
  function drawTape(cv, trace, emptyMsg) {
    var g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    var L = 50, R = 10, TP = 8, B = 20;
    if (!trace || !trace.length) { emptyText(g, emptyMsg || T('Noch keine Messung')); return; }
    var tMax = 0, ys0 = trace.map(function (p) { return p.devMs; }).sort(function (a, b) { return a - b; });
    trace.forEach(function (p) { if (p.t > tMax) tMax = p.t; });
    var yMin = ys0[Math.floor(ys0.length * 0.02)], yMax = ys0[Math.ceil(ys0.length * 0.98) - 1];   // Ausreisser bestimmen die Skala nicht
    var mid = (yMin + yMax) / 2, half = Math.max(0.8, (yMax - yMin) / 2 * 1.2);
    yMin = mid - half; yMax = mid + half;
    var X = function (t) { return L + (t / (tMax || 1)) * (w - L - R); };
    var Y = function (v) { return TP + (1 - (v - yMin) / (yMax - yMin)) * (h - TP - B); };
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.fillStyle = C.faint; ctx.font = '10px "IBM Plex Mono", monospace';
    var ys = niceStep(yMax - yMin, 3);
    for (var v = Math.ceil(yMin / ys) * ys; v <= yMax; v += ys) {
      var yy = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(w - R, yy); ctx.stroke();
      ctx.fillText(axisNum(v, ys < 1 ? 1 : 0) + ' ms', 2, yy + 3);
    }
    var xs = niceStep(Math.max(tMax, 1), 5);
    for (var s = 0; s <= tMax + 1e-9; s += xs) ctx.fillText(fmt(s, 0) + ' s', Math.min(Math.round(X(s)) - 6, w - R - 28), h - 5);
    trace.forEach(function (p) {
      var yv = Math.max(yMin, Math.min(yMax, p.devMs));
      ctx.fillStyle = p.parity ? C.tock : C.lume;
      ctx.beginPath(); ctx.arc(X(p.t), Y(yv), 1.8, 0, Math.PI * 2); ctx.fill();
    });
  }
  function drawBeat(cv, tpls, liftTimeMs) {
    var g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    var L = 10, R = 10, TP = 18, B = 24;
    if (!tpls) { emptyText(g, T('Noch keine Messung')); return; }
    var lt = liftTimeMs || 0;
    var x0 = -Math.max(6, lt + 3.5), x1 = 5;
    var X = function (ms) { return L + (ms - x0) / (x1 - x0) * (w - L - R); };
    var Y = function (v) { return TP + (1 - v) * (h - TP - B); };
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.setLineDash([3, 4]); ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
    (lt ? [-lt, 0] : [0]).forEach(function (ms) { var xx = Math.round(X(ms)) + 0.5; ctx.beginPath(); ctx.moveTo(xx, TP - 6); ctx.lineTo(xx, h - B); ctx.stroke(); });
    ctx.setLineDash([]);
    ctx.fillStyle = C.muted;
    if (lt) ctx.fillText(T('Auslösung'), X(-lt) + 4, TP + 2);
    ctx.fillText(T('Fall'), X(0) + 4, TP + 2);
    ctx.fillStyle = C.faint;
    if (lt) ctx.fillText(T('Hebezeit {v} ms', { v: fmt(lt, 2) }), X(-lt) + 4, h - 7);
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
  function drawHistory(items) {
    var cv = $('historyChart'), g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    var L = 46, R = 10, TP = 10, B = 20;
    if (!items.length) { emptyText(g, T('Noch keine Messungen')); return; }
    var lo = -8, hi = 10;
    items.forEach(function (m) { lo = Math.min(lo, m.rate - m.sigma); hi = Math.max(hi, m.rate + m.sigma); });
    lo = Math.max(lo, -60); hi = Math.min(hi, 60);
    var X = function (i) { return items.length === 1 ? (L + w - R) / 2 : L + i / (items.length - 1) * (w - L - R); };
    var Y = function (v) { return TP + (1 - (v - lo) / (hi - lo)) * (h - TP - B); };
    ctx.fillStyle = C.band; ctx.fillRect(L, Y(6), w - L - R, Y(-4) - Y(6));
    ctx.strokeStyle = C.line; ctx.fillStyle = C.faint; ctx.font = '11px "IBM Plex Mono", monospace';
    var st = niceStep(hi - lo, 4);
    for (var v = Math.ceil(lo / st) * st; v <= hi; v += st) {
      var yy = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(w - R, yy); ctx.stroke();
      ctx.fillText(axisNum(v, 0) + ' s', 2, yy + 4);
    }
    ctx.fillText(dateStr(items[0].date), L, h - 5);
    items.forEach(function (m, i) {
      var x = X(i), y = Y(Math.max(lo, Math.min(hi, m.rate)));
      ctx.strokeStyle = C.faint; ctx.beginPath();
      ctx.moveTo(x, Y(Math.max(lo, m.rate - m.sigma))); ctx.lineTo(x, Y(Math.min(hi, m.rate + m.sigma))); ctx.stroke();
      ctx.fillStyle = counted(m) ? C.lume : C.faint;
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    });
  }
  /* Verlauf im Regulier-Modus: der Gang der letzten Minuten, Lücken (kein klares Ticken) unterbrechen die Linie */
  function drawTrend(cv, pts, tNow) {
    var g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    var L = 46, R = 10, TP = 10, B = 20;
    var span = Math.min(REG_SPAN, Math.max(60, tNow)), x0 = Math.max(0, tNow - span);
    var vis = pts.filter(function (p) { return p.t >= x0 - 0.01; }), ok = vis.filter(function (p) { return !p.gap; });
    if (!ok.length) { emptyText(g, T('Der Verlauf erscheint, sobald Tickwerk misst.')); return; }
    var lo = Infinity, hi = -Infinity;
    ok.forEach(function (p) { var e = Math.min(p.sigma, 5); lo = Math.min(lo, p.rate - e); hi = Math.max(hi, p.rate + e); });
    var mid = (lo + hi) / 2, half = Math.max(5, (hi - lo) / 2 * 1.15);
    lo = Math.max(-150, mid - half); hi = Math.min(150, mid + half);
    var X = function (t) { return L + (t - x0) / span * (w - L - R); };
    var Y = function (v) { return TP + (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (h - TP - B); };
    if (6 > lo && -4 < hi) { ctx.fillStyle = C.band; ctx.fillRect(L, Y(6), w - L - R, Y(-4) - Y(6)); }
    ctx.font = '10px "IBM Plex Mono", monospace'; ctx.lineWidth = 1;
    var st = niceStep(hi - lo, 4);
    for (var v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) {
      var yy = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = Math.abs(v) < 1e-9 ? C.line2 : C.line; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(w - R, yy); ctx.stroke();
      ctx.fillStyle = C.faint; ctx.fillText(axisNum(v, st < 1 ? 1 : 0) + ' s', 2, yy + 3);
    }
    var xs = span > 90 ? 60 : 30;
    for (var s = Math.ceil(x0 / xs) * xs; s <= x0 + span + 1e-9; s += xs) {
      var xx = X(s), label = mmss(s);
      ctx.fillStyle = C.faint; ctx.fillText(label, Math.max(L, Math.min(xx - 12, w - R - 28)), h - 5);
    }
    ctx.strokeStyle = C.faint;
    ok.forEach(function (p) { var x = X(p.t); ctx.beginPath(); ctx.moveTo(x, Y(p.rate - p.sigma)); ctx.lineTo(x, Y(p.rate + p.sigma)); ctx.stroke(); });
    ctx.strokeStyle = C.lume; ctx.lineWidth = 1.5; ctx.beginPath();
    var pen = false;
    vis.forEach(function (p) {
      if (p.gap) { pen = false; return; }
      if (!pen) { ctx.moveTo(X(p.t), Y(p.rate)); pen = true; } else ctx.lineTo(X(p.t), Y(p.rate));
    });
    ctx.stroke();
    ok.forEach(function (p, i) {
      var last = i === ok.length - 1;
      ctx.fillStyle = C.lume; ctx.beginPath(); ctx.arc(X(p.t), Y(p.rate), last ? 4 : 2.2, 0, Math.PI * 2); ctx.fill();
    });
  }
  function drawLagenChart(st) {
    var cv = $('lagenChart'), g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    var L = 40, R = 8, TP = 18, B = 26, rows = st.rows;
    var vals = [];
    rows.forEach(function (r) { if (r.m) vals.push(r.m.rate - r.m.sigma, r.m.rate + r.m.sigma); });
    var lo = Math.min(-8, Math.min.apply(null, vals.concat([0]))), hi = Math.max(10, Math.max.apply(null, vals.concat([0])));
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    var X = function (i) { return L + (i + 0.5) / rows.length * (w - L - R); };
    var Y = function (v) { return TP + (1 - (v - lo) / (hi - lo)) * (h - TP - B); };
    ctx.fillStyle = C.band; ctx.fillRect(L, Y(6), w - L - R, Y(-4) - Y(6));
    ctx.font = '10px "IBM Plex Mono", monospace'; ctx.lineWidth = 1;
    var step = niceStep(hi - lo, 4);
    for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      var yy = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = v === 0 ? C.line2 : C.line; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(w - R, yy); ctx.stroke();
      ctx.fillStyle = C.faint; ctx.fillText(axisNum(v, 0), 4, yy + 3);
    }
    if (st.mean != null) {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = C.muted;
      var ym = Math.round(Y(st.mean)) + 0.5; ctx.beginPath(); ctx.moveTo(L, ym); ctx.lineTo(w - R, ym); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.textAlign = 'center';
    rows.forEach(function (r, i) {
      var x = X(i);
      ctx.fillStyle = C.faint; ctx.fillText(r.pos, x, h - 8);
      if (!r.m) return;
      var ok = counted(r.m), col = ok ? (HORIZ[r.pos] ? C.lume : C.tock) : C.faint;
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(x, Y(r.m.rate - r.m.sigma)); ctx.lineTo(x, Y(r.m.rate + r.m.sigma)); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, Y(r.m.rate), ok ? 4.5 : 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.text; ctx.fillText(signed(r.m.rate, 1), x, Y(r.m.rate + r.m.sigma) - 6);
    });
    ctx.textAlign = 'start';
  }
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var s = topScreen();
      if (s === 'measure' && !rec) redrawMeasure();
      else if (s === 'history') drawHistory(isPro() ? filteredMeas().slice(-40) : filteredMeas().slice(-FREE_HISTORY));
      else if (s === 'lagen' && session && !$('lResult').hidden) drawLagenChart(lagenStats(SETS[session.set], sessByPos()));
      else if (s === 'lpos' && !rec) renderLpos(top().p);
      else if (s === 'reg' && reg) { drawTrend($('rTrend'), reg.pts, reg.t); if (reg.last) drawTape($('rTape'), reg.last.trace); }
    }, 150);
  });
  $('mDetails').addEventListener('toggle', function () { if (this.open && lastShown) drawBeat($('mBeat'), lastShown.r.templates, lastShown.r.liftTimeMs); });

  /* ---------- Installieren und neue Version ---------- */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; $('installBtn').hidden = false; });
  $('installBtn').addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () { deferredPrompt = null; $('installBtn').hidden = true; });
  });
  window.addEventListener('appinstalled', function () { $('installBtn').hidden = true; });

  /* Nach Update suchen (unter «Mehr»): Der Browser prüft von selbst nur beim Öffnen der App, ob es eine neue Version gibt.
     Der Knopf stösst die Prüfung sofort an und sagt, was herauskam: aktuell, gefunden (wird geladen), bereit (neu laden),
     keine Verbindung, oder hier nicht möglich (kein https, kein Offline-Speicher). */
  var swReg = null, updReady = false, updBusy = false, updMsg = null;
  function setUpd(text, kind) { $('updState').textContent = text; $('updState').setAttribute('data-kind', kind || ''); }
  function renderUpd() {
    if (updBusy) return;
    if (updReady) setUpd(T('Die neue Version ist bereit. Unten «Neue Version: neu laden» tippen.'), 'ok');
    else if (updMsg) setUpd(updMsg.text, updMsg.kind);
    else setUpd(T('Installiert ist Version {v}', { v: APP_VERSION }), '');
  }
  /* Eine neue Version ist geladen und aktiv: Knopf zum Neuladen anbieten (nie mitten in einer Messung von selbst neu laden) */
  function updIsReady() {
    if (updReady) return;
    updReady = true; updBusy = false;
    $('updateBtn').hidden = false;
    renderUpd();
    toast(T('Eine neue Version von Tickwerk ist bereit. Unter «Mehr» neu laden.'));
  }
  function updCheck() {
    if (updBusy || updReady) { renderUpd(); return; }
    if (!swReg) { updMsg = { text: T('Hier gibt es keine Updates: Tickwerk läuft nicht über https.'), kind: 'warn' }; renderUpd(); return; }
    if (navigator.onLine === false) { updMsg = { text: T('Keine Verbindung. Mit dem Internet verbinden und nochmals suchen.'), kind: 'warn' }; renderUpd(); return; }
    updBusy = true; setUpd(T('Suche nach einer neuen Version …'), '');
    var over = false, timer = setTimeout(function () { end(T('Keine Antwort vom Server. Später nochmals suchen.'), 'warn'); }, 25000);
    function end(text, kind) {
      if (over) return;
      over = true; clearTimeout(timer); updBusy = false;
      updMsg = text ? { text: text, kind: kind } : null;
      renderUpd();
    }
    swReg.update().then(function () {
      var nw = swReg.installing || swReg.waiting;
      if (updReady) { end('', ''); return; }
      if (!nw) { end(T('Tickwerk ist aktuell: Version {v}, geprüft um {t}.', { v: APP_VERSION, t: timeStr(new Date()) }), 'ok'); return; }
      setUpd(T('Neue Version gefunden. Sie wird geladen …'), '');
      nw.addEventListener('statechange', function () {
        if (nw.state === 'activated') { end('', ''); updIsReady(); }
        else if (nw.state === 'redundant') end(T('Die neue Version konnte nicht geladen werden. Später nochmals suchen.'), 'warn');
      });
    }).catch(function () { end(T('Keine Verbindung zum Server. Später nochmals suchen.'), 'warn'); });
  }
  $('updCheck').addEventListener('click', updCheck);
  $('updateBtn').addEventListener('click', function () { if (!rec && !busy) location.reload(); });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadController) updIsReady(); });
    navigator.serviceWorker.register('sw.js').then(function (r) { swReg = r; }).catch(function () { /* ohne Offline-Modus weiter */ });
  }

  /* ---------- «Modell fehlt?» (0.6.5) ----------
     Wer seine Uhr nicht findet, kann Modell und Werk melden. Die App hat dafür keinen Server: Der Knopf ist ein Link, der
     das Mailprogramm mit fertigem Text öffnet, an die Adresse aus der Konfiguration (kontakt). Ohne gültige Adresse bleibt
     alles verborgen. Es verlässt nichts das Handy, bevor im Mailprogramm «Senden» getippt wird. */
  var KONTAKT = typeof CFG.kontakt === 'string' && /^[A-Za-z0-9._+-]{1,64}@[A-Za-z0-9-]{1,63}(\.[A-Za-z0-9-]{1,63}){1,4}$/.test(CFG.kontakt) ? CFG.kontakt : '';
  function missMail() {
    var line = function (label, id) { var v = $(id).value.replace(/[\r\n]+/g, ' ').trim(); return label + ': ' + (v || '–'); };
    var body = [line(T('Marke und Modell'), 'msModel'), line(T('Werk'), 'msCal'), line(T('Quelle oder Hinweis'), 'msSrc'), '',
      'Tickwerk ' + APP_VERSION + ' · ' + LANG + ' · ' + T('{u} Modelle im Katalog', { u: UHREN.length })].join('\n');
    return 'mailto:' + KONTAKT + '?subject=' + encodeURIComponent('Tickwerk: ' + T('Modell fehlt')) + '&body=' + encodeURIComponent(body);
  }
  function missUpdate() { $('msSend').href = KONTAKT ? missMail() : '#'; }
  $('wMissing').hidden = !KONTAKT;
  $('wMissing').addEventListener('click', function () {
    if (!KONTAKT) return;
    $('msModel').value = ($('wFind').value || $('wName').value || '').trim().slice(0, 80);
    $('msCal').value = (calSel ? calSel.name : $('wCalFind').value || '').trim().slice(0, 80);
    $('msSrc').value = '';
    hideSuggest(); missUpdate();
    openSheet('missSheet');
  });
  ['msModel', 'msCal', 'msSrc'].forEach(function (id) { $(id).addEventListener('input', missUpdate); });
  $('msSend').addEventListener('click', function (e) {
    if (!KONTAKT || !$('msModel').value.trim()) { e.preventDefault(); $('msModel').focus(); return; }
    missUpdate();
    setTimeout(function () { if (sheetOpen === 'missSheet') closeSheet(); }, 300);   /* der Link öffnet das Mailprogramm; danach das Blatt schliessen */
  });
  $('msClose').addEventListener('click', function () { closeSheet(); });

  /* ---------- Was ist neu ----------
     Einmal nach einem Update zeigen, was dazugekommen ist und wo es zu finden ist; jederzeit unter «Mehr». Bei einer
     neuen Installation nicht (dort erklärt die Anleitung den Einstieg). settings.seenVersion merkt sich die Version. */
  var NEWS_ORDER = ['0.6.6', '0.6.5', '0.6.4'];   /* neuste zuerst; die älteren stehen im Blatt darunter, falls ein Update übersprungen wurde */
  var NEWS = {
    '0.6.6': [
      { t: T('Eichen ohne Quarzuhr'), s: T('Unter «Handy-Uhr eichen» gibt es neu «Mit Internetzeit eichen». Das Handy liegt eine Stunde am Ladegerät; Tickwerk vergleicht den Takt des Mikrofons mit der genauen Zeit aus dem Internet. Wie genau das Ergebnis ist, zeigt Tickwerk an; das Ziel nach einer Stunde ist etwa ± 1 ppm, das sind ± 0,1 s/Tag.') }
    ].concat(NET_SVC_HOST ? [
      { t: T('Zeit von einem öffentlichen Zeitdienst'), s: T('Die genaue Zeit holt Tickwerk neu zuerst beim öffentlichen Zeitdienst {a} und erst, wenn er nicht antwortet, beim Server der App. Darum fragt Tickwerk beim nächsten Mal nochmals, ob du einverstanden bist.', { a: NET_SVC_HOST }) }
    ] : []),
    '0.6.5': [
      { t: T('Genaue Zeit für den Gang im Alltag'), s: T('Auf Wunsch holt Tickwerk beim Zeitvergleich die genaue Zeit aus dem Internet. Die Uhr des Handys kann bis etwa zwei Sekunden danebenliegen; mit der genauen Zeit stimmt der Gang im Alltag schon nach wenigen Tagen. Tickwerk fragt beim nächsten Vergleich, ob du das möchtest.') },
      { t: T('Quarzuhr als Referenz'), s: T('Eine Uhr lässt sich jetzt als Quarzuhr anlegen. Kennt Tickwerk nach etwa einer Woche ihren Gang, kannst du ihn unter «Handy-Uhr eichen» übernehmen: Die Eichung wird damit rund zehnmal genauer.') },
      { t: T('Werksvorgabe deines Werks'), s: T('Für rund 20 Werke kennt Tickwerk jetzt den Gang, den der Hersteller erlaubt, zum Beispiel von Seiko, Miyota, Orient, Oris und Rolex. Die Vorgabe steht beim Werk. Verglichen wird beim Gang im Alltag und im Lagen-Test, nicht bei der einzelnen Messung.') },
      { t: T('Modell fehlt?'), s: T('Findest du deine Uhr in der Suche nicht, kannst du sie beim Anlegen mit «Modell fehlt? Melden» per E-Mail melden.') }
    ],
    '0.6.4': [
      { t: T('Viel mehr Uhren und Werke'), s: T('Die Suche kennt jetzt {u} Modelle von {m} Marken und {k} Werke, darunter viele ältere. Aufgenommen ist nur, wofür eine Quelle das verbaute Werk nennt.',
        { u: UHREN.length, m: UHREN.map(function (u) { return u.marke; }).filter(function (m, i, a) { return a.indexOf(m) === i; }).length, k: KAL.length }) },
      { t: T('Vergleich mit den ETA-Stufen'), s: T('Der Lagen-Test zeigt jetzt, welche Qualitätsstufe von ETA dein Ergebnis erfüllt: Standard, Elaboré oder Top. Für «Top» den Test mit 6 Lagen machen. Der Gangreserve-Test vergleicht dazu, wie stark sich der Gang in 24 Stunden ändert. Ein Vergleich, kein Zertifikat.') },
      { t: T('Markenkaliber finden'), s: T('Die Suche findet jetzt auch Markenkaliber wie Tudor T600, Oris 798 oder Alpina AL-525 und zeigt das Werk, auf dem sie beruhen.') },
      { t: T('Hebewinkel: bestätigt oder unbestätigt'), s: T('Wo sich zwei Quellen widersprechen, steht der Hebewinkel jetzt als «unbestätigt» da. Einige Werte sind neu, zum Beispiel 36° für das Omega 8800. Gespeicherte Uhren behalten ihren Wert. Zum Übernehmen bei der Uhr das Werk neu wählen.') }
    ],
    '0.6.3': [
      { t: T('Kein grober Wert mehr nach einer Lücke'), s: T('Fehlt das Ticken vier Sekunden oder länger, zum Beispiel weil das Handy verrutscht ist, zeigt Tickwerk keinen Wert mehr, sondern sagt, wann die Lücke war.') },
      { t: T('Unsichere Messung läuft von selbst weiter'), s: T('Ist der Wert nach der gewählten Messdauer noch zu unsicher, misst Tickwerk weiter, höchstens bis 60 Sekunden. Ausschalten unter Einstellungen.') },
      { t: T('Messungen als Tabelle'), s: T('Auf der Seite der Uhr unter «Letzte Messungen»: «Tabelle (CSV)» speichert alle Messungen der Uhr für Excel. Gehört zu Tickwerk Pro.') },
      { t: T('Nach Update suchen'), s: T('Unter «Mehr»: zeigt, ob die neuste Version installiert ist, und lädt eine neue.') },
      { t: T('Diagnose teilen'), s: T('Unter «Mehr»: Version, Handy, Mikrofon und die letzten Fehler als Text, falls einmal etwas nicht klappt.') }
    ]
  };
  function showNews() {
    var ul = $('nsList');
    $('nsTitle').textContent = T('Version') + ' ' + APP_VERSION;
    ul.innerHTML = '';
    NEWS_ORDER.forEach(function (v, i) {
      if (i) { var h = document.createElement('li'); h.className = 'news-v'; h.textContent = T('Version') + ' ' + v; ul.appendChild(h); }
      (NEWS[v] || []).forEach(function (it) {
        var li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('span');
        a.className = 'news-t'; a.textContent = it.t; b.className = 'news-s'; b.textContent = it.s;
        li.appendChild(a); li.appendChild(b); ul.appendChild(li);
      });
    });
    openSheet('newsSheet');
  }
  /* Beim Start: true, wenn das Blatt gezeigt wurde (dann kommen die übrigen Hinweise erst beim nächsten Start) */
  function newsOnStart() {
    if (settings.seenVersion === APP_VERSION) return false;
    var isUpdate = !!settings.seenVersion || settings.guideSeen;   /* schon benutzt: ein Update. Sonst neu installiert */
    if (isUpdate && NEWS[APP_VERSION]) {
      if (sheetOpen || rec || busy || topScreen() !== 'measure') return false;   /* gerade beschäftigt: beim nächsten Start zeigen */
      settings.seenVersion = APP_VERSION; saveSettings();
      showNews();
      return true;
    }
    settings.seenVersion = APP_VERSION; saveSettings();
    return false;
  }
  $('newsBtn').addEventListener('click', showNews);
  $('nsClose').addEventListener('click', function () { closeSheet(); });

  /* ---------- Diagnose teilen ----------
     Ein Text mit allem, was bei der Fehlersuche hilft: Version, Handy, Mikrofon, Eichung, die letzten Messungen (ohne
     Namen der Uhren) und die letzten Fehler. Er wird zuerst angezeigt und verlässt das Handy nur über «Teilen» oder
     «Kopieren». Fragen an den Browser, die warten lassen könnten (Gerät, Speicher, Erlaubnis), haben eine Frist von 1,5 s. */
  function soon(make, fallback) {
    return new Promise(function (resolve) {
      var done = false, t = setTimeout(function () { if (!done) { done = true; resolve(fallback); } }, 1500);
      function fin(v) { if (!done) { done = true; clearTimeout(t); resolve(v); } }
      try { Promise.resolve(make()).then(function (v) { fin(v == null ? fallback : v); }, function () { fin(fallback); }); } catch (e) { fin(fallback); }
    });
  }
  function diagStamp(iso) {
    var d = new Date(iso), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function diagDevice() {
    var ud = navigator.userAgentData;
    if (!ud || !ud.getHighEntropyValues) return Promise.resolve(logLine(navigator.userAgent));
    return ud.getHighEntropyValues(['model', 'platformVersion', 'fullVersionList']).then(function (h) {
      var br = (h.fullVersionList || ud.brands || []).filter(function (b) { return !/not.?a.?brand/i.test(b.brand) && b.brand !== 'Chromium'; })[0];
      return logLine([h.model, (ud.platform || '') + ' ' + (h.platformVersion || ''), br ? br.brand + ' ' + br.version : ''].map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' · ')) ||
        logLine(navigator.userAgent);
    });
  }
  function diagText() {
    var yn = function (b) { return T(b ? 'ja' : 'nein'); };
    return Promise.all([
      soon(diagDevice, logLine(navigator.userAgent)),
      soon(function () { return navigator.storage.estimate(); }, {}),
      soon(function () { return navigator.storage.persisted(); }, null),
      soon(function () { return navigator.permissions.query({ name: 'microphone' }).then(function (st) { return st.state; }); }, ''),
      soon(function () { return caches.keys(); }, [])
    ]).then(function (r) {
      var L = [], cal = calOf(''), est = r[1] || {}, perm = { granted: T('erteilt'), denied: T('verweigert'), prompt: T('noch nicht gefragt') }[r[3]] || T('unbekannt');
      var build = (Array.isArray(r[4]) ? r[4] : []).filter(function (k) { return /^tickwerk-[a-z]+-[0-9a-f]{6,12}$/.test(k); }).join(', ');
      var last = meas.slice(-5).reverse(), standalone = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
      L.push('Tickwerk ' + APP_VERSION + ' (' + (FLAVOR === 'test' ? T('Testversion') : 'Google Play') + ') · ' + T('Mess-Engine') + ' ' + (engineVersion || '?'));
      L.push(T('Stand') + ': ' + diagStamp(new Date().toISOString()) + (build ? ' · ' + build : ''));
      L.push(T('Sprache') + ': ' + LANG + ' (' + T('Handy') + ': ' + logLine(navigator.language || '?').slice(0, 20) + ')');
      L.push(T('Gerät') + ': ' + r[0]);
      L.push(T('Als App installiert') + ': ' + yn(standalone) + ' · ' + T('online') + ': ' + yn(navigator.onLine !== false) + ' · ' + T('Bildschirm') + ': ' +
        window.innerWidth + ' × ' + window.innerHeight + ' (' + (window.devicePixelRatio || 1).toFixed(2) + ')');
      L.push(T('Mikrofon') + ': ' + T(isPro() && settings.micId ? 'gewählt' : 'eingebaut') + ' · ' + T('Erlaubnis') + ': ' + perm +
        (lastRec && lastRec.fs ? ' · ' + T('letzte Aufnahme') + ' ' + Math.round(lastRec.fs) + ' Hz' : ''));
      var acc = calAcc(cal), nl = settings.netLast;
      L.push(T('Eichung') + ': ' + (cal.ppm ? signed(cal.ppm, 1) + ' ppm' + (cal.at ? ' (' + diagStamp(cal.at).slice(0, 10) + ')' : '') +
        ' · ' + T(cal.src === 'zeit' ? 'Internetzeit' : cal.raw != null ? 'Quarzuhr' : 'von Hand') + (acc ? ' · ± ' + fmt(acc.ppm, 1) + ' ppm' : '') : T('keine')) +
        ' · ' + T('Gang der Quarzuhr') + ': ' + (settings.quartzSrc ? signed(settings.quartzRate, 2) + ' (' + T(settings.quartzSrc === 'uhr' ? 'Gang im Alltag' : 'von Hand') + ')' : T('unbekannt')) +
        ' · ' + T('weitere Mikrofone') + ': ' + Object.keys(settings.cal).length);
      L.push(T('Internetzeit') + ': ' + T(netOn() ? 'ein' : netAsked() ? 'aus' : 'noch nicht gefragt') + (FLAVOR === 'test' && settings.netPick ? ' (' + T(settings.netPick === 'a' ? 'nur Zeitdienst' : 'nur Server der App') + ')' : '') + ' · ' + T('letzte Abfrage') + ': ' +
        (!nl ? '–' : diagStamp(nl.at) + ' · ' + (nl.ok ? netSrcName(nl.src) + ' · ' + nl.n + ' ' + T('Antworten') + ' · ± ' + nl.unc + ' ms · ' + T('Laufzeit') + ' ' + nl.rtt + ' ms · ' +
          T('Handy-Uhr') + ' ' + (nl.ph < 0 ? '−' : '+') + Math.abs(nl.ph) + ' ms' : T('gescheitert') + (nl.why ? ' (' + nl.why + ')' : ''))));
      var cz = settings.calZeit;
      L.push(T('Eichung mit Internetzeit') + ': ' + (!cz ? '–' : diagStamp(cz.at) + ' · ' + (cz.ok ? signed(cz.ppm, 1) + ' ppm ± ' + fmt(cz.sig, 1) : T('gescheitert') + (cz.why ? ' (' + cz.why + ')' : '')) +
        ' · ' + fmt(cz.min, 0) + ' min · ' + cz.k + ' ' + T('Zeitabfragen') + (cz.src ? ' (' + netSrcName(cz.src) + (cz.grp > 1 ? ' +' + (cz.grp - 1) : '') + ')' : '') + ' · ' + T('Mikrofon gegen Handy-Uhr') + ' ' + signed(cz.audio, 1) + ' ppm · ' +
        T('Handy-Uhr gegen Zeit') + ' ' + signed(cz.clock, 1) + ' ppm · ' + T(cz.kind === 'm' ? 'Samples der Mikrofon-Spur' : 'Samples der Tonausgabe') + ' · ' + T('Sprünge') + ' ' + cz.steps));
      L.push(T('Einstellungen') + ': ' + settings.dur + ' s · ' + T('automatischer Start') + ' ' + yn(settings.autoStart) + ' · ' + T('verlängern') + ' ' + yn(settings.extend) + ' · ' + settings.pos);
      L.push(T('Daten') + ': ' + plural(watches.length, 'Uhr', 'Uhren') + ' · ' + plural(meas.length, 'Messung', 'Messungen') + ' · Pro: ' + yn(isPro()));
      L.push(T('Speicher') + ': ' + T('dauerhaft') + ' ' + (r[2] == null ? '?' : yn(r[2])) + (est.usage ? ' · ' + fmt(est.usage / 1048576, 1) + ' MB' : '') +
        ' · ' + T('Update bereit') + ': ' + yn(updReady));
      L.push('');
      L.push(T('Letzte Messungen') + ':');
      if (!last.length) L.push('  –');
      last.forEach(function (m) {
        L.push('  ' + diagStamp(m.date) + ' · ' + m.pos + ' · ' + signed(m.rate, 2) + ' ± ' + fmt(m.sigma, 2) + ' · ' + qText(m.q) + (m.stable === false ? ' (' + T('schwankt') + ')' : '') +
          ' · ' + Math.round(m.dur) + ' s · ' + m.bph + ' · ' + (m.fs ? Math.round(m.fs) + ' Hz · ' : '') + T(m.source) + ' · ' + (m.app || '?') + '/' + (m.eng || '?'));
      });
      L.push('');
      L.push(T('Letzte Fehler') + ':');
      if (!errLog.length) L.push('  –');
      /* Versprochen ist: keine Namen der Uhren. Die App schreibt keine ins Protokoll; eine technische Meldung des Browsers
         (das Feld x) könnte aber ein Stück gespeicherter Daten zitieren. Darum dort jeden bekannten Namen ersetzen. */
      var names = Object.create(null);
      watches.forEach(function (w) { names[w.name] = 1; });
      meas.forEach(function (m) { if (m.watchName) names[m.watchName] = 1; });
      names = Object.keys(names).filter(function (n) { return n.length >= 3; }).sort(function (a, b) { return b.length - a.length; });
      function noNames(x) { names.forEach(function (n) { x = x.split(n).join('…'); }); return x; }
      errLog.slice().reverse().forEach(function (e) { L.push('  ' + diagStamp(e.t) + ' · ' + T(e.m) + (e.x ? ' (' + noNames(e.x) + ')' : '')); });
      return L.join('\n');
    });
  }
  function diagOpen() {
    $('dgText').textContent = T('Einen Moment …'); $('dgOut').textContent = '';
    $('dgShare').hidden = !navigator.share; $('dgShare').disabled = true; $('dgCopy').disabled = true;
    openSheet('diagSheet');
    diagText().then(function (txt) {
      $('dgText').textContent = txt;
      $('dgShare').disabled = false; $('dgCopy').disabled = false;
    });
  }
  function diagCopied(ok) { $('dgOut').textContent = ok ? T('Kopiert. Jetzt in eine Nachricht einfügen.') : T('Kopieren ging nicht. Den Text lange antippen und von Hand kopieren.'); }
  $('diagBtn').addEventListener('click', diagOpen);
  $('dgClose').addEventListener('click', function () { closeSheet(); });
  $('dgShare').addEventListener('click', function () {
    if (!navigator.share) return;
    navigator.share({ title: 'Tickwerk ' + T('Diagnose'), text: $('dgText').textContent }).catch(function () { /* abgebrochen */ });
  });
  $('dgCopy').addEventListener('click', function () {
    var txt = $('dgText').textContent;
    function legacy() {   /* ohne Zwischenablage-Schnittstelle: Text markieren und den Browser kopieren lassen */
      var ok = false;
      try {
        var rg = document.createRange(), sel = window.getSelection();
        rg.selectNodeContents($('dgText')); sel.removeAllRanges(); sel.addRange(rg);
        ok = document.execCommand('copy'); sel.removeAllRanges();
      } catch (e) { ok = false; }
      diagCopied(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { diagCopied(true); }, legacy);
    else legacy();
  });

  /* ---------- Start ---------- */
  var RENDER = { measure: renderMeasure, watches: renderWatches, watch: renderDetail, edit: renderEdit, lagen: renderLagen, lpos: renderLpos, reg: renderReg, zeit: renderZeit, detektiv: renderDetektiv, guide: function () {},
    more: renderMore, pro: renderPro, history: renderHistory, settings: renderSettings, eichen: renderEichen };
  if (FLAVOR === 'test') {
    var row = document.createElement('span'), badge = document.createElement('span');
    row.className = 'eyebrow-row'; badge.className = 'test-badge'; badge.textContent = 'TEST';
    $('mState').parentNode.insertBefore(row, $('mState')); row.appendChild($('mState')); row.appendChild(badge);
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(function (p) { return p || navigator.storage.persist(); }).catch(function () {}); } catch (e) { /* egal */ }
  clearReadout();
  setStatus('status', idleHint(), '');
  if (location.hash === '#mehr') { stack = [{ s: 'more', p: {} }]; history.replaceState({ tw: 0 }, '', location.pathname + location.search); }
  render();
  if (!settings.guideSeen) { newsOnStart(); go('guide'); }   /* neu installiert: nichts zu zeigen, nur die Version merken */
  else setTimeout(function () {
    if (newsOnStart()) return;   /* nach einem Update zuerst «Was ist neu»; die übrigen Hinweise kommen beim nächsten Start */
    for (var i = 0; i < watches.length; i++) {
      var dt = dueText(watches[i]);
      if (dt) { toast(T('Bei «{w}»: {x}', { w: watches[i].name, x: dt })); return; }
    }
    /* Eichung über ein halbes Jahr alt: höchstens einmal im Monat daran erinnern */
    if (calOld(calOf(micKey())) && (!settings.calNag || Date.now() - new Date(settings.calNag).getTime() > CAL_NAG_DAYS * 86400000)) {
      settings.calNag = new Date().toISOString(); saveSettings();
      toast(T('Die Eichung der Handy-Uhr ist über sechs Monate alt. Neu eichen unter Mehr, «Handy-Uhr eichen».'));
    }
  }, 1200);
  if (FLAVOR === 'store') {
    billingInit().then(function () { return restorePurchases(); }).then(function (res) {
      if (res === 'restored') afterProChange();
      else if (topScreen() === 'pro') renderPro();
    });
  }
  runJob({ samples: new Float32Array(48000 * 5), fs: 48000, opts: {} }).then(function () { if (topScreen() === 'more') renderMore(); });
})();
