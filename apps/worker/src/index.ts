import "./env.js";
import { Worker } from "bullmq";
import {
  getRedisConnection,
  QUEUE_NAME,
  QUEUE_WEBHOOK,
  JOB_TRANSCODE,
  JOB_DELETE_ASSETS,
  JOB_DISPATCH_WEBHOOK
} from "jobs";
import { transcodeVideo } from "./jobs/transcode-video.js";
import { deleteVideoAssets } from "./jobs/delete-video-assets.js";
import { dispatchWebhook } from "./jobs/dispatch-webhook.js";
import { ensureBuckets } from "./lib/ensure-buckets.js";
import { config } from "./env.js";

async function main() {
  await ensureBuckets();

  const videoWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === JOB_TRANSCODE) return transcodeVideo(job);
      if (job.name === JOB_DELETE_ASSETS) return deleteVideoAssets(job);
      throw new Error(`Unknown video job: ${job.name}`);
    },
    { connection: getRedisConnection(), concurrency: config.workerConcurrency }
  );

  const webhookWorker = new Worker(
    QUEUE_WEBHOOK,
    async (job) => {
      if (job.name === JOB_DISPATCH_WEBHOOK) return dispatchWebhook(job);
      throw new Error(`Unknown webhook job: ${job.name}`);
    },
    { connection: getRedisConnection(), concurrency: 2 }
  );

  videoWorker.on("ready", () => console.log(`[worker:video] ready, concurrency ${config.workerConcurrency}`));
  videoWorker.on("failed", (job, err) => console.error(`[worker:video] failed ${job?.id}: ${err.message}`));
  webhookWorker.on("ready", () => console.log("[worker:webhook] ready, concurrency 2"));
  webhookWorker.on("failed", (job, err) => console.error(`[worker:webhook] failed ${job?.id}: ${err.message}`));

  const shutdown = async () => {
    console.log("[worker] graceful shutdown");
    await Promise.all([videoWorker.close(), webhookWorker.close()]);
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
