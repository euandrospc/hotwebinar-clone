import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessWebinar } from "@/lib/webinar-access";
import { prisma } from "db";
import { IntegrationsForm } from "@/components/webinar/integrations-form";
import { SalesWebhookCard } from "@/components/sales-webhook-card";

export const metadata: Metadata = { title: "Integrações do webinar" };

export default async function IntegrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!canAccessWebinar(session, w)) notFound();
  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_500px]">
      <IntegrationsForm
        webinarId={id}
        initial={{
          webhookUrl: w.webhookUrl ?? "",
          webhookOnOptin: w.webhookOnOptin,
          webhookOnEnter: w.webhookOnEnter,
          webhookOnOfferView: w.webhookOnOfferView,
          webhookOnOfferClick: w.webhookOnOfferClick,
          webhookOnRaffleEntry: w.webhookOnRaffleEntry,
          webhookOnSale: w.webhookOnSale,
          webhookOnPitchReached: w.webhookOnPitchReached,
          webhookOnPermanence: w.webhookOnPermanence,
          webhookOnLeave: w.webhookOnLeave,
          permanenceThresholdSec: w.permanenceThresholdSec
        }}
      />
      <SalesWebhookCard webinarId={id} initialSecret={w.salesWebhookSecret} />
    </div>
  );
}
