import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { IntegrationsForm } from "@/components/webinar/integrations-form";

export default async function IntegrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();
  return (
    <div className="container mx-auto py-10">
      <IntegrationsForm
        webinarId={id}
        initial={{
          webhookUrl: w.webhookUrl ?? "",
          webhookOnOptin: w.webhookOnOptin,
          webhookOnEnter: w.webhookOnEnter,
          webhookOnOfferView: w.webhookOnOfferView,
          webhookOnOfferClick: w.webhookOnOfferClick,
          webhookOnRaffleEntry: w.webhookOnRaffleEntry,
          webhookOnPitchReached: w.webhookOnPitchReached,
          webhookOnPermanence: w.webhookOnPermanence,
          webhookOnLeave: w.webhookOnLeave,
          permanenceThresholdSec: w.permanenceThresholdSec
        }}
      />
    </div>
  );
}
