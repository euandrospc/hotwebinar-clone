import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "rw-user", email: "rw@example.com", name: "RW" };

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn() }),
  headers: async () => new Headers()
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: TEST_USER, session: { id: "s", userId: TEST_USER.id } }) } }
}));
const enqueueWebhookMock = vi.fn(async () => ({ id: "j2" }));
vi.mock("jobs", async () => ({
  enqueueDispatchWebhook: enqueueWebhookMock,
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook"
}));

beforeEach(async () => {
  await prisma.webhookDelivery.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  enqueueWebhookMock.mockClear();
});

afterAll(async () => prisma.$disconnect());

describe("retryWebhook", () => {
  it("creates a new delivery and enqueues", async () => {
    const w = await prisma.webinar.create({
      data: {
        ownerId: TEST_USER.id, name: "T", title: "T", slug: "rw-1",
        status: "ACTIVE", webhookUrl: "https://x", webhookOnOptin: true
      }
    });
    const orig = await prisma.webhookDelivery.create({
      data: { webinarId: w.id, event: "lead_novo", url: "https://x", payload: { foo: 1 }, status: "FAILED" }
    });
    const { retryWebhook } = await import("@/server/actions/public");

    const r = await retryWebhook(orig.id);
    expect(r).toEqual({ ok: true });

    const all = await prisma.webhookDelivery.findMany();
    expect(all).toHaveLength(2);
    const newOne = all.find((d) => d.id !== orig.id)!;
    expect(newOne.event).toBe("lead_novo");
    expect(newOne.status).toBe("PENDING");
    expect(newOne.attempt).toBe(0);
    expect(enqueueWebhookMock).toHaveBeenCalledWith({ deliveryId: newOne.id });
  });

  it("returns error when delivery is for a webinar not owned by session user", async () => {
    await prisma.user.create({ data: { id: "other", email: "o@e.com", name: "O" } });
    const w = await prisma.webinar.create({
      data: { ownerId: "other", name: "T", title: "T", slug: "rw-2", status: "ACTIVE" }
    });
    const orig = await prisma.webhookDelivery.create({
      data: { webinarId: w.id, event: "lead_novo", url: "https://x", payload: {}, status: "FAILED" }
    });
    const { retryWebhook } = await import("@/server/actions/public?" + Date.now());
    const r = await retryWebhook(orig.id);
    expect(r).toMatchObject({ error: { message: expect.any(String) } });
  });
});
