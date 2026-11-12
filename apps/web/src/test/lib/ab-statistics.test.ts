import { describe, expect, it } from "vitest";
import { calculateSampleSize, compareProportions, sampleRatioMismatchPValue, wilsonInterval } from "@/lib/ab-statistics";

describe("A/B fixed-horizon statistics", () => {
  it.each([[0.05, 0.2, 8158], [0.1, 0.2, 3841], [0.02, 0.25, 13809]])("plans a sample for baseline %s and lift %s", (baseline, lift, expected) => {
    expect(calculateSampleSize(baseline, lift)).toBe(expected);
  });
  it.each([[0, 0.2], [1, 0.1], [0.9, 0.5], [0.1, 0], [NaN, 0.2], [0.1, Infinity]])("rejects invalid planning rates", (baseline, lift) => {
    expect(() => calculateSampleSize(baseline, lift)).toThrow(RangeError);
  });
  it("matches the reference two-sided two-proportion test and delta interval", () => {
    const result = compareProportions(100, 1000, 130, 1000);
    expect(result.delta).toBeCloseTo(0.03, 12);
    expect(result.relativeLift).toBeCloseTo(0.3, 12);
    expect(result.pValue).toBeCloseTo(0.035488450466, 6);
    expect(result.interval?.[0]).toBeCloseTo(0.002067934439, 10);
    expect(result.interval?.[1]).toBeCloseTo(0.057932065561, 10);
    expect(compareProportions(50, 1000, 65, 1000).pValue).toBeCloseTo(0.149643106370, 6);
  });
  it("returns descriptive differences but no normal test for sparse counts", () => {
    expect(compareProportions(0, 100, 5, 100)).toEqual({ delta: 0.05, relativeLift: null, interval: null, pValue: null });
    expect(compareProportions(100, 100, 90, 100).pValue).toBeNull();
    expect(compareProportions(0, 0, 10, 20)).toEqual({ delta: null, relativeLift: null, interval: null, pValue: null });
  });
  it("preserves uncertainty with zero conversions and no observations", () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    const zero = wilsonInterval(0, 100)!;
    expect(zero[0]).toBeCloseTo(0, 12);
    expect(zero[1]).toBeCloseTo(0.0369934982, 9);
    expect(wilsonInterval(100, 100)![1]).toBeCloseTo(1, 12);
    expect(() => wilsonInterval(101, 100)).toThrow(RangeError);
  });
  it("uses the full 50/50 assignment chi-square diagnostic", () => {
    expect(sampleRatioMismatchPValue(500, 500)).toBe(1);
    expect(sampleRatioMismatchPValue(550, 450)).toBeCloseTo(0.001565402258, 7);
    expect(sampleRatioMismatchPValue(550, 450)).toBeGreaterThan(0.0005);
    expect(sampleRatioMismatchPValue(600, 400)).toBeLessThan(0.0005);
    expect(sampleRatioMismatchPValue(600, 400)).toBeCloseTo(2.539628589e-10, 15);
    expect(sampleRatioMismatchPValue(0, 0)).toBeNull();
  });
});
