import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";
import { QUEUE_NAME, QUEUE_WEBHOOK } from "./types.js";

let cachedVideo: Queue | undefined;
let cachedWebhook: Queue | undefined;

export function getVideoQueue(): Queue {
  if (cachedVideo) return cachedVideo;
  cachedVideo = new Queue(QUEUE_NAME, { connection: getRedisConnection() });
  return cachedVideo;
}

export function getWebhookQueue(): Queue {
  if (cachedWebhook) return cachedWebhook;
  cachedWebhook = new Queue(QUEUE_WEBHOOK, { connection: getRedisConnection() });
  return cachedWebhook;
}
