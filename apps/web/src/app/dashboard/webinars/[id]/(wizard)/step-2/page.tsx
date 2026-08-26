import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step2Form } from "@/components/wizard/step-2-form";

export default async function Step2Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step2Form
      webinarId={id}
      initial={{
        mode: w.mode,
        startDate: w.startDate ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: w.endDate ?? new Date(Date.now() + 25 * 60 * 60 * 1000),
        timezone: w.timezone,
        waitingTitle: w.waitingTitle,
        waitingSubtitle: w.waitingSubtitle,
        waitingShowThumb: w.waitingShowThumb,
        waitingTemplate: w.waitingTemplate,
        closedGroupUrl: w.closedGroupUrl ?? ""
      }}
    />
  );
}
