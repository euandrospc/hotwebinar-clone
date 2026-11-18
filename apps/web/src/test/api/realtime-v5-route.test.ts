import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), snapshot: vi.fn(),
  NotFoundError: class extends Error {}
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:3010" }) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/server/realtime-source-v5", () => ({ getRealtimeSourceSnapshot: mocks.snapshot, RealtimeSourceNotFoundError: mocks.NotFoundError }));

import { GET } from "@/app/api/webinars/[id]/realtime-v5/route";

const request = () => GET(new Request("http://localhost:3010/api/webinars/selected/realtime-v5"), { params: Promise.resolve({ id: "selected" }) });
beforeEach(() => {
  mocks.session.mockReset().mockResolvedValue({ user: { id: "admin", role: "admin" } });
  mocks.snapshot.mockReset().mockResolvedValue({ online: 7, updatedAt: "2026-11-17T23:00:00Z" });
});

describe("realtime source route", () => {
  it("requires local authentication before querying the selected data source", async () => {
    mocks.session.mockResolvedValue(null);
    const response = await request();
    expect(response.status).toBe(401);
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });

  it("passes the authenticated viewer and actual Host to the shared provider and disables caching", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.snapshot).toHaveBeenCalledWith({ webinarId: "selected", viewer: { id: "admin", role: "admin" }, host: "localhost:3010" });
    expect(await response.json()).toMatchObject({ online: 7 });
  });

  it("returns 404 when the source does not authorize the webinar", async () => {
    mocks.snapshot.mockRejectedValue(new mocks.NotFoundError());
    const response = await request();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("returns an unavailable status rather than zero data or provider credentials", async () => {
    mocks.snapshot.mockRejectedValue(new Error("Failed postgresql://private:secret@host"));
    const response = await request();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Realtime data unavailable" });
  });
});
