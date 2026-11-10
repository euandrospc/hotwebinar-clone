import { describe, expect, it } from "vitest";
import { getLeadsPage, parseLeadsPagination } from "@/lib/leads-pagination";

describe("leads pagination query bounds", () => {
  it("uses a compact, bounded default and accepts only the supported page sizes", () => {
    expect(parseLeadsPagination({})).toEqual({ page: 1, pageSize: 25 });
    for (const pageSize of ["25", "50", "100"]) {
      expect(parseLeadsPagination({ page: "2", pageSize })).toEqual({ page: 2, pageSize: Number(pageSize) });
    }
    for (const pageSize of ["0", "-1", "1000000", "25.5", "50abc"]) {
      expect(parseLeadsPagination({ pageSize }).pageSize).toBe(25);
    }
  });

  it("rejects malformed, non-positive and unsafe page numbers before an offset is calculated", () => {
    for (const page of ["", "0", "-1", "1.5", "2abc", "Infinity", "9007199254740992"]) {
      expect(parseLeadsPagination({ page }).page).toBe(1);
    }
    expect(parseLeadsPagination({ page: ["3", "999"], pageSize: ["50", "100"] })).toEqual({ page: 3, pageSize: 50 });
  });

  it("clamps stale URLs to the last available page, including an empty result", () => {
    expect(getLeadsPage(999_999, 51, 25)).toBe(3);
    expect(getLeadsPage(2, 50, 25)).toBe(2);
    expect(getLeadsPage(2, 49, 50)).toBe(1);
    expect(getLeadsPage(999_999, 0, 25)).toBe(1);
  });
});
