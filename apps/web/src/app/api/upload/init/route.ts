import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { presignPut } from "@/lib/storage/presign";
import { ORIGINALS_BUCKET } from "@/lib/storage/buckets";

const inputSchema = z.object({
  name: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string()
});

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
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }
  const { name, sizeBytes, mimeType } = parsed.data;

  if (!mimeType.startsWith("video/")) {
    return NextResponse.json({ error: "invalid_mime", message: "MIME deve ser video/*" }, { status: 400 });
  }

  const maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024 * 1024);
  if (sizeBytes > maxBytes) {
    return NextResponse.json(
      { error: "too_large", maxBytes, sizeBytes, message: `Arquivo > ${(maxBytes / (1024 ** 3)).toFixed(1)} GiB` },
      { status: 413 }
    );
  }

  // Determine extension from name (fallback .mp4)
  const ext = (name.split(".").pop() ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";

  const video = await prisma.video.create({
    data: {
      ownerId: session.user.id,
      name,
      source: "UPLOAD",
      originalUrl: "", // filled after we know the key
      status: "QUEUED",
      progress: 0,
      bytes: BigInt(sizeBytes)
    }
  });

  const key = `${video.id}/raw.${ext}`;
  await prisma.video.update({ where: { id: video.id }, data: { originalUrl: key } });

  const uploadUrl = await presignPut(ORIGINALS_BUCKET, key, mimeType, 15 * 60);

  return NextResponse.json({
    videoId: video.id,
    uploadUrl,
    headers: { "Content-Type": mimeType }
  });
}
