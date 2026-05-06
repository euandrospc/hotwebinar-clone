import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";

const queueAddMock = vi.fn(async () => ({ id: "j1" }));
vi.mock("jobs", async () => ({
  enqueueDispatchWebhook: queueAddMock,
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook"
}));

const TEST_USER = { id: "wh-user", email: "wh@example.com", name: "WH" };

beforeEach(async () => {
  await prisma.webhookDelivery.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  queueAddMock.mockClear();
});

afterAll(async () => prisma.$disconnect());

async function makeWebinar(overrides: any = {}) {
  return prisma.webinar.create({
    data: {
      ownerId: TEST_USER.id,
      name: "T", title: "T", slug: "test-" + Math.random().toString(36).slice(2, 8),
      status: "ACTIVE",
      webhookUrl: "https://hooks.example/x",
      webhookOnOptin: true,
      ...overrides
    }
  });
}

describe("enqueueWebhook", () => {
  it("creates delivery row + enqueues job when flag enabled", async () => {
    const { enqueueWebhook } = await import("@/lib/webhook");
    const w = await makeWebinar();
    const lead = await prisma.lead.create({
      data: { webinarId: w.id, name: "Joe", email: "j@e.com" }
    });
    await enqueueWebhook(w, "lead_novo", lead);

    const deliveries = await prisma.webhookDelivery.findMany();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].event).toBe("lead_novo");
    expect(deliveries[0].url).toBe("https://hooks.example/x");
    expect(deliveries[0].status).toBe("PENDING");
    expect(queueAddMock).toHaveBeenCalledWith({ deliveryId: deliveries[0].id });
  });

  it("skips when webhook flag is off", async () => {
    const { enqueueWebhook } = await import("@/lib/webhook?" + Date.now());
    const w = await makeWebinar({ webhookOnOptin: false });
    await enqueueWebhook(w, "lead_novo", null);
    expect(await prisma.webhookDelivery.count()).toBe(0);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("skips when webhookUrl is null", async () => {
    const { enqueueWebhook } = await import("@/lib/webhook?" + (Date.now() + 1));
    const w = await makeWebinar({ webhookUrl: null });
    await enqueueWebhook(w, "lead_novo", null);
    expect(await prisma.webhookDelivery.count()).toBe(0);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("payload includes webinarSlug + lead public dto", async () => {
    const { enqueueWebhook } = await import("@/lib/webhook?" + (Date.now() + 2));
    const w = await makeWebinar({ slug: "myhook" });
    const lead = await prisma.lead.create({
      data: { webinarId: w.id, name: "Joe", email: "j@e.com", phone: "+5511" }
    });
    await enqueueWebhook(w, "lead_novo", lead);
    const d = await prisma.webhookDelivery.findFirst();
    const payload = d!.payload as any;
    expect(payload.event).toBe("lead_novo");
    expect(payload.webinarSlug).toBe("myhook");
    expect(payload.lead.id).toBe(lead.id);
    expect(payload.lead.name).toBe("Joe");
    expect(payload.lead.email).toBeUndefined();
  });
});
