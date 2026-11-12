import { describe, it, expect, vi } from "vitest";

vi.mock("hls.js", () => ({ default: class {} }));

describe("aheadOfLiveCorrection", () => {
  it("pulls a viewer who ran ahead back to the live position", async () => {
    const { aheadOfLiveCorrection } = await import("@/app/[slug]/_components/hls-player");
    expect(aheadOfLiveCorrection(7195, 3121, 7802)).toBe(3121); // skipped ahead
    expect(aheadOfLiveCorrection(4129, 3061, 7802)).toBe(3061); // 2x playback
  });

  it("leaves on-time and behind viewers alone", async () => {
    const { aheadOfLiveCorrection } = await import("@/app/[slug]/_components/hls-player");
    expect(aheadOfLiveCorrection(3090, 3093, 7802)).toBeNull(); // slightly behind
    expect(aheadOfLiveCorrection(3095, 3093, 7802)).toBeNull(); // within tolerance
    expect(aheadOfLiveCorrection(1200, 3093, 7802)).toBeNull(); // buffering behind
  });

  it("never targets past the end of the video", async () => {
    const { aheadOfLiveCorrection } = await import("@/app/[slug]/_components/hls-player");
    expect(aheadOfLiveCorrection(7900, 9000, 7802)).toBe(7802);
  });
});
