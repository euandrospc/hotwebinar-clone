import { type Job } from "bullmq";
import type { DeleteAssetsPayload } from "jobs";
import { config } from "../env.js";
import { deletePrefix } from "../lib/s3.js";

export async function deleteVideoAssets(job: Job<DeleteAssetsPayload>): Promise<void> {
  const { videoId } = job.data;
  const originalsDeleted = await deletePrefix(config.s3BucketOriginals, `${videoId}/`).catch((err) => {
    console.error(`[delete-assets] failed to clean originals for ${videoId}:`, err);
    return 0;
  });
  const hlsDeleted = await deletePrefix(config.s3BucketHls, `${videoId}/`).catch((err) => {
    console.error(`[delete-assets] failed to clean hls for ${videoId}:`, err);
    return 0;
  });
  console.log(`[delete-assets] video ${videoId} cleaned: ${originalsDeleted} originals, ${hlsDeleted} hls files`);
}
