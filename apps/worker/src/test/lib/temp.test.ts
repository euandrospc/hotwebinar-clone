import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
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

describe("makeJobTempDir", () => {
  it("creates a writable directory and cleanup removes it", async () => {
    const { makeJobTempDir } = await import("@/lib/temp.js?" + Date.now());
    const tmp = await makeJobTempDir("job-1");
    await fs.writeFile(`${tmp.path}/touch.txt`, "ok");
    expect(await fs.readFile(`${tmp.path}/touch.txt`, "utf8")).toBe("ok");
    await tmp.cleanup();
    await expect(fs.access(tmp.path)).rejects.toThrow();
  });
});
