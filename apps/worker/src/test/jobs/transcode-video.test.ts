import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";
import os from "node:os";

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.S3_ENDPOINT = "http://localhost:9000";
  process.env.S3_ACCESS_KEY = "test";
  process.env.S3_SECRET_KEY = "test-min-12chars";
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
  process.env.S3_PUBLIC_BASE_URL = "http://localhost:9000";
  process.env.WORKER_TMP_ROOT = os.tmpdir();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const TEST_USER = { id: "trv-user", email: "trv@example.com", name: "TR Tester" };

async function setupOwnerAndVideo(originalKey: string) {
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.cta.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.video.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  const video = await prisma.video.create({
    data: {
      ownerId: TEST_USER.id,
      name: "test.mp4",
      source: "UPLOAD",
      originalUrl: originalKey,
      status: "QUEUED",
      progress: 0
    }
  });
  return video;
}

describe("transcodeVideo", () => {
  it("transitions QUEUED → READY on happy path", async () => {
    const video = await setupOwnerAndVideo(`${"x".repeat(0)}videos/raw.mp4`);

    vi.mock("@/lib/s3.js", () => ({
      getS3: vi.fn(),
      downloadObjectToFile: vi.fn(async () => undefined),
      uploadFileToObject: vi.fn(async () => undefined),
      deletePrefix: vi.fn(async () => 0)
    }));
    vi.mock("@/lib/ffmpeg.js", () => ({
      ffprobe: vi.fn(async () => ({ height: 720, durationSec: 60 })),
      runFfmpeg: vi.fn(async (opts: { onProgressLine?: (s: number) => void }) => {
        opts.onProgressLine?.(60);
        return { exitCode: 0, stderrTail: "" };
      })
    }));
    vi.mock("@/lib/temp.js", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const ostmp = await import("node:os");
      return {
        makeJobTempDir: vi.fn(async (id: string) => {
          const dir = path.join(ostmp.tmpdir(), `t-${id}`);
          await fs.mkdir(dir, { recursive: true });
          // pre-create files the upload step expects
          await fs.writeFile(path.join(dir, "master.m3u8"), "");
          await fs.writeFile(path.join(dir, "360p.m3u8"), "");
          await fs.writeFile(path.join(dir, "720p.m3u8"), "");
          await fs.writeFile(path.join(dir, "thumb.jpg"), "");
          return { path: dir, cleanup: async () => fs.rm(dir, { recursive: true, force: true }) };
        })
      };
    });

    const { transcodeVideo } = await import("@/jobs/transcode-video.js");
    const fakeJob = {
      id: "test-job",
      data: { videoId: video.id },
      updateProgress: vi.fn(async () => undefined)
    };
    await transcodeVideo(fakeJob as never);

    const after = await prisma.video.findUnique({ where: { id: video.id } });
    expect(after?.status).toBe("READY");
    expect(after?.progress).toBe(100);
    expect(after?.hlsUrl).toContain("/master.m3u8");
    expect(after?.thumbUrl).toContain("/thumb.jpg");
    expect(after?.durationSec).toBe(60);
  });

  it("skips when Video.status is already READY (idempotent)", async () => {
    const video = await setupOwnerAndVideo("videos/raw.mp4");
    await prisma.video.update({ where: { id: video.id }, data: { status: "READY" } });

    vi.resetModules();
    vi.doMock("@/lib/s3.js", () => ({
      downloadObjectToFile: vi.fn(async () => { throw new Error("should not download"); }),
      uploadFileToObject: vi.fn(),
      deletePrefix: vi.fn(),
      getS3: vi.fn()
    }));
    vi.doMock("@/lib/ffmpeg.js", () => ({
      ffprobe: vi.fn(async () => { throw new Error("should not probe"); }),
      runFfmpeg: vi.fn()
    }));
    vi.doMock("@/lib/temp.js", () => ({
      makeJobTempDir: vi.fn(async () => { throw new Error("should not make tmp"); })
    }));
    const { transcodeVideo } = await import("@/jobs/transcode-video.js?" + Date.now());

    const fakeJob = { id: "j2", data: { videoId: video.id }, updateProgress: vi.fn(async () => undefined) };
    await transcodeVideo(fakeJob as never);

    const after = await prisma.video.findUnique({ where: { id: video.id } });
    expect(after?.status).toBe("READY");
  });

  it("transitions to FAILED when ffmpeg returns non-zero exit", async () => {
    const video = await setupOwnerAndVideo("videos/raw.mp4");

    vi.resetModules();
    vi.doMock("@/lib/s3.js", () => ({
      downloadObjectToFile: vi.fn(async () => undefined),
      uploadFileToObject: vi.fn(async () => undefined),
      deletePrefix: vi.fn(async () => 0),
      getS3: vi.fn()
    }));
    vi.doMock("@/lib/ffmpeg.js", () => ({
      ffprobe: vi.fn(async () => ({ height: 720, durationSec: 60 })),
      runFfmpeg: vi.fn(async () => ({ exitCode: 1, stderrTail: "fatal: corrupt" }))
    }));
    vi.doMock("@/lib/temp.js", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const ostmp = await import("node:os");
      return {
        makeJobTempDir: vi.fn(async (id: string) => {
          const dir = path.join(ostmp.tmpdir(), `t-${id}-fail`);
          await fs.mkdir(dir, { recursive: true });
          return { path: dir, cleanup: async () => fs.rm(dir, { recursive: true, force: true }) };
        })
      };
    });

    const { transcodeVideo } = await import("@/jobs/transcode-video.js?" + Date.now() + 1);
    const fakeJob = { id: "j3", data: { videoId: video.id }, updateProgress: vi.fn(async () => undefined) };
    await expect(transcodeVideo(fakeJob as never)).rejects.toThrow();

    const after = await prisma.video.findUnique({ where: { id: video.id } });
    expect(after?.status).toBe("FAILED");
    expect(after?.errorMessage).toContain("fatal: corrupt");
  });
});
