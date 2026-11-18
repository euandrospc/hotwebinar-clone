import { describe, expect, it } from "vitest";
import { buildRealtimeDevicesV5 } from "@/lib/realtime-devices-v5";
import { buildRealtimeKpisV5DemoSnapshot } from "@/lib/realtime-kpis-v5-demo";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

describe("realtime devices", () => {
  it("uses the online audience, including unknown devices, as its denominator", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    const data = buildRealtimeDevicesV5(snapshot);
    expect(data).toMatchObject({ available: true, total: 178 });
    expect(data.items.map(item => item.count)).toEqual([52, 112, 10, 4]);
    expect(data.items.reduce((sum, item) => sum + item.count, 0)).toBe(snapshot.online);
    expect(data.items.find(item => item.key === "mobile")?.percentage).toBeCloseTo(112 / 178 * 100);
    expect(data.items.reduce((sum, item) => sum + item.percentage!, 0)).toBeCloseTo(100);
    expect(data.total).not.toBe(snapshot.funnel![0].count);
  });

  it("distinguishes an observed empty audience from unavailable data", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    const data = buildRealtimeDevicesV5({ ...snapshot, online: 0, devices: { desktop: 0, mobile: 0, tablet: 0, unknown: 0 } });
    expect(data).toMatchObject({ available: true, total: 0 });
    expect(data.items.every(item => item.count === 0 && item.percentage === null)).toBe(true);
    expect(buildRealtimeDevicesV5(null)).toEqual({ available: false, total: null, items: [] });
  });

  it.each([
    { desktop: -1, mobile: 112, tablet: 10, unknown: 4 },
    { desktop: 52.5, mobile: 112, tablet: 10, unknown: 4 },
    { desktop: "52", mobile: 112, tablet: 10, unknown: 4 },
    { desktop: 52, mobile: 112, tablet: 10 },
    { desktop: 52, mobile: 112, tablet: 10, unknown: 0 },
    undefined,
  ])("does not fabricate a breakdown from malformed or inconsistent counts (%j)", devices => {
    const snapshot = { ...buildRealtimeKpisV5DemoSnapshot(), devices } as WebinarRealtimeSnapshot;
    expect(buildRealtimeDevicesV5(snapshot)).toEqual({ available: false, total: null, items: [] });
  });
});
