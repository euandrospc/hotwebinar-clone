import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "uc-user", email: "uc@example.com", name: "UC" };

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: TEST_USER, session: { id: "s", userId: TEST_USER.id } }) } }
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const headObjectMock = vi.fn<() => Promise<{ exists: boolean; size?: number }>>(async () => ({ exists: true, size: 1000 }));
const queueAddMock = vi.fn(async () => ({ id: "j1" }));

vi.mock("@/lib/storage/presign.js", () => ({
  presignPut: vi.fn(),
  presignGet: vi.fn(),
  headObject: headObjectMock
}));
vi.mock("jobs", async () => ({
  enqueueTranscode: queueAddMock,
  enqueueDeleteAssets: vi.fn(async () => ({ id: "j" })),
  JOB_TRANSCODE: "transcode-video",
  JOB_DELETE_ASSETS: "delete-video-assets"
}));

beforeEach(async () => {
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
  await prisma.video.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  headObjectMock.mockClear();
  queueAddMock.mockClear();
});
afterAll(async () => prisma.$disconnect());

describe("POST /api/upload/complete", () => {
  it("enqueues job when raw exists in MinIO", async () => {
    const v = await prisma.video.create({
      data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", originalUrl: `${"a"}/raw.mp4`, status: "QUEUED" }
    });
    headObjectMock.mockResolvedValueOnce({ exists: true, size: 100 });
    const { POST } = await import("@/app/api/upload/complete/route");
    const req = new Request("http://localhost/api/upload/complete", {
      method: "POST",
      body: JSON.stringify({ videoId: v.id }),
      headers: { "content-type": "application/json" }
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(queueAddMock).toHaveBeenCalledWith({ videoId: v.id });
  });

  it("rejects when HEAD object missing", async () => {
    const v = await prisma.video.create({
      data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", originalUrl: "y/raw.mp4", status: "QUEUED" }
    });
    headObjectMock.mockResolvedValueOnce({ exists: false });
    const { POST } = await import("@/app/api/upload/complete/route?" + Date.now());
    const req = new Request("http://localhost/api/upload/complete", {
      method: "POST",
      body: JSON.stringify({ videoId: v.id }),
      headers: { "content-type": "application/json" }
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("rejects when video belongs to other user", async () => {
    await prisma.user.create({ data: { id: "other", email: "other@example.com", name: "Other" } });
    const v = await prisma.video.create({
      data: { ownerId: "other", name: "x", source: "UPLOAD", originalUrl: "z/raw.mp4", status: "QUEUED" }
    });
    const { POST } = await import("@/app/api/upload/complete/route?" + (Date.now() + 1));
    const req = new Request("http://localhost/api/upload/complete", {
      method: "POST",
      body: JSON.stringify({ videoId: v.id }),
      headers: { "content-type": "application/json" }
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(queueAddMock).not.toHaveBeenCalled();
  });
});
