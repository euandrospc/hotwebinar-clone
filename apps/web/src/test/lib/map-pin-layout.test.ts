import { describe, expect, it } from "vitest";
import { separateMapPins } from "@/lib/map-pin-layout";

describe("individual map pins", () => {
  it("keeps 256 people at the same coordinates individually selectable", () => {
    const points = Array.from({ length: 256 }, (_, index) => ({ id: `person-${index}`, x: 300, y: 250 }));
    const original = structuredClone(points);
    const offsets = separateMapPins(points);
    expect(offsets.size).toBe(256);
    const positions = points.map((point) => ({ x: point.x + offsets.get(point.id)!.x, y: point.y + offsets.get(point.id)!.y }));
    for (let index = 0; index < positions.length; index++) {
      for (let other = 0; other < index; other++) {
        expect(Math.hypot(positions[index].x - positions[other].x, positions[index].y - positions[other].y)).toBeGreaterThanOrEqual(21 - 1e-9);
      }
    }
    expect(points).toEqual(original);
    expect(separateMapPins([...points].reverse())).toEqual(offsets);
  });

  it("leaves clear positions untouched and separates nearby locations too", () => {
    const offsets = separateMapPins([
      { id: "a", x: 10, y: 10 },
      { id: "b", x: 12, y: 12 },
      { id: "c", x: 400, y: 400 }
    ]);
    expect(offsets.get("a")).toEqual({ x: 0, y: 0 });
    expect(offsets.get("c")).toEqual({ x: 0, y: 0 });
    const nearby = offsets.get("b")!;
    expect(Math.hypot(nearby.x + 2, nearby.y + 2)).toBeGreaterThanOrEqual(21);
    expect(separateMapPins([]).size).toBe(0);
  });
});
