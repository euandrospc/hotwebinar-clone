"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { enqueueTranscode, enqueueDeleteAssets } from "jobs";
import { proxifyHlsUrl } from "@/lib/public-dto";

type Result = { ok: true } | { error: string; webinars?: Array<{ id: string; title: string }> };

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function listVideos() {
  const session = await requireSession();
  const rows = await prisma.video.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" }
  });
  return rows.map((v) => ({
    id: v.id,
    name: v.name,
    source: v.source,
    status: v.status,
    progress: v.progress,
    durationSec: v.durationSec,
    bytes: v.bytes ? v.bytes.toString() : null,
    thumbUrl: proxifyHlsUrl(v.thumbUrl),
    customThumbUrl: proxifyHlsUrl(v.customThumbUrl),
    hlsUrl: proxifyHlsUrl(v.hlsUrl),
    errorMessage: v.errorMessage,
    createdAt: v.createdAt
  }));
}

export async function deleteVideo(id: string, force: boolean): Promise<Result> {
  const session = await requireSession();
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== session.user.id) return { error: "not_found" };

  const webinars = await prisma.webinar.findMany({
    where: { videoId: id },
    select: { id: true, title: true }
  });
  if (webinars.length > 0 && !force) {
    return { error: "in_use", webinars };
  }
  await prisma.video.delete({ where: { id } });
  await enqueueDeleteAssets({ videoId: id, ownerId: session.user.id });
  revalidatePath("/dashboard/videos");
  return { ok: true };
}

export async function setCustomThumb(id: string, customThumbUrl: string | null): Promise<Result> {
  const session = await requireSession();
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== session.user.id) return { error: "not_found" };
  await prisma.video.update({ where: { id }, data: { customThumbUrl } });
  revalidatePath("/dashboard/videos");
  return { ok: true };
}

export async function retryTranscode(id: string): Promise<Result> {
  const session = await requireSession();
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== session.user.id) return { error: "not_found" };
  if (video.status !== "FAILED") return { error: "not_failed" };
  await prisma.video.update({ where: { id }, data: { status: "QUEUED", errorMessage: null, progress: 0 } });
  await enqueueTranscode({ videoId: id });
  revalidatePath("/dashboard/videos");
  return { ok: true };
}
