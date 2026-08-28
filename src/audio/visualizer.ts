// Purely decorative, driven by an AnalyserNode. Two modes, flippable while
// playing: a scrolling waveform (oscilloscope-style trace with a fading
// trail), or a rolling spectrogram (log-frequency, so the hum's harmonics
// sit as steady horizontal lines and a chirp draws its sweep as a rising
// diagonal streak).
export type VisualizerMode = 'waveform' | 'spectrogram';

const MIN_DISPLAY_FREQ = 20;
const MAX_DISPLAY_FREQ = 4000;

// Background (#06070d) -> accent cyan -> a warm highlight for the loudest
// bins, so chirps/glitches read as bright streaks against a cooler noise
// floor, echoing the app's own accent/glitch colors. A gamma curve pushes
// the cyan crossover well above the midpoint -- most of the mix sits at
// low-to-moderate levels, and a linear map made everything look uniformly
// bright, crushing out the actual texture.
function magnitudeToRgb(value: number): [number, number, number] {
  const t = Math.pow(value / 255, 2.2);
  const mix = (a: number[], b: number[], k: number): [number, number, number] => [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
  const bg = [6, 7, 13];
  const accent = [127, 217, 255];
  const highlight = [255, 179, 127];
  return t < 0.6 ? mix(bg, accent, t / 0.6) : mix(accent, highlight, (t - 0.6) / 0.4);
}

export class Visualizer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly timeData: Uint8Array<ArrayBuffer>;
  private readonly freqData: Uint8Array<ArrayBuffer>;
  private readonly cssWidth: number;
  private readonly cssHeight: number;
  private readonly dpr: number;
  private rafId: number | null = null;
  private mode: VisualizerMode = 'waveform';

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly analyser: AnalyserNode,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;

    const rect = canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.cssWidth = rect.width || canvas.width;
    this.cssHeight = rect.height || canvas.height;
    canvas.width = Math.round(this.cssWidth * this.dpr);
    canvas.height = Math.round(this.cssHeight * this.dpr);
    ctx.scale(this.dpr, this.dpr);

    this.analyser.fftSize = 2048;
    // Lower than the 0.8 default so the spectrogram shows crisp diagonal
    // chirp sweeps instead of a smeared trail.
    this.analyser.smoothingTimeConstant = 0.5;
    this.timeData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

    this.paintBackground(1);
  }

  setMode(mode: VisualizerMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.paintBackground(1);
  }

  start(): void {
    if (this.rafId !== null) return;
    const draw = () => {
      this.rafId = requestAnimationFrame(draw);
      this.render();
    };
    draw();
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.paintBackground(1);
  }

  private paintBackground(alpha: number): void {
    this.ctx.save();
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.fillStyle = `rgba(13, 16, 32, ${alpha})`;
    this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    this.ctx.restore();
  }

  private render(): void {
    if (this.mode === 'waveform') {
      this.renderWaveform();
    } else {
      this.renderSpectrogramColumn();
    }
  }

  private renderWaveform(): void {
    this.analyser.getByteTimeDomainData(this.timeData);
    this.paintBackground(0.35);

    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#7fd9ff';
    this.ctx.beginPath();

    const sliceWidth = this.cssWidth / this.timeData.length;
    let x = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = this.timeData[i] / 128 - 1;
      const y = this.cssHeight / 2 + v * (this.cssHeight / 2) * 0.85;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
      x += sliceWidth;
    }
    this.ctx.stroke();
  }

  private renderSpectrogramColumn(): void {
    const devW = this.canvas.width;
    const devH = this.canvas.height;
    const colW = Math.max(1, Math.round(this.dpr));

    // Scroll the existing image left by one column, working in raw device
    // pixels so the self-copy isn't skewed by the CSS-pixel scale transform.
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.canvas, colW, 0, devW - colW, devH, 0, 0, devW - colW, devH);
    this.ctx.restore();

    this.analyser.getByteFrequencyData(this.freqData);
    const sampleRate = this.analyser.context.sampleRate;
    const binHz = sampleRate / this.analyser.fftSize;
    const maxFreq = Math.min(MAX_DISPLAY_FREQ, sampleRate / 2);

    const column = this.ctx.createImageData(colW, devH);
    for (let row = 0; row < devH; row++) {
      // row 0 = top = highest displayed frequency, log-spaced downward.
      const t = row / (devH - 1);
      const freq = maxFreq * Math.pow(MIN_DISPLAY_FREQ / maxFreq, t);
      const bin = Math.min(this.freqData.length - 1, Math.round(freq / binHz));
      const [r, g, b] = magnitudeToRgb(this.freqData[bin]);
      for (let c = 0; c < colW; c++) {
        const idx = (row * colW + c) * 4;
        column.data[idx] = r;
        column.data[idx + 1] = g;
        column.data[idx + 2] = b;
        column.data[idx + 3] = 255;
      }
    }

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.putImageData(column, devW - colW, 0);
    this.ctx.restore();
  }
}
