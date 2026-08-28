// Purely decorative scrolling waveform driven by an AnalyserNode, drawn
// with a soft trailing fade so it feels ambient rather than clinical.
export class Visualizer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly dataArray: Uint8Array<ArrayBuffer>;
  private readonly cssWidth: number;
  private readonly cssHeight: number;
  private rafId: number | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly analyser: AnalyserNode,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cssWidth = rect.width || canvas.width;
    this.cssHeight = rect.height || canvas.height;
    canvas.width = this.cssWidth * dpr;
    canvas.height = this.cssHeight * dpr;
    ctx.scale(dpr, dpr);

    this.analyser.fftSize = 2048;
    this.dataArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

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
    this.ctx.fillStyle = `rgba(13, 16, 32, ${alpha})`;
    this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
  }

  private render(): void {
    this.analyser.getByteTimeDomainData(this.dataArray);
    this.paintBackground(0.35);

    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#7fd9ff';
    this.ctx.beginPath();

    const sliceWidth = this.cssWidth / this.dataArray.length;
    let x = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const v = this.dataArray[i] / 128 - 1;
      const y = this.cssHeight / 2 + v * (this.cssHeight / 2) * 0.85;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
      x += sliceWidth;
    }
    this.ctx.stroke();
  }
}
