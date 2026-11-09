import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

export type GeoIpData = {
  country: string | null;
  region: string | null;
  city: string | null;
  lat: number;
  lng: number;
};

export type GeoIpResult =
  | { ok: true; data: GeoIpData }
  | { ok: false; error: string; retryable: boolean; retryAfterMs?: number };

const RATE_LIMIT_FALLBACK_MS = 60 * 60 * 1000;

/** Canonical public addresses only; forwarded headers must never become URL paths. */
export function normalizePublicIp(value: string | null | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim();
  const bracketed = candidate.match(/^\[([0-9a-fA-F:.]+)\](?::(\d{1,5}))?$/);
  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);
  const wrapped = bracketed ?? ipv4WithPort;
  if (wrapped) {
    if (wrapped[2] && (Number(wrapped[2]) < 1 || Number(wrapped[2]) > 65535)) return null;
    candidate = wrapped[1];
    if (bracketed && isIP(candidate) !== 6) return null;
  }
  // Reject ambiguous legacy IPv4 spellings and scoped IPv6 before parsing.
  if (!isIP(candidate) || candidate.includes("%")) return null;
  try {
    let address = ipaddr.parse(candidate);
    if (address instanceof ipaddr.IPv6 && address.isIPv4MappedAddress()) address = address.toIPv4Address();
    if (address.range() !== "unicast") return null;
    if (address instanceof ipaddr.IPv6) {
      // Addresses outside the global-unicast allocation are not public client IPs.
      if (!address.match(ipaddr.IPv6.parse("2000::"), 3)) return null;
      return address.toRFC5952String();
    }
    return address.toString();
  } catch {
    return null;
  }
}

export function hasValidGeo(value: { lat: number | null; lng: number | null }): boolean {
  return typeof value.lat === "number" && typeof value.lng === "number" &&
    Number.isFinite(value.lat) && Number.isFinite(value.lng) &&
    value.lat >= -90 && value.lat <= 90 && value.lng >= -180 && value.lng <= 180;
}

export function getClientIp(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for");
  // Do not skip an invalid first hop or change proxy trust by consulting other headers.
  return normalizePublicIp(forwarded !== null ? forwarded.split(",")[0] : headers.get("x-real-ip"));
}

function retryAfterMs(value: string | null): number {
  if (!value?.trim()) return RATE_LIMIT_FALLBACK_MS;
  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const milliseconds = Number(trimmed) * 1000;
    if (Number.isFinite(milliseconds)) return Math.max(1000, milliseconds);
  }
  const date = Date.parse(trimmed);
  return Number.isFinite(date) ? Math.max(1000, date - Date.now()) : RATE_LIMIT_FALLBACK_MS;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

/** One provider request only. Persistence, shared throttling and retries belong to the worker. */
export async function lookupGeoIp(ip: string): Promise<GeoIpResult> {
  const normalized = normalizePublicIp(ip);
  if (!normalized) return { ok: false, error: "invalid_ip", retryable: false };
  const url = new URL(`https://ipapi.co/${encodeURIComponent(normalized)}/json/`);
  const key = process.env.GEOIP_API_KEY?.trim();
  // Official client uses ?key=: github.com/ipapi-co/ipapi-nodejs/blob/master/ipapi.js
  if (key) url.searchParams.set("key", key);

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
      headers: { "user-agent": "hotwebinar-clone/1.0" },
      cache: "no-store",
      redirect: "error"
    });
    if (response.status === 429) {
      return { ok: false, error: "rate_limited", retryable: true, retryAfterMs: retryAfterMs(response.headers.get("retry-after")) };
    }
    if (!response.ok) {
      const retryable = response.status >= 500 || response.status === 408;
      const retryAfter = response.headers.get("retry-after");
      return {
        ok: false, error: `http_${response.status}`, retryable,
        ...(retryable && retryAfter ? { retryAfterMs: retryAfterMs(retryAfter) } : {})
      };
    }
    let body: unknown;
    try { body = await response.json(); }
    catch { return { ok: false, error: "invalid_response", retryable: true }; }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false, error: "invalid_response", retryable: true };
    }
    const data = body as Record<string, unknown>;
    const reason = typeof data.reason === "string" ? data.reason.toLowerCase().replace(/[^a-z]/g, "") : "";
    if (reason === "ratelimited") {
      return { ok: false, error: "rate_limited", retryable: true, retryAfterMs: retryAfterMs(response.headers.get("retry-after")) };
    }
    if (data.error || data.reserved === true) {
      if (reason === "invalidipaddress") return { ok: false, error: "invalid_ip", retryable: false };
      if (reason === "reservedipaddress" || data.reserved === true) return { ok: false, error: "reserved_ip", retryable: false };
      return { ok: false, error: "provider_error", retryable: true };
    }
    const lat = typeof data.latitude === "number" ? data.latitude : null;
    const lng = typeof data.longitude === "number" ? data.longitude : null;
    if (lat === null || lng === null || !hasValidGeo({ lat, lng })) {
      return { ok: false, error: "invalid_coordinates", retryable: true };
    }
    return {
      ok: true,
      data: { country: optionalText(data.country_code), region: optionalText(data.region), city: optionalText(data.city), lat, lng }
    };
  } catch (error) {
    const timedOut = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
    return { ok: false, error: timedOut ? "timeout" : "network_error", retryable: true };
  }
}
