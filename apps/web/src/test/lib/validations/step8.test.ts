import { describe, it, expect } from "vitest";
import { step8Schema } from "@/lib/validations/webinar";

const VALID = {
  audienceMode: "DYNAMIC" as const,
  audienceMin: 50,
  audienceMax: 500,
  audienceLiveBadge: true
};

describe("step8Schema", () => {
  it("accepts valid input", () => {
    expect(step8Schema.safeParse(VALID).success).toBe(true);
  });
  it("accepts NONE + FIXED modes", () => {
    expect(step8Schema.safeParse({ ...VALID, audienceMode: "NONE" }).success).toBe(true);
    expect(step8Schema.safeParse({ ...VALID, audienceMode: "FIXED" }).success).toBe(true);
  });
  it("rejects invalid mode", () => {
    expect(step8Schema.safeParse({ ...VALID, audienceMode: "OTHER" }).success).toBe(false);
  });
  it("rejects max < min", () => {
    expect(step8Schema.safeParse({ ...VALID, audienceMin: 500, audienceMax: 100 }).success).toBe(false);
  });
  it("rejects negative min", () => {
    expect(step8Schema.safeParse({ ...VALID, audienceMin: -1 }).success).toBe(false);
  });
  it("accepts min === max", () => {
    expect(step8Schema.safeParse({ ...VALID, audienceMin: 200, audienceMax: 200 }).success).toBe(true);
  });
});
