import { beforeEach, describe, expect, it, vi } from "vitest";
import { signLeadCookie } from "@/lib/lead-session";
import { authenticateRealtime, isAllowedRealtimeOrigin } from "@/server/realtime/auth";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), lead: vi.fn(), session: vi.fn(), webinar: vi.fn()
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("db", () => ({ prisma: {
  lead: { findUnique: mocks.lead }, session: { findFirst: mocks.session }, webinar: { findFirst: mocks.webinar }
} }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LEAD_SESSION_SECRET = "realtime-auth-test-secret-more-than-32";
  mocks.getSession.mockResolvedValue({ session: { id: "session" }, user: { id: "owner" } });
  mocks.session.mockResolvedValue({ user: { id: "owner", role: "admin" } });
  mocks.webinar.mockResolvedValue({ id: "w1" });
  mocks.lead.mockResolvedValue({ id: "l1", webinarId: "w1" });
});

describe("realtime authentication", () => {
  it("rejects missing and cross-origin origins", () => {
    expect(isAllowedRealtimeOrigin(undefined, "localhost:3010")).toBe(false);
    expect(isAllowedRealtimeOrigin("https://evil.example", "lives.bravy.com.br")).toBe(false);
    expect(isAllowedRealtimeOrigin("http://localhost:3011", "localhost:3010")).toBe(false);
    expect(isAllowedRealtimeOrigin("http://localhost:3010", "localhost:3010")).toBe(true);
    expect(isAllowedRealtimeOrigin("https://lives.bravy.com.br", "lives.bravy.com.br")).toBe(true);
  });

  it("derives the private lead room only from the signed cookie", async () => {
    const identity = await authenticateRealtime({ cookie: `hw_lead=${signLeadCookie("l1")}` }, { kind: "lead" });
    expect(identity).toEqual({ kind: "lead", leadId: "l1", webinarId: "w1", rooms: ["lead:l1"] });
    expect(mocks.lead).toHaveBeenCalledWith({ where: { id: "l1" }, select: { id: true, webinarId: true } });
    expect(await authenticateRealtime({ cookie: "hw_lead=forged.l2" }, { kind: "lead" })).toBeNull();
    expect(await authenticateRealtime({}, { kind: "lead" })).toBeNull();
  });

  it("keeps global staff access restricted to current admin or attendant roles", async () => {
    mocks.session.mockResolvedValue({ user: { id: "staff", role: "attendant" } });
    expect(await authenticateRealtime({}, { kind: "staff" })).toMatchObject({ rooms: ["staff"] });
    mocks.session.mockResolvedValue({ user: { id: "staff", role: "disabled" } });
    expect(await authenticateRealtime({}, { kind: "staff" })).toBeNull();
    mocks.session.mockResolvedValue({ user: { id: "staff", role: "user" } });
    expect(await authenticateRealtime({}, { kind: "staff" })).toBeNull();
  });

  it("rechecks revoked sessions even when auth returned a cached user", async () => {
    expect(await authenticateRealtime({}, { kind: "dashboard" })).toMatchObject({ rooms: ["dashboard:owner"] });
    mocks.session.mockResolvedValue(null);
    expect(await authenticateRealtime({}, { kind: "dashboard" })).toBeNull();
  });

  it("requires owner access for a webinar and excludes attendants from metrics", async () => {
    expect(await authenticateRealtime({}, { kind: "webinar", webinarId: "w1" })).toMatchObject({ rooms: ["webinar:w1"] });
    expect(mocks.webinar).toHaveBeenCalledWith({ where: { id: "w1", ownerId: "owner" }, select: { id: true } });
    mocks.webinar.mockResolvedValue(null);
    expect(await authenticateRealtime({}, { kind: "webinar", webinarId: "foreign" })).toBeNull();
    mocks.session.mockResolvedValue({ user: { id: "staff", role: "attendant" } });
    expect(await authenticateRealtime({}, { kind: "dashboard" })).toBeNull();
  });
});
