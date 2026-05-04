import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";

const TIME_RE = /\btime=(\d+):(\d+):(\d+(?:\.\d+)?)/;

/**
 * Returns elapsed seconds parsed from a single ffmpeg stderr line, or null.
 */
export function parseFfmpegProgressLine(line: string): number | null {
  const m = line.match(TIME_RE);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const s = parseFloat(m[3]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || !Number.isFinite(s)) return null;
  return h * 3600 + min * 60 + s;
}

/**
 * Maps elapsed/total seconds onto [start, end] percentage range, clamped to end.
 */
export function ffmpegPctFromTime(
  elapsedSec: number,
  totalSec: number,
  start: number,
  end: number
): number {
  if (totalSec <= 0) return start;
  const ratio = Math.min(1, elapsedSec / totalSec);
  return Math.round(start + ratio * (end - start));
}

export interface FfmpegOptions {
  args: string[];
  onProgressLine?: (elapsedSec: number) => void;
}

export interface FfmpegResult {
  exitCode: number;
  stderrTail: string;
}

/**
 * Runs `ffmpeg` with the supplied args and resolves with exit code + stderr tail.
 * Streams stderr lines through `onProgressLine` for time-based progress reporting.
 */
export function runFfmpeg(opts: FfmpegOptions): Promise<FfmpegResult> {
  return new Promise((resolve) => {
    const proc: ChildProcessByStdio<null, Readable, Readable> = spawn("ffmpeg", opts.args, { stdio: ["ignore", "pipe", "pipe"] });
    let buffer = "";
    const stderrLines: string[] = [];
    const MAX_TAIL_LINES = 50;

    proc.stderr.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r\n|\r|\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        stderrLines.push(line);
        if (stderrLines.length > MAX_TAIL_LINES) stderrLines.shift();
        if (opts.onProgressLine) {
          const elapsed = parseFfmpegProgressLine(line);
          if (elapsed !== null) opts.onProgressLine(elapsed);
        }
      }
    });

    proc.on("close", (exitCode) => {
      if (buffer.length > 0) stderrLines.push(buffer);
      resolve({
        exitCode: exitCode ?? -1,
        stderrTail: stderrLines.join("\n").slice(-1024)
      });
    });
  });
}

/**
 * Returns the source video's height (px) and duration (sec) via ffprobe.
 */
export function ffprobe(inputPath: string): Promise<{ height: number; durationSec: number }> {
  return new Promise((resolve, reject) => {
    const args = [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=height:format=duration",
      "-of", "json",
      inputPath
    ];
    const proc = spawn("ffprobe", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
    proc.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed (${code}): ${stderr.slice(-512)}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as { streams?: Array<{ height?: number }>; format?: { duration?: string } };
        const height = parsed.streams?.[0]?.height ?? 0;
        const durationSec = parseFloat(parsed.format?.duration ?? "0");
        if (height <= 0 || !Number.isFinite(durationSec) || durationSec <= 0) {
          reject(new Error("ffprobe: invalid stream metadata"));
          return;
        }
        resolve({ height, durationSec });
      } catch (err) {
        reject(err);
      }
    });
  });
}
