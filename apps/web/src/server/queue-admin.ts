import { prisma } from "db";
import { openWebhookQueue, WebhookQueueUnavailableError, type WebhookQueueUnavailableReason } from "jobs";

export const QUEUE_STATES = ["failed", "waiting", "active", "delayed", "completed"] as const;
export type QueueState = (typeof QUEUE_STATES)[number];
export const QUEUE_PAGE_SIZE = 25;

export interface QueueJobRow {
  id: string;
  state: QueueState;
  attemptsMade: number;
  maxAttempts: number;
  failedReason: string | null;
  createdAt: string;
  processedAt: string | null;
  finishedAt: string | null;
  /** Next automatic retry, for jobs waiting on backoff. */
  nextAttemptAt: string | null;
  delivery: {
    event: string;
    url: string;
    status: "PENDING" | "SUCCESS" | "FAILED";
    responseStatus: number | null;
    webinarId: string;
    webinarName: string;
    leadName: string | null;
  } | null;
}

export type QueueOverview =
  | { available: false; reason: WebhookQueueUnavailableReason }
  | {
      available: true;
      paused: boolean;
      workers: number;
      counts: Record<QueueState, number>;
      state: QueueState;
      page: number;
      totalPages: number;
      total: number;
      jobs: QueueJobRow[];
    };

const iso = (ms?: number | null) => (typeof ms === "number" && ms > 0 ? new Date(ms).toISOString() : null);

/** Snapshot of the webhook queue for the admin screen. Never throws on a Redis outage. */
export async function getWebhookQueueOverview(state: QueueState, requestedPage: number): Promise<QueueOverview> {
  try {
    const queue = await openWebhookQueue();
    const [raw, paused, workers] = await Promise.all([
      queue.getJobCounts("failed", "waiting", "active", "delayed", "completed"),
      queue.isPaused(),
      // Some managed Redis providers block CLIENT LIST; the count is informative only.
      queue.getWorkersCount().catch(() => 0)
    ]);
    const counts: Record<QueueState, number> = {
      failed: raw.failed ?? 0,
      waiting: raw.waiting ?? 0,
      active: raw.active ?? 0,
      delayed: raw.delayed ?? 0,
      completed: raw.completed ?? 0
    };

    const total = counts[state];
    const totalPages = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const start = (page - 1) * QUEUE_PAGE_SIZE;
    const fetched = await queue.getJobs(
      state,
      start,
      start + QUEUE_PAGE_SIZE - 1,
      // Oldest first for what is still queued; newest first for what already ran.
      state === "waiting" || state === "delayed"
    );
    const jobs = fetched.filter((job) => job && job.id);

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { id: { in: jobs.map((job) => job.data?.deliveryId).filter(Boolean) } },
      select: {
        id: true, event: true, url: true, status: true, responseStatus: true, webinarId: true,
        webinar: { select: { name: true, title: true } },
        lead: { select: { name: true } }
      }
    });
    const byId = new Map(deliveries.map((d) => [d.id, d]));

    return {
      available: true, paused, workers, counts, state, page, totalPages, total,
      jobs: jobs.map((job) => {
        const d = byId.get(job.data?.deliveryId);
        return {
          id: job.id as string,
          state,
          attemptsMade: job.attemptsMade,
          maxAttempts: job.opts.attempts ?? 1,
          failedReason: job.failedReason || null,
          createdAt: new Date(job.timestamp).toISOString(),
          processedAt: iso(job.processedOn),
          finishedAt: iso(job.finishedOn),
          nextAttemptAt: state === "delayed" ? iso((job.processedOn ?? job.timestamp) + (job.delay ?? 0)) : null,
          delivery: d ? {
            event: d.event,
            url: d.url,
            status: d.status,
            responseStatus: d.responseStatus,
            webinarId: d.webinarId,
            webinarName: d.webinar.name || d.webinar.title,
            leadName: d.lead?.name ?? null
          } : null
        };
      })
    };
  } catch (error) {
    if (error instanceof WebhookQueueUnavailableError) return { available: false, reason: error.reason };
    console.error("[webhook] queue inspection failed");
    return { available: false, reason: "unavailable" };
  }
}

export interface WebhookWebinarTotals {
  webinarId: string;
  webinarName: string;
  sent: number;
  failed: number;
  pending: number;
  total: number;
}

export interface WebhookDeliveryTotals {
  sent: number;
  failed: number;
  pending: number;
  total: number;
  webinars: WebhookWebinarTotals[];
}

/**
 * All-time delivery totals from PostgreSQL. The queue only retains its latest
 * finished jobs, so sent counts must come from the delivery history.
 */
export async function getWebhookDeliveryTotals(): Promise<WebhookDeliveryTotals> {
  const groups = await prisma.webhookDelivery.groupBy({ by: ["webinarId", "status"], _count: { _all: true } });
  const names = await prisma.webinar.findMany({
    where: { id: { in: [...new Set(groups.map((g) => g.webinarId))] } },
    select: { id: true, name: true, title: true }
  });
  const nameById = new Map(names.map((w) => [w.id, w.name || w.title]));

  const byWebinar = new Map<string, WebhookWebinarTotals>();
  for (const group of groups) {
    const row = byWebinar.get(group.webinarId) ?? {
      webinarId: group.webinarId,
      webinarName: nameById.get(group.webinarId) ?? "Webinar removido",
      sent: 0, failed: 0, pending: 0, total: 0
    };
    const count = group._count._all;
    if (group.status === "SUCCESS") row.sent += count;
    else if (group.status === "FAILED") row.failed += count;
    else row.pending += count;
    row.total += count;
    byWebinar.set(group.webinarId, row);
  }

  const webinars = [...byWebinar.values()].sort((a, b) => b.total - a.total || a.webinarName.localeCompare(b.webinarName));
  const sum = (key: "sent" | "failed" | "pending" | "total") => webinars.reduce((acc, w) => acc + w[key], 0);
  return { sent: sum("sent"), failed: sum("failed"), pending: sum("pending"), total: sum("total"), webinars };
}
