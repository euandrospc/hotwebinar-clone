import { describe, expect, it } from "vitest";
import {
  buildWebinarRealtimeSnapshot,
  realtimeDeviceType,
  type RealtimeLead
} from "@/lib/webinar-realtime";

const lead = (overrides: Partial<RealtimeLead> = {}): RealtimeLead => ({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  city: "São Paulo",
  region: "SP",
  country: "BR",
  lat: -23.55,
  lng: -46.63,
  ...overrides
});

describe("webinar realtime aggregation", () => {
  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "desktop"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "desktop"],
    ["Mozilla/5.0 (X11; Linux x86_64)", "desktop"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile", "mobile"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile", "mobile"],
    ["Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Mobile", "tablet"],
    ["Mozilla/5.0 (Linux; Android 14; SM-X900)", "tablet"],
    [null, "unknown"],
    ["  ", "unknown"],
    ["Unrecognized client", "unknown"]
  ])("classifies %s as %s", (ua, expected) => {
    expect(realtimeDeviceType(ua)).toBe(expected);
  });

  it("keeps device and location totals consistent and groups shared map locations", () => {
    const result = buildWebinarRealtimeSnapshot([
      lead(),
      lead({ userAgent: "iPhone Mobile", country: " br " }),
      lead({ userAgent: "iPad Mobile", city: "Rio de Janeiro", region: "RJ", lat: -22.90, lng: -43.17 }),
      lead({ userAgent: null, city: null, region: null, country: null, lat: null, lng: null })
    ], new Date("2026-10-30T18:00:00Z"));

    expect(result.updatedAt).toBe("2026-10-30T18:00:00.000Z");
    expect(result.online).toBe(4);
    expect(result.devices).toEqual({ desktop: 1, mobile: 1, tablet: 1, unknown: 1 });
    expect(result.located).toBe(3);
    expect(result.unlocated).toBe(1);
    expect(result.locations).toHaveLength(2);
    expect(result.locations.find((location) => location.city === "São Paulo")?.count).toBe(2);
    expect(result.locations.reduce((count, location) => count + location.count, 0)).toBe(result.located);
    expect(result.topCountries).toEqual([{ code: "BR", count: 3 }]);
    expect(result.topCities[0]).toEqual({ label: "São Paulo, SP, BR", count: 2 });
  });

  it("excludes invalid coordinates while keeping known city and country counts", () => {
    const result = buildWebinarRealtimeSnapshot([
      lead({ lat: NaN }), lead({ lng: Infinity }), lead({ lat: 91 }),
      lead({ lng: -181 }), lead({ lat: null }), lead({ lng: null }),
      lead({ lat: 0, lng: 0 })
    ]);
    expect(result.online).toBe(7);
    expect(result.located).toBe(1);
    expect(result.unlocated).toBe(6);
    expect(result.locations[0]).toMatchObject({ lat: 0, lng: 0, count: 1 });
    expect(result.topCountries).toEqual([{ code: "BR", count: 7 }]);
  });

  it("does not merge cities in different regions and limits rankings to five", () => {
    const result = buildWebinarRealtimeSnapshot([
      lead({ city: "Springfield", region: "IL", country: "US" }),
      lead({ city: "Springfield", region: "MA", country: "US" }),
      ...["A", "B", "C", "D", "E"].map((city) => lead({ city }))
    ]);
    expect(result.locations).toHaveLength(7);
    expect(result.topCities).toHaveLength(5);
    expect(new Set(result.locations.map((location) => location.id)).size).toBe(7);
  });

  it("returns a coherent empty state", () => {
    const result = buildWebinarRealtimeSnapshot([]);
    expect(result).toMatchObject({
      online: 0,
      devices: { desktop: 0, mobile: 0, tablet: 0, unknown: 0 },
      located: 0, unlocated: 0, locations: [], topCities: [], topCountries: []
    });
  });
});
