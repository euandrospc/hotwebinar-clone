import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step4Form } from "@/components/wizard/step-4-form";

export default async function Step4Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id }, include: { video: true } });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step4Form
      webinarId={id}
      initial={{
        videoExternalUrl: w.video?.originalUrl ?? "",
        pitchAtSec: w.pitchAtSec ?? undefined
      }}
    />
  );
}
