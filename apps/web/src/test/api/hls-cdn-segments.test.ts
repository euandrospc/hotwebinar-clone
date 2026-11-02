import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/storage/buckets", () => ({ HLS_BUCKET: "b" }));

const PLAYLIST = [
  "#EXTM3U",
  '#EXT-X-KEY:METHOD=AES-128,URI="/api/hls/key/vid1",IV=0x0',
  "#EXTINF:6.000000,",
  "720p_000.ts",
  "#EXTINF:6.000000,",
  "720p_001.ts",
  "#EXT-X-ENDLIST"
].join("\n");

afterEach(() => { delete process.env.HLS_SEGMENT_BASE_URL; });

describe("withCdnSegments", () => {
  it("rewrites only segment lines to the CDN, keeping the key URI", async () => {
    process.env.HLS_SEGMENT_BASE_URL = "https://hls.example.com/";
    const { withCdnSegments } = await import("@/lib/hls-playlist");
    const out = withCdnSegments(PLAYLIST, "vid1/720p.m3u8").split("\n");
    expect(out[1]).toContain('URI="/api/hls/key/vid1"');
    expect(out[3]).toBe("https://hls.example.com/vid1/720p_000.ts");
    expect(out[5]).toBe("https://hls.example.com/vid1/720p_001.ts");
  });

  it("leaves the playlist alone without a CDN base", async () => {
    const { withCdnSegments } = await import("@/lib/hls-playlist");
    expect(withCdnSegments(PLAYLIST, "vid1/720p.m3u8")).toBe(PLAYLIST);
  });
});
