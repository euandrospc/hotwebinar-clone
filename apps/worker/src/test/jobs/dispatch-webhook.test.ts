import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "dw-user", email: "dw@example.com", name: "DW" };

beforeEach(async () => {
  process.env.DATABASE_URL = "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.S3_ENDPOINT = "http://localhost:9000";
  process.env.S3_ACCESS_KEY = "test";
  process.env.S3_SECRET_KEY = "test-min-12chars";
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
  process.env.S3_PUBLIC_BASE_URL = "http://localhost:9000";
  await prisma.webhookDelivery.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  vi.restoreAllMocks();
});

afterAll(async () => prisma.$disconnect());

async function makeDelivery() {
  const w = await prisma.webinar.create({
    data: { ownerId: TEST_USER.id, name: "T", title: "T", slug: "dw-1", status: "ACTIVE" }
  });
  return prisma.webhookDelivery.create({
    data: { webinarId: w.id, event: "lead_novo", url: "https://hooks.example/x", payload: { foo: 1 }, status: "PENDING" }
  });
}

describe("dispatchWebhook", () => {
  it("marks SUCCESS on 2xx response and stores response body", async () => {
    const d = await makeDelivery();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("OK", { status: 200 })));
    const { dispatchWebhook } = await import("@/jobs/dispatch-webhook.js");
    const job: any = { data: { deliveryId: d.id } };
    await dispatchWebhook(job);
    const after = await prisma.webhookDelivery.findUnique({ where: { id: d.id } });
    expect(after?.status).toBe("SUCCESS");
    expect(after?.responseStatus).toBe(200);
    expect(after?.responseBody).toBe("OK");
    expect(after?.attempt).toBe(1);
  });

  it("marks FAILED + throws on 5xx (BullMQ retry)", async () => {
    const d = await makeDelivery();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("server error", { status: 500 })));
    const { dispatchWebhook } = await import("@/jobs/dispatch-webhook.js?" + Date.now());
    const job: any = { data: { deliveryId: d.id } };
    await expect(dispatchWebhook(job)).rejects.toThrow();
    const after = await prisma.webhookDelivery.findUnique({ where: { id: d.id } });
    expect(after?.status).toBe("FAILED");
    expect(after?.errorMessage).toContain("HTTP 500");
  });

  it("truncates response body to 1024 chars", async () => {
    const d = await makeDelivery();
    const huge = "a".repeat(5000);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(huge, { status: 200 })));
    const { dispatchWebhook } = await import("@/jobs/dispatch-webhook.js?" + (Date.now() + 1));
    const job: any = { data: { deliveryId: d.id } };
    await dispatchWebhook(job);
    const after = await prisma.webhookDelivery.findUnique({ where: { id: d.id } });
    expect(after?.responseBody?.length).toBe(1024);
  });

  it("returns silently when delivery not found", async () => {
    const { dispatchWebhook } = await import("@/jobs/dispatch-webhook.js?" + (Date.now() + 2));
    const job: any = { data: { deliveryId: "nonexistent" } };
    await expect(dispatchWebhook(job)).resolves.toBeUndefined();
  });
});
