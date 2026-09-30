/** Sliding-window limiter for outbound requests (process-local). */
export class RateLimiter {
  private readonly timestamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  tryTake(): boolean {
    const now = this.now();
    while (this.timestamps.length > 0 && (this.timestamps[0] ?? 0) <= now - this.windowMs) {
      this.timestamps.shift();
    }
    if (this.timestamps.length >= this.limit) return false;
    this.timestamps.push(now);
    return true;
  }
}

/**
 * Caps concurrent work such as AI calls. `tryAcquire` never waits: when all
 * slots are busy the caller skips the optional work instead of queueing.
 */
export class Semaphore {
  private active = 0;

  constructor(private readonly capacity: number) {}

  tryAcquire(): (() => void) | null {
    if (this.active >= this.capacity) return null;
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
    };
  }
}
