import { describe, it, expect } from "vitest";
import { selectLadder, LADDER, type Variant } from "@/lib/ladder.js";

describe("selectLadder", () => {
  it("returns all 4 variants when source is 1440p+", () => {
    const r = selectLadder(1440);
    expect(r.map((v) => v.height)).toEqual([360, 720, 1080, 1440]);
  });

  it("excludes 1440p when source is 1080p", () => {
    const r = selectLadder(1080);
    expect(r.map((v) => v.height)).toEqual([360, 720, 1080]);
  });

  it("returns only 360p when source is 480p", () => {
    const r = selectLadder(480);
    expect(r.map((v) => v.height)).toEqual([360]);
  });

  it("returns single matching variant for sub-360p source", () => {
    const r = selectLadder(240);
    expect(r).toHaveLength(1);
    expect(r[0].height).toBe(240);
  });

  it("LADDER preset has expected fields per variant", () => {
    for (const v of LADDER) {
      expect(typeof v.height).toBe("number");
      expect(typeof v.width).toBe("number");
      expect(typeof v.bitrate).toBe("string");
      expect(typeof v.audioBitrate).toBe("string");
    }
  });

  it("Variant type is exported", () => {
    const v: Variant = { height: 720, width: 1280, bitrate: "2500k", audioBitrate: "128k" };
    expect(v.height).toBe(720);
  });
});
