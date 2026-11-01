import { describe, expect, it } from "vitest";
import { leadsDateRange } from "@/lib/leads-date-range";

describe("leadsDateRange", () => {
  it("keeps the browser timezone and includes the final minute", () => {
    const range = leadsDateRange("2026-10-31T00:00:00-03:00", "2026-10-31T23:59:00-03:00")!;
    expect(range.gte.toISOString()).toBe("2026-10-31T03:00:00.000Z");
    expect(range.lte.toISOString()).toBe("2026-11-01T02:59:59.999Z");
  });
  it("ignores missing, invalid and reversed ranges", () => {
    expect(leadsDateRange()).toBeUndefined();
    expect(leadsDateRange("invalid", "invalid")).toBeUndefined();
    expect(leadsDateRange("2026-11-01", "2026-10-31")).toBeUndefined();
  });
});
