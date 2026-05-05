import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { buildChatXlsx } from "@/lib/chat-xlsx";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const webinar = await prisma.webinar.findUnique({ where: { id } });
  if (!webinar || webinar.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { webinarId: id },
    orderBy: { showAtSec: "asc" }
  });

  const buf = await buildChatXlsx(
    messages.map((m) => ({
      authorName: m.authorName,
      text: m.text,
      showAtSec: m.showAtSec,
      isOwner: m.isOwner
    }))
  );

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="chat-${id}.xlsx"`
    }
  });
}
