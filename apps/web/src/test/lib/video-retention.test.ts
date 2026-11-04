import { expect, it } from "vitest";
import { buildRetention } from "@/lib/dashboard-stats";

it("calculates the percentage over actual viewers, excluding registrations without watch time", () => {
  const data = buildRetention([0, 0, 60, 120, 300, 600, 900, 1200, 1800, 3600, 4000, 7200], 7200, 2);
  expect(data[0]).toMatchObject({ count: 10, pct: 100 });
  expect(data[1]).toMatchObject({ sec: 3600, label: "1:00:00", count: 3, pct: 30 });
  expect(data[2]).toMatchObject({ count: 1, pct: 10 });
});
it("returns zero retention without division errors when no one watched", () => {
  expect(buildRetention([0, 0], 3600).every(point => point.count === 0 && point.pct === 0)).toBe(true);
});
