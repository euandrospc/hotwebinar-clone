import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { headObject } from "@/lib/storage/presign";
import { ORIGINALS_BUCKET } from "@/lib/storage/buckets";
import { enqueueTranscode } from "jobs";

const inputSchema = z.object({ videoId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const video = await prisma.video.findUnique({ where: { id: parsed.data.videoId } });
  if (!video || video.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!video.originalUrl) return NextResponse.json({ error: "missing_key" }, { status: 400 });

  const head = await headObject(ORIGINALS_BUCKET, video.originalUrl);
  if (!head.exists) {
    return NextResponse.json({ error: "raw_not_found" }, { status: 400 });
  }

  if (typeof head.size === "number") {
    await prisma.video.update({
      where: { id: video.id },
      data: { bytes: BigInt(head.size) }
    });
  }

  console.log("[upload-complete] enqueuing transcode for", video.id);
  try {
    const handle = await enqueueTranscode({ videoId: video.id });
    console.log("[upload-complete] enqueued, runId=", handle.id);
  } catch (err: any) {
    console.error("[upload-complete] enqueueTranscode FAILED:", err?.message, err?.stack?.slice(0, 500));
    return NextResponse.json({ error: "enqueue_failed", message: err?.message || String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
