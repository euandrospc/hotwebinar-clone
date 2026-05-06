import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "se-user", email: "se@example.com", name: "SE" };

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: TEST_USER.id } }) } }
}));

beforeEach(async () => {
  await prisma.saleNotification.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
});

afterAll(async () => prisma.$disconnect());

describe("GET /api/webinars/[id]/sales/export", () => {
  it("returns xlsx with attachment disposition + at least 1 row", async () => {
    const w = await prisma.webinar.create({
      data: { ownerId: TEST_USER.id, name: "T", title: "T", slug: "se-1" }
    });
    await prisma.saleNotification.create({
      data: { webinarId: w.id, showAtSec: 60, buyerName: "Ana", productName: "Curso", price: "R$ 99" }
    });
    const { GET } = await import("@/app/api/webinars/[id]/sales/export/route");
    const res = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: w.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    expect(res.headers.get("content-disposition")).toContain(`vendas-${w.id}.xlsx`);
    const ab = await res.arrayBuffer();
    expect(ab.byteLength).toBeGreaterThan(0);
  });
});
