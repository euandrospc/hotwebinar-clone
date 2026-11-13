import { describe, it, expect } from "vitest";
import { estimateR2Cost, projectR2Month } from "@/lib/cloudflare-usage";

const GB = 1024 ** 3;

describe("estimateR2Cost", () => {
  it("is free inside the free tier", () => {
    expect(estimateR2Cost(8 * GB, 900_000, 9_000_000).total).toBe(0);
  });

  it("charges only what goes over the free tier", () => {
    const c = estimateR2Cost(20 * GB, 2_000_000, 30_000_000);
    expect(c.storage).toBeCloseTo(10 * 0.015);
    expect(c.classA).toBeCloseTo(4.5);
    expect(c.classB).toBeCloseTo(20 * 0.36);
    expect(c.total).toBeCloseTo(0.15 + 4.5 + 7.2);
  });
});

describe("projectR2Month", () => {
  it("projects reads linearly and finds the day they cross the free tier", () => {
    const p = projectR2Month({ from: "2026-11-01", to: "2026-11-13", daysInMonth: 30, storageBytes: 0, classA: 0, classB: 6_240_063 });
    expect(p.elapsed).toBe(13);
    expect(p.complete).toBe(false);
    expect(p.classBLimitDay).toBe(21);
    expect(p.costUsd.classB).toBeCloseTo(((6_240_063 / 13) * 30 - 10_000_000) / 1e6 * 0.36);
  });

  it("is the actual total for a finished month", () => {
    const p = projectR2Month({ from: "2026-10-01", to: "2026-10-31", daysInMonth: 31, storageBytes: 0, classA: 5, classB: 5 });
    expect(p.complete).toBe(true);
    expect(p.classBLimitDay).toBeNull();
    expect(p.classB).toBe(5);
  });
});
