import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getClientIp, hasValidGeo, lookupGeoIp, normalizePublicIp } from "@/lib/geoip";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEOIP_API_KEY", "");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("normalizePublicIp", () => {
  it.each([
    [" 8.8.8.8 ", "8.8.8.8"],
    ["8.8.8.8:443", "8.8.8.8"],
    ["2606:4700:4700:0000:0000:0000:0000:1111", "2606:4700:4700::1111"],
    ["[2606:4700:4700::1111]:443", "2606:4700:4700::1111"],
    ["[2606:4700:4700::1111]", "2606:4700:4700::1111"],
    ["::ffff:8.8.8.8", "8.8.8.8"],
    ["::ffff:0808:0808", "8.8.8.8"],
    ["[::ffff:8.8.8.8]:443", "8.8.8.8"]
  ])("normalizes %s", (input, expected) => expect(normalizePublicIp(input)).toBe(expected));

  it.each([
    null, undefined, "", "unknown", "127.0.0.1", "10.1.2.3", "172.31.255.255", "192.168.1.1",
    "169.254.10.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    "192.0.2.1", "198.51.100.1", "203.0.113.1", "::", "::1", "::2", "fc00::1", "fe80::1",
    "ff02::1", "fec0::1", "2001:db8::1", "3fff::1", "::ffff:192.168.1.1", "64:ff9b::0808:0808",
    "8.8.8.8:0", "8.8.8.8:65536", "[2606:4700::1111]:65536", "[8.8.8.8]:443", "1.2.3.999",
    "127.1", "0x08080808", "010.010.010.010", "8.8.8.8/json/?key=bad", "8.8.8.8, 1.1.1.1",
    "[2606:4700::1111]extra", "2606:4700::1111%eth0", "example.com"
  ])("rejects non-public or malformed input %s", input => expect(normalizePublicIp(input)).toBeNull());
});

describe("getClientIp", () => {
  it("selects the first forwarded address and preserves header precedence", () => {
    const headers = new Headers({ "x-forwarded-for": "8.8.8.8:443, 10.0.0.1", "x-real-ip": "1.1.1.1" });
    expect(getClientIp(headers)).toBe("8.8.8.8");
  });
  it.each(["", "unknown, 8.8.8.8", "10.0.0.1, 8.8.8.8"])("does not replace invalid first hop %s", value => {
    expect(getClientIp(new Headers({ "x-forwarded-for": value, "x-real-ip": "1.1.1.1" }))).toBeNull();
  });
  it("uses real-ip only when forwarded-for is absent", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "::ffff:1.1.1.1" }))).toBe("1.1.1.1");
    expect(getClientIp(new Headers({ "cf-connecting-ip": "8.8.8.8" }))).toBeNull();
  });
});

describe("hasValidGeo", () => {
  it.each([{ lat: 0, lng: 0 }, { lat: -90, lng: -180 }, { lat: 90, lng: 180 }])("accepts valid boundaries %j", value => {
    expect(hasValidGeo(value)).toBe(true);
  });
  it.each([
    { lat: null, lng: 0 }, { lat: 0, lng: null }, { lat: NaN, lng: 0 }, { lat: 0, lng: Infinity },
    { lat: 90.1, lng: 0 }, { lat: -90.1, lng: 0 }, { lat: 0, lng: 180.1 }, { lat: 0, lng: -180.1 }
  ])("rejects unusable coordinates %j", value => expect(hasValidGeo(value)).toBe(false));
});

function respond(body: unknown, status = 200, headers: HeadersInit = {}) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status, headers }));
}

