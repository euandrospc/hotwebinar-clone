import type { Lead, Webinar } from "db";
import { prisma } from "db";
import { getWebhookQueue, JOB_DISPATCH_WEBHOOK, type WebhookEvent } from "jobs";
import { publicLeadDto } from "@/lib/public-dto";

const FLAG_BY_EVENT: Record<WebhookEvent, keyof Webinar> = {
  lead_novo: "webhookOnOptin",
  lead_acessou: "webhookOnEnter",
  lead_viu_oferta: "webhookOnOfferView",
  lead_clicou_oferta: "webhookOnOfferClick",
  lead_viu_pitch: "webhookOnPitchReached",
  lead_permaneceu: "webhookOnPermanence",
  lead_saiu: "webhookOnLeave",
  lead_entrou_sorteio: "webhookOnRaffleEntry"
};

export function isEventEnabled(w: Webinar, event: WebhookEvent): boolean {
  const flagKey = FLAG_BY_EVENT[event];
  return Boolean(w[flagKey]);
}

export async function enqueueWebhook(
  webinar: Webinar,
  event: WebhookEvent,
  lead: Lead | null,
  context: { videoSec?: number; ctaId?: string } = {}
): Promise<void> {
  if (!webinar.webhookUrl) return;
  if (!isEventEnabled(webinar, event)) return;

  const payload = {
    event,
    webinarId: webinar.id,
    webinarSlug: webinar.slug,
    leadId: lead?.id ?? null,
    lead: lead ? publicLeadDto(lead) : null,
    context,
    timestamp: new Date().toISOString()
  };

  const delivery = await prisma.webhookDelivery.create({
    data: {
      webinarId: webinar.id,
      leadId: lead?.id,
      event,
      url: webinar.webhookUrl,
      payload,
      status: "PENDING"
    }
  });

  await getWebhookQueue().add(
    JOB_DISPATCH_WEBHOOK,
    { deliveryId: delivery.id },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 100
    }
  );
}

export async function maybeFireEnterWebhook(
  webinar: import("db").Webinar,
  lead: import("db").Lead
): Promise<void> {
  if (lead.enterFired) return;
  // Atomic compare-and-swap: only fire if this update wins the race.
  const result = await prisma.lead.updateMany({
    where: { id: lead.id, enterFired: false },
    data: { enterFired: true, lastSeenAt: new Date() }
  });
  if (result.count === 0) return;
  const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
  if (!updated) return;
  await enqueueWebhook(webinar, "lead_acessou", updated);
}
