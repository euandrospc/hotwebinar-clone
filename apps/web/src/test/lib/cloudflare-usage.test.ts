import { describe, it, expect } from "vitest";
import { estimateR2Cost } from "@/lib/cloudflare-usage";

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
