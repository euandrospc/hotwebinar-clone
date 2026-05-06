import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "db";
import { isReservedSlug } from "@/lib/slug-blacklist";
import { publicWebinarDto } from "@/lib/public-dto";
import { computePhase } from "@/lib/sync";
import { CaptureForm } from "./_components/capture-form";
import { ClosedView } from "./_components/closed-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (isReservedSlug(slug)) return { title: "Webinar" };
  const w = await prisma.webinar.findUnique({ where: { slug }, select: { title: true, name: true } });
  const title = w?.title || w?.name || "Webinar";
  return { title };
}

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
  if (phase === "closed") return <ClosedView w={dto} />;
  return <CaptureForm w={dto} />;
}
