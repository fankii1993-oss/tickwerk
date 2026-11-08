/* Tickwerk: nimmt das Mikrofon unveraendert auf und schickt Bloecke an die Seite. */
class TwRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 4096;
    this.buf = new Float32Array(this.size);
    this.n = 0;
    this.peak = 0;
  }
  process(inputs) {
    const input = inputs[0];
    const ch = input && input[0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        const v = ch[i];
        this.buf[this.n++] = v;
        const a = v < 0 ? -v : v;
        if (a > this.peak) this.peak = a;
        if (this.n === this.size) {
          this.port.postMessage({ samples: this.buf, peak: this.peak }, [this.buf.buffer]);
          this.buf = new Float32Array(this.size);
          this.n = 0;
          this.peak = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('tw-recorder', TwRecorder);
