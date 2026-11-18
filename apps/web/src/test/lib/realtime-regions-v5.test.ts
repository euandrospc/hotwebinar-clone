import { describe, expect, it } from "vitest";
import { BRAZIL_STATES, buildRealtimeMapV5 } from "@/lib/realtime-map-v5";
import { buildRealtimeRegionsV5 } from "@/lib/realtime-regions-v5";
import { buildRealtimeKpisV5DemoSnapshot } from "@/lib/realtime-kpis-v5-demo";
import { buildWebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

describe("realtime Brazil regions", () => {
  it("groups every UF exactly once, including DF in Central-West and TO in North", () => {
    const map = buildRealtimeMapV5(buildWebinarRealtimeSnapshot([]));
    map.states = BRAZIL_STATES.map(([uf, name]) => ({ key: `br-${uf.toLowerCase()}`, uf, name, value: 1 }));
    map.brazilMapped = map.totalOnline = 27;
    const result = buildRealtimeRegionsV5(map);
    expect(Object.fromEntries(result.items.map(item => [item.key, item.count]))).toEqual({
      southeast: 4, south: 3, northeast: 9, "central-west": 4, north: 7,
    });
    for (const [uf, region] of [["DF", "central-west"], ["TO", "north"], ["MS", "central-west"]]) {
      const single = { ...map, brazilMapped: 1, totalOnline: 1, states: map.states.map(state => ({ ...state, value: state.uf === uf ? 1 : 0 })) };
      expect(buildRealtimeRegionsV5(single).items.find(item => item.key === region)?.count).toBe(1);
    }
  });

  it("uses mapped Brazilian viewers as the percentage base and separates excluded coverage", () => {
    const result = buildRealtimeRegionsV5(buildRealtimeMapV5(buildRealtimeKpisV5DemoSnapshot()));
    expect(result).toMatchObject({ available: true, total: 160, outsideBrazil: 8, unmapped: 10 });
    expect(result.items.map(item => item.count)).toEqual([92, 32, 21, 10, 5]);
    [57.5, 20, 13.125, 6.25, 3.125].forEach((percentage, index) => {
      expect(result.items[index].percentage).toBeCloseTo(percentage, 8);
    });
    expect(result.items.reduce((sum, item) => sum + item.count, 0)).toBe(result.total);
  });

  it("keeps zero regions distinct from unavailable data, including online viewers without a Brazilian UF", () => {
    const zero = buildRealtimeRegionsV5(buildRealtimeMapV5(buildWebinarRealtimeSnapshot([])));
    expect(zero).toMatchObject({ available: true, total: 0, outsideBrazil: 0, unmapped: 0 });
    expect(zero.items).toHaveLength(5);
    expect(zero.items.every(item => item.count === 0 && item.percentage === null)).toBe(true);
    const unmapped = buildRealtimeRegionsV5(buildRealtimeMapV5({ ...buildWebinarRealtimeSnapshot([]), online: 4,
      geography: [{ country: null, region: null, count: 4 }],
    }));
    expect(unmapped).toMatchObject({ available: true, total: 0, unmapped: 4 });
    expect(buildRealtimeRegionsV5(buildRealtimeMapV5(null))).toEqual({
      available: false, total: null, items: [], outsideBrazil: null, unmapped: null,
    });
  });

  it("does not manufacture regions from inconsistent or incomplete map counts", () => {
    const map = buildRealtimeMapV5(buildRealtimeKpisV5DemoSnapshot());
    const invalidMaps = [
      { ...map, brazilMapped: 159 },
      { ...map, totalOnline: 179 },
      { ...map, states: map.states.slice(1) },
      { ...map, states: [...map.states, map.states[0]] },
      { ...map, states: map.states.map((state, index) => index === 0 ? { ...state, value: -1 } : state) },
      { ...map, states: map.states.map((state, index) => index === 0 ? { ...state, value: null } : state) },
    ];
    for (const invalid of invalidMaps) expect(buildRealtimeRegionsV5(invalid).available).toBe(false);
  });
});
