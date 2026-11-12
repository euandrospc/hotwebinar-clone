import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessWebinar } from "@/lib/webinar-access";
import { prisma } from "db";
import { Step6Form } from "@/components/wizard/step-6-form";

export const metadata: Metadata = { title: "Chat do webinar" };

export default async function Step6Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({
    where: { id },
    include: { chatMessages: { orderBy: { showAtSec: "asc" } } }
  });
  if (!canAccessWebinar(session, w)) notFound();

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
