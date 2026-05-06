import { describe, it, expect } from "vitest";
import { aggregateLeadsForMap, LEADS_CLUSTER_THRESHOLD, type LeadsMapInputLead } from "@/lib/leads-map-aggregate";

function lead(overrides: Partial<LeadsMapInputLead> = {}): LeadsMapInputLead {
  return {
    id: "l" + Math.random().toString(36).slice(2, 8),
    name: "L",
    email: "l@e.com",
    city: null,
    region: null,
    country: null,
    lat: null,
    lng: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    ...overrides
  };
}

describe("aggregateLeadsForMap", () => {
  it("returns zeros for empty input", () => {
    const r = aggregateLeadsForMap([]);
    expect(r).toEqual({
      pins: [],
      total: 0,
      geoCount: 0,
      ungeoCount: 0,
      topCountries: [],
      topCities: []
    });
  });

  it("includes only leads with both lat and lng as pins", () => {
    const r = aggregateLeadsForMap([
      lead({ lat: -23.5, lng: -46.6, city: "São Paulo", country: "BR" }),
      lead({ lat: null, lng: null, city: "Rio", country: "BR" }),
      lead({ lat: 40.7, lng: null, city: "NYC", country: "US" })
    ]);
    expect(r.pins).toHaveLength(1);
    expect(r.pins[0].city).toBe("São Paulo");
    expect(r.total).toBe(3);
    expect(r.geoCount).toBe(1);
    expect(r.ungeoCount).toBe(2);
  });

  it("counts country/city even when pin not produced", () => {
    const r = aggregateLeadsForMap([
      lead({ city: "Recife", country: "BR" }),
      lead({ city: "Recife", country: "BR" }),
      lead({ city: "Rio", country: "BR" })
    ]);
    expect(r.topCountries).toEqual([{ code: "BR", count: 3 }]);
    expect(r.topCities[0]).toEqual({ city: "Recife", count: 2 });
    expect(r.topCities[1]).toEqual({ city: "Rio", count: 1 });
  });

  it("caps top lists at 5", () => {
    const leads: LeadsMapInputLead[] = [];
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j <= i; j++) {
        leads.push(lead({ country: `C${i}` }));
      }
    }
    const r = aggregateLeadsForMap(leads);
    expect(r.topCountries).toHaveLength(5);
    expect(r.topCountries[0].count).toBe(7);
    expect(r.topCountries[4].count).toBe(3);
  });

  it("creates LeadPin with createdAtIso string", () => {
    const r = aggregateLeadsForMap([
      lead({ lat: 0, lng: 0, createdAt: new Date("2026-05-15T12:00:00Z") })
    ]);
    expect(r.pins[0].createdAtIso).toBe("2026-05-15T12:00:00.000Z");
  });

  it("exports LEADS_CLUSTER_THRESHOLD = 500", () => {
    expect(LEADS_CLUSTER_THRESHOLD).toBe(500);
  });
});