describe("lookupGeoIp", () => {
  it("returns validated data with a bounded request and no persistence", async () => {
    respond({ country_code: "BR", region: "SP", city: "São Paulo", latitude: -23.5, longitude: -46.6 });
    const timeout = vi.spyOn(AbortSignal, "timeout");
    expect(await lookupGeoIp("::ffff:8.8.8.8")).toEqual({
      ok: true, data: { country: "BR", region: "SP", city: "São Paulo", lat: -23.5, lng: -46.6 }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://ipapi.co/8.8.8.8/json/", expect.objectContaining({
      signal: expect.any(AbortSignal), cache: "no-store", redirect: "error"
    }));
    expect(timeout).toHaveBeenCalledWith(5000);
  });
  it("handles missing optional labels without losing valid zero coordinates", async () => {
    respond({ latitude: 0, longitude: 0, country_code: 1, city: " " });
    expect(await lookupGeoIp("8.8.8.8")).toEqual({ ok: true, data: { country: null, region: null, city: null, lat: 0, lng: 0 } });
  });
  it("adds the optional key as an encoded query parameter", async () => {
    vi.stubEnv("GEOIP_API_KEY", "test&key=one");
    respond({ latitude: 0, longitude: 0 });
    await lookupGeoIp("8.8.8.8");
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("key")).toBe("test&key=one");
    expect([...url.searchParams.keys()]).toEqual(["key"]);
  });
  it.each(["unknown", "10.0.0.1", "2001:db8::1", "8.8.8.8/../../json"])("never requests invalid IP %s", async ip => {
    expect(await lookupGeoIp(ip)).toEqual({ ok: false, error: "invalid_ip", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([429, 200])("recognizes rate limits with HTTP %i and defaults to one hour", async status => {
    respond({ error: true, reason: "RateLimited" }, status);
    expect(await lookupGeoIp("8.8.8.8")).toEqual({ ok: false, error: "rate_limited", retryable: true, retryAfterMs: 3_600_000 });
  });
  it.each([["0", 1000], ["0.5", 1000], ["120", 120_000], ["172800", 172_800_000], ["invalid", 3_600_000]])(
    "honors Retry-After %s without shortening long cooldowns", async (value, expected) => {
      respond({}, 429, { "Retry-After": value as string });
      expect(await lookupGeoIp("8.8.8.8")).toMatchObject({ retryAfterMs: expected });
    }
  );
  it("honors Retry-After HTTP dates, with at least one second", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-04T12:00:00Z"));
    respond({ error: true, reason: "RateLimited" }, 200, { "Retry-After": "Fri, 06 Nov 2026 12:00:00 GMT" });
    expect(await lookupGeoIp("8.8.8.8")).toMatchObject({ retryAfterMs: 172_800_000 });
    respond({}, 429, { "Retry-After": "Wed, 04 Nov 2026 11:59:00 GMT" });
    expect(await lookupGeoIp("8.8.8.8")).toMatchObject({ retryAfterMs: 1000 });
  });
  it.each([400, 403, 404])("does not retry permanent HTTP %i", async status => {
    respond({}, status);
    expect(await lookupGeoIp("8.8.8.8")).toEqual({ ok: false, error: `http_${status}`, retryable: false });
  });
  it.each([408, 500, 502, 503])("retries transient HTTP %i", async status => {
    respond({}, status);
    expect(await lookupGeoIp("8.8.8.8")).toEqual({ ok: false, error: `http_${status}`, retryable: true });
  });
  it("preserves a transient server's requested recovery window", async () => {
    respond({}, 503, { "Retry-After": "600" });
    expect(await lookupGeoIp("8.8.8.8")).toEqual({ ok: false, error: "http_503", retryable: true, retryAfterMs: 600_000 });
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-04T12:00:00Z"));
    respond({}, 503, { "Retry-After": "Fri, 06 Nov 2026 12:00:00 GMT" });
    expect(await lookupGeoIp("8.8.8.8")).toMatchObject({ retryAfterMs: 172_800_000 });
  });
  it.each([["Invalid IP Address", "invalid_ip"], ["Reserved IP Address", "reserved_ip"]])(
    "does not retry provider rejection %s", async (reason, error) => {
      respond({ error: true, reason });
      expect(await lookupGeoIp("8.8.8.8")).toEqual({ ok: false, error, retryable: false });
    }
  );
  it("does not propagate raw provider errors or IPs", async () => {
    respond({ error: true, reason: "Account issue with 8.8.8.8 and secret-key" });
    expect(await lookupGeoIp("8.8.8.8")).toEqual({ ok: false, error: "provider_error", retryable: true });
  });
  it.each([
    {}, { latitude: null, longitude: 1 }, { latitude: "-23.5", longitude: -46.6 },
    { latitude: 91, longitude: 1 }, { latitude: 1, longitude: -181 }
  ])("retries unusable coordinates %j", async body => {
    respond(body);
    expect(await lookupGeoIp("8.8.8.8")).toEqual({ ok: false, error: "invalid_coordinates", retryable: true });
  });
  it.each([{ body: null }, { body: [] }, { body: "invalid" }])("retries malformed bodies %j", async ({ body }) => {
    respond(body);
    expect(await lookupGeoIp("8.8.8.8")).toEqual({ ok: false, error: "invalid_response", retryable: true });
  });
  it("retries invalid JSON", async () => {
    fetchMock.mockResolvedValue(new Response("not-json"));
    expect(await lookupGeoIp("8.8.8.8")).toEqual({ ok: false, error: "invalid_response", retryable: true });
  });
  it("classifies network errors without leaking the exception", async () => {
    fetchMock.mockRejectedValue(new Error("failed request https://ipapi.co/8.8.8.8/json/?key=secret"));
    expect(await lookupGeoIp("8.8.8.8")).toEqual({ ok: false, error: "network_error", retryable: true });
  });
  it.each(["TimeoutError", "AbortError"])("retries %s", async name => {
    fetchMock.mockRejectedValue(new DOMException("timed out", name));
    expect(await lookupGeoIp("8.8.8.8")).toEqual({ ok: false, error: "timeout", retryable: true });
  });
});
