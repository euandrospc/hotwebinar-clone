"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { openWebhookQueue, type WebhookQueue } from "jobs";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES, hasRole } from "@/lib/roles";

type Result = { ok: true } | { error: { message: string } };

const QUEUES_PATH = "/dashboard/filas";
const BULK_LIMIT = 1_000;

/** Admin-only wrapper: queue jobs span every account's webinars. */
async function withQueue(run: (queue: WebhookQueue) => Promise<string | void>): Promise<Result> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !hasRole((session.user as { role?: string | null }).role, ADMIN_ROLES)) {
    return { error: { message: "Não autorizado" } };
  }
  try {
    const problem = await run(await openWebhookQueue());
    if (problem) return { error: { message: problem } };
  } catch {
    return { error: { message: "Não foi possível acessar a fila. Verifique a conexão com o Redis." } };
  }
  revalidatePath(QUEUES_PATH);
  return { ok: true };
}

export async function retryQueueJob(jobId: string): Promise<Result> {
  return withQueue(async (queue) => {
    const job = await queue.getJob(jobId);
    if (!job) return "Este job não está mais na fila.";
    if (!(await job.isFailed())) return "Somente jobs com falha podem ser reprocessados.";
    await job.retry("failed");
  });
}

export async function removeQueueJob(jobId: string): Promise<Result> {
  return withQueue(async (queue) => {
    const job = await queue.getJob(jobId);
    if (!job) return;
    if (await job.isActive()) return "O job está em processamento e não pode ser removido agora.";
    await job.remove();
  });
}

export async function retryFailedQueueJobs(): Promise<Result> {
  return withQueue(async (queue) => { await queue.retryJobs({ state: "failed", count: BULK_LIMIT }); });
}

export async function clearFailedQueueJobs(): Promise<Result> {
  return withQueue(async (queue) => { await queue.clean(0, BULK_LIMIT, "failed"); });
}

export async function setQueuePaused(paused: boolean): Promise<Result> {
  return withQueue(async (queue) => { await (paused ? queue.pause() : queue.resume()); });
}
