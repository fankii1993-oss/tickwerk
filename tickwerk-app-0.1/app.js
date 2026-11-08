/* Tickwerk Web-App 0.4: Messen, Lagen-Test, Uhren, Verlauf, Pro. */
(function () {
  'use strict';

  /* Nicht eingebettet in fremden Seiten laufen (Schutz vor untergeschobenen Klicks) */
  if (window.top !== window.self) {
    document.documentElement.className += ' framed';
    var fm = document.createElement('p'), fa = document.createElement('a');
    fm.className = 'framed-msg'; fa.href = location.href; fa.target = '_blank'; fa.rel = 'noopener';
    fa.textContent = 'Tickwerk in einem eigenen Fenster öffnen';
    fm.appendChild(fa); document.body.appendChild(fm);
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var KAL = window.TICKWERK_KALIBER || [];
  var UHREN = window.TICKWERK_UHREN || [];
  var CFG = window.TICKWERK_CONFIG || {};
  var FLAVOR = CFG.flavor === 'store' ? 'store' : 'test';
  var APP_VERSION = '0.4.3';
  var PREFIX = typeof CFG.storage === 'string' && /^[a-z][a-z0-9.]{2,30}$/.test(CFG.storage) ? CFG.storage : 'tickwerk.v1';
  var KEYS = { watches: PREFIX + '.watches', meas: PREFIX + '.measurements', settings: PREFIX + '.settings', session: PREFIX + '.session', pro: PREFIX + '.pro' };
  var PRO_SKU = typeof CFG.proSku === 'string' && /^[a-z0-9._]{1,40}$/.test(CFG.proSku) ? CFG.proSku : 'tickwerk_pro';
  var BACKEND = typeof CFG.billingBackend === 'string' && /^https:\/\/[A-Za-z0-9.\-]+(:\d+)?(\/[A-Za-z0-9._\-\/]*)?$/.test(CFG.billingBackend) ? CFG.billingBackend : '';
  var PRICE = typeof CFG.price === 'string' ? CFG.price.slice(0, 20) : 'CHF 9.–';
  var FREE_PER_WEEK = 3, FREE_HISTORY = 5, FREE_DETAIL = 3, MAX_MEAS = 3000, MAX_WATCHES = 200, TRACE_KEEP = 40;
  var POS = { ZO: 'Zifferblatt oben', ZU: 'Zifferblatt unten', KU: 'Krone unten', KO: 'Krone oben', KL: 'Krone links', KR: 'Krone rechts' };
  var POS_HINT = {
    ZO: 'Uhr flach hinlegen, Zifferblatt nach oben. Die Unterkante des Handys an die Krone.',
    ZU: 'Uhr umdrehen, Zifferblatt nach unten, am besten auf ein weiches Tuch.',
    KU: 'Uhr aufstellen, die Krone zeigt nach unten. Zum Beispiel zwischen zwei Bücher klemmen.',
    KO: 'Uhr aufstellen, die Krone zeigt nach oben.',
    KL: 'Uhr aufstellen, die Krone zeigt nach links. Die 6 steht oben.',
    KR: 'Uhr aufstellen, die Krone zeigt nach rechts. Die 12 steht oben.'
  };
  var HORIZ = { ZO: true, ZU: true };
  var POS_ORDER = ['ZO', 'ZU', 'KU', 'KO', 'KL', 'KR'];
  var SETS = { 4: ['ZO', 'ZU', 'KU', 'KL'], 6: ['ZO', 'ZU', 'KU', 'KO', 'KL', 'KR'] };
  var C = { lume: '#B8F28A', tock: '#9FD8FF', faint: '#8A95A3', line: '#27303B', line2: '#3A4452', muted: '#AEB7C2', warn: '#F59B5E', text: '#EEF1F4', band: 'rgba(184, 242, 138, 0.10)' };
  var LIVE_FIRST = 6, LIVE_EVERY = 3, LIVE_WINDOW = 10, SETTLE = 5;
  /* Automatischer Start: zuhören, bis das Ticken in zwei kurzen Fenstern nacheinander klar ist */
  var SEARCH_WINDOW = 4.5, SEARCH_EVERY = 1.25, SEARCH_NEED = 2, SEARCH_KEEP = 6, SEARCH_MAX = 120, START_SKIP = 0.4;

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
    return { id: str(w.id, 40), name: str(w.name, 60), kaliberId: str(w.kaliberId, 60),
      liftAngle: lift >= 30 && lift <= 70 ? lift : 52, bph: bph >= 3600 && bph <= 72000 ? Math.round(bph) : null };
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
    if (finite(m.fs, 0) > 0) out.fs = m.fs;
    if (str(m.eng, 20)) out.eng = str(m.eng, 20);
    if (str(m.app, 20)) out.app = str(m.app, 20);
    if (m.fp === true) out.fp = true;
    if (str(m.sess, 40)) out.sess = str(m.sess, 40);
    if (m.lset === 4 || m.lset === 6) out.lset = m.lset;
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
    quartzRate: Math.abs(finite(S.quartzRate, 0)) <= 10 ? finite(S.quartzRate, 0) : 0,
    quartzRaw: Math.abs(finite(S.quartzRaw, NaN)) < 500 ? S.quartzRaw : null,
    testPro: S.testPro !== false,
    free: cleanFree(S.free)
  };
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
    if (!store(KEYS.meas, meas)) toast('Der Speicher ist voll. Alte Messungen löschen oder unter Einstellungen eine Sicherung speichern.');
  }

  /* ---------- Format ---------- */
  function fmt(v, d) { return v.toFixed(d).replace('.', ','); }
  function signed(v, d) { var s = fmt(Math.abs(v), d); return (v < 0 && s.replace(/[0,]/g, '') !== '' ? '−' : '+') + s; }
  function thousands(n) { var s = String(Math.round(Math.abs(n))), o = ''; while (s.length > 3) { o = '’' + s.slice(-3) + o; s = s.slice(0, -3); } return (n < 0 ? '−' : '') + s + o; }
  function dateStr(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  }
  function timeStr(d) { return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }); }
  function dayShort(iso) { var d = new Date(iso); return d.getDate() + '.' + (d.getMonth() + 1) + '.'; }
  function ago(iso) {
    var d = new Date(iso), now = new Date();
    var days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    if (days <= 0) return 'heute ' + timeStr(d);
    if (days === 1) return 'gestern';
    if (days < 30) return 'vor ' + days + ' Tagen';
    return 'am ' + d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function dLong(d) { return d.toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function deg(v) { return fmt(v, v % 1 ? 1 : 0) + '°'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
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
  worker.onerror = function () { setStatus('status', 'Die Auswertung konnte nicht starten. Seite neu laden.', 'err'); };
  function runJob(payload) {
    return new Promise(function (resolve) { var id = ++jobSeq; jobs[id] = resolve; payload.id = id; worker.postMessage(payload); });
  }

  /* ---------- Uhren und Werke ---------- */
  function findWatch(id) { for (var i = 0; i < watches.length; i++) if (watches[i].id === id) return watches[i]; return null; }
  function currentWatch() { return findWatch(settings.watchId); }
  var UNKNOWN = { id: '', name: 'Unbekannte Uhr', kaliberId: '', liftAngle: 52, bph: null };
  /* Die Schlagzahl wird immer erkannt; die gespeicherte gilt nur als Erwartung (Hinweis bei Abweichung). */
  function watchOpts(w) { return { liftAngle: w && w.liftAngle ? w.liftAngle : 52, bph: null, clockPpm: settings.ppm || 0 }; }
  function kalById(id) { for (var i = 0; i < KAL.length; i++) if (KAL[i].id === id) return KAL[i]; return null; }
  function calName(id) { var k = kalById(id); return k ? k.name : ''; }
  /* Woher der Hebewinkel stammt: '' (bestätigt oder eigene Angabe), 'unbestätigt' oder 'angenommen' */
  function liftState(w) {
    var lift = w && w.liftAngle ? w.liftAngle : 52;
    var k = w ? kalById(w.kaliberId) : null;
    if (k && k.hebewinkel != null && Math.abs(k.hebewinkel - lift) < 0.01) return k.sicher ? '' : 'unbestätigt';
    if (Math.abs(lift - 52) < 0.01 && !(k && k.hebewinkel != null)) return 'angenommen';
    return '';
  }
  function watchSub(w) {
    if (!w) return 'Hebewinkel 52° angenommen · Schlagzahl automatisch';
    var k = kalById(w.kaliberId);
    if (k && k.messbar === false) return (k.name + ' · nicht messbar');
    return (k ? k.name : 'Werk unbekannt') + ' · ' + (w.bph ? thousands(w.bph) + ' A/h' : 'Schlagzahl automatisch') + ' · ' + deg(w.liftAngle);
  }
  function measOf(w) { var id = w ? w.id : ''; return meas.filter(function (m) { return m.watchId === id; }); }
  /* Gewertet wird wie im Messprotokoll: gutes Signal, stabiler Gang, kleine Unsicherheit */
  function counted(m) { return m.q !== 'schwach' && m.stable !== false && m.sigma <= 0.5; }

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
    lagen: 'Der Lagen-Test misst die Uhr in bis zu sechs Lagen nacheinander, wie beim Uhrmacher, und zeigt die Lagendifferenz.',
    pdf: 'Das Messprotokoll fasst alle Messungen einer Uhr als PDF zusammen, zum Drucken, Sammeln oder für den Uhrmacher.',
    watches: 'In der Gratis-Version lässt sich eine Uhr speichern. Mit Pro beliebig viele.',
    wav: 'Mit Pro lassen sich Aufnahmen als WAV-Datei teilen, zum Beispiel mit einem Uhrmacher.',
    values: 'Abfallfehler und Amplitude zeigt Tickwerk gratis bei ' + FREE_PER_WEEK + ' Messungen pro Woche. Mit Pro bei jeder Messung.',
    history: 'Gratis siehst du die letzten Messungen. Mit Pro den ganzen Verlauf.'
  };
  function requirePro(feature) {
    if (isPro()) return true;
    $('psText').textContent = (PRO_WHY[feature] || '') + ' Einmal ' + priceText() + ', kein Abo.';
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
    try { return new Intl.NumberFormat('de-CH', { style: 'currency', currency: p.currency }).format(v); } catch (e) { return String(p.currency) + ' ' + v.toFixed(2); }
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
      toast('Testversion: Pro ist zum Ausprobieren freigeschaltet. Es wurde nichts gekauft.');
      afterProChange(); return;
    }
    billingInit().then(function (s) {
      if (!s || typeof window.PaymentRequest !== 'function') { toast('Kaufen geht nur in der Tickwerk-App aus dem Google Play Store.'); return; }
      var req;
      try {
        req = new PaymentRequest([{ supportedMethods: BILLING_URL, data: { sku: PRO_SKU } }], { total: { label: 'Tickwerk Pro', amount: { currency: 'CHF', value: '0' } } });
      } catch (e) { toast('Der Kauf konnte nicht starten.'); return; }
      $('proBuy').disabled = true;
      return req.show().then(function (resp) {
        var token = resp.details && resp.details.purchaseToken;
        return settlePurchase(token).then(function (ok) {
          return Promise.resolve(resp.complete(ok ? 'success' : 'fail')).catch(function () { /* egal */ }).then(function () { return ok; });
        });
      }).then(function (ok) {
        if (ok) { grantPro(); toast('Danke! Tickwerk Pro ist freigeschaltet.'); }
        else toast('Der Kauf ist noch nicht bestätigt. Tickwerk prüft beim nächsten Start nochmals; sonst «Käufe wiederherstellen» tippen.');
      }, function (e) {
        toast(e && e.name === 'AbortError' ? 'Kauf abgebrochen. Schon gekauft? Dann «Käufe wiederherstellen» tippen.' : 'Kauf nicht möglich' + (e && e.message ? ': ' + e.message : '.'));
      }).then(function () { $('proBuy').disabled = false; afterProChange(); });
    });
  }
  function afterProChange() {
    render();
    if (lastShown) showResult(lastShown.r, lastShown.m);
  }

  /* ---------- Navigation: Bildschirme als Stapel, Android-Zurück schliesst den obersten ---------- */
  var SCREENS = ['measure', 'watches', 'watch', 'edit', 'lagen', 'lpos', 'guide', 'more', 'pro', 'history', 'settings'];
  var NO_TABS = { edit: true, lagen: true, lpos: true, guide: true };
  var stack = [{ s: 'measure', p: {} }];
  var sheetOpen = null, afterPop = null, shownScreen = '';
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabbar button'));
  function top() { return stack[stack.length - 1]; }
  function topScreen() { return top().s; }
  function render(restoreScroll) {
    var t = top();
    if (rec && rec.owner !== t.s) recStop(true);
    if (t.s !== 'lpos') lpStop();
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
  ['watchSheet', 'proSheet'].forEach(function (id) {
    $(id).addEventListener('click', function (e) { if (e.target === $(id)) closeSheet(); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetOpen) closeSheet(); });
  $('psClose').addEventListener('click', function () { closeSheet(); });
  $('psMore').addEventListener('click', function () { closeSheet(function () { go('pro'); }); });
  $('wsClose').addEventListener('click', function () { closeSheet(); });
  $('wsAdd').addEventListener('click', function () { closeSheet(addWatch); });

  /* ---------- Aufnahme ---------- */
  var rec = null, opening = false, wakeLock = null;
  function micError(e) {
    var n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') {
      return 'Mikrofon blockiert. In Chrome: Menü ⋮ → Einstellungen → Website-Einstellungen → Mikrofon → ' + (location.host || 'diese Seite') +
        ' auf «Zulassen» stellen, dann neu laden. Hilft das nicht: Android-Einstellungen → Apps → Chrome (oder Tickwerk) → Berechtigungen → Mikrofon.';
    }
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Kein Mikrofon gefunden.';
    if (n === 'NotReadableError' || n === 'AbortError') {
      return 'Das Mikrofon ist gerade belegt, zum Beispiel durch einen Anruf oder eine Aufnahme-App. Diese beenden und nochmals tippen.';
    }
    return 'Mikrofon konnte nicht geöffnet werden' + (n ? ' (' + n + ')' : '') + '.';
  }
  /* o: { owner, dur, settle, opts, onOpening, onFail, onBegin, onSettle, onTick, onLive, onCancel, onDone } */
  async function recStart(o) {
    if (rec || opening) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      o.onFail('Dieser Browser erlaubt hier keine Mikrofon-Aufnahme. Tickwerk über https öffnen, zum Beispiel in Chrome.'); return;
    }
    opening = true;
    if (o.onOpening) o.onOpening();
    var stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }, video: false
      });
    } catch (e) { opening = false; o.onFail(micError(e)); return; }
    var AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
    try { await ctx.resume(); } catch (e) { /* egal */ }
    var r = { o: o, owner: o.owner, stream: stream, ctx: ctx, chunks: [], n: 0, fs: ctx.sampleRate, dur: o.dur,
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
      o.onFail('Aufnahme konnte nicht starten' + (e && e.message ? ': ' + e.message : '.')); return;
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
    r.chunks.push(samples); r.n += samples.length;
    if (r.n >= r.dur * r.fs) recFinish();
  }
  function tick() {
    var r = rec; if (!r) return;
    var o = r.o;
    if (r.phase === 'search') { searchTick(r); return; }
    if (r.skipped < r.settleN) { if (o.onSettle) o.onSettle(Math.ceil((r.settleN - r.skipped) / r.fs), r); return; }
    var t = r.n / r.fs;
    if (o.onTick) o.onTick(Math.max(0, Math.ceil(r.dur - t)), t / r.dur, r);
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
  /* Signal klar: ab jetzt zählt die Messzeit. Kurzes Vibrieren als Zeichen, die ersten 0,4 s danach werden verworfen. */
  function beginMeasure(r) {
    if (rec !== r || r.phase !== 'search') return;
    r.phase = 'measure'; r.chunks = []; r.n = 0; r.skipped = 0; r.settleN = Math.round(START_SKIP * r.fs);
    r.nextLive = LIVE_FIRST; r.liveBusy = false;
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) { /* egal */ }
    if (r.o.onMeasureStart) r.o.onMeasureStart(r);
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
    if (document.hidden && rec) { recStop(true); toast('Aufnahme abgebrochen: Tickwerk war im Hintergrund.'); }
  });
  function recFinish() {
    var r = rec; if (!r) return;
    rec = null; teardown(r);
    r.o.onDone(allSamples(r, Math.round(r.dur * r.fs)), r.fs);
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
    if (c.sess) { m.sess = c.sess; if (c.lset) m.lset = c.lset; }
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
  var LEVEL_TEXT = ['kein Signal', 'Signal schwach', 'Signal mittel', 'Signal gut', 'Signal stark'];
  function setSignal(level) { $('mSignal').setAttribute('data-level', String(level)); $('mSignalText').textContent = LEVEL_TEXT[level]; }
  function setMarker(rate, live) {
    var mk = $('mMarker');
    mk.hidden = false; mk.classList.toggle('live', !!live);
    mk.style.left = ((Math.max(-20, Math.min(20, rate)) + 20) / 40 * 100) + '%';
  }
  function setChipsDisabled(on) { ['mPos', 'mDur', 'mLagen', 'mWatchPick'].forEach(function (id) { $(id).disabled = on; }); }
  function setLocks(locked) {
    ['mBe', 'mAmp'].forEach(function (id) { $(id).classList.toggle('locked', locked); });
    $('mBeTag').hidden = true; $('mAmpTag').hidden = true;   /* der Wert selbst zeigt «Pro» */
  }
  function clearReadout() {
    lastShown = null; lastRec = null;
    $('mRate').textContent = '–'; $('mRate').classList.remove('live'); $('mSigma').textContent = '';
    $('mMarker').hidden = true; $('mVerdict').hidden = true; $('bphWarn').hidden = true; $('mQuartz').hidden = true;
    $('mBe').textContent = '–'; $('mBeNote').textContent = ''; $('mAmp').textContent = '–'; $('mLift').textContent = '';
    $('mBph').textContent = '–'; $('mBphNote').textContent = 'erkannt';
    setLocks(false); setSignal(0);
    $('shareBtn').hidden = true; $('mState').textContent = 'Bereit';
    $('mStartLabel').textContent = 'Messen';
    drawTape($('mTape'), null, 'Der Papierstreifen erscheint während der Messung.');
    drawBeat($('mBeat'), null);
  }
  function idleHint() {
    return settings.autoStart ? '«Messen» tippen und die Unterkante des Handys an die Krone halten. Tickwerk startet, sobald das Ticken klar ist.' :
      'Unterkante des Handys an die Krone halten, dann «Messen» tippen.';
  }
  function renderMeasure() {
    var w = currentWatch(), k = w ? kalById(w.kaliberId) : null;
    if (settings.watchId && !w) { settings.watchId = ''; saveSettings(); }
    $('mWatchName').textContent = w ? w.name : UNKNOWN.name;
    $('mWatchSub').textContent = watchSub(w) + (settings.ppm ? ' · Handy-Uhr korrigiert' : '');
    $('mPos').value = settings.pos; $('mDur').value = String(settings.dur);
    if (!rec && !busy && !lastShown && k && k.messbar === false) setStatus('status', k.notiz || 'Dieses Werk lässt sich mit dem Mikrofon nicht messen.', 'err');
    renderFree();
    if (!rec) redrawMeasure();
  }
  function redrawMeasure() {
    if (lastShown) { drawTape($('mTape'), lastShown.r.trace); drawBeat($('mBeat'), lastShown.r.templates, lastShown.r.liftTimeMs); }
    else if (!busy) drawTape($('mTape'), null, 'Der Papierstreifen erscheint während der Messung.');
  }
  function renderFree() {
    var el = $('mFree');
    if (isPro()) { el.hidden = true; return; }
    var left = freeLeft();
    el.hidden = false;
    el.textContent = left ? 'Abfallfehler und Amplitude: noch ' + left + ' von ' + FREE_PER_WEEK + ' Gratis-Messungen diese Woche.' :
      'Die ' + FREE_PER_WEEK + ' Gratis-Messungen mit allen Werten sind diese Woche aufgebraucht. Gang und Schlagzahl misst Tickwerk weiter gratis.';
  }
  function measureStart() {
    if (rec) { recStop(true); return; }
    if (busy || opening) return;
    var w = currentWatch();
    function measuring() {
      $('mSearch').hidden = true;
      $('mState').textContent = 'Misst';
      setStatus('status', 'Messung läuft. Nichts bewegen.', 'busy');
      drawTape($('mTape'), null, 'Der Papierstreifen erscheint nach ein paar Sekunden.');
    }
    recStart({
      owner: 'measure', dur: settings.dur, search: settings.autoStart, settle: 0, opts: watchOpts(w),
      onOpening: function () { $('mStart').disabled = true; setStatus('status', 'Mikrofon wird geöffnet …', 'busy'); },
      onFail: function (msg) { $('mStart').disabled = false; setStatus('status', msg, 'err'); },
      onBegin: function (r) {
        clearReadout();
        $('mStart').disabled = false; $('mStart').classList.add('running'); setChipsDisabled(true);
        if (r.phase !== 'search') { measuring(); return; }
        $('mState').textContent = 'Sucht das Signal';
        $('mStartLabel').textContent = 'Abbrechen';
        $('mSearch').hidden = false;
        setStatus('status', 'Handy-Unterkante an die Krone halten und kurz ruhig bleiben. Sobald das Ticken klar ist, startet die Messung von selbst.', 'busy');
        drawTape($('mTape'), null, 'Tickwerk hört zu …');
      },
      onSearchTick: function (t, r) { bar($('levelFill'), (20 * Math.log10(r.peak + 1e-9) + 80) / 60); },
      onSearch: function (res, good, t) {
        var heard = heardOf(res);
        setSignal(heard ? qLevel(res.quality) : 0);
        if (heard) { drawTape($('mTape'), res.trace); $('mSigma').textContent = thousands(res.bph) + ' A/h erkannt'; }
        if (good) setStatus('status', 'Signal gut. Ruhig halten, die Messung startet gleich.', 'ok');
        else if (heard) setStatus('status', 'Ticken erkannt, aber noch schwach. Das Handy etwas verschieben oder fester an die Krone halten.', 'busy');
        else setStatus('status', t > 20 ? 'Noch kein klares Ticken. Ist die Uhr aufgezogen und der Raum ruhig? Sonst «Jetzt messen» tippen.' :
          'Suche das Ticken … Handy-Unterkante an die Krone halten.', 'busy');
      },
      onMeasureStart: measuring,
      onQuartz: function () { measureIdle(); $('mState').textContent = 'Bereit'; showQuartzHint(); },
      onTimeout: function () {
        measureIdle(); $('mState').textContent = 'Bereit';
        setStatus('status', 'Zwei Minuten lang kein klares Ticken. Uhr aufziehen, Handy-Unterkante direkt an die Krone halten und nochmals versuchen.', 'err');
      },
      onTick: function (left, frac, r) {
        $('mStartLabel').textContent = 'Abbrechen · ' + left + ' s';
        bar($('mProg'), frac);
        var db = 20 * Math.log10(r.peak + 1e-9);
        bar($('levelFill'), (db + 80) / 60);
      },
      onLive: function (res) {
        if (heardOf(res)) {
          $('mRate').textContent = signed(res.rate, 1); $('mRate').classList.add('live');
          $('mSigma').textContent = 'vorläufig · ' + thousands(res.bph) + ' A/h';
          setMarker(res.rate, true); setSignal(qLevel(res.quality));
          drawTape($('mTape'), res.trace);
          setStatus('status', 'Ticken erkannt. Nichts bewegen, bis die Zeit um ist.', 'ok');
        } else {
          setSignal(0);
          setStatus('status', 'Noch kein klares Ticken. Unterkante des Handys näher an die Krone, Raum ruhig halten.', 'err');
        }
      },
      onCancel: function () { measureIdle(); $('mState').textContent = 'Bereit'; setStatus('status', 'Abgebrochen.', ''); },
      onDone: function (samples, fs) {
        measureIdle();
        lastRec = { samples: samples, fs: fs, date: new Date(), watchName: w ? w.name : UNKNOWN.name, pos: settings.pos };
        analyzeMeasure(samples, fs, 'Mikrofon');
      }
    });
  }
  function showQuartzHint() {
    $('mQuartz').hidden = false; setSignal(0);
    setStatus('status', 'Quarzuhr erkannt. Die Messung ist für mechanische Uhren.', '');
  }
  function measureIdle() {
    $('mStart').classList.remove('running'); $('mStart').disabled = false; setChipsDisabled(false); $('mSearch').hidden = true;
    bar($('mProg'), 0); bar($('levelFill'), 0);
    $('mStartLabel').textContent = lastShown ? 'Nochmals messen' : 'Messen';
  }
  function analyzeMeasure(samples, fs, source) {
    var w = currentWatch(), pos = settings.pos, keepRec = lastRec;
    busy = true;
    $('mStart').disabled = true; $('mStartLabel').textContent = 'Rechnet …'; $('mState').textContent = 'Rechnet';
    setStatus('status', 'Rechne …', 'busy');
    runJob({ samples: samples, fs: fs, opts: watchOpts(w) }).then(function (res) {
      busy = false; $('mStart').disabled = false;
      if (!res || !res.ok) {
        clearReadout(); lastRec = keepRec;
        $('shareBtn').hidden = !lastRec;
        setStatus('status', (res && res.reason) || 'Keine Messung möglich.', 'err');
        runJob({ kind: 'quartzProbe', samples: samples.subarray(0, Math.min(samples.length, Math.round(12 * fs))), fs: fs }).then(function (qr) {
          if (qr && qr.quartz && !rec && !busy) showQuartzHint();
        });
        return;
      }
      var m = saveMeasurement(res, source, fs, { watch: w, pos: pos });
      lastRec = keepRec;
      showResult(res, m);
      renderFree();
    });
  }
  function showResult(r, m) {
    lastShown = { r: r, m: m };
    var w = findWatch(m.watchId), k = w ? kalById(w.kaliberId) : null, st = liftState(w);
    $('mRate').textContent = signed(r.rate, 1); $('mRate').classList.remove('live');
    $('mSigma').textContent = '± ' + fmt(r.rateSigma, 2) + ' s/Tag · ' + fmt(r.duration, 0) + ' s · ' + r.beatsUsed + ' Schläge' +
      (r.rateStable === false && r.halves ? ' · schwankt (' + signed(r.halves.rate[0], 1) + ' / ' + signed(r.halves.rate[1], 1) + ')' : '');
    setMarker(r.rate, false);
    var kind, text, weak = r.quality && r.quality.label === 'schwach';
    if (r.rateStable === false && !weak) { kind = 'warn'; text = 'Der Gang hat sich während der Messung verändert. Uhr ruhig liegen lassen und nochmals messen.'; }
    else if (weak || r.rateSigma > 0.5) { kind = 'warn'; text = 'Nur ein grober Wert: das Signal ist schwach. Handy näher an die Krone und nochmals messen.'; }
    else if (r.rate >= -4 && r.rate <= 6) { kind = 'good'; text = 'Im Chronometer-Bereich (−4 bis +6 s/Tag).'; }
    else if (Math.abs(r.rate) <= 15) { kind = 'okay'; text = 'Gut für eine Uhr ohne Chronometer-Zertifikat.'; }
    else { kind = 'warn'; text = 'Deutlich daneben. In einer anderen Lage nochmals messen; bleibt es so, regulieren lassen.'; }
    $('mVerdict').hidden = false; $('mVerdict').setAttribute('data-kind', kind); $('mVerdictText').textContent = text;
    var full = showsPro(m);
    setLocks(!full);
    if (full) {
      $('mBe').textContent = fmt(r.beatErrorMs, 2) + ' ms';
      $('mBeNote').textContent = r.beatErrorReliable === false ? 'unsicher' : (r.beatErrorMs <= 0.5 ? 'sehr gut' : (r.beatErrorMs <= 1 ? 'in Ordnung' : 'hoch'));
      $('mAmp').textContent = r.amplitude ? Math.round(r.amplitude) + '°' : '–';
      $('mLift').textContent = !r.amplitude ? '' : !r.amplitudeReliable ? 'unsicher' : (k && k.coaxial ? 'Richtwert (Co-Axial)' : 'bei ' + deg(r.liftAngle) + (st ? ' (' + st + ')' : ''));
    } else {
      $('mBe').textContent = 'Pro'; $('mBeNote').textContent = '';
      $('mAmp').textContent = 'Pro'; $('mLift').textContent = '';
    }
    $('mBph').textContent = thousands(r.bph);
    var expBph = w && w.bph ? w.bph : 0, mismatch = !!expBph && expBph !== r.bph;
    $('mBphNote').textContent = mismatch ? 'erwartet ' + thousands(expBph) : 'A/h';
    $('bphWarn').hidden = !mismatch;
    if (mismatch) {
      $('bphWarnText').textContent = 'Tickwerk hat ' + thousands(r.bph) + ' A/h erkannt, für «' + w.name + '» sind ' + thousands(expBph) +
        ' A/h hinterlegt. Möglicherweise steckt eine andere Version des Werks in der Uhr.';
      $('bphFix').textContent = thousands(r.bph) + ' A/h übernehmen';
      $('bphFix').onclick = function () { w.bph = r.bph; saveWatches(); $('bphWarn').hidden = true; $('mBphNote').textContent = 'A/h'; renderMeasure(); };
    }
    setSignal(qLevel(r.quality));
    $('mState').textContent = 'Gemessen · ' + timeStr(new Date(m.date));
    setStatus('status', (m.watchId ? 'Gespeichert bei «' + m.watchName + '»' : 'Gespeichert unter «Alle Messungen»') + ', Lage ' + POS[m.pos] +
      (r.clockPpm ? '. Handy-Uhr korrigiert.' : '.') + (r.gaps && r.gaps.length ? ' Ein kurzer Aussetzer der Aufnahme wurde ausgeglichen.' : ''), 'ok');
    $('mStartLabel').textContent = 'Nochmals messen';
    $('shareBtn').hidden = !lastRec;
    drawTape($('mTape'), r.trace);
    drawBeat($('mBeat'), r.templates, r.liftTimeMs);
  }
  $('mStart').addEventListener('click', measureStart);
  $('mForce').addEventListener('click', recForceStart);
  $('mQuartzGo').addEventListener('click', function () {
    $('mQuartz').hidden = true;
    go('settings');
    $('quartzRec').scrollIntoView({ block: 'center' });
  });
  $('mPos').addEventListener('change', function () { settings.pos = this.value; saveSettings(); });
  $('mDur').addEventListener('change', function () { settings.dur = parseInt(this.value, 10) || 30; saveSettings(); });
  $('mLagen').addEventListener('click', function () { lagenOpen(settings.watchId); });
  $('mGuide').addEventListener('click', function () { go('guide'); });
  $('mWatchPick').addEventListener('click', openWatchSheet);
  ['mBe', 'mAmp'].forEach(function (id) {
    $(id).parentNode.parentNode.addEventListener('click', function () { if ($(id).classList.contains('locked')) requirePro('values'); });
  });
  function setWatch(id) {
    if (settings.watchId === id) return;
    settings.watchId = id; saveSettings();
    clearReadout(); setStatus('status', idleHint(), '');
  }
  function openWatchSheet() {
    if (rec || busy) return;
    var ul = $('wsList'); ul.innerHTML = '';
    watches.concat([null]).forEach(function (w) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<span>' + esc(w ? w.name : UNKNOWN.name) + '</span><small>' + esc(watchSub(w)) + '</small>';
      if ((w ? w.id : '') === settings.watchId) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', function () { setWatch(w ? w.id : ''); closeSheet(); renderMeasure(); });
      li.appendChild(b); ul.appendChild(li);
    });
    openSheet('watchSheet');
  }

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
    shareOrDownload(encodeWav(lastRec.samples, lastRec.fs), name, 'Tickwerk Aufnahme');
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
      done: rows.every(function (r) { return !!r.m; }) };
    if (ok.length >= 2) {
      st.hi = ok.reduce(function (a, r) { return r.m.rate > a.m.rate ? r : a; });
      st.lo = ok.reduce(function (a, r) { return r.m.rate < a.m.rate ? r : a; });
      st.spread = st.hi.m.rate - st.lo.m.rate;
    }
    if (h.length && v.length) st.hv = avg(v.map(rate)) - avg(h.map(rate));
    return st;
  }
  /* Nächste Lage: zuerst eine offene, sonst eine schwache zum Wiederholen */
  function nextPos(set, byPos) {
    return set.filter(function (p) { return !byPos[p]; })[0] || set.filter(function (p) { return byPos[p] && !counted(byPos[p]); })[0] || null;
  }
  function lagenVerdict(st) {
    if (st.n < 2) return 'Zu wenige sichere Lagen für eine Aussage. Die schwachen Lagen nochmals messen.';
    var p = ['Mittel ' + signed(st.mean, 1) + ' s/Tag' + (st.mean >= -4 && st.mean <= 6 ? ', im Chronometer-Bereich (−4 bis +6).' : '.')];
    if (st.spread <= 10) p.push('Die Lagendifferenz von ' + fmt(st.spread, 1) + ' s/Tag ist klein: das Werk läuft in allen Lagen gleichmässig.');
    else if (st.spread <= 20) p.push('Eine Lagendifferenz von ' + fmt(st.spread, 1) + ' s/Tag ist üblich für eine Uhr ohne Chronometer-Zertifikat.');
    else p.push('Die Lagendifferenz von ' + fmt(st.spread, 1) + ' s/Tag ist gross. Ein Uhrmacher kann prüfen, ob ein Service nötig ist.');
    if (st.hv != null) p.push('Senkrecht gegenüber waagrecht: ' + signed(st.hv, 1) + ' s/Tag (die Chronometer-Norm erlaubt −6 bis +8).');
    if (st.weak) p.push(st.weak === 1 ? 'Eine Lage hatte ein schwaches Signal und zählt nicht.' : st.weak + ' Lagen hatten ein schwaches Signal und zählen nicht.');
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
    $('lBackLabel').textContent = stack.length > 1 && stack[stack.length - 2].s === 'watch' ? (w ? w.name : 'Zurück') : 'Messen';
    $('lStep').textContent = finished ? 'Fertig · ' + set.length + ' Lagen' : measured + ' von ' + set.length + ' gemessen';
    var mins = Math.max(1, Math.round(set.length * (settings.dur + (settings.autoStart ? 8 : SETTLE) + 15) / 60));
    $('lLead').textContent = finished ? 'Alle Lagen gemessen. Eine Lage antippen, um ihr Ergebnis zu sehen oder sie nochmals zu messen.' :
      'Lage antippen. Tickwerk zeigt, wie die Uhr liegt, und ' + (settings.autoStart ? 'misst von selbst, sobald das Ticken klar ist.' : 'misst nach «Messen».') +
      ' Je ' + settings.dur + ' s, zusammen etwa ' + mins + ' Minuten.';
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
      var sub = !m ? (p === next ? 'als Nächstes' : 'offen') : !counted(m) ? 'Signal schwach · nochmals' :
        (ampBe(m).join(' · ') || '± ' + fmt(m.sigma, 2) + ' s/Tag');
      b.innerHTML = '<svg class="pos-icon lt-icon" viewBox="0 0 110 110" aria-hidden="true">' + posIcon(p) + '</svg>' +
        '<span class="lt-txt"><span class="lt-h">' + esc(POS[p]) + '</span>' +
        '<span class="lt-v">' + (m ? esc(signed(m.rate, 1)) + '<small> s/Tag</small>' : '–') + '</span>' +
        '<span class="lt-s">' + esc(sub) + '</span></span>' + (m && counted(m) ? ICON.check : '');
      b.setAttribute('aria-label', POS[p] + ': ' + (m ? signed(m.rate, 1) + ' Sekunden pro Tag' : sub));
      b.addEventListener('click', function () { if (rec || busy) return; go('lpos', { pos: p }); });
      tl.appendChild(b);
    });
    $('lDiffCard').hidden = finished;
    $('lDiff').textContent = st.spread == null ? '–' : fmt(st.spread, 1) + ' s';
    $('lDiffSub').textContent = st.spread == null ? 'noch zu wenige Lagen' : 'zwischen ' + POS[st.hi.pos] + ' und ' + POS[st.lo.pos];
    $('lResult').hidden = !finished;
    if (finished) {
      $('lgMean').textContent = st.mean == null ? '–' : signed(st.mean, 1);
      $('lgSpread').textContent = st.spread == null ? '–' : fmt(st.spread, 1);
      $('lgHV').textContent = st.hv == null ? '–' : signed(st.hv, 1);
      $('lgBe').textContent = st.be == null ? '–' : fmt(st.be, 2);
      $('lgAmp').textContent = st.ampH == null && st.ampV == null ? '–' : (st.ampH != null ? Math.round(st.ampH) + '°' : '–') + ' / ' + (st.ampV != null ? Math.round(st.ampV) + '°' : '–');
      $('lgVerdict').textContent = lagenVerdict(st);
      drawLagenChart(st);
    }
    $('lNext').hidden = !next;
    if (next) $('lNextLabel').textContent = (byPos[next] ? 'Nochmals messen: ' : 'Messen: ') + POS[next];
    $('lCancel').textContent = finished ? 'Neuer Lagen-Test' : 'Abbrechen';
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
    if (sessMeas().length && !window.confirm('Lagen-Test abbrechen? Die bisherigen Messungen bleiben im Verlauf.')) return;
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
    makeReport(w, $('lgPdfBar'), { list: list, kind: 'lagen', subtitle: 'Lagen-Test in ' + set.length + ' Lagen vom ' + dLong(new Date(session.started)) });
  });

  /* ---------- Eine Lage messen ---------- */
  var lpTimer = 0;
  function lpStop() { clearInterval(lpTimer); lpTimer = 0; }
  function setPSignal(level) { $('pSignal').setAttribute('data-level', String(level)); $('pSignalText').textContent = LEVEL_TEXT[level]; }
  function lpReady(p) {
    lpStop();
    $('pState').textContent = 'Bereit';
    $('pRate').textContent = '–'; $('pRate').classList.remove('live'); $('pSub').textContent = '';
    $('pMetrics').hidden = true; setPSignal(0); bar($('pLevel'), 0); bar($('pProg'), 0);
    $('pSearch').hidden = true; $('pAlt').hidden = true;
    $('pStart').classList.remove('running'); $('pStart').disabled = false;
    $('pStartLabel').textContent = 'Messen';
    drawTape($('pTape'), null, settings.autoStart ? 'Tickwerk hört gleich zu …' : '«Messen» tippen, wenn die Uhr liegt.');
    setStatus('pStatus', settings.autoStart ? '' : 'Uhr so hinlegen, Handy-Unterkante an die Krone halten, dann «Messen» tippen.', '');
  }
  function renderLpos(p) {
    var set = session ? SETS[session.set] : null;
    if (!set || set.indexOf(p.pos) < 0) { setTimeout(function () { popTo('lagen'); }, 0); return; }
    $('pStep').textContent = 'Lage ' + (set.indexOf(p.pos) + 1) + ' von ' + set.length;
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
      onOpening: function () { $('pStart').disabled = true; setStatus('pStatus', 'Mikrofon wird geöffnet …', 'busy'); },
      onFail: function (msg) { $('pStart').disabled = false; setStatus('pStatus', msg, 'err'); },
      onBegin: function (r) {
        $('pStart').disabled = false; $('pStart').classList.add('running'); $('pStartLabel').textContent = 'Abbrechen';
        if (r.phase !== 'search') { $('pState').textContent = 'Ruhe'; setStatus('pStatus', 'Hände weg: Die Uhr soll ruhig liegen.', 'busy'); return; }
        $('pState').textContent = 'Sucht das Signal'; $('pSearch').hidden = false;
        drawTape($('pTape'), null, 'Tickwerk hört zu …');
        setStatus('pStatus', 'Uhr so hinlegen und die Handy-Unterkante an die Krone halten. Sobald das Ticken klar ist, startet die Messung von selbst.', 'busy');
      },
      onSearchTick: function (tt, r) { bar($('pLevel'), (20 * Math.log10(r.peak + 1e-9) + 80) / 60); },
      onSearch: function (res, good, tt) {
        var heard = heardOf(res);
        setPSignal(heard ? qLevel(res.quality) : 0);
        if (heard) { drawTape($('pTape'), res.trace); $('pSub').textContent = thousands(res.bph) + ' A/h erkannt'; }
        if (good) setStatus('pStatus', 'Signal gut. Ruhig halten, die Messung startet gleich.', 'ok');
        else if (heard) setStatus('pStatus', 'Ticken erkannt, aber noch schwach. Das Handy etwas verschieben oder fester an die Krone halten.', 'busy');
        else setStatus('pStatus', tt > 20 ? 'Noch kein klares Ticken. Ist die Uhr aufgezogen und der Raum ruhig? Sonst «Jetzt messen» tippen.' :
          'Suche das Ticken … Handy-Unterkante an die Krone halten.', 'busy');
      },
      onMeasureStart: function () {
        $('pSearch').hidden = true; $('pState').textContent = 'Misst';
        setStatus('pStatus', 'Messung läuft. Nichts bewegen.', 'busy');
      },
      onQuartz: function () {
        lpReady(p);
        setStatus('pStatus', 'Das klingt nach einer Quarzuhr (ein Schritt pro Sekunde). Den Lagen-Test gibt es nur für mechanische Uhren.', 'err');
      },
      onTimeout: function () {
        lpReady(p);
        setStatus('pStatus', 'Zwei Minuten lang kein klares Ticken. Uhr aufziehen, Handy-Unterkante direkt an die Krone halten und nochmals versuchen.', 'err');
      },
      onSettle: function (left) { if (!settings.autoStart) $('pState').textContent = 'Ruhe · ' + left + ' s'; },
      onTick: function (left, frac, r) {
        $('pState').textContent = 'Misst · noch ' + left + ' s';
        $('pStartLabel').textContent = 'Abbrechen · ' + left + ' s';
        bar($('pProg'), frac);
        bar($('pLevel'), (20 * Math.log10(r.peak + 1e-9) + 80) / 60);
      },
      onLive: function (res) {
        if (heardOf(res)) {
          $('pRate').textContent = signed(res.rate, 1); $('pRate').classList.add('live');
          $('pSub').textContent = 'vorläufig · ' + thousands(res.bph) + ' A/h';
          setPSignal(qLevel(res.quality)); drawTape($('pTape'), res.trace);
          setStatus('pStatus', 'Ticken erkannt. Nichts bewegen, bis die Zeit um ist.', 'ok');
        } else {
          setPSignal(0);
          setStatus('pStatus', 'Noch kein klares Ticken. Handy-Unterkante näher an die Krone, ohne die Uhr zu bewegen.', 'err');
        }
      },
      onCancel: function () { lpReady(p); setStatus('pStatus', 'Abgebrochen.', ''); },
      onDone: function (samples, fs) {
        busy = true;
        $('pStart').classList.remove('running'); $('pStart').disabled = true; $('pSearch').hidden = true;
        $('pStartLabel').textContent = 'Rechnet …'; $('pState').textContent = 'Rechnet'; bar($('pProg'), 0); bar($('pLevel'), 0);
        setStatus('pStatus', 'Rechne …', 'busy');
        runJob({ samples: samples, fs: fs, opts: watchOpts(w) }).then(function (res) {
          busy = false; $('pStart').disabled = false;
          var here = top().s === 'lpos' && top().p === p;
          if (!session || session.id !== sess) { if (here) lpReady(p); return; }
          if (!res || !res.ok) {
            if (here) { lpReady(p); $('pStartLabel').textContent = 'Nochmals messen'; setStatus('pStatus', ((res && res.reason) || 'Keine Messung möglich.') + ' Nochmals messen.', 'err'); }
            return;
          }
          var m = saveMeasurement(res, 'Mikrofon', fs, { watch: w, pos: pos, sess: sess, lset: setN });
          try { if (navigator.vibrate) navigator.vibrate([60, 90, 60]); } catch (e) { /* egal */ }
          if (here) lpShowResult(p, m, res, true);
        });
      }
    });
  }
  /* Ergebnis einer Lage. fresh: eben gemessen → nach RESULT_SECONDS von selbst zurück zur Auswahl (wenn es zählt) */
  function lpShowResult(p, m, res, fresh) {
    lpStop(); p.res = res;
    var ok = counted(m), extra = ampBe(m);
    $('pState').textContent = fresh ? 'Ergebnis' : 'Gemessen · ' + dateStr(m.date);
    $('pRate').textContent = signed(m.rate, 1); $('pRate').classList.remove('live');
    $('pSub').textContent = '± ' + fmt(m.sigma, 2) + ' s/Tag · ' + Math.round(m.dur) + ' s · ' + thousands(m.bph) + ' A/h';
    setPSignal(ok ? (m.q === 'stark' ? 4 : 3) : 1);
    var pro = showsPro(m);
    $('pMetrics').hidden = false;
    $('pAmp').textContent = !pro ? 'Pro' : m.ampOk && m.amp ? m.amp + '°' : '–';
    $('pAmpNote').textContent = pro && m.lift ? 'bei ' + deg(m.lift) : '';
    $('pBe').textContent = !pro ? 'Pro' : m.beOk ? fmt(m.be, 2) : '–';
    $('pSearch').hidden = true; bar($('pProg'), 0); bar($('pLevel'), 0);
    $('pStart').classList.remove('running'); $('pStart').disabled = false;
    if (res) drawTape($('pTape'), res.trace); else drawTape($('pTape'), m.tr ? traceOf(m.tr) : null, 'Gemessen am ' + dateStr(m.date));
    $('pAlt').hidden = false;
    if (!ok) {
      $('pStartLabel').textContent = 'Nochmals messen'; $('pAlt').textContent = 'Zur Auswahl';
      setStatus('pStatus', 'Signal schwach (± ' + fmt(m.sigma, 2) + ' s/Tag): Diese Lage zählt nicht. Nochmals messen, Handy fester an die Krone.', 'err');
      return;
    }
    if (!fresh) {
      $('pStartLabel').textContent = 'Nochmals messen'; $('pAlt').textContent = 'Zur Auswahl';
      setStatus('pStatus', POS[p.pos] + ': ' + signed(m.rate, 1) + ' s/Tag' + (extra.length ? ' · ' + extra.join(' · ') : '') + '.', 'ok');
      return;
    }
    $('pAlt').textContent = 'Nochmals messen';
    var left = RESULT_SECONDS;
    var label = function () { $('pStartLabel').textContent = 'Weiter · ' + left; };
    label();
    setStatus('pStatus', POS[p.pos] + ' gemessen. Gleich geht es zurück zur Auswahl.', 'ok');
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
    if ($('pAlt').textContent === 'Zur Auswahl') { back(); return; }
    lpStart();
  });
  $('pForce').addEventListener('click', recForceStart);

  /* ---------- Meine Uhren ---------- */
  function watchStatus(w, list) {
    var ok = list.filter(counted), last = ok[ok.length - 1];
    if (!list.length) return { cls: 'none', text: 'Noch nicht gemessen' };
    if (!last) return { cls: 'none', text: 'Kein sicherer Wert' };
    var pro = showsPro(last);
    if (Math.abs(last.rate) > 30 || (pro && last.ampOk && last.amp && last.amp < 200) || (pro && last.beOk && last.be > 2)) return { cls: 'warn', text: 'Service prüfen', last: last };
    if (last.rate >= -4 && last.rate <= 6) return { cls: 'good', text: 'Chronometer-Bereich', last: last };
    return { cls: 'okay', text: 'In Ordnung', last: last };
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
      b.innerHTML = '<span class="wcard-top"><span><span class="wcard-name">' + esc(w.name) + '</span><span class="mono-sub">' + esc(calName(w.kaliberId) || 'Werk unbekannt') + '</span></span>' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span>' +
        '<span class="wcard-mid"><span class="wcard-rate"><span class="wcard-num"><b>' + (show ? esc(signed(show.rate, 1)) : '–') + '</b><span>s/Tag</span></span>' +
        '<span class="pill ' + st.cls + '">' + PILL_ICON[st.cls] + esc(st.text) + '</span></span>' + sparkline(list, st.cls) + '</span>' +
        '<span class="wcard-foot">' + esc(list.length ? plural(list.length, 'Messung', 'Messungen') + ' · zuletzt ' + ago(list[list.length - 1].date) : 'Noch keine Messung') + '</span>';
      b.addEventListener('click', function () { go('watch', { id: w.id }); });
      box.appendChild(b);
    });
  }
  function addWatch() {
    if (!isPro() && watches.length >= 1) { requirePro('watches'); return; }
    go('edit', {});
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
    if (!list.length) return { kind: 'neutral', t: 'Noch keine Messung', s: 'Am besten morgens nach dem Aufziehen messen, dann am Abend nochmals. So siehst du, wie die Uhr im Alltag läuft.' };
    if (!last) return { kind: 'neutral', t: 'Noch kein sicherer Wert', s: 'Die bisherigen Messungen hatten ein schwaches Signal. Handy näher an die Krone halten und in einem ruhigen Raum messen.' };
    var pro = showsPro(last);
    if (pro && last.ampOk && last.amp && last.amp < 200 && HORIZ[last.pos]) {
      return { kind: 'warn', t: 'Amplitude niedrig', s: 'Unter 200° in waagrechter Lage. Ist die Uhr voll aufgezogen? Bleibt es so, braucht das Werk vermutlich einen Service.' };
    }
    if (pro && last.beOk && last.be > 2) return { kind: 'warn', t: 'Abfallfehler hoch', s: 'Über 2 ms: Tick und Tack sind ungleich lang. Ein Uhrmacher kann das bei der nächsten Regulierung einstellen.' };
    if (Math.abs(last.rate) > 30) return { kind: 'warn', t: 'Deutlich daneben', s: 'Mehr als 30 s/Tag. Möglicherweise ist die Uhr magnetisiert. Ein Uhrmacher kann das schnell prüfen und regulieren.' };
    var recent = ok.filter(function (m) { return Date.now() - new Date(m.date) < 14 * 86400000; }), byPos = Object.create(null);
    recent.forEach(function (m) { (byPos[m.pos] = byPos[m.pos] || []).push(m.rate); });
    var pm = Object.keys(byPos).map(function (p) { return { p: p, r: avg(byPos[p]) }; });
    if (pm.length >= 2) {
      var hi = pm.reduce(function (a, x) { return x.r > a.r ? x : a; }), lo = pm.reduce(function (a, x) { return x.r < a.r ? x : a; });
      if (hi.r - lo.r > 20) return { kind: 'warn', t: 'Grosse Lagendifferenz', s: POS[hi.p] + ' und ' + POS[lo.p] + ' liegen ' + fmt(hi.r - lo.r, 0) + ' s/Tag auseinander. Ein Lagen-Test zeigt das ganze Bild.' };
    }
    var rng = ok.slice(-5), rlo = Math.min.apply(null, rng.map(function (m) { return m.rate; })), rhi = Math.max.apply(null, rng.map(function (m) { return m.rate; }));
    var spanTxt = rng.length > 1 ? ' Die letzten ' + rng.length + ' sicheren Messungen liegen zwischen ' + signed(rlo, 1) + ' und ' + signed(rhi, 1) + ' s/Tag.' : '';
    if (last.rate >= -4 && last.rate <= 6) return { kind: 'good', t: 'Im Chronometer-Bereich', s: 'Die letzte sichere Messung liegt bei ' + signed(last.rate, 1) + ' s/Tag.' + spanTxt };
    if (Math.abs(last.rate) <= 15) return { kind: 'neutral', t: 'In Ordnung', s: 'Für eine Uhr ohne Chronometer-Zertifikat sind bis etwa ±15 s/Tag üblich.' + spanTxt };
    return { kind: 'warn', t: last.rate > 0 ? 'Geht deutlich vor' : 'Geht deutlich nach', s: signed(last.rate, 1) + ' s/Tag. Ein Uhrmacher kann die Uhr regulieren. Vorher in einer zweiten Lage messen.' + spanTxt };
  }
  function renderBars(list) {
    var el = $('dBars'), pts = list.slice(-8);
    el.innerHTML = ''; $('dBarLabels').innerHTML = '';
    if (!pts.length) { el.innerHTML = '<p class="hint bars-empty">Noch keine Messung.</p>'; return; }
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
    $('dCal').textContent = (k ? k.name : 'Werk unbekannt') + (k && k.messbar === false ? ' · nicht messbar' : '');
    var bphSeen = list.length ? list[list.length - 1].bph : 0;
    $('dBph').innerHTML = esc(w.bph ? thousands(w.bph) : bphSeen ? thousands(bphSeen) : '–') + '<small>' + esc(w.bph ? 'A/h hinterlegt' : bphSeen ? 'A/h erkannt' : 'automatisch') + '</small>';
    $('dLift').innerHTML = esc(deg(w.liftAngle)) + '<small>' + esc(st || 'bestätigt') + '</small>';
    $('dCount').textContent = String(list.length);
    $('dRange').textContent = list.length > 8 ? 'letzte 8' : list.length ? plural(list.length, 'Messung', 'Messungen') : '';
    renderBars(list);
    var ins = insightFor(list), box = $('dInsight');
    box.hidden = false; box.className = 'insight' + (ins.kind === 'good' ? '' : ' ' + ins.kind);
    box.innerHTML = ICON[ins.kind] + '<div><span class="insight-t">' + esc(ins.t) + '</span><span class="insight-s">' + esc(ins.s) + '</span></div>';
    var ul = $('dList'); ul.innerHTML = '';
    var max = isPro() ? 10 : FREE_DETAIL, rows = list.slice(-max).reverse();
    rows.forEach(function (m) {
      var li = document.createElement('li'), full = showsPro(m);
      var extra = [POS[m.pos], counted(m) ? 'Signal ' + m.q : 'nicht gewertet'];
      if (full && m.amp) extra.push(m.amp + '°');
      if (full && m.beOk && m.be != null) extra.push(fmt(m.be, 2) + ' ms');
      if (m.sess) extra.push('Lagen-Test');
      li.innerHTML = '<span class="r-l">' + esc(dateStr(m.date)) + '<small>' + esc(extra.join(' · ')) + '</small></span>' +
        '<span class="r-r' + (counted(m) ? '' : ' dim') + '">' + esc(signed(m.rate, 1) + ' s/Tag') + '</span>';
      ul.appendChild(li);
    });
    if (!rows.length) ul.innerHTML = '<li><span class="r-l">Noch keine Messung<small>Mit «Jetzt messen» beginnen</small></span></li>';
    var more = list.length - rows.length;
    $('dMore').hidden = more <= 0;
    $('dMore').textContent = isPro() ? 'Alle ' + list.length + ' Messungen unter Mehr → Alle Messungen.' : more + ' ältere ' + (more === 1 ? 'Messung ist' : 'Messungen sind') + ' gespeichert. Den ganzen Verlauf zeigt Tickwerk Pro.';
    $('dPdf').disabled = !list.length; $('dShare').disabled = !list.length;
    $('dPdfBar').hidden = true;
    renderLagenCard(w, list);
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
    $('dlDate').textContent = dateStr(L.started) + ' · ' + L.set.length + ' Lagen';
    $('dlMean').textContent = st.mean == null ? '–' : signed(st.mean, 1);
    $('dlSpread').textContent = st.spread == null ? '–' : fmt(st.spread, 1);
    $('dlBe').textContent = !pro ? 'Pro' : st.be == null ? '–' : fmt(st.be, 2);
    $('dlAmp').textContent = !pro ? 'Pro' : st.ampH == null && st.ampV == null ? '–' : (st.ampH != null ? Math.round(st.ampH) + '°' : '–') + ' / ' + (st.ampV != null ? Math.round(st.ampV) + '°' : '–');
    var ul = $('dlRows'); ul.innerHTML = '';
    st.rows.forEach(function (r) {
      var li = document.createElement('li'), m = r.m;
      var sub = !m ? 'nicht gemessen' : !counted(m) ? 'Signal schwach, zählt nicht' : (ampBe(m).join(' · ') || 'Signal ' + m.q);
      li.innerHTML = '<span class="r-l">' + esc(POS[r.pos]) + '<small>' + esc(sub) + '</small></span>' +
        '<span class="r-r' + (m && counted(m) ? '' : ' dim') + '">' + (m ? esc(signed(m.rate, 1) + ' s/Tag') : '–') + '</span>';
      ul.appendChild(li);
    });
    $('dlNote').hidden = st.done;
    $('dlNote').textContent = st.done ? '' : (current ? 'Noch nicht fertig: ' : 'Nicht fertig gemessen: ') + plural(st.rows.filter(function (r) { return !r.m; }).length, 'Lage fehlt', 'Lagen fehlen') + '.';
    $('dlOpen').hidden = !(current && !st.done);
    $('dlPdf').disabled = !st.n;
    $('dlPdfBar').hidden = true;
  }
  $('dlPdf').addEventListener('click', function () {
    var w = detailWatch(); if (!w) return;
    var L = lastLagenOf(measOf(w)); if (!L) return;
    makeReport(w, $('dlPdfBar'), { list: L.list, kind: 'lagen', subtitle: 'Lagen-Test in ' + L.set.length + ' Lagen vom ' + dLong(new Date(L.started)) });
  });
  $('dlOpen').addEventListener('click', function () { var w = detailWatch(); if (w && session && session.watchId === w.id) lagenOpen(w.id); });
  function detailWatch() { var t = top(); return t.s === 'watch' ? findWatch(t.p.id) : null; }
  $('dPdf').addEventListener('click', function () { var w = detailWatch(); if (w) makeReport(w, $('dPdfBar'), {}); });
  $('dShare').addEventListener('click', function () { var w = detailWatch(); if (w) makeReport(w, $('dPdfBar'), { share: true }); });
  $('dMeasure').addEventListener('click', function () { var w = detailWatch(); if (!w) return; setWatch(w.id); switchTab('measure'); });
  $('dEdit').addEventListener('click', function () { var w = detailWatch(); if (w) go('edit', { id: w.id }); });
  $('dLagen').addEventListener('click', function () { var w = detailWatch(); if (w) lagenOpen(w.id); });

  /* ---------- Uhr hinzufügen und bearbeiten ---------- */
  var nameAuto = false;
  function byName(a, b) { return a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' }); }
  function calInfo(k) {
    if (!k) return '';
    if (k.messbar === false) return k.notiz || 'Dieses Werk lässt sich nicht messen.';
    var s = (k.hebewinkel != null ? 'Hebewinkel ' + deg(k.hebewinkel) + (k.sicher ? '' : ' (unbestätigt)') : 'Hebewinkel unbekannt, 52° angenommen') +
      ' · ' + (k.bph ? thousands(k.bph) + ' A/h' : 'Schlagzahl wird erkannt');
    return s + (k.notiz ? '. ' + k.notiz : '');
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
    if (!k) return 'Werk unbekannt';
    if (k.messbar === false) return 'nicht messbar';
    return (k.bph ? thousands(k.bph) + ' A/h' : 'Schlagzahl wird erkannt') + ' · ' +
      (k.hebewinkel != null ? deg(k.hebewinkel) + (k.sicher ? '' : ' (unbestätigt)') : 'Hebewinkel unbekannt');
  }
  var found = [], foundSel = -1;
  function hideSuggest() { $('wFindList').hidden = true; $('wFind').setAttribute('aria-expanded', 'false'); found = []; foundSel = -1; }
  function showSuggest(items) {
    var ul = $('wFindList'); ul.innerHTML = ''; found = items; foundSel = -1;
    if (!items.length) ul.innerHTML = '<li class="none">Nichts gefunden. Name und Werk unten selbst eintragen.</li>';
    items.forEach(function (e, i) {
      var li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = 'wFind-' + i;
      li.innerHTML = e.kind === 'uhr'
        ? '<span class="t">' + esc(fullName(e.u)) + '</span><span class="s">' + esc((e.k ? e.k.name : '') + ' · ' + calShort(e.k)) + '</span>'
        : '<span class="t"><span class="tag">Werk</span>' + esc(e.k.name) + '</span><span class="s">' + esc(calShort(e.k)) + '</span>';
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
      if (!$('wName').value.trim() || nameAuto) { $('wName').value = modelName(e.u); nameAuto = true; }
      $('wFindNote').textContent = 'Übernommen: ' + fullName(e.u) + '.' + (e.u.notiz ? ' ' + e.u.notiz : '') + ' Alles lässt sich unten noch ändern.';
    } else {
      $('wFindNote').textContent = 'Werk übernommen: ' + e.k.name + '.' + ($('wName').value.trim() ? '' : ' Jetzt noch einen Namen eingeben.');
      if (!$('wName').value.trim()) $('wName').focus();
    }
    $('wFind').value = '';
    hideSuggest();
  }
  function defaultFindNote() {
    $('wFindNote').textContent = UHREN.length + ' beliebte Modelle und ' + KAL.length + ' Werke. Nicht dabei? Die Felder unten selbst ausfüllen.';
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
    $('wCalFind').value = k ? k.name : '';
    $('wCalClear').hidden = !k;
  }
  function hideCalList() { $('wCalList').hidden = true; $('wCalFind').setAttribute('aria-expanded', 'false'); calFound = []; calIdx = -1; }
  function calItem(k, i) {
    var li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = 'wCal-' + i;
    li.innerHTML = k ? '<span class="t">' + esc(k.name) + '</span><span class="s">' + esc(calShort(k)) + '</span>' :
      '<span class="t">Unbekannt oder eigene Angaben</span><span class="s">Hebewinkel 52°, Schlagzahl erkennt Tickwerk selbst</span>';
    if (k && calSel && k.id === calSel.id) li.classList.add('picked');
    li.addEventListener('pointerdown', function (ev) { ev.preventDefault(); });
    li.addEventListener('click', function () { pickCal(k); });
    return li;
  }
  function showCalList(q) {
    var ul = $('wCalList'); ul.innerHTML = ''; calFound = []; calIdx = -1;
    var typed = norm(q) && !(calSel && q === calSel.name);
    if (typed) {
      calFound = searchCal(q);
      if (!calFound.length) ul.innerHTML = '<li class="none">Kein Werk gefunden. Leer lassen und Hebewinkel unten selbst eintragen.</li>';
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
    if (w) {
      $('wName').value = w.name; setCal(kalById(w.kaliberId)); $('wLift').value = w.liftAngle; $('wBph').value = w.bph ? String(w.bph) : '';
      applyCal(kalById(w.kaliberId), true);
      $('watchFormTitle').textContent = 'Uhr bearbeiten'; $('wSave').textContent = 'Änderungen speichern'; $('wDelete').hidden = false;
    } else {
      $('wLift').value = 52; applyCal(null);
      $('watchFormTitle').textContent = 'Uhr hinzufügen'; $('wSave').textContent = 'Speichern'; $('wDelete').hidden = true;
    }
  }
  $('watchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = top(); if (t.s !== 'edit') return;
    var name = $('wName').value.trim();
    if (!name) return;
    var lift = parseFloat(String($('wLift').value).replace(',', '.'));
    var editing = t.p.id && findWatch(t.p.id);
    var w = cleanWatch({ id: editing ? editing.id : 'w' + Date.now().toString(36), name: name, kaliberId: $('wCal').value,
      liftAngle: isFinite(lift) ? lift : 52, bph: $('wBph').value ? parseInt($('wBph').value, 10) : null });
    if (editing) watches = watches.map(function (x) { return x.id === editing.id ? w : x; });
    else {
      if (!isPro() && watches.length >= 1) { requirePro('watches'); return; }
      if (watches.length >= MAX_WATCHES) { toast('Tickwerk speichert höchstens ' + MAX_WATCHES + ' Uhren.'); return; }
      watches.push(w);
    }
    saveWatches();
    if (!editing) setWatch(w.id);
    toast(editing ? 'Gespeichert.' : '«' + w.name + '» hinzugefügt.');
    back();
  });
  $('wDelete').addEventListener('click', function () {
    var t = top(), w = t.p.id ? findWatch(t.p.id) : null;
    if (!w || !window.confirm('«' + w.name + '» löschen? Die Messungen bleiben unter «Alle Messungen».')) return;
    watches = watches.filter(function (x) { return x.id !== w.id; }); saveWatches();
    if (settings.watchId === w.id) setWatch('');
    if (session && session.watchId === w.id) { session = null; saveSession(); }
    popTo('watches');
  });

  /* ---------- Alle Messungen ---------- */
  function renderHistoryFilter() {
    var sel = $('historyFilter'), keep = sel.value;
    sel.innerHTML = '<option value="*">Alle Uhren</option>';
    var seen = Object.create(null);
    watches.forEach(function (w) { seen[w.id] = true; var o = document.createElement('option'); o.value = w.id; o.textContent = w.name; sel.appendChild(o); });
    if (meas.some(function (m) { return !m.watchId || !seen[m.watchId]; })) {
      var o = document.createElement('option'); o.value = ''; o.textContent = 'Ohne Uhr / gelöschte'; sel.appendChild(o);
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
      if (full) { parts.push('Abfallfehler ' + fmt(m.be, 2) + ' ms' + (m.beOk ? '' : ' (unsicher)')); if (m.amp) parts.push(m.amp + '°' + (m.ampOk ? '' : ' (unsicher)')); }
      parts.push(counted(m) ? 'Signal ' + m.q : 'nicht gewertet');
      if (m.sess) parts.push('Lagen-Test');
      li.innerHTML = '<span class="r-l">' + esc((m.watchName || UNKNOWN.name) + ' · ' + dateStr(m.date)) + '<small>' + esc(parts.join(' · ')) + '</small></span>' +
        '<span class="r-r' + (counted(m) ? '' : ' dim') + '">' + esc(signed(m.rate, 1)) + '<button type="button" class="del" aria-label="Messung löschen">Löschen</button></span>';
      li.querySelector('button').addEventListener('click', function () {
        meas = meas.filter(function (x) { return x.id !== m.id; }); saveMeas(); renderHistory();
      });
      ul.appendChild(li);
    });
    var hidden = all.length - shown.length;
    $('historyPro').hidden = hidden <= 0;
    $('historyPro').textContent = hidden + (hidden === 1 ? ' ältere Messung ist' : ' ältere Messungen sind') + ' gespeichert. Den ganzen Verlauf zeigt Tickwerk Pro.';
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
  function renderSettings() { $('ppm').value = settings.ppm || 0; $('autoStart').checked = settings.autoStart; $('quartzRate').value = settings.quartzRate || 0; }
  $('autoStart').addEventListener('change', function () { settings.autoStart = this.checked; saveSettings(); if (!rec && !lastShown) setStatus('status', idleHint(), ''); });
  $('fileIn').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f || rec || busy) return;
    switchTab('measure');
    clearReadout();
    setStatus('status', 'Lese ' + f.name + ' …', 'busy');
    decodeFile(f).then(function (a) {
      var maxN = Math.round(120 * a.sampleRate);
      var s = a.samples.length > maxN ? a.samples.subarray(0, maxN) : a.samples;
      lastRec = { samples: s, fs: a.sampleRate, date: new Date(), watchName: (currentWatch() || UNKNOWN).name, pos: settings.pos };
      analyzeMeasure(s, a.sampleRate, 'Datei');
    }).catch(function () {
      setStatus('status', f.size > MAX_FILE ? f.name + ' ist zu gross (höchstens 150 MB).' : f.name + ' konnte nicht gelesen werden. Am besten WAV verwenden.', 'err');
    });
  });
  $('ppm').addEventListener('change', function () {
    var v = parseFloat(String(this.value).replace(',', '.'));
    settings.ppm = isFinite(v) && Math.abs(v) < 500 ? v : 0; settings.quartzRaw = null; saveSettings();
  });
  /* Eichung mit einer Quarzuhr: gemessene Abweichung plus eigener Gang der Quarzuhr (geht sie vor, sind ihre Schritte kürzer) */
  function quartzPpm() { return +(settings.quartzRaw + settings.quartzRate / 0.0864).toFixed(1); }
  function applyQuartz(q) {
    if (!q || !q.ok) { $('quartzOut').textContent = (q && q.reason) || 'Keine Auswertung möglich.'; return; }
    settings.quartzRaw = +q.ppm.toFixed(2);
    settings.ppm = quartzPpm(); saveSettings(); $('ppm').value = settings.ppm;
    $('quartzOut').textContent = 'Die Handy-Uhr geht ' + fmt(Math.abs(settings.ppm), 1) + ' ppm ' + (settings.ppm >= 0 ? 'vor' : 'nach') + ' (± ' + fmt(Math.max(0.1, q.sigmaPpm), 1) + ' ppm), das sind ' +
      fmt(Math.abs(settings.ppm) * 0.0864, 2) + ' s/Tag' + (settings.quartzRate ? ', mit dem Gang der Quarzuhr verrechnet' : '') + '. Tickwerk korrigiert das ab jetzt bei jeder Messung (' + q.steps + ' Schritte erkannt).' +
      (q.inhibition ? ' Deine Quarzuhr gleicht ihren Gang alle ' + q.inhibition.everyS + ' s mit einem kleinen Sprung aus (' + fmt(Math.abs(q.inhibition.jumpMs), 1) + ' ms); das ist berücksichtigt.' : '');
  }
  $('quartzRate').addEventListener('change', function () {
    var v = parseFloat(String(this.value).replace(',', '.'));
    settings.quartzRate = isFinite(v) && Math.abs(v) <= 10 ? v : 0; this.value = settings.quartzRate;
    if (settings.quartzRaw != null) { settings.ppm = quartzPpm(); $('ppm').value = settings.ppm; }
    saveSettings();
  });
  var QUARTZ_LABEL = 'Quarzuhr messen (2½ Minuten)';
  $('quartzRec').addEventListener('click', function () {
    if (rec && rec.owner === 'settings') { recStop(true); return; }
    if (rec || busy || opening) return;
    recStart({
      owner: 'settings', dur: 150, settle: 1, noLive: true, opts: {},
      onOpening: function () { $('quartzRec').disabled = true; $('quartzOut').textContent = 'Mikrofon wird geöffnet …'; },
      onFail: function (msg) { $('quartzRec').disabled = false; $('quartzOut').textContent = msg; },
      onBegin: function () { $('quartzRec').disabled = false; $('quartzRec').textContent = 'Abbrechen'; $('quartzOut').textContent = 'Aufnahme läuft. Handy ruhig an die Quarzuhr halten, nicht reden.'; },
      onTick: function (left) { $('quartzRec').textContent = 'Abbrechen · ' + left + ' s'; },
      onCancel: function () { $('quartzRec').textContent = QUARTZ_LABEL; $('quartzOut').textContent = 'Abgebrochen.'; },
      onDone: function (samples, fs) {
        $('quartzRec').textContent = QUARTZ_LABEL; $('quartzOut').textContent = 'Rechne …';
        runJob({ kind: 'quartz', samples: samples, fs: fs }).then(applyQuartz);
      }
    });
  });
  $('quartzFile').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    $('quartzOut').textContent = 'Lese ' + f.name + ' …';
    decodeFile(f).then(function (a) {
      var maxQ = Math.round(300 * a.sampleRate);
      return runJob({ kind: 'quartz', samples: a.samples.length > maxQ ? a.samples.subarray(0, maxQ) : a.samples, fs: a.sampleRate });
    }).then(applyQuartz).catch(function () { $('quartzOut').textContent = f.size > MAX_FILE ? f.name + ' ist zu gross (höchstens 150 MB).' : f.name + ' konnte nicht gelesen werden.'; });
  });
  $('exportBtn').addEventListener('click', function () {
    var now = new Date(), pad = function (x) { return (x < 10 ? '0' : '') + x; };
    var data = { app: 'Tickwerk', format: 1, version: APP_VERSION, exported: now.toISOString(), watches: watches, measurements: meas, settings: { ppm: settings.ppm } };
    var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    shareOrDownload(blob, 'tickwerk-sicherung-' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '.json', 'Tickwerk Sicherung');
    $('backupOut').textContent = plural(watches.length, 'Uhr', 'Uhren') + ' und ' + plural(meas.length, 'Messung', 'Messungen') + ' gesichert. Die Datei liegt bei den Downloads.';
  });
  $('importIn').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { $('backupOut').textContent = 'Die Datei ist zu gross für eine Tickwerk-Sicherung.'; return; }
    f.text().then(function (txt) {
      var d = JSON.parse(txt);
      if (!d || typeof d !== 'object' || d.app !== 'Tickwerk') throw new Error('keine Tickwerk-Sicherung');
      var ws = list(d.watches, cleanWatch), ms = list(d.measurements, cleanMeas);
      var haveW = Object.create(null), haveM = Object.create(null);
      watches.forEach(function (w) { haveW[w.id] = true; }); meas.forEach(function (m) { haveM[m.id] = true; });
      /* doppelte Einträge auch innerhalb der Datei nur einmal übernehmen, höchstens MAX_WATCHES Uhren */
      var addW = ws.filter(function (w) { if (haveW[w.id]) return false; haveW[w.id] = true; return true; }).slice(0, Math.max(0, MAX_WATCHES - watches.length));
      var addM = ms.filter(function (m) { if (haveM[m.id]) return false; haveM[m.id] = true; return true; });
      watches = watches.concat(addW);
      meas = meas.concat(addM).sort(function (a, b) { return new Date(a.date) - new Date(b.date); }).slice(-MAX_MEAS);
      lastId = meas.reduce(function (a, m) { return Math.max(a, m.id); }, lastId);
      if (d.settings && typeof d.settings.ppm === 'number' && isFinite(d.settings.ppm) && Math.abs(d.settings.ppm) < 500 && !settings.ppm) settings.ppm = d.settings.ppm;
      saveWatches(); saveMeas(); saveSettings(); renderSettings();
      var dup = (ws.length - addW.length) + (ms.length - addM.length);
      $('backupOut').textContent = plural(addW.length, 'Uhr', 'Uhren') + ' und ' + plural(addM.length, 'Messung', 'Messungen') + ' übernommen' + (dup ? ' (' + dup + ' waren schon vorhanden)' : '') + '.';
    }).catch(function (err) {
      $('backupOut').textContent = 'Die Sicherung konnte nicht geladen werden' + (err && err.message ? ' (' + err.message + ')' : '') + '.';
    });
  });
  $('wipeBtn').addEventListener('click', function () {
    if (!window.confirm('Alle Uhren und Messungen auf diesem Handy löschen? Das lässt sich nicht rückgängig machen. Tipp: vorher eine Sicherung speichern.')) return;
    watches = []; meas = []; session = null; settings.watchId = '';
    saveWatches(); saveMeas(); saveSession(); saveSettings();
    clearReadout();
    $('backupOut').textContent = 'Alle Uhren und Messungen sind gelöscht.';
  });

  /* ---------- Mehr, Pro, Anleitung ---------- */
  function renderMore() {
    $('moreVersion').textContent = 'Version ' + APP_VERSION + (FLAVOR === 'test' ? ' · Testversion' : '');
    $('moreProState').textContent = isPro() ? 'Freigeschaltet' : 'Gratis · noch ' + freeLeft() + ' von ' + FREE_PER_WEEK + ' Messungen mit allen Werten diese Woche';
    $('moreHistory').textContent = plural(meas.length, 'Messung', 'Messungen');
    $('versionInfo').textContent = 'Tickwerk ' + APP_VERSION + (FLAVOR === 'test' ? ' (Testversion)' : '') + ' · Mess-Engine ' + (engineVersion || '?');
  }
  function renderPro() {
    var pro = isPro(), card = $('proState'), store = FLAVOR === 'store';
    $('proFree').textContent = 'Gratis bleiben Gangabweichung, Schlagzahl und Papierstreifen für eine Uhr, dazu ' + FREE_PER_WEEK + ' Messungen pro Woche mit allen Werten.';
    var txt;
    if (pro) txt = FLAVOR === 'test' ? 'Testversion: Pro ist zum Ausprobieren freigeschaltet. Es wurde nichts gekauft.' : 'Tickwerk Pro ist freigeschaltet. Danke für die Unterstützung!';
    else if (!store) txt = 'Testversion: «Pro kaufen» schaltet Pro hier nur zum Ausprobieren frei. Es wird nichts verrechnet.';
    else if (billing.svc) txt = 'Preis: ' + priceText() + ' einmalig. Der Kauf gilt für dein Google-Konto, auch auf einem neuen Handy.';
    else txt = 'Kaufen lässt sich Pro in der Tickwerk-App aus dem Google Play Store. In dieser Browser-Version gibt es die Gratis-Funktionen.';
    card.textContent = txt;
    $('proBuy').hidden = pro;
    $('proBuy').textContent = 'Pro kaufen · ' + priceText();
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
      toast(res === 'restored' ? 'Pro ist wiederhergestellt.' : res === 'pending' ? 'Der Kauf ist noch nicht abgeschlossen. Später nochmals versuchen.' :
        res === 'unavailable' ? 'Google Play ist hier nicht erreichbar.' : res === 'error' ? 'Wiederherstellen hat nicht geklappt. Später nochmals versuchen.' : 'Kein Kauf von Tickwerk Pro auf diesem Google-Konto gefunden.');
      afterProChange();
    });
  });
  $('proTestToggle').addEventListener('change', function () { settings.testPro = this.checked; saveSettings(); afterProChange(); });
  $('proTestReset').addEventListener('click', function () { settings.free = { week: '', used: 0 }; saveSettings(); toast('Gratis-Messungen zurückgesetzt: wieder ' + FREE_PER_WEEK + ' diese Woche.'); render(); });
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
    if (!items.length || !window.TickwerkReport) { bar.textContent = 'Für diese Uhr gibt es noch keine Messung.'; return; }
    var out;
    try {
      out = window.TickwerkReport.build({
        watch: w, kal: kalById(w.kaliberId), liftState: liftState(w.id ? w : null), meas: items, appVersion: APP_VERSION + (FLAVOR === 'test' ? ' (Test)' : ''),
        engineVersion: engineVersion, logo: window.TICKWERK_LOGO || null, now: new Date(), subtitle: opt.subtitle, kind: opt.kind
      });
    } catch (e) {
      bar.textContent = 'Das Protokoll konnte nicht erstellt werden (' + (e && e.message || e) + ').'; return;
    }
    var blob = new Blob([out.bytes], { type: 'application/pdf' }), file = null;
    try { file = new File([blob], out.filename, { type: 'application/pdf' }); } catch (e) { /* alte Browser */ }
    if (lastReportUrl) URL.revokeObjectURL(lastReportUrl);
    lastReportUrl = URL.createObjectURL(blob);
    var canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    var share = function () { navigator.share({ files: [file], title: 'Tickwerk Messprotokoll ' + w.name }).catch(function () { /* abgebrochen */ }); };
    bar.innerHTML = '<span class="pdfinfo">' + esc('Protokoll ' + out.number + ' · ' + plural(out.pages, 'Seite', 'Seiten') + ' · ' +
      Math.max(1, Math.round(out.bytes.length / 1024)) + ' KB') + '</span>' +
      (canShare ? '<button type="button" data-p="share">Teilen oder speichern</button>' : '') +
      '<button type="button" data-p="open">Öffnen und drucken</button><button type="button" data-p="dl">Herunterladen</button>';
    if (canShare) bar.querySelector('[data-p="share"]').addEventListener('click', share);
    bar.querySelector('[data-p="open"]').addEventListener('click', function () { window.open(lastReportUrl, '_blank', 'noopener'); });
    bar.querySelector('[data-p="dl"]').addEventListener('click', function () {
      var a = document.createElement('a'); a.href = lastReportUrl; a.download = out.filename;
      document.body.appendChild(a); a.click(); a.remove();
    });
    if (opt.share && canShare) share();
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
  function emptyText(g, text) { g.ctx.fillStyle = C.faint; g.ctx.font = '13px Inter, sans-serif'; g.ctx.fillText(text, 14, g.h / 2 + 4); }
  function drawTape(cv, trace, emptyMsg) {
    var g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    var L = 50, R = 10, T = 8, B = 20;
    if (!trace || !trace.length) { emptyText(g, emptyMsg || 'Noch keine Messung'); return; }
    var tMax = 0, ys0 = trace.map(function (p) { return p.devMs; }).sort(function (a, b) { return a - b; });
    trace.forEach(function (p) { if (p.t > tMax) tMax = p.t; });
    var yMin = ys0[Math.floor(ys0.length * 0.02)], yMax = ys0[Math.ceil(ys0.length * 0.98) - 1];   // Ausreisser bestimmen die Skala nicht
    var mid = (yMin + yMax) / 2, half = Math.max(0.8, (yMax - yMin) / 2 * 1.2);
    yMin = mid - half; yMax = mid + half;
    var X = function (t) { return L + (t / (tMax || 1)) * (w - L - R); };
    var Y = function (v) { return T + (1 - (v - yMin) / (yMax - yMin)) * (h - T - B); };
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
  function drawHistory(items) {
    var cv = $('historyChart'), g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    var L = 46, R = 10, T = 10, B = 20;
    if (!items.length) { emptyText(g, 'Noch keine Messungen'); return; }
    var lo = -8, hi = 10;
    items.forEach(function (m) { lo = Math.min(lo, m.rate - m.sigma); hi = Math.max(hi, m.rate + m.sigma); });
    lo = Math.max(lo, -60); hi = Math.min(hi, 60);
    var X = function (i) { return items.length === 1 ? (L + w - R) / 2 : L + i / (items.length - 1) * (w - L - R); };
    var Y = function (v) { return T + (1 - (v - lo) / (hi - lo)) * (h - T - B); };
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
  function drawLagenChart(st) {
    var cv = $('lagenChart'), g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    var L = 40, R = 8, T = 18, B = 26, rows = st.rows;
    var vals = [];
    rows.forEach(function (r) { if (r.m) vals.push(r.m.rate - r.m.sigma, r.m.rate + r.m.sigma); });
    var lo = Math.min(-8, Math.min.apply(null, vals.concat([0]))), hi = Math.max(10, Math.max.apply(null, vals.concat([0])));
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    var X = function (i) { return L + (i + 0.5) / rows.length * (w - L - R); };
    var Y = function (v) { return T + (1 - (v - lo) / (hi - lo)) * (h - T - B); };
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
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    /* Neue Version im Hintergrund geladen: Knopf zum Neuladen anbieten (nie mitten in einer Messung neu laden) */
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) return;
      $('updateBtn').hidden = false;
      toast('Eine neue Version von Tickwerk ist bereit. Unter «Mehr» neu laden.');
    });
    $('updateBtn').addEventListener('click', function () { if (!rec && !busy) location.reload(); });
    navigator.serviceWorker.register('sw.js').catch(function () { /* ohne Offline-Modus weiter */ });
  }

  /* ---------- Start ---------- */
  var RENDER = { measure: renderMeasure, watches: renderWatches, watch: renderDetail, edit: renderEdit, lagen: renderLagen, lpos: renderLpos, guide: function () {},
    more: renderMore, pro: renderPro, history: renderHistory, settings: renderSettings };
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
  if (!settings.guideSeen) go('guide');
  if (FLAVOR === 'store') {
    billingInit().then(function () { return restorePurchases(); }).then(function (res) {
      if (res === 'restored') afterProChange();
      else if (topScreen() === 'pro') renderPro();
    });
  }
  runJob({ samples: new Float32Array(48000 * 5), fs: 48000, opts: {} }).then(function () { if (topScreen() === 'more') renderMore(); });
})();
