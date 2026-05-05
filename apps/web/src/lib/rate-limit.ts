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
  return {
    check(key: string): boolean {
      const now = Date.now();
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
