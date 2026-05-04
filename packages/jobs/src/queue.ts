import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";
import { QUEUE_NAME } from "./types.js";

let cached: Queue | undefined;

export function getVideoQueue(): Queue {
  if (cached) return cached;
  cached = new Queue(QUEUE_NAME, { connection: getRedisConnection() });
  return cached;
}
