import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step5Form } from "@/components/wizard/step-5-form";

export default async function Step5Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step5Form
      webinarId={id}
      initial={{
        offerName: w.offerName,
        offerTitle: w.offerTitle,
        offerPriceOriginal: w.offerPriceOriginal,
        offerPriceFinal: w.offerPriceFinal,
        offerButtonText: w.offerButtonText,
        offerButtonColor: w.offerButtonColor,
        offerImageDesktopUrl: w.offerImageDesktopUrl,
        offerImageMobileUrl: w.offerImageMobileUrl,
        pitchAtSec: w.pitchAtSec,
        offerShowAtSec: w.offerShowAtSec,
        offerHideAtSec: w.offerHideAtSec,
        offerLink: w.offerLink,
        offerPassUtms: w.offerPassUtms,
        offerDisabled: w.offerDisabled,
        offerSameWindow: w.offerSameWindow,
        offerRaffleEnabled: w.offerRaffleEnabled
      }}
    />
  );
}
