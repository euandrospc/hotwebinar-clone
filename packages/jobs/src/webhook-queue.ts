import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { JOB_DISPATCH_WEBHOOK, QUEUE_WEBHOOK, type DispatchWebhookPayload } from "./types";

export type WebhookQueue = Queue<DispatchWebhookPayload>;
export type WebhookQueueUnavailableReason = "not_configured" | "unavailable";

export class WebhookQueueUnavailableError extends Error {
  constructor(readonly reason: WebhookQueueUnavailableReason) {
    super(reason === "not_configured"
      ? "REDIS_URL is not configured; the webhook queue is disabled"
      : "Redis is unavailable; the webhook queue cannot be reached");
    this.name = "WebhookQueueUnavailableError";
  }
}

const READY_TIMEOUT_MS = 1_500;
const DEFAULT_CONCURRENCY = 20;
// Protects receivers from bursts: at most 50 deliveries per second.
const RATE_LIMIT = { max: 50, duration: 1_000 };

// Five tries with exponential backoff (2s, 4s, 8s, 16s). Finished jobs stay
// for a while so the admin queue screen can show recent activity;
// WebhookDelivery remains the history.
const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: { age: 24 * 3_600, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 3_600, count: 5_000 }
} as const;

// Same Redis as realtime. Tests must opt into their own store.
function queueRedisUrl(): string | undefined {
  return process.env.NODE_ENV === "test" ? process.env.REALTIME_REDIS_TEST_URL : process.env.REDIS_URL;
}

function queuePrefix(): string {
  return process.env.NODE_ENV === "test" ? "hotwebinar:queue:test:v1" : "hotwebinar:queue:v1";
}

export function isWebhookQueueConfigured(): boolean {
  return Boolean(queueRedisUrl());
}

// Next compiles each route into its own bundle; keep one producer per process.
type ProducerState = { url: string; redis: Redis; queue: WebhookQueue | null };
const globalState = globalThis as typeof globalThis & { __hotwebinarWebhookQueue?: ProducerState };

function waitUntilReady(redis: Redis, timeoutMs: number): Promise<boolean> {
  if (redis.status === "ready") return Promise.resolve(true);
  if (redis.status === "end") return Promise.resolve(false);
  return new Promise((resolve) => {
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      redis.off("ready", onReady);
      redis.off("end", onEnd);
      resolve(ready);
    };
    const onReady = () => finish(true);
    const onEnd = () => finish(false);
    const timer = setTimeout(() => finish(false), timeoutMs);
    redis.once("ready", onReady);
    redis.once("end", onEnd);
  });
}

/**
 * Producer/inspection handle. Fails fast instead of holding an HTTP request
 * when Redis is down: commands are never buffered while disconnected.
 */
export async function openWebhookQueue(): Promise<WebhookQueue> {
  const url = queueRedisUrl();
  if (!url) throw new WebhookQueueUnavailableError("not_configured");

  let state = globalState.__hotwebinarWebhookQueue;
  if (!state || state.url !== url) {
    const previous = state;
    const redis = new Redis(url, {
      connectTimeout: 2_000,
      commandTimeout: 5_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000)
    });
    // Callers get the failure from their own command. Never print connection URLs.
    redis.on("error", () => {});
    state = globalState.__hotwebinarWebhookQueue = { url, redis, queue: null };
    if (previous) void closeProducer(previous);
  }

  if (!(await waitUntilReady(state.redis, READY_TIMEOUT_MS))) {
    throw new WebhookQueueUnavailableError("unavailable");
  }
  if (!state.queue) {
    state.queue = new Queue<DispatchWebhookPayload>(QUEUE_WEBHOOK, {
      connection: state.redis,
      prefix: queuePrefix(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS
    });
    state.queue.on("error", () => {});
  }
  return state.queue;
}

async function closeProducer(state: ProducerState): Promise<void> {
  try { await state.queue?.close(); } catch { /* already closed */ }
  try { await state.redis.quit(); } catch { state.redis.disconnect(); }
}

export async function closeWebhookQueue(): Promise<void> {
  const state = globalState.__hotwebinarWebhookQueue;
  globalState.__hotwebinarWebhookQueue = undefined;
  if (state) await closeProducer(state);
}

/** The delivery id is the job id, so the same delivery is never queued twice at once. */
export async function enqueueDispatchWebhook(payload: DispatchWebhookPayload) {
  const queue = await openWebhookQueue();
  return queue.add(JOB_DISPATCH_WEBHOOK, payload, { jobId: payload.deliveryId });
}

function workerConcurrency(): number {
  const configured = Number(process.env.WEBHOOK_QUEUE_CONCURRENCY);
  return Number.isInteger(configured) && configured > 0 ? Math.min(configured, 50) : DEFAULT_CONCURRENCY;
}

/**
 * Starts the consumer. A throwing processor makes BullMQ retry the job with
 * the queue backoff. Returns a function that waits for in-flight jobs and stops.
 */
export function startWebhookWorker(
  processor: (payload: DispatchWebhookPayload) => Promise<unknown>
): () => Promise<void> {
  const url = queueRedisUrl();
  if (!url) {
    console.warn("[webhook] REDIS_URL is not configured; queued webhooks will not be delivered.");
    return async () => {};
  }

  // Blocking reads require unlimited per-request retries; the worker simply
  // resumes when Redis comes back.
  const connection = new Redis(url, {
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000)
  });
  let reported = false;
  const report = () => {
    if (reported) return;
    reported = true;
    console.error("[webhook] queue worker lost its Redis connection; retrying.");
  };
  connection.on("error", report);
  connection.on("ready", () => { reported = false; });

  const worker = new Worker<DispatchWebhookPayload>(
    QUEUE_WEBHOOK,
    (job) => processor(job.data),
    { connection, prefix: queuePrefix(), concurrency: workerConcurrency(), limiter: RATE_LIMIT }
  );
  worker.on("error", report);

  return async () => {
    try { await worker.close(); } catch { /* connection already gone */ }
    try { await connection.quit(); } catch { connection.disconnect(); }
  };
}
