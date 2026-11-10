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

export function limitFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

// Per IP: mobile carriers (CGNAT) and office Wi-Fi put many real leads behind one IP.
export const optinLimiter = createLimiter({ max: 30, windowMs: 60_000 });
export const leadChatLimiter = createLimiter({ max: 30, windowMs: 60_000 });
export const offerClickLimiter = createLimiter({ max: 10, windowMs: 60_000 });
// Per attendant. High enough for shared logins and fast bursts across many conversations.
export const attendantReplyLimiter = createLimiter({
  max: limitFromEnv("RATE_LIMIT_ATTENDANT_REPLY_PER_MIN", 600),
  windowMs: 60_000
});
// All team replies in this process combined. Each reply is a few short queries plus one
// Redis publish to the lead and staff rooms, so this bounds total writes far below what
// the 20-connection pool sustains, protecting the live player even if a client misbehaves.
export const teamReplyGlobalLimiter = createLimiter({
  max: limitFromEnv("RATE_LIMIT_TEAM_REPLY_GLOBAL_PER_MIN", 1200),
  windowMs: 60_000
});
export const staffLinkPreviewLimiter = createLimiter({ max: 300, windowMs: 60_000 });
export const leadLinkPreviewLimiter = createLimiter({ max: 60, windowMs: 60_000 });
