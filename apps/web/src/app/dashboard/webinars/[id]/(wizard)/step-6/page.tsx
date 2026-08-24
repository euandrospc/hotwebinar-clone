import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step6Form } from "@/components/wizard/step-6-form";

export default async function Step6Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({
    where: { id },
    include: { chatMessages: { orderBy: { showAtSec: "asc" } } }
  });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step6Form
      webinarId={id}
      slug={w.slug}
      initial={{
        messages: w.chatMessages.map((m) => ({
          id: m.id,
          authorName: m.authorName,
          text: m.text,
          showAtSec: m.showAtSec,
          isOwner: m.isOwner
        })),
        teamChatName: w.teamChatName
      }}
    />
  );
}
