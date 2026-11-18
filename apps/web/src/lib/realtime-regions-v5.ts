import type { RealtimeMapV5Data } from "@/lib/realtime-map-v5";

const regions = [
  { key: "southeast", label: "Southeast", states: ["ES", "MG", "RJ", "SP"], color: "#535bff" },
  { key: "south", label: "South", states: ["PR", "RS", "SC"], color: "#858bff" },
  { key: "northeast", label: "Northeast", states: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"], color: "#a6aaff" },
  { key: "central-west", label: "Central-West", states: ["DF", "GO", "MT", "MS"], color: "#b9a4e8" },
  { key: "north", label: "North", states: ["AC", "AP", "AM", "PA", "RO", "RR", "TO"], color: "#8dbbd7" },
] as const;

export interface RealtimeRegionsV5Data {
  available: boolean;
  total: number | null;
  items: Array<{ key: string; label: string; count: number; percentage: number | null; color: string }>;
  outsideBrazil: number | null;
  unmapped: number | null;
}

/** Use the same identified Brazilian viewers as the map, not all online viewers. */
export function buildRealtimeRegionsV5(map: RealtimeMapV5Data): RealtimeRegionsV5Data {
  const unavailable: RealtimeRegionsV5Data = {
    available: false, total: null, items: [], outsideBrazil: null, unmapped: null,
  };
  const { brazilMapped, outsideBrazil, unmapped, totalOnline } = map;
  if (!map.available || brazilMapped === null || outsideBrazil === null || unmapped === null || totalOnline === null
    || [brazilMapped, outsideBrazil, unmapped, totalOnline].some(value => !Number.isSafeInteger(value) || value < 0)
    || brazilMapped + outsideBrazil + unmapped !== totalOnline) return unavailable;

  const stateCounts = new Map<string, number>();
  const knownStates = new Set<string>(regions.flatMap(region => [...region.states]));
  for (const state of map.states) {
    if (!knownStates.has(state.uf) || stateCounts.has(state.uf) || state.value === null
      || !Number.isSafeInteger(state.value) || state.value < 0) return unavailable;
    stateCounts.set(state.uf, state.value);
  }
  if (stateCounts.size !== knownStates.size
    || [...stateCounts.values()].reduce((sum, count) => sum + count, 0) !== brazilMapped) return unavailable;

  return {
    available: true,
    total: brazilMapped,
    outsideBrazil,
    unmapped,
    items: regions.map(({ states, ...region }) => {
      const count = states.reduce((sum, uf) => sum + stateCounts.get(uf)!, 0);
      return { ...region, count, percentage: brazilMapped > 0 ? count / brazilMapped * 100 : null };
    }),
  };
}
