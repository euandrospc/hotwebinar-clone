import { describe, it, expect } from "vitest";
import {
  hashSeed,
  simulateAudienceAt,
  simulateAudienceSeries
} from "@/lib/audience-sim";

describe("hashSeed", () => {
  it("is deterministic", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
  });
});

describe("simulateAudienceAt — DYNAMIC", () => {
  it("stays within [min, max] across timeline", () => {
    const min = 100;
    const max = 200;
    for (let t = 0; t <= 3600; t += 60) {
      const v = simulateAudienceAt(t, 3600, min, max, "seed-x", "DYNAMIC");
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
    }
  });
  it("is deterministic per seed + t", () => {
    expect(simulateAudienceAt(120, 3600, 50, 500, "seed-1", "DYNAMIC"))
      .toBe(simulateAudienceAt(120, 3600, 50, 500, "seed-1", "DYNAMIC"));
  });
  it("varies across t in DYNAMIC mode", () => {
    const a = simulateAudienceAt(60, 3600, 50, 500, "s", "DYNAMIC");
    const b = simulateAudienceAt(1800, 3600, 50, 500, "s", "DYNAMIC");
    const c = simulateAudienceAt(3500, 3600, 50, 500, "s", "DYNAMIC");
    expect(a !== b || b !== c || a !== c).toBe(true);
  });
});

describe("simulateAudienceAt — FIXED", () => {
  it("returns same value at any t", () => {
    const seed = "fixed-seed";
    const v0 = simulateAudienceAt(0, 3600, 100, 200, seed, "FIXED");
    const v1 = simulateAudienceAt(1800, 3600, 100, 200, seed, "FIXED");
    const v2 = simulateAudienceAt(3500, 3600, 100, 200, seed, "FIXED");
    expect(v0).toBe(v1);
    expect(v1).toBe(v2);
    expect(v0).toBeGreaterThanOrEqual(100);
    expect(v0).toBeLessThanOrEqual(200);
  });
});

describe("simulateAudienceSeries", () => {
  it("returns N+1 samples from 0 to duration", () => {
    const series = simulateAudienceSeries(3600, 50, 500, "s", "DYNAMIC", 12);
    expect(series).toHaveLength(13);
    expect(series[0].t).toBe(0);
    expect(series[12].t).toBe(3600);
    for (const p of series) {
      expect(p.count).toBeGreaterThanOrEqual(50);
      expect(p.count).toBeLessThanOrEqual(500);
    }
  });
});
