import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step1Form } from "@/components/wizard/step-1-form";

export default async function Step1Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step1Form
      webinarId={id}
      initial={{
        name: w.name,
        title: w.title,
        slug: w.slug ?? "",
        language: w.language,
        accessFacilitated: w.accessFacilitated,
        videoSyncWithStart: w.videoSyncWithStart
      }}
    />
  );
}
