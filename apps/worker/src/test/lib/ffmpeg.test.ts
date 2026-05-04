import { describe, it, expect } from "vitest";
import { parseFfmpegProgressLine, ffmpegPctFromTime } from "@/lib/ffmpeg.js";

describe("parseFfmpegProgressLine", () => {
  it("extracts elapsed seconds from 'time=' fragment", () => {
    const line = "frame= 1234 fps= 23 q=28.0 size=    2048kB time=00:00:42.50 bitrate= 394.6kbits/s";
    expect(parseFfmpegProgressLine(line)).toBeCloseTo(42.5, 1);
  });

  it("returns null for non-progress lines", () => {
    expect(parseFfmpegProgressLine("[hls @ 0x55] Opening segment for writing")).toBeNull();
  });

  it("handles minutes correctly", () => {
    const line = "frame=  100 fps= 23 q=28.0 size=    1024kB time=00:01:30.00 bitrate= 100.0kbits/s";
    expect(parseFfmpegProgressLine(line)).toBeCloseTo(90, 1);
  });

  it("handles hours correctly", () => {
    const line = "frame=  100 fps= 23 q=28.0 size=    1024kB time=01:00:00.00 bitrate= 100.0kbits/s";
    expect(parseFfmpegProgressLine(line)).toBeCloseTo(3600, 1);
  });
});

describe("ffmpegPctFromTime", () => {
  it("scales elapsed/total into [start, end]", () => {
    expect(ffmpegPctFromTime(0, 100, 10, 80)).toBe(10);
    expect(ffmpegPctFromTime(50, 100, 10, 80)).toBe(45);
    expect(ffmpegPctFromTime(100, 100, 10, 80)).toBe(80);
  });

  it("clamps over-shoot to upper bound", () => {
    expect(ffmpegPctFromTime(120, 100, 10, 80)).toBe(80);
  });

  it("returns lower bound when total is 0", () => {
    expect(ffmpegPctFromTime(50, 0, 10, 80)).toBe(10);
  });
});
