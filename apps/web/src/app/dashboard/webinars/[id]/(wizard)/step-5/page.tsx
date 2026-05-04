import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step5Form } from "@/components/wizard/step-5-form";

export default async function Step5Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({
    where: { id },
    include: { ctas: { orderBy: { showAtSec: "asc" } } }
  });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step5Form
      webinarId={id}
      initial={{
        ctas: w.ctas.map((c) => ({
          id: c.id,
          label: c.label,
          url: c.url,
          showAtSec: c.showAtSec,
          hideAtSec: c.hideAtSec ?? undefined
        }))
      }}
    />
  );
}
