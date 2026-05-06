import path from "node:path";
import crypto from "node:crypto";
import { logger, task } from "@trigger.dev/sdk/v3";
import { prisma } from "db";
import type { TranscodePayload } from "jobs";
import { getTriggerConfig } from "./_lib/env";
import { downloadObjectToFile, uploadFileToObject, deletePrefix } from "./_lib/s3";
import { ffprobe, runFfmpeg } from "./_lib/ffmpeg";
import { makeJobTempDir } from "./_lib/temp";
import { selectLadder } from "./_lib/ladder";

function publicUrl(key: string): string {
  const cfg = getTriggerConfig();
  return `${cfg.s3PublicBaseUrl}/${cfg.s3BucketHls}/${key}`;
}

async function setProgress(videoId: string, pct: number) {
  await prisma.video.updateMany({
    where: { id: videoId, status: "PROCESSING" },
    data: { progress: Math.min(100, Math.max(0, Math.round(pct))) }
  });
}

export const transcodeVideoTask = task({
  id: "transcode-video",
  maxDuration: 3600,
  machine: "large-1x",
  run: async (payload: TranscodePayload, { ctx }) => {
    const { videoId } = payload;
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      logger.warn(`video ${videoId} not found, skipping`);
      return { skipped: true };
    }
    if (video.status === "READY") {
      logger.log(`video ${videoId} already READY, skipping (idempotent)`);
      return { skipped: true };
    }
    if (!video.originalUrl) {
      throw new Error(`Video ${videoId} has no originalUrl`);
    }

    await prisma.video.update({ where: { id: videoId }, data: { status: "PROCESSING", progress: 0, errorMessage: null } });
    await setProgress(videoId, 0);

    const tmp = await makeJobTempDir(ctx.run.id ?? videoId);
    const rawPath = path.join(tmp.path, "raw");

    try {
      await downloadObjectToFile(getTriggerConfig().s3BucketOriginals, video.originalUrl, rawPath);
      await setProgress(videoId, 5);

      const probe = await ffprobe(rawPath);
      const ladder = selectLadder(probe.height);
      if (ladder.length === 0) throw new Error("Empty ladder for source height");

      await setProgress(videoId, 10);

      const encKey = crypto.randomBytes(16);
      const keyHex = encKey.toString("hex");
      const keyBinPath = path.join(tmp.path, "key.bin");
      const keyInfoPath = path.join(tmp.path, "key_info.txt");
      const keyUri = `/api/hls/key/${videoId}`;
      const fsMod = await import("node:fs/promises");
      await fsMod.writeFile(keyBinPath, encKey);
      await fsMod.writeFile(keyInfoPath, `${keyUri}\n${keyBinPath}\n`, "utf8");

      const args: string[] = ["-y", "-i", rawPath];
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
          "-hls_key_info_file", keyInfoPath,
          "-hls_segment_filename", path.join(tmp.path, `${variantName}_%03d.ts`),
          "-f", "hls",
          playlistFile
        );
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
          void setProgress(videoId, pct);
        }
      });
      if (result.exitCode !== 0) {
        throw new Error(`ffmpeg exit ${result.exitCode}: ${result.stderrTail}`);
      }

      const masterPath = path.join(tmp.path, "master.m3u8");
      const masterBody = ["#EXTM3U", "#EXT-X-VERSION:3", ...masterEntries].join("\n") + "\n";
      const fs = await import("node:fs/promises");
      await fs.writeFile(masterPath, masterBody, "utf8");

      await setProgress(videoId, 80);
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
        logger.warn(`thumb gen failed: ${thumbResult.stderrTail.slice(-200)}`);
      }

      await setProgress(videoId, 85);

      const entries = await fs.readdir(tmp.path);
      for (const entry of entries) {
        if (entry === "raw") continue;
        if (entry === "key.bin" || entry === "key_info.txt") continue;
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
        await uploadFileToObject(getTriggerConfig().s3BucketHls, `${videoId}/${entry}`, local, contentType);
      }

      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "READY",
          hlsUrl: publicUrl(`${videoId}/master.m3u8`),
          thumbUrl: publicUrl(`${videoId}/thumb.jpg`),
          encKey: keyHex,
          durationSec: Math.round(probe.durationSec),
          progress: 100,
          errorMessage: null
        }
      });
      return { videoId, status: "READY" as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.video.update({
        where: { id: videoId },
        data: { status: "FAILED", errorMessage: msg.slice(0, 1024) }
      });
      await deletePrefix(getTriggerConfig().s3BucketHls, `${videoId}/`).catch(() => undefined);
      throw err;
    } finally {
      await tmp.cleanup().catch(() => undefined);
    }
  }
});
