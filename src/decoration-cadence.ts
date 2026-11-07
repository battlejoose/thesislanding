/** Decorative canvas work is independent of monitor refresh and market data. */
export class DecorationCadence {
  private due = 0;
  private last = 0;
  constructor(private readonly fps = 30) {}
  reset(now: number) { this.last = now; this.due = now + 1000 / this.fps; }
  advance(now: number): number | null {
    if (now + 0.1 < this.due) return null;
    const step = 1000 / this.fps;
    const delta = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    // Retain fractional frame time, but never replay frames missed in a stall.
    this.due += (Math.floor(Math.max(0, now - this.due) / step) + 1) * step;
    return delta;
  }
}
