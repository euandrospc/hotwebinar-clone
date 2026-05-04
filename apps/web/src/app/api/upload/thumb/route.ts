import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { presignPut } from "@/lib/storage/presign";
import { HLS_BUCKET } from "@/lib/storage/buckets";

const inputSchema = z.object({ videoId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const video = await prisma.video.findUnique({ where: { id: parsed.data.videoId } });
  if (!video || video.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const key = `${video.id}/thumb-custom.jpg`;
  const uploadUrl = await presignPut(HLS_BUCKET, key, "image/jpeg", 15 * 60);
  return NextResponse.json({ uploadUrl, key });
}
