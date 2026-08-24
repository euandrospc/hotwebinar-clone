export interface LimiterOptions {
  max: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export interface Limiter {
  check(key: string): boolean;
}

export function createLimiter(opts: LimiterOptions): Limiter {
  const buckets = new Map<string, Bucket>();
  let lastSweep = 0;

  // Evict expired buckets so a stream of unique keys (e.g. spoofed IPs) cannot
  // grow the Map without bound. Amortized: sweep at most once per window.
  function sweep(now: number): void {
    if (now - lastSweep < opts.windowMs) return;
    lastSweep = now;
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k);
    }
  }

  return {
    check(key: string): boolean {
      const now = Date.now();
      sweep(now);
      const b = buckets.get(key);
      if (!b || now >= b.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      if (b.count >= opts.max) return false;
      b.count += 1;
      return true;
    }
  };
}

export const optinLimiter = createLimiter({ max: 5, windowMs: 60_000 });
export const leadChatLimiter = createLimiter({ max: 30, windowMs: 60_000 });
export const offerClickLimiter = createLimiter({ max: 10, windowMs: 60_000 });
export const attendantReplyLimiter = createLimiter({ max: 60, windowMs: 60_000 });
