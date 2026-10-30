export interface RealtimeLead {
  userAgent: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
}

export interface WebinarRealtimeSnapshot {
  updatedAt: string;
  online: number;
  devices: { desktop: number; mobile: number; tablet: number; unknown: number };
  located: number;
  unlocated: number;
  locations: Array<{
    id: string;
    city: string | null;
    region: string | null;
    country: string | null;
    lat: number;
    lng: number;
    count: number;
  }>;
  topCities: Array<{ label: string; count: number }>;
  topCountries: Array<{ code: string; count: number }>;
}

export function realtimeDeviceType(userAgent: string | null): keyof WebinarRealtimeSnapshot["devices"] {
  if (!userAgent?.trim()) return "unknown";
  if (/ipad|tablet|kindle|silk|playbook/i.test(userAgent) || (/android/i.test(userAgent) && !/mobile/i.test(userAgent))) {
    return "tablet";
  }
  if (/mobile|iphone|ipod|windows phone|blackberry/i.test(userAgent)) return "mobile";
  if (/windows|macintosh|mac os x|x11|linux|cros/i.test(userAgent)) return "desktop";
  return "unknown";
}

const clean = (value: string | null) => value?.trim() || null;

function rankedCounts(counts: Map<string, number>) {
  return [...counts.entries()]
    .sort(([a, ac], [b, bc]) => bc - ac || a.localeCompare(b))
    .slice(0, 5);
}

// All panels describe the same online cohort. Coordinates are approximate IP
// locations, so viewers at the same location share a marker, without exposing PII.
export function buildWebinarRealtimeSnapshot(
  leads: RealtimeLead[],
  now = new Date()
): WebinarRealtimeSnapshot {
  const devices: WebinarRealtimeSnapshot["devices"] = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
  const locations = new Map<string, WebinarRealtimeSnapshot["locations"][number]>();
  const cities = new Map<string, number>();
  const countries = new Map<string, number>();
  let located = 0;

  for (const lead of leads) {
    devices[realtimeDeviceType(lead.userAgent)] += 1;
    const city = clean(lead.city);
    const region = clean(lead.region);
    const country = clean(lead.country)?.toUpperCase() ?? null;
    if (country) countries.set(country, (countries.get(country) ?? 0) + 1);
    if (city) {
      const label = [city, region, country].filter(Boolean).join(", ");
      cities.set(label, (cities.get(label) ?? 0) + 1);
    }

    const { lat, lng } = lead;
    if (
      typeof lat !== "number" || typeof lng !== "number" ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) continue;

    located += 1;
    const id = JSON.stringify([lat, lng, city, region, country]);
    const existing = locations.get(id);
    if (existing) existing.count += 1;
    else locations.set(id, { id, city, region, country, lat, lng, count: 1 });
  }

  return {
    updatedAt: now.toISOString(),
    online: leads.length,
    devices,
    located,
    unlocated: leads.length - located,
    locations: [...locations.values()],
    topCities: rankedCounts(cities).map(([label, count]) => ({ label, count })),
    topCountries: rankedCounts(countries).map(([code, count]) => ({ code, count }))
  };
}
