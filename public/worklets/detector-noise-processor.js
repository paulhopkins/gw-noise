// AudioWorkletProcessor that synthesizes a continuous "detector noise" bed:
// white noise shaped into the bucket-shaped ASD characteristic of a
// gravitational-wave interferometer — boosted low end (seismic/suspension
// wall), a relatively flat mid band, and a gentle high-frequency rise (shot
// noise). This is an artistic approximation, not real strain data.

class Biquad {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.b0 = 1;
    this.b1 = 0;
    this.b2 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  // RBJ Audio EQ Cookbook shelving filters.
  setLowShelf(freq, gainDb, q) {
    const A = Math.pow(10, gainDb / 40);
    const w0 = (2 * Math.PI * freq) / this.sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = (sinW0 / 2) * Math.sqrt((A + 1 / A) * (1 / q - 1) + 2);
    const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;

    const b0 = A * (A + 1 - (A - 1) * cosW0 + twoSqrtAAlpha);
    const b1 = 2 * A * (A - 1 - (A + 1) * cosW0);
    const b2 = A * (A + 1 - (A - 1) * cosW0 - twoSqrtAAlpha);
    const a0 = A + 1 + (A - 1) * cosW0 + twoSqrtAAlpha;
    const a1 = -2 * (A - 1 + (A + 1) * cosW0);
    const a2 = A + 1 + (A - 1) * cosW0 - twoSqrtAAlpha;

    this._normalize(b0, b1, b2, a0, a1, a2);
  }

  setHighShelf(freq, gainDb, q) {
    const A = Math.pow(10, gainDb / 40);
    const w0 = (2 * Math.PI * freq) / this.sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = (sinW0 / 2) * Math.sqrt((A + 1 / A) * (1 / q - 1) + 2);
    const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;

    const b0 = A * (A + 1 + (A - 1) * cosW0 + twoSqrtAAlpha);
    const b1 = -2 * A * (A - 1 + (A + 1) * cosW0);
    const b2 = A * (A + 1 + (A - 1) * cosW0 - twoSqrtAAlpha);
    const a0 = A + 1 - (A - 1) * cosW0 + twoSqrtAAlpha;
    const a1 = 2 * (A - 1 - (A + 1) * cosW0);
    const a2 = A + 1 - (A - 1) * cosW0 - twoSqrtAAlpha;

    this._normalize(b0, b1, b2, a0, a1, a2);
  }

  setLowpass(freq, q) {
    const w0 = (2 * Math.PI * freq) / this.sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / (2 * q);

    const b0 = (1 - cosW0) / 2;
    const b1 = 1 - cosW0;
    const b2 = (1 - cosW0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosW0;
    const a2 = 1 - alpha;

    this._normalize(b0, b1, b2, a0, a1, a2);
  }

  _normalize(b0, b1, b2, a0, a1, a2) {
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }

  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

class DetectorNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    const sr = sampleRate; // global in AudioWorkletGlobalScope

    this.seismicShelf = new Biquad(sr);
    this.seismicShelf.setLowShelf(40, 18, 0.7);

    this.shotShelf = new Biquad(sr);
    this.shotShelf.setHighShelf(1800, 10, 0.7);

    this.ceiling = new Biquad(sr);
    this.ceiling.setLowpass(9000, 0.7);

    // Slow-moving amplitude wobble so the bed feels alive rather than static.
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.wobbleRate = 0.03; // Hz
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const dt = 1 / sampleRate;

    for (let channel = 0; channel < output.length; channel++) {
      const outData = output[channel];
      for (let i = 0; i < outData.length; i++) {
        let sample = Math.random() * 2 - 1;
        sample = this.seismicShelf.process(sample);
        sample = this.shotShelf.process(sample);
        sample = this.ceiling.process(sample);

        this.wobblePhase += 2 * Math.PI * this.wobbleRate * dt;
        const wobble = 0.85 + 0.15 * Math.sin(this.wobblePhase);

        outData[i] = sample * 0.35 * wobble;
      }
    }

    return true;
  }
}

registerProcessor('detector-noise-processor', DetectorNoiseProcessor);
