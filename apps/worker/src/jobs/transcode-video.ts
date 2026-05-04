import path from "node:path";
import { type Job } from "bullmq";
import { prisma } from "db";
import type { TranscodePayload, JobProgress } from "jobs";
import { config } from "../env.js";
import { downloadObjectToFile, uploadFileToObject, deletePrefix } from "../lib/s3.js";
import { ffprobe, runFfmpeg } from "../lib/ffmpeg.js";
import { makeJobTempDir } from "../lib/temp.js";
import { selectLadder } from "../lib/ladder.js";

function publicUrl(key: string): string {
  return `${config.s3PublicBaseUrl}/${config.s3BucketHls}/${key}`;
}

async function reportProgress(job: Job, p: JobProgress) {
  await job.updateProgress(p);
  await prisma.video.update({
    where: { id: (job.data as TranscodePayload).videoId },
    data: { progress: Math.min(100, Math.max(0, Math.round(p.pct))) }
  });
}

export async function transcodeVideo(job: Job<TranscodePayload>): Promise<void> {
  const { videoId } = job.data;
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) {
    console.warn(`[transcode] video ${videoId} not found, skipping`);
    return;
  }
  if (video.status === "READY") {
    console.log(`[transcode] video ${videoId} already READY, skipping (idempotent)`);
    return;
  }
  if (!video.originalUrl) {
    throw new Error(`Video ${videoId} has no originalUrl`);
  }

  await prisma.video.update({ where: { id: videoId }, data: { status: "PROCESSING", progress: 0, errorMessage: null } });
  await reportProgress(job, { pct: 0, stage: "downloading" });

  const tmp = await makeJobTempDir(job.id ?? videoId);
  const rawPath = path.join(tmp.path, "raw");

  try {
    await downloadObjectToFile(config.s3BucketOriginals, video.originalUrl, rawPath);
    await reportProgress(job, { pct: 5, stage: "probing" });

    const probe = await ffprobe(rawPath);
    const ladder = selectLadder(probe.height);
    if (ladder.length === 0) throw new Error("Empty ladder for source height");

    await reportProgress(job, { pct: 10, stage: "transcoding" });

    // Build ffmpeg args: 1 input, N variants, HLS muxer with master playlist.
    const args: string[] = ["-y", "-i", rawPath];
    const variantOutputs: string[] = [];
    const masterEntries: string[] = [];

    for (const v of ladder) {
      const variantName = `${v.height}p`;
      const playlistFile = path.join(tmp.path, `${variantName}.m3u8`);
      args.push(
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-vf", `scale=-2:${v.height}`,
        "-b:v", v.bitrate,
        "-c:a", "aac",
        "-b:a", v.audioBitrate,
        "-hls_time", "6",
        "-hls_playlist_type", "vod",
        "-hls_segment_filename", path.join(tmp.path, `${variantName}_%03d.ts`),
        "-f", "hls",
        playlistFile
      );
      variantOutputs.push(playlistFile);
      const widthHint = v.width;
      masterEntries.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(v.bitrate, 10) * 1000},RESOLUTION=${widthHint}x${v.height}\n${variantName}.m3u8`
      );
    }

    const result = await runFfmpeg({
      args,
      onProgressLine: (elapsed) => {
        const ratio = probe.durationSec > 0 ? Math.min(1, elapsed / probe.durationSec) : 0;
        const pct = Math.round(10 + ratio * (80 - 10));
        void reportProgress(job, { pct, stage: "transcoding" });
      }
    });
    if (result.exitCode !== 0) {
      throw new Error(`ffmpeg exit ${result.exitCode}: ${result.stderrTail}`);
    }

    // Write master playlist.
    const masterPath = path.join(tmp.path, "master.m3u8");
    const masterBody = ["#EXTM3U", "#EXT-X-VERSION:3", ...masterEntries].join("\n") + "\n";
    const fs = await import("node:fs/promises");
    await fs.writeFile(masterPath, masterBody, "utf8");

    // Generate thumbnail at duration/2.
    await reportProgress(job, { pct: 80, stage: "thumbnail" });
    const thumbPath = path.join(tmp.path, "thumb.jpg");
    const thumbResult = await runFfmpeg({
      args: [
        "-y",
        "-ss", String(Math.max(0, probe.durationSec / 2)),
        "-i", rawPath,
        "-frames:v", "1",
        "-q:v", "5",
        "-vf", "scale=320:-2",
        thumbPath
      ]
    });
    if (thumbResult.exitCode !== 0) {
      console.warn(`[transcode] thumb gen failed: ${thumbResult.stderrTail.slice(-200)}`);
    }

    await reportProgress(job, { pct: 85, stage: "uploading" });

    // Upload all variants + segments + master + thumb to hls-public/<videoId>/.
    const entries = await fs.readdir(tmp.path);
    for (const entry of entries) {
      if (entry === "raw") continue;
      const local = path.join(tmp.path, entry);
      const stat = await fs.stat(local);
      if (!stat.isFile()) continue;
      const contentType = entry.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : entry.endsWith(".ts")
          ? "video/mp2t"
          : entry.endsWith(".jpg")
            ? "image/jpeg"
            : "application/octet-stream";
      await uploadFileToObject(config.s3BucketHls, `${videoId}/${entry}`, local, contentType);
    }

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "READY",
        hlsUrl: publicUrl(`${videoId}/master.m3u8`),
        thumbUrl: publicUrl(`${videoId}/thumb.jpg`),
        durationSec: Math.round(probe.durationSec),
        progress: 100,
        errorMessage: null
      }
    });
    await job.updateProgress({ pct: 100, stage: "uploading" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", errorMessage: msg.slice(0, 1024) }
    });
    // Best-effort cleanup of partial uploads
    await deletePrefix(config.s3BucketHls, `${videoId}/`).catch(() => undefined);
    throw err;
  } finally {
    await tmp.cleanup().catch(() => undefined);
  }
}
