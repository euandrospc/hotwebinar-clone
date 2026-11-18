import { describe, expect, it } from "vitest";
import { BRAZIL_STATES, buildRealtimeMapV5 } from "@/lib/realtime-map-v5";
import { buildWebinarRealtimeSnapshot, type WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

type Location = WebinarRealtimeSnapshot["locations"][number];
const location = (id: string, region: string | null = "SP", country: string | null = "BR"): Location => ({
  id, name: null, city: null, region, country, lat: -23.55, lng: -46.63, count: 1,
});
const snapshot = (locations: Location[] = [], online = locations.length): WebinarRealtimeSnapshot => ({
  ...buildWebinarRealtimeSnapshot([]), online, locations, geography: undefined,
});
const state = (result: ReturnType<typeof buildRealtimeMapV5>, uf: string) => result.states.find(item => item.uf === uf)!;

describe("realtime Brazil choropleth", () => {
  it("keeps all 27 states and differentiates unavailable from a genuine zero", () => {
    expect(new Set(BRAZIL_STATES.map(([uf]) => uf)).size).toBe(27);
    const missing = buildRealtimeMapV5(null);
    expect(missing.available).toBe(false);
    expect(missing.totalOnline).toBeNull();
    expect(missing.states).toHaveLength(27);
    expect(missing.states.every(item => item.value === null)).toBe(true);
    const zero = buildRealtimeMapV5(snapshot());
    expect(zero).toMatchObject({ available: true, totalOnline: 0, brazilMapped: 0, outsideBrazil: 0, unmapped: 0 });
    expect(zero.states.every(item => item.value === 0)).toBe(true);
  });

  it("normalizes state codes, ISO prefixes, names, accents and Brazil aliases", () => {
    const result = buildRealtimeMapV5(snapshot([
      location("1", " sp ", "br"), location("2", "BR-SP", "Brasil"),
      location("3", "São Paulo", "Brazil"), location("4", "sao  paulo", "BRA"),
      location("5", "BR_RJ"), location("6", "Rio de Janeiro"),
      location("7", "Espírito Santo"), location("8", "Paraiba"),
    ]));
    expect(state(result, "SP")).toMatchObject({ key: "br-sp", name: "São Paulo", value: 4 });
    expect(state(result, "RJ").value).toBe(2);
    expect(state(result, "ES").value).toBe(1);
    expect(state(result, "PB").value).toBe(1);
    expect(result.brazilMapped).toBe(8);
  });

  it("separates foreign viewers and unknown states without guessing from coordinates", () => {
    const result = buildRealtimeMapV5(snapshot([
      location("br", "MG"), location("foreign", "SP", "US"), location("foreign2", "Lisbon", "PT"),
      location("missing-country", "SP", null), location("missing-region", null), location("invalid-region", "Atlantis"),
      location("unknown-country", "SP", "UNKNOWN"),
    ], 10));
    expect(result).toMatchObject({ totalOnline: 10, brazilMapped: 1, outsideBrazil: 2, unmapped: 7 });
    expect(state(result, "SP").value).toBe(0);
    expect(result.states.reduce((sum, item) => sum + (item.value ?? 0), 0)).toBe(result.brazilMapped);
  });

  it("counts a viewer ID once and preserves the first valid location", () => {
    const result = buildRealtimeMapV5(snapshot([
      location("one", "SP"), location("one", "RJ"), location("two", "SC"), location("two", "SP", "US"),
    ], 2));
    expect(result).toMatchObject({ brazilMapped: 2, outsideBrazil: 0, unmapped: 0 });
    expect(state(result, "SP").value).toBe(1);
    expect(state(result, "RJ").value).toBe(0);
  });

  it("counts identified states and foreign countries without coordinates, preserving unknown geography", () => {
    const result = buildRealtimeMapV5({ ...snapshot([], 8), geography: [
      { country: "BR", region: "São Paulo", count: 2 },
      { country: "BRA", region: "BR_RJ", count: 1 },
      { country: "US", region: null, count: 2 },
      { country: "BR", region: null, count: 1 },
      { country: null, region: "SP", count: 1 },
      { country: "UNKNOWN", region: null, count: 1 },
    ] });
    expect(result).toMatchObject({ available: true, totalOnline: 8, brazilMapped: 3, outsideBrazil: 2, unmapped: 3 });
    expect(state(result, "SP").value).toBe(2);
    expect(state(result, "RJ").value).toBe(1);
  });

  it("uses the all-viewer geography instead of adding coordinate pins a second time", () => {
    const result = buildRealtimeMapV5({ ...snapshot([location("one", "SP")], 2), geography: [
      { country: "BR", region: "SP", count: 2 },
    ] });
    expect(result).toMatchObject({ available: true, brazilMapped: 2, unmapped: 0 });
    expect(state(result, "SP").value).toBe(2);
  });

  it.each([
    [],
    [{ country: "BR", region: "SP", count: 3 }],
    [{ country: "BR", region: "SP", count: 1 }],
    [{ country: "BR", region: "SP", count: -1 }],
    [{ country: "BR", region: "SP", count: 1.5 }],
    [{ country: "BR", region: "SP", count: Number.NaN }],
  ].map(geography => [geography] as const))("does not repair malformed or incomplete all-viewer geography (%j)", geography => {
    expect(buildRealtimeMapV5({ ...snapshot([location("valid")], 2), geography }).available).toBe(false);
  });

  it("leaves malformed or aggregated individual records unmapped", () => {
    const result = buildRealtimeMapV5(snapshot([
      { ...location("count"), count: 4 }, { ...location("negative"), count: -1 },
      { ...location("coord"), lat: Number.NaN }, { ...location("range"), lng: 190 },
      location(""), location("valid", "BA"),
    ], 6));
    expect(result).toMatchObject({ available: true, brazilMapped: 1, outsideBrazil: 0, unmapped: 5 });
  });

  it("does not clip an inconsistent total into apparently valid geography", () => {
    expect(buildRealtimeMapV5(snapshot([location("one"), location("two")], 1)).available).toBe(false);
    expect(buildRealtimeMapV5(snapshot([location("one")], 0)).available).toBe(false);
    expect(buildRealtimeMapV5(snapshot([], Number.NaN)).available).toBe(false);
    expect(buildRealtimeMapV5(snapshot([], -1)).available).toBe(false);
    expect(buildRealtimeMapV5(snapshot([], 0.5)).available).toBe(false);
  });
});
