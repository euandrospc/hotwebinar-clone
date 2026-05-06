import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "vid-actions-user", email: "va@example.com", name: "VA" };

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: TEST_USER, session: { id: "s", userId: TEST_USER.id } }) } }
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const enqueueTranscodeMock = vi.fn(async () => ({ id: "j1" }));
const enqueueDeleteAssetsMock = vi.fn(async () => ({ id: "j1" }));
vi.mock("jobs", async () => ({
  enqueueTranscode: enqueueTranscodeMock,
  enqueueDeleteAssets: enqueueDeleteAssetsMock,
  JOB_TRANSCODE: "transcode-video",
  JOB_DELETE_ASSETS: "delete-video-assets"
}));

beforeEach(async () => {
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.video.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  enqueueTranscodeMock.mockClear();
  enqueueDeleteAssetsMock.mockClear();
});
afterAll(async () => prisma.$disconnect());

describe("listVideos", () => {
  it("scopes to owner", async () => {
    await prisma.user.create({ data: { id: "other", email: "o@e.com", name: "O" } });
    await prisma.video.create({ data: { ownerId: "other", name: "stranger", source: "UPLOAD", status: "READY" } });
    await prisma.video.create({ data: { ownerId: TEST_USER.id, name: "mine", source: "UPLOAD", status: "READY" } });
    const { listVideos } = await import("@/server/actions/video");
    const out = await listVideos();
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("mine");
  });
});

describe("deleteVideo", () => {
  it("blocks delete when video is in use without force", async () => {
    const v = await prisma.video.create({ data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", status: "READY" } });
    await prisma.webinar.create({ data: { ownerId: TEST_USER.id, videoId: v.id, name: "w", title: "w" } });
    const { deleteVideo } = await import("@/server/actions/video?" + Date.now());
    const r = await deleteVideo(v.id, false);
    expect(r).toMatchObject({ error: "in_use" });
    expect(await prisma.video.findUnique({ where: { id: v.id } })).not.toBeNull();
  });

  it("force-deletes and cascades videoId to null", async () => {
    const v = await prisma.video.create({ data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", status: "READY" } });
    const w = await prisma.webinar.create({ data: { ownerId: TEST_USER.id, videoId: v.id, name: "w", title: "w" } });
    const { deleteVideo } = await import("@/server/actions/video?" + (Date.now() + 1));
    const r = await deleteVideo(v.id, true);
    expect(r).toEqual({ ok: true });
    expect(await prisma.video.findUnique({ where: { id: v.id } })).toBeNull();
    const updatedWebinar = await prisma.webinar.findUnique({ where: { id: w.id } });
    expect(updatedWebinar?.videoId).toBeNull();
    expect(enqueueDeleteAssetsMock).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: v.id })
    );
  });

  it("deletes immediately when no webinars use it", async () => {
    const v = await prisma.video.create({ data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", status: "READY" } });
    const { deleteVideo } = await import("@/server/actions/video?" + (Date.now() + 2));
    const r = await deleteVideo(v.id, false);
    expect(r).toEqual({ ok: true });
    expect(await prisma.video.findUnique({ where: { id: v.id } })).toBeNull();
  });
});

describe("setCustomThumb", () => {
  it("updates the customThumbUrl when value provided", async () => {
    const v = await prisma.video.create({ data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", status: "READY" } });
    const { setCustomThumb } = await import("@/server/actions/video?" + (Date.now() + 3));
    await setCustomThumb(v.id, "http://x/thumb-custom.jpg");
    const after = await prisma.video.findUnique({ where: { id: v.id } });
    expect(after?.customThumbUrl).toBe("http://x/thumb-custom.jpg");
  });
});

describe("retryTranscode", () => {
  it("only retries when status is FAILED", async () => {
    const v = await prisma.video.create({ data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", status: "READY" } });
    const { retryTranscode } = await import("@/server/actions/video?" + (Date.now() + 4));
    const r = await retryTranscode(v.id);
    expect(r).toMatchObject({ error: expect.any(String) });
  });

  it("re-enqueues a FAILED video", async () => {
    const v = await prisma.video.create({
      data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", status: "FAILED", errorMessage: "boom" }
    });
    const { retryTranscode } = await import("@/server/actions/video?" + (Date.now() + 5));
    const r = await retryTranscode(v.id);
    expect(r).toEqual({ ok: true });
    const after = await prisma.video.findUnique({ where: { id: v.id } });
    expect(after?.status).toBe("QUEUED");
    expect(after?.errorMessage).toBeNull();
    expect(enqueueTranscodeMock).toHaveBeenCalledWith({ videoId: v.id });
  });
});
