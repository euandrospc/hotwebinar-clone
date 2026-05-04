import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "ui-user", email: "ui@example.com", name: "UI" };

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: TEST_USER, session: { id: "s", userId: TEST_USER.id } }) } }
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/storage/presign.js", () => ({
  presignPut: vi.fn(async () => "http://signed.example/abc"),
  presignGet: vi.fn(),
  headObject: vi.fn(async () => ({ exists: true, size: 1234 }))
}));

beforeEach(async () => {
  process.env.MAX_UPLOAD_BYTES = String(10 * 1024 * 1024 * 1024);
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
  await prisma.video.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
});
afterAll(async () => prisma.$disconnect());

describe("POST /api/upload/init", () => {
  it("returns presigned URL + new Video QUEUED", async () => {
    const { POST } = await import("@/app/api/upload/init/route");
    const req = new Request("http://localhost/api/upload/init", {
      method: "POST",
      body: JSON.stringify({ name: "vid.mp4", sizeBytes: 1_000_000, mimeType: "video/mp4" }),
      headers: { "content-type": "application/json" }
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.uploadUrl).toBe("http://signed.example/abc");
    expect(body.videoId).toBeDefined();
    const video = await prisma.video.findUnique({ where: { id: body.videoId } });
    expect(video?.status).toBe("QUEUED");
    expect(video?.source).toBe("UPLOAD");
  });

  it("rejects non-video MIME", async () => {
    const { POST } = await import("@/app/api/upload/init/route");
    const req = new Request("http://localhost/api/upload/init", {
      method: "POST",
      body: JSON.stringify({ name: "doc.pdf", sizeBytes: 1000, mimeType: "application/pdf" }),
      headers: { "content-type": "application/json" }
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects size > MAX_UPLOAD_BYTES", async () => {
    process.env.MAX_UPLOAD_BYTES = "1000";
    const { POST } = await import("@/app/api/upload/init/route");
    const req = new Request("http://localhost/api/upload/init", {
      method: "POST",
      body: JSON.stringify({ name: "vid.mp4", sizeBytes: 2000, mimeType: "video/mp4" }),
      headers: { "content-type": "application/json" }
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });
});
