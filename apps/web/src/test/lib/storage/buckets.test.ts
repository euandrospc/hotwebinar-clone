import { describe, it, expect, beforeEach } from "vitest";

beforeEach(() => {
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
});

describe("buckets", () => {
  it("exposes originals + hls bucket names from env", async () => {
    const mod = await import("@/lib/storage/buckets.js?" + Date.now());
    expect(mod.ORIGINALS_BUCKET).toBe("originals-private");
    expect(mod.HLS_BUCKET).toBe("hls-public");
  });

  it("throws when S3_BUCKET_ORIGINALS is missing", async () => {
    delete process.env.S3_BUCKET_ORIGINALS;
    await expect(import("@/lib/storage/buckets.js?" + Date.now() + 1)).rejects.toThrow(/S3_BUCKET_ORIGINALS/);
  });
});
