import { type Job } from "bullmq";
import { prisma } from "db";
import type { DispatchWebhookPayload } from "jobs";

export async function dispatchWebhook(job: Job<DispatchWebhookPayload>): Promise<void> {
  const { deliveryId } = job.data;
  const d = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
  if (!d) return;

  await prisma.webhookDelivery.update({
    where: { id: d.id },
    data: { attempt: { increment: 1 } }
  });

  try {
    const res = await fetch(d.url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "hotwebinar-clone/1.0" },
      body: JSON.stringify(d.payload),
      signal: AbortSignal.timeout(10_000)
    });
    const body = (await res.text()).slice(0, 1024);
    if (res.ok) {
      await prisma.webhookDelivery.update({
        where: { id: d.id },
        data: { status: "SUCCESS", responseStatus: res.status, responseBody: body, errorMessage: null }
      });
      return;
    }
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: { status: "FAILED", errorMessage: msg.slice(0, 1024) }
    });
    throw err;
  }
}
