import { describe, it, expect } from "vitest";
import { TIMEZONES, AUTO_TIMEZONE_VALUE } from "@/lib/timezones";

describe("timezones", () => {
  it("includes São Paulo as default", () => {
    expect(TIMEZONES.find((t) => t.value === "America/Sao_Paulo")).toBeDefined();
  });

  it("first option is auto detect sentinel", () => {
    expect(TIMEZONES[0].value).toBe(AUTO_TIMEZONE_VALUE);
  });

  it("AUTO_TIMEZONE_VALUE is __auto__", () => {
    expect(AUTO_TIMEZONE_VALUE).toBe("__auto__");
  });

  it("contains at least 18 zones (incl auto)", () => {
    expect(TIMEZONES.length).toBeGreaterThanOrEqual(18);
  });
});
