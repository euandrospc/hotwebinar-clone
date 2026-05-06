export const LEADS_CLUSTER_THRESHOLD = 500;

export interface LeadsMapInputLead {
  id: string;
  name: string;
  email: string;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: Date;
}

export interface LeadPin {
  id: string;
  name: string;
  email: string;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number;
  lng: number;
  createdAtIso: string;
}

export interface LeadsMapAggregate {
  pins: LeadPin[];
  total: number;
  geoCount: number;
  ungeoCount: number;
  topCountries: Array<{ code: string; count: number }>;
  topCities: Array<{ city: string; count: number }>;
}

function topN<K>(map: Map<K, number>, n: number): Array<[K, number]> {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function aggregateLeadsForMap(leads: LeadsMapInputLead[]): LeadsMapAggregate {
  const pins: LeadPin[] = [];
  const countriesByCode = new Map<string, number>();
  const citiesByName = new Map<string, number>();

  for (const l of leads) {
    if (l.country) countriesByCode.set(l.country, (countriesByCode.get(l.country) ?? 0) + 1);
    if (l.city) citiesByName.set(l.city, (citiesByName.get(l.city) ?? 0) + 1);
    if (typeof l.lat === "number" && typeof l.lng === "number") {
      pins.push({
        id: l.id,
        name: l.name,
        email: l.email,
        city: l.city,
        region: l.region,
        country: l.country,
        lat: l.lat,
        lng: l.lng,
        createdAtIso: l.createdAt.toISOString()
      });
    }
  }

  return {
    pins,
    total: leads.length,
    geoCount: pins.length,
    ungeoCount: leads.length - pins.length,
    topCountries: topN(countriesByCode, 5).map(([code, count]) => ({ code, count })),
    topCities: topN(citiesByName, 5).map(([city, count]) => ({ city, count }))
  };
}
