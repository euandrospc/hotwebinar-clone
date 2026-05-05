import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "uo-user", email: "uo@example.com", name: "UO" };

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: TEST_USER.id } }) } }
}));
vi.mock("@/lib/storage/presign", () => ({
  presignPut: vi.fn(async () => "https://put.example/upload-url")
}));
vi.mock("@/lib/storage/buckets", () => ({ HLS_BUCKET: "hls-public" }));

beforeEach(async () => {
  process.env.S3_PUBLIC_BASE_URL = "http://localhost:9000";
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
});

afterAll(async () => prisma.$disconnect());

async function makeWebinar(ownerId = TEST_USER.id) {
  return prisma.webinar.create({
    data: { ownerId, name: "T", title: "T", slug: "uo-" + Math.random().toString(36).slice(2, 6) }
  });
}

describe("POST /api/upload/offer-image", () => {
  it("returns presigned URL + public URL with the expected key", async () => {
    const w = await makeWebinar();
    const { POST } = await import("@/app/api/upload/offer-image/route");
    const res = await POST(new Request("http://localhost/api/upload/offer-image", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ webinarId: w.id, kind: "desktop", mimeType: "image/png", sizeBytes: 1024 })
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.uploadUrl).toBe("https://put.example/upload-url");
    expect(json.key).toBe(`offer/${w.id}/desktop.png`);
    expect(json.publicUrl).toBe(`http://localhost:9000/hls-public/offer/${w.id}/desktop.png`);
  });
  it("rejects non-allowlisted MIME types", async () => {
    const w = await makeWebinar();
    const { POST } = await import("@/app/api/upload/offer-image/route?" + Date.now());
    const res = await POST(new Request("http://localhost/api/upload/offer-image", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ webinarId: w.id, kind: "desktop", mimeType: "image/svg+xml", sizeBytes: 1024 })
    }));
    expect(res.status).toBe(400);
  });
  it("rejects sizes above 2 MiB", async () => {
    const w = await makeWebinar();
    const { POST } = await import("@/app/api/upload/offer-image/route?" + (Date.now() + 1));
    const res = await POST(new Request("http://localhost/api/upload/offer-image", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ webinarId: w.id, kind: "mobile", mimeType: "image/jpeg", sizeBytes: 3 * 1024 * 1024 })
    }));
    expect(res.status).toBe(413);
  });
  it("rejects when webinar belongs to another user", async () => {
    await prisma.user.create({ data: { id: "other", email: "o@e.com", name: "O" } });
    const w = await makeWebinar("other");
    const { POST } = await import("@/app/api/upload/offer-image/route?" + (Date.now() + 2));
    const res = await POST(new Request("http://localhost/api/upload/offer-image", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ webinarId: w.id, kind: "desktop", mimeType: "image/png", sizeBytes: 1024 })
    }));
    expect(res.status).toBe(404);
  });
});
