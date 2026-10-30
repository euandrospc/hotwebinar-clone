import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { getWebinarRealtimeSnapshot } from "@/server/webinar-realtime";

export const dynamic = "force-dynamic";
const responseHeaders = { "cache-control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: responseHeaders });

  const { id } = await params;
  const webinar = await prisma.webinar.findFirst({
    where: { id, ownerId: session.user.id },
    select: { id: true }
  });
  if (!webinar) return NextResponse.json({ error: "Not found" }, { status: 404, headers: responseHeaders });

  return NextResponse.json(await getWebinarRealtimeSnapshot(webinar.id), { headers: responseHeaders });
}
