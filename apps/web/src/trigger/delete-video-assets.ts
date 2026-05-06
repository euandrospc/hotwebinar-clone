import { logger, task } from "@trigger.dev/sdk/v3";
import type { DeleteAssetsPayload } from "jobs";
import { getTriggerConfig } from "./_lib/env";
import { deletePrefix } from "./_lib/s3";

export const deleteVideoAssetsTask = task({
  id: "delete-video-assets",
  maxDuration: 300,
  run: async (payload: DeleteAssetsPayload) => {
    const { videoId } = payload;
    const cfg = getTriggerConfig();
    const originalsDeleted = await deletePrefix(cfg.s3BucketOriginals, `${videoId}/`).catch((err) => {
      logger.error(`failed to clean originals for ${videoId}`, { err: String(err) });
      return 0;
    });
    const hlsDeleted = await deletePrefix(cfg.s3BucketHls, `${videoId}/`).catch((err) => {
      logger.error(`failed to clean hls for ${videoId}`, { err: String(err) });
      return 0;
    });
    logger.log(`video ${videoId} cleaned: ${originalsDeleted} originals, ${hlsDeleted} hls files`);
    return { originalsDeleted, hlsDeleted };
  }
});
