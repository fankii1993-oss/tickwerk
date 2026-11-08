/* Tickwerk Messprotokoll: erzeugt ein PDF (A4) direkt im Browser, ohne Fremdbibliothek.
   Schrift: Helvetica (eine der 14 Standardschriften jedes PDF-Programms), Grafiken als Vektor. */
(function (global) {
  'use strict';

  /* ---------- Schrift: Breiten (1/1000 em) für WinAnsi 32..255 ---------- */
  var WR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
  var WB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];
  var WIDTHS = { R: WR, B: WB, I: WR };
  var FONTKEY = { R: 'F1', B: 'F2', I: 'F3' };
  var SPECIAL = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
    0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
    0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
    0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
    0x2212: 0x96,                 /* Minuszeichen: Halbgeviertstrich, gleich breit wie die Ziffern */
    0x00A0: 0x20, 0x2009: 0x20, 0x202F: 0x20, 0x2011: 0x2D
  };
  function winAnsi(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 32 && c < 127) out.push(c);
      else if (SPECIAL[c] !== undefined) out.push(SPECIAL[c]);
      else if (c >= 0xA1 && c <= 0xFF) out.push(c);
      else if (c === 0x2192) out.push(0x2D, 0x3E);
      else if (c === 0x2264) out.push(0x3C, 0x3D);
      else if (c === 0x2265) out.push(0x3E, 0x3D);
      else if (c >= 0xD800 && c <= 0xDBFF) { out.push(0x3F); i++; }
      else if (c === 10 || c === 13 || c === 9) out.push(0x20);
      else out.push(0x3F);
    }
    return out;
  }
  function widthOf(bytes, font, size, spacing) {
    var t = WIDTHS[font] || WR, s = 0;
    for (var i = 0; i < bytes.length; i++) s += t[bytes[i] - 32] || 0;
    return s * size / 1000 + (spacing || 0) * bytes.length;
  }
  function textWidth(str, font, size, spacing) { return widthOf(winAnsi(String(str)), font, size, spacing); }
  function pdfStr(bytes) {
    var s = '(';
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      if (b === 40 || b === 41 || b === 92) s += '\\' + String.fromCharCode(b);
      else if (b < 32 || b > 126) s += '\\' + ('00' + b.toString(8)).slice(-3);
      else s += String.fromCharCode(b);
    }
    return s + ')';
  }
  function utf16(str) {
    var h = 'FEFF';
    for (var i = 0; i < str.length; i++) h += ('000' + str.charCodeAt(i).toString(16).toUpperCase()).slice(-4);
    return '<' + h + '>';
  }
  function num(v) { return String(Math.round(v * 100) / 100); }
  function num3(v) { return String(Math.round(v * 1000) / 1000); }
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(num3).join(' '); }
  /* Zeilenumbruch nach Wörtern; überlange Wörter werden hart getrennt */
  function wrap(str, font, size, maxW) {
    var lines = [];
    String(str).split('\n').forEach(function (para) {
      var words = para.split(' '), line = '';
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (textWidth(t, font, size) <= maxW || !line) {
          line = t;
          while (textWidth(line, font, size) > maxW && line.length > 1) {   /* einzelnes Wort zu lang */
            var cut = line.length - 1;
            while (cut > 1 && textWidth(line.slice(0, cut), font, size) > maxW) cut--;
            lines.push(line.slice(0, cut)); line = line.slice(cut);
          }
        } else { lines.push(line); line = w; }
      });
      lines.push(line);
    });
    return lines;
  }

  /* ---------- Kleiner PDF-Schreiber (Koordinaten: oben links = 0, in Punkt) ---------- */
  function Pdf() { this.W = 595.28; this.H = 841.89; this.pages = []; this.page = null; }
  Pdf.prototype.addPage = function () { this.page = []; this.pages.push(this.page); return this; };
  Pdf.prototype.op = function (s) { this.page.push(s); return this; };
  Pdf.prototype.fill = function (hex) { return this.op(rgb(hex) + ' rg'); };
  Pdf.prototype.stroke = function (hex) { return this.op(rgb(hex) + ' RG'); };
  Pdf.prototype.lw = function (w) { return this.op(num3(w) + ' w'); };
  Pdf.prototype.cap = function (c) { return this.op((c === 'round' ? 1 : c === 'square' ? 2 : 0) + ' J'); };
  Pdf.prototype.join = function (j) { return this.op((j === 'round' ? 1 : j === 'bevel' ? 2 : 0) + ' j'); };
  Pdf.prototype.dash = function (a) { return this.op('[' + (a || []).map(num).join(' ') + '] 0 d'); };
  Pdf.prototype.save = function () { return this.op('q'); };
  Pdf.prototype.restore = function () { return this.op('Q'); };
  Pdf.prototype.path = function (cmds, mode) {
    var H = this.H, out = [];
    cmds.forEach(function (c) {
      if (c[0] === 'h') out.push('h');
      else if (c[0] === 'c') out.push(num(c[1]) + ' ' + num(H - c[2]) + ' ' + num(c[3]) + ' ' + num(H - c[4]) + ' ' + num(c[5]) + ' ' + num(H - c[6]) + ' c');
      else out.push(num(c[1]) + ' ' + num(H - c[2]) + ' ' + c[0]);
    });
    out.push(mode || 'f');
    return this.op(out.join(' '));
  };
  Pdf.prototype.rect = function (x, y, w, h, mode) { return this.op(num(x) + ' ' + num(this.H - y - h) + ' ' + num(w) + ' ' + num(h) + ' re ' + (mode || 'f')); };
  Pdf.prototype.rrect = function (x, y, w, h, r, mode) {
    var k = 0.5523 * r;
    return this.path([['m', x + r, y], ['l', x + w - r, y], ['c', x + w - r + k, y, x + w, y + r - k, x + w, y + r], ['l', x + w, y + h - r],
      ['c', x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h], ['l', x + r, y + h], ['c', x + r - k, y + h, x, y + h - r + k, x, y + h - r],
      ['l', x, y + r], ['c', x, y + r - k, x + r - k, y, x + r, y], ['h']], mode);
  };
  Pdf.prototype.line = function (x1, y1, x2, y2) { return this.op(num(x1) + ' ' + num(this.H - y1) + ' m ' + num(x2) + ' ' + num(this.H - y2) + ' l S'); };
  Pdf.prototype.poly = function (pts, mode) {
    var H = this.H;
    return this.op(pts.map(function (p, i) { return num(p[0]) + ' ' + num(H - p[1]) + (i ? ' l' : ' m'); }).join(' ') + ' ' + (mode || 'S'));
  };
  Pdf.prototype.circle = function (cx, cy, r, mode) {
    var k = 0.5523 * r;
    return this.path([['m', cx + r, cy], ['c', cx + r, cy + k, cx + k, cy + r, cx, cy + r], ['c', cx - k, cy + r, cx - r, cy + k, cx - r, cy],
      ['c', cx - r, cy - k, cx - k, cy - r, cx, cy - r], ['c', cx + k, cy - r, cx + r, cy - k, cx + r, cy], ['h']], mode);
  };
  /* Punkt als Linie der Länge 0 mit runden Enden: klein und sauber (PDF-Norm, Abschnitt Linienenden) */
  Pdf.prototype.dot = function (x, y) { var a = num(x) + ' ' + num(this.H - y); return this.op(a + ' m ' + a + ' l S'); };
  Pdf.prototype.text = function (str, x, y, o) {
    o = o || {};
    var size = o.size || 9, font = o.font || 'R', sp = o.spacing || 0, bytes = winAnsi(String(str));
    var w = widthOf(bytes, font, size, sp);
    if (o.align === 'right') x -= w; else if (o.align === 'center') x -= w / 2;
    if (o.color) this.fill(o.color);
    return this.op('BT /' + FONTKEY[font] + ' ' + num(size) + ' Tf ' + num3(sp) + ' Tc ' + num(x) + ' ' + num(this.H - y) + ' Td ' + pdfStr(bytes) + ' Tj ET');
  };
  /* SVG-Pfad (M L H V C Q Z, absolut und relativ) an Stelle (tx, ty) mit Massstab s */
  Pdf.prototype.svgPath = function (d, tx, ty, s, mode) {
    var H = this.H, tk = d.match(/[MmLlHhVvCcQqZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
    var i = 0, cmd = 'M', x = 0, y = 0, sx = 0, sy = 0, out = [];
    function P(a, b) { return num(tx + a * s) + ' ' + num(H - (ty + b * s)); }
    function n() { return parseFloat(tk[i++]); }
    while (i < tk.length) {
      if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
      var rel = cmd >= 'a', C = cmd.toUpperCase(), a, b;
      if (C === 'Z') { out.push('h'); x = sx; y = sy; continue; }
      if (C === 'M') { a = n(); b = n(); if (rel) { a += x; b += y; } x = sx = a; y = sy = b; out.push(P(x, y) + ' m'); cmd = rel ? 'l' : 'L'; }
      else if (C === 'L') { a = n(); b = n(); if (rel) { a += x; b += y; } x = a; y = b; out.push(P(x, y) + ' l'); }
      else if (C === 'H') { a = n(); x = rel ? x + a : a; out.push(P(x, y) + ' l'); }
      else if (C === 'V') { b = n(); y = rel ? y + b : b; out.push(P(x, y) + ' l'); }
      else if (C === 'C') {
        var x1 = n(), y1 = n(), x2 = n(), y2 = n(), x3 = n(), y3 = n();
        if (rel) { x1 += x; y1 += y; x2 += x; y2 += y; x3 += x; y3 += y; }
        out.push(P(x1, y1) + ' ' + P(x2, y2) + ' ' + P(x3, y3) + ' c'); x = x3; y = y3;
      } else if (C === 'Q') {
        var qx = n(), qy = n(), ex = n(), ey = n();
        if (rel) { qx += x; qy += y; ex += x; ey += y; }
        out.push(P(x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y)) + ' ' + P(ex + 2 / 3 * (qx - ex), ey + 2 / 3 * (qy - ey)) + ' ' + P(ex, ey) + ' c');
        x = ex; y = ey;
      } else { i++; }
    }
    out.push(mode || 'f');
    return this.op(out.join(' '));
  };
  Pdf.prototype.output = function (info) {
    var self = this, objs = [null, null];
    function add(s) { objs.push(s); return objs.length; }
    var fR = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    var fB = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    var fI = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
    var dt = info.date, p2 = function (v) { return (v < 10 ? '0' : '') + v; };
    var off = -dt.getTimezoneOffset(), dateStr = 'D:' + dt.getFullYear() + p2(dt.getMonth() + 1) + p2(dt.getDate()) + p2(dt.getHours()) +
      p2(dt.getMinutes()) + p2(dt.getSeconds()) + (off >= 0 ? '+' : '-') + p2(Math.floor(Math.abs(off) / 60)) + "'" + p2(Math.abs(off) % 60) + "'";
    var infoNo = add('<< /Title ' + utf16(info.title) + ' /Subject ' + utf16(info.subject || '') + ' /Creator ' + utf16('Tickwerk') +
      ' /Producer ' + utf16('Tickwerk ' + (info.version || '')) + ' /CreationDate (' + dateStr + ') >>');
    var kids = [];
    this.pages.forEach(function (ops) {
      var content = ops.join('\n');
      var cNo = add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
      var pNo = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(self.W) + ' ' + num(self.H) + '] /Resources << /Font << /F1 ' + fR +
        ' 0 R /F2 ' + fB + ' 0 R /F3 ' + fI + ' 0 R >> >> /Contents ' + cNo + ' 0 R >>');
      kids.push(pNo + ' 0 R');
    });
    objs[0] = '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >> >>';
    objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
    var body = '%PDF-1.4\n%âãÏÓ\n', offs = [];
    objs.forEach(function (o, k) { offs.push(body.length); body += (k + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    var xref = body.length;
    body += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offs.forEach(function (o) { body += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
    body += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + infoNo + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    var bytes = new Uint8Array(body.length);
    for (var i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 255;
    return bytes;
  };

  /* ---------- Format und Auswertung ---------- */
  var C = {
    ink: '#0E1B26', text: '#25323E', muted: '#56636F', faint: '#7E8B97', line: '#C9D1D9', hair: '#E1E6EB', box: '#F2F5F8',
    band: '#E1EFD5', bandText: '#3F7A22', tick: '#4E9A2E', tock: '#2B7BB9', warn: '#A9531C', g1: '#CFE3C2', g2: '#C6DBEC', dotOff: '#AEB8C2'
  };
  var POS_ORDER = ['ZO', 'ZU', 'KU', 'KO', 'KL', 'KR'];
  var POS_NAME = { ZO: 'Zifferblatt oben', ZU: 'Zifferblatt unten', KU: 'Krone unten', KO: 'Krone oben', KL: 'Krone links', KR: 'Krone rechts' };
  var HORIZ = { ZO: true, ZU: true };
  var MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /* Sprache: build() setzt sie aus d.lang. Übersetzt wird mit d.tr (T aus app.js: deutscher Text -> Englisch, {Platzhalter}); ohne d.tr Deutsch. */
  var LG = { en: false, T: fill };
  function fill(s, v) {
    return v ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(v, k) ? String(v[k]) : m; }) : s;
  }
  function T(s, v) { return LG.T(s, v); }
  function capF(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function posName(p) { return POS_NAME[p] ? T(POS_NAME[p]) : (p || ''); }

  function fmt(v, d) { return LG.en ? v.toFixed(d) : v.toFixed(d).replace('.', ','); }
  function signed(v, d) { var s = fmt(Math.abs(v), d); return (v < 0 && /[1-9]/.test(s) ? '−' : '+') + s; }
  function thousands(n) { var s = String(Math.round(Math.abs(n))), o = ''; while (s.length > 3) { o = (LG.en ? ',' : '’') + s.slice(-3) + o; s = s.slice(0, -3); } return (n < 0 ? '−' : '') + s + o; }
  function p2(v) { return (v < 10 ? '0' : '') + v; }
  function dShort(d) { return p2(d.getDate()) + (LG.en ? '/' : '.') + p2(d.getMonth() + 1) + (LG.en ? '/' : '.') + d.getFullYear(); }
  function dTime(d) { return dShort(d) + ', ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function dLong(d) { return LG.en ? d.getDate() + ' ' + MONTHS_EN[d.getMonth()] + ' ' + d.getFullYear() : d.getDate() + '. ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function mean(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; }
  function deg(v) { return fmt(v, v % 1 ? 1 : 0) + '°'; }
  /* Wie in der App: gewertet bis ±1,5 s/Tag bei gutem Signal; schwankte der Gang während der Messung, mit Vermerk */
  function counted(m) { return m.q !== 'schwach' && m.sigma <= 1.5; }
  function reason(m) {
    if (m.q === 'schwach') return T('Signal schwach');
    if (m.stable === false) return T('Gang schwankt zu stark');
    return T('Unsicherheit gross');
  }
  function hash4(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000' + (h >>> 0).toString(16).toUpperCase()).slice(-4);
  }
  function niceStep(range, target) {
    var raw = range / target, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }

  /* ---------- Protokoll ---------- */
  function build(d) {
    LG.en = d.lang === 'en';
    LG.T = typeof d.tr === 'function' ? d.tr : fill;
    var pdf = new Pdf().addPage();
    var W = pdf.W, ML = 50, CW = W - 100, LIMIT = pdf.H - 70;
    var now = d.now || new Date();
    var meas = d.meas.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    var ok = meas.filter(counted);
    var nr = 'TW-' + now.getFullYear() + p2(now.getMonth() + 1) + p2(now.getDate()) + '-' +
      hash4((d.watch.id || '') + '|' + meas.map(function (m) { return m.id; }).join(',') + '|' + now.getTime());
    var k = d.kal, lift = d.watch.liftAngle || 52, liftState = d.liftState || '';

    /* Auswertung je Lage: nur gewertete Messungen */
    var byPos = Object.create(null);
    ok.forEach(function (m) { (byPos[m.pos] = byPos[m.pos] || []).push(m); });
    var rows = POS_ORDER.filter(function (p) { return byPos[p]; }).map(function (p) {
      var a = byPos[p];
      return {
        pos: p, n: a.length,
        rate: mean(a.map(function (m) { return m.rate; })),
        be: mean(a.filter(function (m) { return m.beOk; }).map(function (m) { return m.be; })),
        amp: mean(a.filter(function (m) { return m.ampOk && m.amp; }).map(function (m) { return m.amp; }))
      };
    });
    var meanRate = rows.length ? mean(rows.map(function (r) { return r.rate; })) : null;
    var spread = rows.length >= 2 ? Math.max.apply(null, rows.map(function (r) { return r.rate; })) - Math.min.apply(null, rows.map(function (r) { return r.rate; })) : null;
    var hRows = rows.filter(function (r) { return HORIZ[r.pos]; }), vRows = rows.filter(function (r) { return !HORIZ[r.pos]; });
    var hv = hRows.length && vRows.length ? mean(vRows.map(function (r) { return r.rate; })) - mean(hRows.map(function (r) { return r.rate; })) : null;
    var beMean = mean(ok.filter(function (m) { return m.beOk; }).map(function (m) { return m.be; }));
    var ampH = mean(ok.filter(function (m) { return HORIZ[m.pos] && m.ampOk && m.amp; }).map(function (m) { return m.amp; }));
    var ampV = mean(ok.filter(function (m) { return !HORIZ[m.pos] && m.ampOk && m.amp; }).map(function (m) { return m.amp; }));
    var bphs = Object.create(null); meas.forEach(function (m) { if (m.bph) bphs[m.bph] = (bphs[m.bph] || 0) + 1; });
    var bphMain = Object.keys(bphs).sort(function (a, b) { return bphs[b] - bphs[a]; })[0];

    var y = 0;
    function section(title, minSpace) {
      need((minSpace || 60) + 22);
      y += 18;
      pdf.text(title.toUpperCase(), ML, y, { font: 'B', size: 7.5, spacing: 0.9, color: C.muted });
      pdf.stroke(C.line).lw(0.5).line(ML, y + 5, ML + CW, y + 5);
      y += 17;
    }
    function need(h) { if (y + h > LIMIT) newPage(); }
    function newPage() {
      pdf.addPage();
      drawLogo(16, 0.24);
      pdf.text(T('Messprotokoll') + ' ' + nr, ML + CW, 36, { font: 'B', size: 8.5, align: 'right', color: C.ink });
      pdf.text(d.watch.name, ML + CW, 47, { size: 8, align: 'right', color: C.muted });
      pdf.stroke(C.line).lw(0.5).line(ML, 60, ML + CW, 60);
      y = 66;
    }
    function drawLogo(top, s) {
      var L = d.logo;
      if (!L) { pdf.text('Tickwerk', ML, top + 30 * s, { font: 'B', size: 52 * s, color: C.ink }); return 0; }
      var pal = L.palette;
      L.mark.forEach(function (it) {
        pdf.save();
        if (it.stroke) pdf.stroke(pal[it.role]).lw(it.w * s).cap(it.cap).join(it.join).svgPath(it.d, ML, top, s, 'S');
        else pdf.fill(pal[it.role]).svgPath(it.d, ML, top, s, 'f');
        pdf.restore();
      });
      pdf.save().fill(pal.text).svgPath(L.wordmark.d, ML + 124 * s, top + (50 + L.wordmark.capHeight / 2) * s, s, 'f').restore();
      return (124 + L.wordmark.width) * s;
    }
    function guilloche(top, h) {
      pdf.save().lw(0.32).cap('round').join('round');
      [{ col: C.g1, lam: 58, n: 6, amp: 0.40, ph: 0 }, { col: C.g2, lam: 41, n: 6, amp: 0.34, ph: 0.9 }].forEach(function (f) {
        pdf.stroke(f.col);
        for (var j = 0; j < f.n; j++) {
          var ph = f.ph + j / f.n * Math.PI, pts = [];
          for (var xx = 0; xx <= CW + 0.01; xx += 3) {
            var env = 0.72 + 0.28 * Math.cos(xx / (f.lam * 3.7) * 2 * Math.PI + j * 0.6);
            pts.push([ML + xx, top + h / 2 + f.amp * h * env * Math.sin(xx / f.lam * 2 * Math.PI + ph)]);
          }
          pdf.poly(pts, 'S');
        }
      });
      pdf.restore();
    }
    function kvBlock(pairs, x, w, labelW, startY) {
      var yy = startY;
      pairs.forEach(function (p) {
        var lines = wrap(p[1], p[2] ? 'B' : 'R', 9, w - labelW);
        pdf.text(p[0], x, yy, { size: 8, color: C.muted });
        lines.forEach(function (ln, i) { pdf.text(ln, x + labelW, yy + i * 11.5, { size: 9, font: p[2] ? 'B' : 'R', color: C.ink }); });
        if (p[3]) pdf.text(p[3], x + labelW, yy + lines.length * 11.5 - 1, { size: 7.2, color: p[4] || C.faint });
        yy += lines.length * 11.5 + (p[3] ? 9.5 : 0) + 6;
      });
      return yy;
    }
    /* Tabelle mit Kopfzeile, Zebrastreifen und Seitenumbruch */
    function table(cols, data, opt) {
      opt = opt || {};
      var fs = opt.size || 8, lh = fs + 3.2;
      function head() {
        pdf.fill(C.box).rect(ML, y - 2, CW, 16, 'f');
        var x = ML;
        cols.forEach(function (c) {
          pdf.text(c.t, c.align === 'right' ? x + c.w - 5 : x + 5, y + 9, { font: 'B', size: 7, color: C.muted, align: c.align === 'right' ? 'right' : 'left' });
          x += c.w;
        });
        y += 18;
      }
      head();
      data.forEach(function (r, ri) {
        var cells = cols.map(function (c, i) { return wrap(r.cells[i] == null ? '–' : r.cells[i], c.font || 'R', fs, c.w - 10); });
        var hgt = Math.max.apply(null, cells.map(function (l) { return l.length; })) * lh + 5;
        if (y + hgt > LIMIT) { newPage(); y += 6; head(); }
        if (ri % 2 === 1) pdf.fill('#F7F9FA').rect(ML, y - 3, CW, hgt, 'f');
        var x = ML;
        cols.forEach(function (c, i) {
          var col = (r.colors && r.colors[i]) || (r.dim ? C.faint : C.ink);
          cells[i].forEach(function (ln, li) {
            pdf.text(ln, c.align === 'right' ? x + c.w - 5 : x + 5, y + 7 + li * lh, { size: fs, font: c.font || 'R', color: col, align: c.align === 'right' ? 'right' : 'left' });
          });
          x += c.w;
        });
        y += hgt;
      });
      pdf.stroke(C.line).lw(0.5).line(ML, y - 2, ML + CW, y - 2);
      y += 4;
    }
    function bullets(items, size) {
      size = size || 8.4;
      items.forEach(function (t) {
        var lines = wrap(t, 'R', size, CW - 14);
        need(lines.length * (size + 3.4) + 4);
        pdf.fill(C.muted).circle(ML + 3, y - 2.6, 1.3, 'f');
        lines.forEach(function (ln, i) { pdf.text(ln, ML + 12, y + i * (size + 3.4), { size: size, color: C.text }); });
        y += lines.length * (size + 3.4) + 4.5;
      });
    }
    function para(t, size, color, font) {
      size = size || 8.6;
      var lines = wrap(t, font || 'R', size, CW);
      need(lines.length * (size + 3.4));
      lines.forEach(function (ln, i) { pdf.text(ln, ML, y + i * (size + 3.4), { size: size, color: color || C.text, font: font || 'R' }); });
      y += lines.length * (size + 3.4);
    }

    /* ---- Kopf, Seite 1 ---- */
    var top = 40;
    drawLogo(top, 0.4);
    pdf.text(T('Messprotokoll'), ML + CW, top + 19, { font: 'B', size: 21, align: 'right', color: C.ink });
    pdf.text(d.subtitle || T('Gangmessung einer mechanischen Armbanduhr'), ML + CW, top + 32, { size: 8.5, align: 'right', color: C.muted });
    pdf.text(T('Nr. {nr}  ·  erstellt am {d}', { nr: nr, d: dLong(now) }), ML + CW, top + 44, { size: 8, align: 'right', color: C.muted });
    guilloche(top + 56, 20);
    y = top + 84;

    /* ---- Uhr ---- */
    section(T('Uhr'), 90);
    var first = new Date(meas[0].date), last = new Date(meas[meas.length - 1].date);
    var bphTxt = bphMain ? T('{bph} A/h (erkannt)', { bph: thousands(bphMain) }) : '–';
    var bphNote = d.watch.bph && bphMain && +bphMain !== d.watch.bph ? T('hinterlegt: {bph} A/h', { bph: thousands(d.watch.bph) }) : '';
    var liftNote = liftState === 'unbestätigt' ? T('vom Basiswerk übernommen, nicht bestätigt') :
      liftState === 'angenommen' ? T('Wert des Werks unbekannt, angenommen') :
      (k && k.quelle && k.hebewinkel === lift ? T('Quelle: {q}', { q: d.kalSource || k.quelle }) : T('Angabe des Besitzers'));
    var left = [[T('Bezeichnung'), d.watch.name, true],
      [T('Werk (Kaliber)'), k ? d.kalName || k.name : T('nicht angegeben'), false, k ? T('nach Angabe des Besitzers, nicht am Werk geprüft') : ''],
      [T('Schlagzahl'), bphTxt, false, bphNote]];
    var right = [[T('Hebewinkel'), deg(lift), false, liftNote, liftState ? C.warn : null],
      [T('Messzeitraum'), dShort(first) === dShort(last) ? dShort(first) : T('{a} bis {b}', { a: dShort(first), b: dShort(last) })],
      [capF(T('Messungen')), T(meas.length === 1 ? '{n} Messung, davon {k} gewertet' : '{n} Messungen, davon {k} gewertet', { n: meas.length, k: ok.length })]];
    var y1 = kvBlock(left, ML, CW / 2 - 12, 74, y), y2 = kvBlock(right, ML + CW / 2 + 6, CW / 2 - 6, 68, y);
    y = Math.max(y1, y2) - 4;

    /* ---- Ergebnis ---- */
    section(T('Ergebnis'), 150);
    var boxTop = y - 6, boxH = 152;
    pdf.fill(C.box).rrect(ML, boxTop, CW, boxH, 8, 'f');
    var cells = [
      [T('Mittlerer Gang'), meanRate == null ? '–' : signed(meanRate, 1), T('s/Tag'),
        rows.length ? T(rows.length === 1 ? 'Mittel aus {n} Lage' : 'Mittel aus {n} Lagen', { n: rows.length }) : T('keine gewertete Messung')],
      [T('Lagendifferenz'), spread == null ? '–' : fmt(spread, 1), spread == null ? '' : T('s/Tag'), spread == null ? T('erst ab 2 Lagen') : T('grösster minus kleinster Gang')],
      [T('Abfallfehler'), beMean == null ? '–' : fmt(beMean, 2), beMean == null ? '' : 'ms', beMean == null ? T('kein sicherer Wert') : T('Mittel der sicheren Werte')],
      [T('Amplitude'), ampH == null && ampV == null ? '–' : (ampH != null ? Math.round(ampH) + '°' : '–') + (ampV != null ? ' / ' + Math.round(ampV) + '°' : ''), '',
        ampH == null && ampV == null ? T('kein sicherer Wert') :
        T(ampH != null && ampV != null ? 'waagrecht / senkrecht' : ampH != null ? 'waagrecht' : 'senkrecht') + (d.kal && d.kal.coaxial ? T(', Richtwert') : '')]
    ];
    var cw4 = (CW - 28) / 4;
    cells.forEach(function (c, i) {
      var x = ML + 14 + i * cw4;
      pdf.text(c[0].toUpperCase(), x, boxTop + 20, { font: 'B', size: 6.8, spacing: 0.6, color: C.muted });
      pdf.text(c[1], x, boxTop + 42, { font: 'B', size: 19, color: C.ink });
      if (c[2]) pdf.text(c[2], x + textWidth(c[1], 'B', 19) + 3, boxTop + 42, { size: 8.5, color: C.muted });
      pdf.text(c[3], x, boxTop + 54, { size: 7, color: C.faint });
    });
    rateScale(ML + 14, boxTop + 70, CW - 28);
    y = boxTop + boxH + 10;
    var verdict;
    if (meanRate == null) verdict = T('Keine Messung erfüllt die Bedingungen für die Wertung (siehe Hinweise). Darum stehen hier keine Mittelwerte.');
    else {
      verdict = T('Mittlerer Gang {v} s/Tag aus {m} in {p}.', {
        v: signed(meanRate, 1), m: T(ok.length === 1 ? '{n} gewerteten Messung' : '{n} gewerteten Messungen', { n: ok.length }),
        p: T(rows.length === 1 ? '{n} Lage' : '{n} Lagen', { n: rows.length })
      }) + ' ';
      verdict += meanRate >= -4 && meanRate <= 6
        ? T('Er liegt im Bereich, den die Chronometer-Norm ISO 3159 für den mittleren Tagesgang verlangt (−4 bis +6 s/Tag). Das ist ein Vergleich, kein Chronometer-Nachweis.')
        : T('Er liegt ausserhalb des Bereichs, den die Chronometer-Norm ISO 3159 für den mittleren Tagesgang verlangt (−4 bis +6 s/Tag).');
    }
    para(verdict, 8.6);

    function rateScale(x, top, w) {
      var vals = meas.map(function (m) { return m.rate; }).concat(meanRate == null ? [] : [meanRate]);
      var need2 = Math.max.apply(null, vals.map(Math.abs).concat([0])) + 2, lim = 20;
      [20, 30, 50, 100, 200, 500].some(function (b) { lim = b; return b >= need2; });
      var X = function (v) { return x + (Math.max(-lim, Math.min(lim, v)) + lim) / (2 * lim) * w; };
      var axis = top + 34, dy = top + 21;
      pdf.fill(C.band).rect(X(-4), top + 8, X(6) - X(-4), 26, 'f');
      pdf.stroke(C.line).lw(0.6).line(x, axis, x + w, axis);
      var st = lim <= 20 ? 5 : lim <= 50 ? 10 : niceStep(lim, 4);
      for (var v = -lim; v <= lim + 1e-9; v += st) {
        pdf.stroke(C.line).lw(0.5).line(X(v), axis, X(v), axis + 3.5);
        pdf.text(v === 0 ? '0' : signed(v, 0), X(v), axis + 12, { size: 6.8, align: 'center', color: C.faint });
      }
      pdf.save().cap('round');
      meas.forEach(function (m) { if (!counted(m)) pdf.stroke(C.dotOff).lw(0.8).circle(X(m.rate), dy, 2.1, 'S'); });
      meas.forEach(function (m) { if (counted(m)) pdf.stroke(C.ink).lw(4.4).dot(X(m.rate), dy); });
      pdf.restore();
      if (meanRate != null) {
        pdf.stroke(C.tock).lw(1.2).line(X(meanRate), top + 8, X(meanRate), axis);
        var lx = Math.max(x + 24, Math.min(x + w - 24, X(meanRate)));
        pdf.text(T('Mittel') + ' ' + signed(meanRate, 1), lx, top + 4.5, { size: 6.8, font: 'B', align: 'center', color: C.tock });
      }
      /* Legende */
      var ly = axis + 26, lx2 = x;
      pdf.fill(C.band).rect(lx2, ly - 6, 12, 7, 'f');
      var lg1 = T('Chronometer-Norm −4 bis +6 s/Tag (nur Vergleich)'), lg2 = T('gewertet'), lg3 = T('nicht gewertet');
      pdf.text(lg1, lx2 + 16, ly, { size: 6.6, color: C.muted });
      lx2 += 16 + textWidth(lg1, 'R', 6.6) + 14;
      pdf.save().cap('round').stroke(C.ink).lw(4.2).dot(lx2 + 2, ly - 2.3).restore();
      pdf.text(lg2, lx2 + 8, ly, { size: 6.6, color: C.muted });
      lx2 += 8 + textWidth(lg2, 'R', 6.6) + 14;
      pdf.stroke(C.dotOff).lw(0.8).circle(lx2 + 2, ly - 2.3, 2.1, 'S');
      pdf.text(lg3, lx2 + 8, ly, { size: 6.6, color: C.muted });
      lx2 += 8 + textWidth(lg3, 'R', 6.6) + 14;
      pdf.stroke(C.tock).lw(1.2).line(lx2 + 2, ly - 6, lx2 + 2, ly + 1);
      pdf.text(T('Mittel'), lx2 + 7, ly, { size: 6.6, color: C.muted });
      pdf.text(T('Gang in s/Tag'), x + w, ly, { size: 6.6, align: 'right', color: C.faint });
    }

    /* ---- Ergebnisse je Lage ---- */
    section(T('Ergebnisse je Lage'), 70);
    if (!rows.length) para(T('Keine gewertete Messung.'), 8.6, C.muted);
    else {
      table([{ t: T('Lage'), w: 150 }, { t: T('Gewertet'), w: 70, align: 'right' }, { t: T('Gang (s/Tag)'), w: 95, align: 'right' },
        { t: T('Abfallfehler (ms)'), w: 95, align: 'right' }, { t: T('Amplitude'), w: CW - 410, align: 'right' }],
        rows.map(function (r) {
          return { cells: [posName(r.pos) + ' ' + T(HORIZ[r.pos] ? '(waagrecht)' : '(senkrecht)'), String(r.n), signed(r.rate, 1),
            r.be == null ? '–' : fmt(r.be, 2), r.amp == null ? '–' : Math.round(r.amp) + '°'] };
        }));
      var extra = [];
      if (spread != null) extra.push(T('Lagendifferenz (grösster minus kleinster Gang): {v} s/Tag.', { v: fmt(spread, 1) }));
      if (hv != null) extra.push(T('Mittel senkrecht minus Mittel waagrecht: {v} s/Tag.', { v: signed(hv, 1) }));
      if (rows.length < 6) extra.push(T('Gemessen in {n} von 6 Lagen.', { n: rows.length }));
      if (extra.length) { y += 4; para(extra.join(' '), 8, C.muted); }
    }

    /* ---- Einzelmessungen ---- */
    section(T('Einzelmessungen'), 60);
    table([{ t: T('Nr.'), w: 24, align: 'right' }, { t: T('Datum, Zeit'), w: 72 }, { t: T('Lage'), w: 70 }, { t: T('Dauer'), w: 32, align: 'right' },
      { t: T('Gang s/Tag'), w: 52, align: 'right' }, { t: T('Abfallf. ms'), w: 50, align: 'right' }, { t: T('Amplitude'), w: 50, align: 'right' },
      { t: T('Signal'), w: 40 }, { t: T('Bemerkung'), w: CW - 390 }],
      meas.map(function (m, i) {
        var dt = new Date(m.date), note = [];
        if (!counted(m)) note.push(T('nicht gewertet: {r}', { r: reason(m) }));
        else if (m.stable === false) note.push(T('Gang schwankt'));
        if (m.beOk === false) note.push(T('Abfallfehler unsicher'));
        if (m.amp && !m.ampOk) note.push(T('Amplitude unsicher'));
        if (m.source === 'Datei') note.push(T('aus Datei'));
        var c = counted(m);
        return {
          dim: !c,
          cells: [String(i + 1), dTime(dt), posName(m.pos) || '–', m.dur ? fmt(m.dur, 0) + ' s' : '–',
            signed(m.rate, 1) + ' ±' + fmt(m.sigma, m.sigma < 0.1 ? 2 : 1), fmt(m.be, 2) + (m.beOk === false ? '*' : ''),
            m.amp ? Math.round(m.amp) + '°' + (m.ampOk ? '' : '*') : '–', ({ stark: T('stark'), mittel: T('mittel'), schwach: T('schwach') })[m.q] || m.q || '–',
            note.join('; ')]
        };
      }), { size: 7.6 });
    para(T('* unsicherer Wert, nicht in den Mittelwerten. ± = statistische Unsicherheit der einzelnen Messung.'), 7, C.faint);

    /* ---- Verlauf ---- */
    if (ok.length >= 2) {
      section(T('Gang im Verlauf'), 116);
      chartHistory(ML, y, CW, 108);
      y += 114;
    }

    /* ---- Papierstreifen ---- */
    var withTr = meas.filter(function (m) { return m.tr && m.tr.t && m.tr.t.length > 10; });
    if (withTr.length) {
      var good = withTr.filter(counted), lm = (good.length ? good : withTr)[(good.length ? good : withTr).length - 1], li = meas.indexOf(lm) + 1;
      section(T('Papierstreifen der Messung Nr. {n}', { n: li }), 130);
      chartTape(ML, y, CW, 104, lm.tr);
      y += 110;
      para(T('Messung Nr. {n} vom {d}, {pos}, Gang {v} s/Tag. Grün: Tick, blau: Tack. Steigende Spur: Uhr geht vor. Abstand der beiden Spuren: Abfallfehler.',
        { n: li, d: dTime(new Date(lm.date)), pos: posName(lm.pos), v: signed(lm.rate, 1) }), 7.4, C.muted);
    }

    /* ---- Messbedingungen ---- */
    section(T('Messbedingungen'), 90);
    var ppms = meas.filter(function (m) { return typeof m.ppm === 'number'; });
    var ppmUsed = ppms.filter(function (m) { return m.ppm; });
    var fsList = meas.filter(function (m) { return m.fs; }).map(function (m) { return Math.round(m.fs / 100) / 10; });
    var cond = [
      [T('Messgerät'), T('Smartphone-Mikrofon, Web-App Tickwerk {a}, Mess-Engine {e}', { a: d.appVersion || '', e: d.engineVersion || '?' })],
      [T('Aufnahme'), recText()],
      [T('Zeitbasis'), ppmUsed.length ? T('Uhr des Smartphones, mit Quarzuhr-Aufnahme um {v} ppm korrigiert', { v: signed(ppmUsed[ppmUsed.length - 1].ppm, 1) })
        : T('Uhr des Smartphones, nicht mit einer Referenz abgeglichen') + (ppms.length < meas.length ? ' ' + T('(bei älteren Messungen nicht gespeichert)') : '')],
      [T('Auswertung'), T('Gang aus dem Abstand der Schläge über die ganze Messung; Abfallfehler aus dem Versatz von Tick und Tack; Amplitude aus der Hebezeit und dem Hebewinkel ({lift})', { lift: deg(lift) })],
      [T('Nicht erfasst'), T('Temperatur, Aufzugszustand, Zeit seit dem letzten Aufziehen')]
    ];
    y = kvBlock(cond.map(function (c) { return [c[0], c[1]]; }), ML, CW, 86, y) - 2;

    function ranges(a) {
      var out = [], i = 0;
      while (i < a.length) { var j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; out.push(j > i + 1 ? a[i] + '–' + a[j] : j === i + 1 ? a[i] + ', ' + a[j] : String(a[i])); i = j + 1; }
      return out.join(', ');
    }
    function recText() {
      var mic = [], file = [];
      meas.forEach(function (m, i) { (m.source === 'Datei' ? file : mic).push(i + 1); });
      var t = mic.length ? (file.length ? T('Nr.') + ' ' + ranges(mic) + ': ' : '') + T('direkt über das Mikrofon, unkomprimiert, ohne Rauschunterdrückung') +
        (fsList.length ? ' (' + fmt(Math.max.apply(null, fsList), 1) + ' kHz)' : '') : '';
      if (file.length) t += (t ? '. ' : '') + T('Nr.') + ' ' + ranges(file) + ': ' + T('aus einer Audiodatei; deren Format prüft Tickwerk nicht (komprimierte Dateien sind ungenauer)');
      return t;
    }

    /* ---- Hinweise ---- */
    section(T('Hinweise zur Genauigkeit'), 120);
    var notes = [];
    var notOk = meas.length - ok.length;
    if (notOk) notes.push(T(notOk === 1
      ? '{n} von {m} Messungen ist nicht gewertet (schwaches Signal oder Unsicherheit über ±1,5 s/Tag). Sie steht in der Liste, fliesst aber nicht in die Mittelwerte ein.'
      : '{n} von {m} Messungen sind nicht gewertet (schwaches Signal oder Unsicherheit über ±1,5 s/Tag). Sie stehen in der Liste, fliessen aber nicht in die Mittelwerte ein.',
      { n: notOk, m: meas.length }));
    var wob = ok.filter(function (m) { return m.stable === false; }).length;
    if (wob) notes.push(T(wob === 1
      ? 'Bei einer gewerteten Messung schwankte der Gang während der Messung (Vermerk «Gang schwankt»). Ihr Wert ist ungenauer; das ± zeigt, um wie viel.'
      : 'Bei {n} gewerteten Messungen schwankte der Gang während der Messung (Vermerk «Gang schwankt»). Ihre Werte sind ungenauer; das ± zeigt, um wie viel.', { n: wob }));
    if (rows.length === 1) notes.push(T('Gemessen wurde nur in der Lage «{pos}». Eine Uhr geht je nach Lage unterschiedlich; ein vollständiges Bild ergibt sich erst aus mehreren Lagen.', { pos: posName(rows[0].pos) }));
    if (liftState === 'angenommen') notes.push(T('Der Hebewinkel des Werks ist nicht bekannt; gerechnet wurde mit {lift}. Die Amplitude ist deshalb nur ungefähr: 2° Unterschied im Hebewinkel ändern sie um rund 4 %.', { lift: deg(lift) }));
    else if (liftState === 'unbestätigt') notes.push(T('Der Hebewinkel ({lift}) stammt vom Basiswerk und ist nicht vom Hersteller bestätigt. 2° Unterschied ändern die Amplitude um rund 4 %.', { lift: deg(lift) }));
    if (d.kal && d.kal.coaxial) notes.push(T('Co-Axial-Hemmung: Die Amplitude ist nur ein Richtwert. Gang und Abfallfehler sind davon nicht betroffen.'));
    notes.push(ppmUsed.length ? T('Die Zeitbasis ist das Smartphone; ihr Fehler wurde mit einer Quarzuhr bestimmt und abgezogen. Ein Rest von wenigen Zehntelsekunden pro Tag bleibt möglich.')
      : T('Die Zeitbasis ist die Uhr des Smartphones. Ihr Fehler steckt in jedem Gangwert und kann einige Sekunden pro Tag betragen (1 ppm entspricht 0,086 s/Tag).'));
    notes.push(T('Jede Messung dauert 20 bis 60 Sekunden und zeigt den Zustand in diesem Moment. Der Gang über 24 Stunden hängt zusätzlich von Aufzug, Temperatur und Tragen ab und kann davon abweichen.'));
    notes.push(T('Kein Chronometer-Zertifikat: Die Norm ISO 3159 verlangt unter anderem einen mittleren Tagesgang von −4 bis +6 s/Tag, ermittelt während 15 Tagen in 5 Lagen und bei 3 Temperaturen durch eine anerkannte Prüfstelle. Der Bereich dient hier nur als Vergleich.'));
    notes.push(T('Selbstmessung: Die Messungen hat der Besitzer der Uhr mit Tickwerk durchgeführt. Tickwerk prüft weder die Uhr noch die Angaben in diesem Protokoll. Über Echtheit, Zustand oder Wert der Uhr sagt das Protokoll nichts aus.'));
    bullets(notes);

    /* ---- Bestätigung ---- */
    need(92);
    y += 16;
    pdf.text(T('Bestätigung').toUpperCase(), ML, y, { font: 'B', size: 7.5, spacing: 0.9, color: C.muted });
    pdf.stroke(C.line).lw(0.5).line(ML, y + 5, ML + CW, y + 5);
    y += 20;
    para(T('Die messende Person bestätigt mit ihrer Unterschrift, dass die aufgeführten Messungen an der oben genannten Uhr durchgeführt wurden.'), 8, C.muted);
    y += 26;
    var sw = (CW - 40) / 3;
    [T('Gemessen von'), T('Ort, Datum'), T('Unterschrift')].forEach(function (t, i) {
      var x = ML + i * (sw + 20);
      pdf.stroke(C.ink).lw(0.6).line(x, y, x + sw, y);
      pdf.text(t, x, y + 11, { size: 7.4, color: C.muted });
    });
    y += 16;

    /* ---- Fusszeile auf jeder Seite ---- */
    var total = pdf.pages.length;
    pdf.pages.forEach(function (pg, i) {
      pdf.page = pg;
      var fy = pdf.H - 40;
      pdf.stroke(C.line).lw(0.5).line(ML, fy - 10, ML + CW, fy - 10);
      pdf.text('Tickwerk · ' + T('Messprotokoll') + ' ' + nr, ML, fy, { size: 7, color: C.muted });
      pdf.text(T('Seite {i} von {n}', { i: i + 1, n: total }), ML + CW, fy, { size: 7, color: C.muted, align: 'right' });
      pdf.text(T('Selbstmessung mit dem Smartphone. Keine amtliche Prüfung und kein Chronometer-Zertifikat.'), ML, fy + 10, { size: 6.6, color: C.faint });
    });

    function chartHistory(x, top, w, h) {
      var L = 34, B = 16, T = 6, R = 8;
      var lo = Infinity, hi = -Infinity;
      meas.forEach(function (m) { lo = Math.min(lo, m.rate - m.sigma); hi = Math.max(hi, m.rate + m.sigma); });
      lo = Math.min(lo, -7); hi = Math.max(hi, 9);
      var pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
      var X = function (i) { return meas.length === 1 ? x + L + (w - L - R) / 2 : x + L + 10 + i / (meas.length - 1) * (w - L - R - 20); };
      var Y = function (v) { return top + T + (1 - (v - lo) / (hi - lo)) * (h - T - B); };
      pdf.fill(C.band).rect(x + L, Y(6), w - L - R, Y(-4) - Y(6), 'f');
      var st = niceStep(hi - lo, 5);
      for (var v = Math.ceil(lo / st) * st; v <= hi; v += st) {
        pdf.stroke(v === 0 ? C.line : C.hair).lw(v === 0 ? 0.7 : 0.4).line(x + L, Y(v), x + w - R, Y(v));
        pdf.text(v === 0 ? '0' : signed(v, st < 1 ? 1 : 0), x + L - 5, Y(v) + 2.4, { size: 6.6, align: 'right', color: C.faint });
      }
      pdf.text(LG.T('s/Tag'), x, top + T - 0.5, { size: 6.4, color: C.faint });
      meas.forEach(function (m, i) {
        var c = counted(m), col = c ? C.ink : C.dotOff;
        pdf.stroke(col).lw(0.7).line(X(i), Y(m.rate - m.sigma), X(i), Y(m.rate + m.sigma));
        if (c) pdf.save().cap('round').stroke(col).lw(4.2).dot(X(i), Y(m.rate)).restore();
        else pdf.fill('#FFFFFF').stroke(col).lw(0.8).circle(X(i), Y(m.rate), 2.1, 'B');
      });
      var labIdx = meas.length <= 6 ? meas.map(function (_, i) { return i; }) : [0, Math.floor((meas.length - 1) / 2), meas.length - 1];
      labIdx.forEach(function (i) {
        var dt = new Date(meas[i].date);
        pdf.text(LG.T('Nr.') + ' ' + (i + 1) + ' · ' + p2(dt.getDate()) + (LG.en ? '/' + p2(dt.getMonth() + 1) : '.' + p2(dt.getMonth() + 1) + '.'), X(i), top + h - 2, { size: 6.4, align: 'center', color: C.faint });
      });
    }
    function chartTape(x, top, w, h, tr) {
      var L = 40, B = 16, T = 6, R = 8, n = tr.t.length;
      var ds = tr.d.slice().sort(function (a, b) { return a - b; });
      var yMin = ds[Math.floor(n * 0.02)], yMax = ds[Math.ceil(n * 0.98) - 1];
      var mid = (yMin + yMax) / 2, half = Math.max(0.8, (yMax - yMin) / 2 * 1.2); yMin = mid - half; yMax = mid + half;
      var tMax = tr.t[n - 1] || 1;
      var X = function (t) { return x + L + t / tMax * (w - L - R); };
      var Y = function (v) { return top + T + (1 - (v - yMin) / (yMax - yMin)) * (h - T - B); };
      pdf.fill('#FBFCFD').rect(x + L, top + T, w - L - R, h - T - B, 'f');
      var ys = niceStep(yMax - yMin, 4);
      for (var v = Math.ceil(yMin / ys) * ys; v <= yMax; v += ys) {
        pdf.stroke(C.hair).lw(0.4).line(x + L, Y(v), x + w - R, Y(v));
        pdf.text((v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), ys < 1 ? 1 : 0) + ' ms', x + L - 5, Y(v) + 2.4, { size: 6.4, align: 'right', color: C.faint });
      }
      var xs = niceStep(tMax, 6);
      for (var s = 0; s <= tMax + 1e-9; s += xs) pdf.text(fmt(s, 0) + ' s', X(s), top + h - 2, { size: 6.4, align: 'center', color: C.faint });
      pdf.save().cap('round').lw(2.1);
      [0, 1].forEach(function (par) {
        pdf.stroke(par ? C.tock : C.tick);
        for (var i = 0; i < n; i++) {
          if ((tr.p.charAt(i) === '1' ? 1 : 0) !== par) continue;
          pdf.dot(X(tr.t[i]), Y(Math.max(yMin, Math.min(yMax, tr.d[i]))));
        }
      });
      pdf.restore();
    }

    var safe = d.watch.name.replace(/[^\wäöüÄÖÜéèàç-]+/g, '-').replace(/^-+|-+$/g, '') || (LG.en ? 'Watch' : 'Uhr');
    var filename = (d.kind === 'lagen' ? (LG.en ? 'Tickwerk-Position-test_' : 'Tickwerk-Lagentest_') : (LG.en ? 'Tickwerk-Report_' : 'Tickwerk-Messprotokoll_')) +
      safe + '_' + now.getFullYear() + '-' + p2(now.getMonth() + 1) + '-' + p2(now.getDate()) + '.pdf';
    var bytes = pdf.output({ title: T('Messprotokoll') + ' ' + d.watch.name + ' (' + nr + ')', subject: T(d.kind === 'lagen' ? 'Lagen-Test mit Tickwerk' : 'Gangmessung mit Tickwerk'),
      version: d.appVersion, date: now });
    return { bytes: bytes, filename: filename, pages: total, number: nr };
  }

  global.TickwerkReport = { build: build, counted: counted, _wrap: wrap, _textWidth: textWidth };
})(typeof self !== 'undefined' ? self : this);
