import { describe, it, expect, beforeEach } from "vitest";

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public";
});

describe("/api/health", () => {
  it("returns ok when DB is reachable", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: "ok", db: "ok" });
  });
});
