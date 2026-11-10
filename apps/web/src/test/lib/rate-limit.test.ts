import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createLimiter, limitFromEnv } from "@/lib/rate-limit";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-04T14:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createLimiter", () => {
  it("allows up to N requests in the window", () => {
    const limiter = createLimiter({ max: 3, windowMs: 60_000 });
    expect(limiter.check("k1")).toBe(true);
    expect(limiter.check("k1")).toBe(true);
    expect(limiter.check("k1")).toBe(true);
    expect(limiter.check("k1")).toBe(false);
  });

  it("isolates by key", () => {
    const limiter = createLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("b")).toBe(true);
    expect(limiter.check("a")).toBe(false);
  });

  it("resets after window passes", () => {
    const limiter = createLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.check("k")).toBe(true);
    expect(limiter.check("k")).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(limiter.check("k")).toBe(true);
  });
});

describe("limitFromEnv", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("uses a positive integer from the environment", () => {
    vi.stubEnv("TEST_LIMIT_PER_MIN", "2400");
    expect(limitFromEnv("TEST_LIMIT_PER_MIN", 1200)).toBe(2400);
  });

  it("falls back when the value is missing, invalid or not positive", () => {
    expect(limitFromEnv("TEST_LIMIT_MISSING", 1200)).toBe(1200);
    for (const value of ["", "abc", "0", "-5", "1.5"]) {
      vi.stubEnv("TEST_LIMIT_PER_MIN", value);
      expect(limitFromEnv("TEST_LIMIT_PER_MIN", 1200)).toBe(1200);
    }
  });
});
