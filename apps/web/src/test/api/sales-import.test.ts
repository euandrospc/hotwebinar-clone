import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { buildSalesXlsx } from "@/lib/sales-xlsx";

const TEST_USER = { id: "si-user", email: "si@example.com", name: "SI" };

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

async function makeWebinar(ownerId = TEST_USER.id) {
  return prisma.webinar.create({
    data: { ownerId, name: "T", title: "T", slug: "si-" + Math.random().toString(36).slice(2, 6) }
  });
}

describe("POST /api/webinars/[id]/sales/import", () => {
  it("parses xlsx and returns notifications", async () => {
    const w = await makeWebinar();
    const buf = await buildSalesXlsx([
      { showAtSec: 60, buyerName: "Ana", productName: "Curso A", price: "R$ 297" },
      { showAtSec: 120, buyerName: "Bob", productName: "Mentoria", price: null }
    ]);
    const fd = new FormData();
    fd.set("file", new File([buf], "vendas.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const { POST } = await import("@/app/api/webinars/[id]/sales/import/route");
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: fd }), { params: Promise.resolve({ id: w.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.notifications).toHaveLength(2);
    expect(json.notifications[0].buyerName).toBe("Ana");
  });
  it("rejects when webinar belongs to another user", async () => {
    await prisma.user.create({ data: { id: "other", email: "o@e.com", name: "O" } });
    const w = await makeWebinar("other");
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1])], "x.xlsx"));
    const { POST } = await import("@/app/api/webinars/[id]/sales/import/route?" + Date.now());
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: fd }), { params: Promise.resolve({ id: w.id }) });
    expect(res.status).toBe(404);
  });
  it("rejects missing file with 400", async () => {
    const w = await makeWebinar();
    const fd = new FormData();
    const { POST } = await import("@/app/api/webinars/[id]/sales/import/route?" + (Date.now() + 1));
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: fd }), { params: Promise.resolve({ id: w.id }) });
    expect(res.status).toBe(400);
  });
});
