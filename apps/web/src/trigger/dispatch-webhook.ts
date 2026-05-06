import { logger, task } from "@trigger.dev/sdk/v3";
import { prisma } from "db";
import type { DispatchWebhookPayload } from "jobs";

export const dispatchWebhookTask = task({
  id: "dispatch-webhook",
  maxDuration: 60,
  run: async (payload: DispatchWebhookPayload) => {
    const { deliveryId } = payload;
    const d = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!d) {
      logger.warn(`webhookDelivery ${deliveryId} not found`);
      return { skipped: true };
    }

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
        return { status: "SUCCESS" as const, responseStatus: res.status };
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
});
