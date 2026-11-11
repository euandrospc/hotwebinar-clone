import { describe, expect, it } from "vitest";
import { findOverlappingMapPins } from "@/lib/map-pin-layout";

describe("individual map pin overlap selection", () => {
  it("keeps 256 coincident people selectable without inventing display coordinates", () => {
    const points = Array.from({ length: 256 }, (_, index) => ({ id: `person-${index}`, x: 300, y: 250 }));
    const original = structuredClone(points);
    const nearby = findOverlappingMapPins(points, "person-0");
    expect(nearby).toHaveLength(256);
    expect(new Set(nearby.map((point) => point.id)).size).toBe(256);
    expect(nearby.every((point) => point.x === 300 && point.y === 250)).toBe(true);
    expect(points).toEqual(original);
    expect(findOverlappingMapPins([...points].reverse(), "person-0")).toEqual(nearby);
  });

  it("selects only pins whose icon rectangles overlap the clicked origin", () => {
    const points = [
      { id: "origin", x: 0, y: 0 },
      { id: "near", x: 15, y: 21 },
      { id: "chain-only", x: 29, y: 21 },
      { id: "x-boundary", x: 16, y: 0 },
      { id: "y-boundary", x: 0, y: 22 },
      { id: "far", x: 400, y: 400 }
    ];
    expect(findOverlappingMapPins(points, "origin")).toEqual([points[1], points[0]]);
    expect(findOverlappingMapPins(points, "far")).toEqual([points[5]]);
  });

  it("does not pick a replacement origin when the selected viewer is offline", () => {
    expect(findOverlappingMapPins([], "offline")).toEqual([]);
    expect(findOverlappingMapPins([{ id: "remaining", x: 10, y: 10 }], "offline")).toEqual([]);
  });
});
