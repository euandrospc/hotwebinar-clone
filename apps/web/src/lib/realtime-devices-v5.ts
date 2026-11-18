import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

const deviceTypes = [
  { key: "desktop", label: "Desktop", color: "#535bff" },
  { key: "mobile", label: "Mobile", color: "#858bff" },
  { key: "tablet", label: "Tablet", color: "#b0b5ff" },
  { key: "unknown", label: "Unknown", color: "#a1a7b3" },
] as const;

export interface RealtimeDevicesV5Data {
  available: boolean;
  total: number | null;
  items: Array<{
    key: keyof WebinarRealtimeSnapshot["devices"];
    label: string;
    count: number;
    percentage: number | null;
    color: string;
  }>;
}

/** Devices describe the same unique online viewers as the live KPI. */
export function buildRealtimeDevicesV5(snapshot: WebinarRealtimeSnapshot | null): RealtimeDevicesV5Data {
  const unavailable: RealtimeDevicesV5Data = { available: false, total: null, items: [] };
  if (!snapshot || !Number.isSafeInteger(snapshot.online) || snapshot.online < 0 || !snapshot.devices) return unavailable;
  if (deviceTypes.some(({ key }) => !Number.isSafeInteger(snapshot.devices[key]) || snapshot.devices[key] < 0)) return unavailable;
  const total = deviceTypes.reduce((sum, { key }) => sum + snapshot.devices[key], 0);
  // Do not silently discard unknown devices or invent a balancing category.
  if (total !== snapshot.online) return unavailable;
  return {
    available: true,
    total,
    items: deviceTypes.map(device => ({
      ...device,
      count: snapshot.devices[device.key],
      percentage: total > 0 ? snapshot.devices[device.key] / total * 100 : null,
    })),
  };
}
