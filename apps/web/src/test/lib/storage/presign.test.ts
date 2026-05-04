import { describe, it, expect, beforeEach } from "vitest";

beforeEach(() => {
  process.env.S3_ENDPOINT = "http://localhost:9000";
  process.env.S3_REGION = "us-east-1";
  process.env.S3_ACCESS_KEY = "test-access";
  process.env.S3_SECRET_KEY = "test-secret-at-least-12";
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
});

describe("presign", () => {
  it("presignPut returns a URL containing the bucket and key", async () => {
    const { presignPut } = await import("@/lib/storage/presign.js?" + Date.now());
    const url = await presignPut("originals-private", "abc/raw.mp4", "video/mp4", 60);
    expect(url).toContain("originals-private");
    expect(url).toContain("abc/raw.mp4");
  });

  it("presignGet returns a URL containing the bucket and key", async () => {
    const { presignGet } = await import("@/lib/storage/presign.js?" + Date.now() + 1);
    const url = await presignGet("originals-private", "abc/raw.mp4", 60);
    expect(url).toContain("originals-private");
    expect(url).toContain("abc/raw.mp4");
  });
});
