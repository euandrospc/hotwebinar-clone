import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

const DEMO_CUTOFF = Date.parse("2026-11-17T18:00:00.000Z");
const SAMPLE_MS = 15_000;
const SAMPLE_COUNT = 241;
const AUDIENCE_KNOTS = [104, 117, 132, 146, 127, 144, 165, 153, 141, 176, 201, 189, 178];
const REVENUE_CENTS = [
  4_982_300, 6_143_700, 5_330_900, 7_023_400, 5_874_100, 6_665_000,
  7_312_400, 6_146_700, 8_173_000, 6_933_500, 7_516_900, 8_842_300,
  7_243_800, 9_152_600, 8_621_900, 8_938_120, 8_070_994
];
const SALE_COUNTS = [38, 46, 40, 53, 44, 50, 55, 46, 62, 52, 57, 67, 55, 69, 65, 68, 61];
const FUNNEL_COUNTS = [2610, 2231, 1066, 117, 61];
const FUNNEL_LABELS = ["Visitas", "Acessou o webinar", "Chegou no pitch", "Clicou na oferta", "Comprou"];
const LIVE_LOCATION_GROUPS = [
  { country: "BR", region: "São Paulo", city: "São Paulo", lat: -23.5505, lng: -46.6333, count: 46 },
  { country: "BR", region: "BR-RJ", city: "Rio de Janeiro", lat: -22.9068, lng: -43.1729, count: 24 },
  { country: "BR", region: "MG", city: "Belo Horizonte", lat: -19.9167, lng: -43.9345, count: 22 },
  { country: "BR", region: "PR", city: "Curitiba", lat: -25.4284, lng: -49.2733, count: 14 },
  { country: "BR", region: "RS", city: "Porto Alegre", lat: -30.0346, lng: -51.2177, count: 10 },
  { country: "BR", region: "SC", city: "Florianópolis", lat: -27.5954, lng: -48.5480, count: 8 },
  { country: "BR", region: "BA", city: "Salvador", lat: -12.9777, lng: -38.5016, count: 8 },
  { country: "BR", region: "PE", city: "Recife", lat: -8.0476, lng: -34.8770, count: 7 },
  { country: "BR", region: "CE", city: "Fortaleza", lat: -3.7319, lng: -38.5267, count: 6 },
  { country: "BR", region: "DF", city: "Brasília", lat: -15.7939, lng: -47.8828, count: 5 },
  { country: "BR", region: "GO", city: "Goiânia", lat: -16.6869, lng: -49.2648, count: 5 },
  { country: "BR", region: "PA", city: "Belém", lat: -1.4558, lng: -48.4902, count: 5 },
  { country: "PT", region: "Lisbon", city: "Lisbon", lat: 38.7223, lng: -9.1393, count: 5 },
  { country: "US", region: "NY", city: "New York", lat: 40.7128, lng: -74.0060, count: 3 },
];

/** Only an exact loopback Host in development can enable the in-memory preview. */
export function isRealtimeKpiDemoRequest({ nodeEnv, host, demo }: {
  nodeEnv: string | undefined;
  host: string | null;
  demo?: string | string[];
}): boolean {
  return nodeEnv === "development" && typeof host === "string"
    && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host)
    && demo === "1";
}

