import { prisma } from "db";

const PRIVATE_IP_PREFIXES = [
  "127.", "10.", "192.168.",
  "172.16.", "172.17.", "172.18.", "172.19.", "172.20.",
  "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
  "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
  "::1", "fe80:"
];

export async function enrichLeadGeo(leadId: string, ip: string): Promise<void> {
  if (!ip || ip === "unknown") return;
  if (PRIVATE_IP_PREFIXES.some((p) => ip.startsWith(p))) return;
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(3000),
      headers: { "user-agent": "hotwebinar-clone/1.0" }
    });
    if (!res.ok) return;
    const d = (await res.json()) as {
      country_code?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      error?: boolean;
    };
    if (d.error) return;
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        country: d.country_code ?? null,
        region: d.region ?? null,
        city: d.city ?? null,
        lat: typeof d.latitude === "number" ? d.latitude : null,
        lng: typeof d.longitude === "number" ? d.longitude : null
      }
    });
  } catch {
    /* silent — best-effort enrichment */
  }
}
