import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { publicWebinarDto, publicVideoDto, publicLeadWithUtmsDto } from "@/lib/public-dto";
import { computePhase, computeInitialOffset } from "@/lib/sync";
import { maybeFireEnterWebhook } from "@/lib/webhook";
import { isReservedSlug } from "@/lib/slug-blacklist";
import { CountdownView } from "../_components/countdown-view";
import { ClosedView } from "../_components/closed-view";
import { PlayerShell } from "../_components/player-shell";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (isReservedSlug(slug)) return { title: "Webinar" };
  const w = await prisma.webinar.findUnique({ where: { slug }, select: { title: true, name: true } });
  const title = w?.title || w?.name || "Webinar";
  return { title };
}

export default async function LivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (isReservedSlug(slug)) notFound();
  const w = await prisma.webinar.findUnique({
    where: { slug },
    include: {
      video: true,
      chatMessages: { orderBy: { showAtSec: "asc" } },
      saleNotifications: { orderBy: { showAtSec: "asc" } }
    }
  });
  if (!w || w.status !== "ACTIVE") notFound();

  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId) redirect(`/${slug}`);
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.webinarId !== w.id) redirect(`/${slug}`);

  const phase = computePhase(
    { mode: w.mode, startDate: w.startDate, endDate: w.endDate },
    new Date()
  );
  const wDto = publicWebinarDto(w);
  const videoDto = publicVideoDto(w.video);
  if (phase === "before" && w.mode === "UNICO") return <CountdownView w={wDto} video={videoDto} />;
  if (phase === "closed") return <ClosedView w={wDto} />;

  const leadChat = await prisma.leadChatMessage.findMany({
    where: { leadId: lead.id }, orderBy: { createdAt: "asc" }
  });
  const offset = computeInitialOffset(
    { mode: w.mode, startDate: w.startDate, endDate: w.endDate },
    { sessionStart: lead.sessionStart },
    new Date(),
    w.video?.durationSec ?? null
  );

  await maybeFireEnterWebhook(w, lead);

  return (
    <PlayerShell
      webinar={wDto}
      video={videoDto}
      offer={{
        name: w.offerName,
        title: w.offerTitle,
        priceOriginal: w.offerPriceOriginal,
        priceFinal: w.offerPriceFinal,
        buttonText: w.offerButtonText,
        buttonColor: w.offerButtonColor,
        imageDesktopUrl: w.offerImageDesktopUrl,
        imageMobileUrl: w.offerImageMobileUrl,
        showAtSec: w.offerShowAtSec,
        hideAtSec: w.offerHideAtSec,
        link: w.offerLink,
        passUtms: w.offerPassUtms,
        disabled: w.offerDisabled,
        sameWindow: w.offerSameWindow,
        raffleEnabled: w.offerRaffleEnabled
      }}
      ownerChat={w.chatMessages.map((m) => ({
        id: m.id, authorName: m.authorName, text: m.text, showAtSec: m.showAtSec, isOwner: m.isOwner
      }))}
      leadChat={leadChat.map((m) => ({
        id: m.id, text: m.text, videoSec: m.videoSec, createdAt: m.createdAt.toISOString()
      }))}
      lead={publicLeadWithUtmsDto(lead)}
      salesNotifications={w.saleNotifications.map((n) => ({
        id: n.id,
        showAtSec: n.showAtSec,
        buyerName: n.buyerName,
        productName: n.productName,
        price: n.price
      }))}
      initialOffsetSec={offset}
    />
  );
}
