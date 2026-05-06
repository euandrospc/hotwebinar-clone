import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { enrichLeadGeo } from "@/lib/geoip";

const TEST_USER = { id: "geo-user", email: "geo@example.com", name: "Geo" };

beforeEach(async () => {
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  vi.unstubAllGlobals();
});

afterAll(async () => prisma.$disconnect());

async function makeLead() {
  const w = await prisma.webinar.create({
    data: { ownerId: TEST_USER.id, name: "T", title: "T", slug: "g-" + Math.random().toString(36).slice(2, 6) }
  });
  return prisma.lead.create({
    data: { webinarId: w.id, name: "L", email: `l${Date.now()}@e.com` }
  });
}

describe("enrichLeadGeo", () => {
  it("persists country/region/city/lat/lng on success", async () => {
    const lead = await makeLead();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ country_code: "BR", region: "SP", city: "São Paulo", latitude: -23.5, longitude: -46.6 })
    });
    vi.stubGlobal("fetch", fetchMock);
    await enrichLeadGeo(lead.id, "8.8.8.8");
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.country).toBe("BR");
    expect(after?.region).toBe("SP");
    expect(after?.city).toBe("São Paulo");
    expect(after?.lat).toBe(-23.5);
    expect(after?.lng).toBe(-46.6);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ipapi.co/8.8.8.8/json/",
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });
  it("skips silently for empty / unknown / private IPs", async () => {
    const lead = await makeLead();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await enrichLeadGeo(lead.id, "");
    await enrichLeadGeo(lead.id, "unknown");
    await enrichLeadGeo(lead.id, "127.0.0.1");
    await enrichLeadGeo(lead.id, "192.168.1.10");
    await enrichLeadGeo(lead.id, "10.0.0.5");
    expect(fetchMock).not.toHaveBeenCalled();
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.country).toBeNull();
    expect(after?.lat).toBeNull();
  });
  it("swallows HTTP errors", async () => {
    const lead = await makeLead();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(enrichLeadGeo(lead.id, "8.8.8.8")).resolves.toBeUndefined();
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.country).toBeNull();
  });
  it("swallows network errors", async () => {
    const lead = await makeLead();
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(enrichLeadGeo(lead.id, "8.8.8.8")).resolves.toBeUndefined();
  });
  it("skips when API returns error:true", async () => {
    const lead = await makeLead();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: true })
    });
    vi.stubGlobal("fetch", fetchMock);
    await enrichLeadGeo(lead.id, "8.8.8.8");
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.country).toBeNull();
  });
});