/** A fresh deterministic snapshot for the realtime preview; never persisted. */
export function buildRealtimeKpisV5DemoSnapshot(): WebinarRealtimeSnapshot {
  const updatedAt = new Date(DEMO_CUTOFF).toISOString();
  const points = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const segment = Math.min(Math.floor(index / 20), AUDIENCE_KNOTS.length - 2);
    const progress = (index - segment * 20) / 20;
    const baseline = AUDIENCE_KNOTS[segment] + (AUDIENCE_KNOTS[segment + 1] - AUDIENCE_KNOTS[segment]) * progress;
    const variation = index === 0 || index === 200 || index === SAMPLE_COUNT - 1 ? 0 : Math.sin(index * 0.29) * 4;
    return {
      at: new Date(DEMO_CUTOFF - (SAMPLE_COUNT - 1 - index) * SAMPLE_MS).toISOString(),
      online: Math.min(201, Math.round(baseline + variation))
    };
  });
  const online = points[points.length - 1].online;
  const peak = Math.max(...points.map(point => point.online));
  const revenueCents = REVENUE_CENTS[REVENUE_CENTS.length - 1];
  const yesterdayRevenueCents = REVENUE_CENTS[REVENUE_CENTS.length - 2];
  const todayFrom = "2026-11-17T03:00:00.000Z";
  const locations = LIVE_LOCATION_GROUPS.flatMap((group, groupIndex) =>
    Array.from({ length: group.count }, (_, personIndex) => ({
      ...group,
      id: `demo-live-location-${groupIndex}-${personIndex}`,
      name: null,
      count: 1,
    })));

  return {
    updatedAt,
    online,
    attendants: {
      from: todayFrom,
      to: updatedAt,
      online: [
        { id: "demo-attendant-ana", name: "Ana Martins", image: null, handledConversations: 47 },
        { id: "demo-attendant-lucas", name: "Lucas Alves", image: null, handledConversations: 36 },
        { id: "demo-attendant-marina", name: "Marina Costa", image: null, handledConversations: 28 },
        { id: "demo-attendant-rafael", name: "Rafael Lima", image: null, handledConversations: 0 },
      ],
    },
    devices: { desktop: 52, mobile: 112, tablet: 10, unknown: 4 },
    located: locations.length,
    unlocated: online - locations.length,
    locations,
    topCities: LIVE_LOCATION_GROUPS.slice(0, 5).map(group => ({ label: `${group.city}, ${group.region}, ${group.country}`, count: group.count })),
    topCountries: [{ code: "BR", count: 160 }, { code: "PT", count: 5 }, { code: "US", count: 3 }],
    funnel: FUNNEL_COUNTS.map((count, index) => ({
      label: FUNNEL_LABELS[index],
      count,
      pct: Math.round(count / FUNNEL_COUNTS[0] * 10_000) / 100,
    })),
    schedule: {
      mode: "UNICO",
      startDate: new Date(DEMO_CUTOFF - 30 * 60_000).toISOString(),
      endDate: new Date(DEMO_CUTOFF + 60 * 60_000).toISOString(),
      pitchAtSec: 45 * 60,
      offerShowAtSec: 50 * 60,
      offerHideAtSec: 80 * 60,
      offerDisabled: false,
      videoSyncWithStart: true,
    },
    audience: {
      average: points.reduce((total, point) => total + point.online, 0) / points.length,
      peak,
      peakAt: points.find(point => point.online === peak)?.at ?? null,
      sampleCount: points.length,
      history: { from: todayFrom, to: updatedAt, points },
      sessionHistory: {
        from: new Date(DEMO_CUTOFF - 30 * 60_000).toISOString(),
        to: updatedAt,
        points: points.filter(point => Date.parse(point.at) >= DEMO_CUTOFF - 30 * 60_000).map(point => ({ ...point })),
      }
    },
    sales: {
      currency: "BRL",
      timezone: "America/Sao_Paulo",
      today: { from: todayFrom, to: updatedAt, revenueCents, count: 61, excludedCount: 0 },
      yesterday: { from: "2026-11-16T03:00:00.000Z", to: todayFrom, revenueCents: yesterdayRevenueCents, count: 68, excludedCount: 0 },
      changePct: Math.round((revenueCents - yesterdayRevenueCents) / yesterdayRevenueCents * 10_000) / 100,
      month: {
        from: "2026-11-01T03:00:00.000Z",
        to: updatedAt,
        excludedCount: 0,
        points: REVENUE_CENTS.map((amount, index) => ({
          date: `2026-11-${String(index + 1).padStart(2, "0")}`,
          revenueCents: amount,
          count: SALE_COUNTS[index]
        }))
      }
    }
  };
}
