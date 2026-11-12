import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessWebinar } from "@/lib/webinar-access";
import { prisma } from "db";
import { Step8Form } from "@/components/wizard/step-8-form";

export const metadata: Metadata = { title: "Audiência do webinar" };

export default async function Step8Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({
    where: { id },
    include: { video: true }
  });
  if (!canAccessWebinar(session, w)) notFound();

  const durationSec =
    w.video?.durationSec ??
    (w.startDate && w.endDate
      ? Math.max(60, Math.floor((w.endDate.getTime() - w.startDate.getTime()) / 1000))
      : 3600);

  return (
    <Step8Form
      webinarId={id}
      durationSec={durationSec}
      seed={`${id}:preview`}
      initial={{
        audienceMode: w.audienceMode,
        audienceMin: w.audienceMin,
        audienceMax: w.audienceMax,
        audienceLiveBadge: w.audienceLiveBadge
      }}
    />
  );
}
