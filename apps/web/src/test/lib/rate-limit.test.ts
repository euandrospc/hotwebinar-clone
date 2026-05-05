import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createLimiter } from "@/lib/rate-limit";

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
