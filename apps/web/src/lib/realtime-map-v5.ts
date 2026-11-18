import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

export const BRAZIL_STATES = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
  ["BA", "Bahia"], ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"],
  ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
] as const;

export interface RealtimeMapV5State {
  key: string;
  uf: string;
  name: string;
  value: number | null;
}

export interface RealtimeMapV5Data {
  available: boolean;
  states: RealtimeMapV5State[];
  totalOnline: number | null;
  brazilMapped: number | null;
  outsideBrazil: number | null;
  unmapped: number | null;
}

function normalized(value: unknown) {
  return typeof value === "string"
    ? value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ")
    : "";
}

const stateCodes = new Map<string, string>(BRAZIL_STATES.flatMap(([uf, name]) => [[uf, uf], [normalized(name), uf]]));
const brazilNames = new Set(["BR", "BRA", "BRASIL", "BRAZIL"]);
const unknownCountries = new Set(["", "UNKNOWN", "UNDEFINED", "NULL", "N/A", "XX", "ZZ", "—", "-"]);

function stateCode(region: unknown) {
  return stateCodes.get(normalized(region).replace(/^BR[-_\s]+/, ""));
}

function emptyMap(): RealtimeMapV5Data {
  return {
    available: false,
    states: BRAZIL_STATES.map(([uf, name]) => ({ key: `br-${uf.toLowerCase()}`, uf, name, value: null })),
    totalOnline: null,
    brazilMapped: null,
    outsideBrazil: null,
    unmapped: null,
  };
}

/** Aggregate only the snapshot's individual online viewers, never historical visits. */
export function buildRealtimeMapV5(snapshot: WebinarRealtimeSnapshot | null): RealtimeMapV5Data {
  if (!snapshot || !Number.isSafeInteger(snapshot.online) || snapshot.online < 0) return emptyMap();

  const counts = new Map<string, number>();
  let outsideBrazil = 0;
  let brazilMapped = 0;

  function addGeography(countryValue: string | null, regionValue: string | null, count: number) {
    const country = normalized(countryValue);
    if (brazilNames.has(country)) {
      const uf = stateCode(regionValue);
      if (uf) {
        counts.set(uf, (counts.get(uf) ?? 0) + count);
        brazilMapped += count;
      }
    } else if (!unknownCountries.has(country)) {
      outsideBrazil += count;
    }
  }

  if (snapshot.geography !== undefined) {
    // State-level identification does not require a geolocated map pin. This
    // summary covers every unique online viewer, including unknown locations.
    if (!Array.isArray(snapshot.geography)) return emptyMap();
    let total = 0;
    for (const group of snapshot.geography) {
      if (!group || !Number.isSafeInteger(group.count) || group.count < 0
        || (group.country !== null && typeof group.country !== "string")
        || (group.region !== null && typeof group.region !== "string")) return emptyMap();
      total += group.count;
      if (!Number.isSafeInteger(total) || total > snapshot.online) return emptyMap();
      addGeography(group.country, group.region, group.count);
    }
    if (total !== snapshot.online) return emptyMap();
  } else {
    // Older snapshots carry only coordinate-based individual locations. Retain
    // that contract without interpreting their count as an aggregated bucket.
    if (!Array.isArray(snapshot.locations)) return emptyMap();
    const seen = new Set<string>();
    for (const location of snapshot.locations) {
      if (!location || typeof location.id !== "string" || !location.id.trim() || seen.has(location.id)) continue;
      if (location.count !== 1 || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)
        || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) continue;
      seen.add(location.id);
      addGeography(location.country, location.region, 1);
    }
    // Never repair an inconsistent snapshot by clipping or reassigning viewers.
    if (seen.size > snapshot.online) return emptyMap();
  }

  return {
    available: true,
    states: BRAZIL_STATES.map(([uf, name]) => ({
      key: `br-${uf.toLowerCase()}`, uf, name, value: counts.get(uf) ?? 0,
    })),
    totalOnline: snapshot.online,
    brazilMapped,
    outsideBrazil,
    unmapped: snapshot.online - brazilMapped - outsideBrazil,
  };
}
