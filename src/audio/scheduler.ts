// Fires a callback at random intervals drawn from an exponential
// distribution (a Poisson-process-like pattern), so events feel occasional
// and non-repetitive rather than looping on a fixed timer. The mean interval
// is re-read from `getMeanIntervalSeconds` before each gap, so a UI rate
// slider can be adjusted live.
export class RandomScheduler {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private firstFire = true;

  constructor(
    private readonly getMeanIntervalSeconds: () => number,
    private readonly onFire: () => void,
    private readonly firstFireCapSeconds = 10,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    this.firstFire = true;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private scheduleNext(): void {
    if (!this.running) return;
    const mean = Math.max(0.5, this.getMeanIntervalSeconds());
    let gapSeconds = -Math.log(1 - Math.random()) * mean;

    // Guarantee a quick first sample after (re)starting, so the layer is
    // audible right away instead of only after a possibly long random wait.
    if (this.firstFire) {
      gapSeconds = Math.min(gapSeconds, this.firstFireCapSeconds);
      this.firstFire = false;
    }

    this.timeoutId = setTimeout(() => {
      if (!this.running) return;
      this.onFire();
      this.scheduleNext();
    }, gapSeconds * 1000);
  }
}
