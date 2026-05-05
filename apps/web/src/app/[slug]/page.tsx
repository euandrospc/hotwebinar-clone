import { notFound } from "next/navigation";
import { prisma } from "db";
import { isReservedSlug } from "@/lib/slug-blacklist";
import { publicWebinarDto } from "@/lib/public-dto";
import { computePhase } from "@/lib/sync";
import { CaptureForm } from "./_components/capture-form";
import { ClosedView } from "./_components/closed-view";

export const dynamic = "force-dynamic";

export default async function CapturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (isReservedSlug(slug)) notFound();
  const w = await prisma.webinar.findUnique({ where: { slug } });
  if (!w || w.status !== "ACTIVE") notFound();
  const phase = computePhase(
    { mode: w.mode, startDate: w.startDate, endDate: w.endDate },
    new Date()
  );
  const dto = publicWebinarDto(w);
  if (phase === "closed" && w.mode === "UNICO") return <ClosedView w={dto} />;
  return <CaptureForm w={dto} />;
}
