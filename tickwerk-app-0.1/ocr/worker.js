/* Tickwerk: Texterkennung für «Per Foto anlegen» (ab 0.7.8). Läuft als eigener Worker (Modul), nur auf diesem Gerät.
   Liest die Schrift auf vorbereiteten Graubildern des Zifferblatts mit Tesseract (WebAssembly, lib.js aus tesseract-wasm).
   Auftrag: { passes: [{ psm, image }] }; psm ist der Seitenmodus von Tesseract, image ein ImageData.
   Antworten: { phase: 'laden' }, { phase: 'lesen' }, dann { ok: true, words: [{ t, c }] } oder { ok: false, err }.
   Die grossen Dateien liegen gepackt daneben (.gz) und werden hier entpackt; der Service Worker behält sie. */
import { createOCREngine, supportsFastBuild } from './lib.js';

async function load(name) {
  const res = await fetch(new URL(name, import.meta.url));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  let buf = await res.arrayBuffer();
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  /* noch gepackt (die ersten zwei Bytes sagen es): entpacken. Manche Server packen selbst aus, dann ist nichts zu tun. */
  if (head.length === 2 && head[0] === 0x1f && head[1] === 0x8b) {
    buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  return buf;
}

self.onmessage = async (e) => {
  let engine = null;
  try {
    self.postMessage({ phase: 'laden' });
    const got = await Promise.all([
      load(supportsFastBuild() ? 'tesseract-core.wasm.gz' : 'tesseract-core-fallback.wasm.gz'),
      load('eng.traineddata.gz')
    ]);
    engine = await createOCREngine({ wasmBinary: got[0] });
    engine.loadModel(got[1]);
    self.postMessage({ phase: 'lesen' });
    const words = [];
    for (const p of e.data.passes) {
      engine.loadImage(p.image);
      engine.setVariable('tessedit_pageseg_mode', String(p.psm));   /* erst nach loadImage: Das Laden stellt den Modus zurück */
      for (const w of engine.getTextBoxes('word')) {
        words.push({ t: w.text, c: Math.round(w.confidence <= 1 ? w.confidence * 100 : w.confidence) });
      }
      engine.clearImage();
    }
    self.postMessage({ ok: true, words: words });
  } catch (err) {
    self.postMessage({ ok: false, err: String((err && err.message) || err) });
  } finally {
    try { if (engine) engine.destroy(); } catch (x) { /* egal */ }
  }
};
