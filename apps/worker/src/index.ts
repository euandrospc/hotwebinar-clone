import "./env.js";
import { Worker } from "bullmq";
import { getRedisConnection, QUEUE_NAME, JOB_TRANSCODE, JOB_DELETE_ASSETS } from "jobs";
import { transcodeVideo } from "./jobs/transcode-video.js";
import { deleteVideoAssets } from "./jobs/delete-video-assets.js";
import { ensureBuckets } from "./lib/ensure-buckets.js";
import { config } from "./env.js";

async function main() {
  await ensureBuckets();
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === JOB_TRANSCODE) return transcodeVideo(job);
      if (job.name === JOB_DELETE_ASSETS) return deleteVideoAssets(job);
      throw new Error(`Unknown job: ${job.name}`);
    },
    { connection: getRedisConnection(), concurrency: config.workerConcurrency }
  );

  worker.on("ready", () => console.log(`[worker] ready, concurrency ${config.workerConcurrency}`));
  worker.on("failed", (job, err) => console.error(`[worker] failed ${job?.id}: ${err.message}`));

  const shutdown = async () => {
    console.log("[worker] graceful shutdown");
    await worker.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
