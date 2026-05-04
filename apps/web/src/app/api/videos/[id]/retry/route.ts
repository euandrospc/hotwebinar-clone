import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { getVideoQueue, JOB_TRANSCODE } from "jobs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (video.status !== "FAILED") {
    return NextResponse.json({ error: "not_failed" }, { status: 409 });
  }

  await prisma.video.update({
    where: { id },
    data: { status: "QUEUED", errorMessage: null, progress: 0 }
  });
  await getVideoQueue().add(
    JOB_TRANSCODE,
    { videoId: id },
    { attempts: 3, backoff: { type: "exponential", delay: 30_000 } }
  );
  return NextResponse.json({ ok: true });
}
