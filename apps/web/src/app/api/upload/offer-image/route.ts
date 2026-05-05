import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { presignPut } from "@/lib/storage/presign";
import { HLS_BUCKET } from "@/lib/storage/buckets";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 2 * 1024 * 1024;

const inputSchema = z.object({
  webinarId: z.string().min(1),
  kind: z.enum(["desktop", "mobile"]),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive()
});

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { webinarId, kind, mimeType, sizeBytes } = parsed.data;

  if (!(ALLOWED_MIME as readonly string[]).includes(mimeType)) {
    return NextResponse.json(
      { error: "invalid_mime", message: `MIME inválido. Use ${ALLOWED_MIME.join(", ")}` },
      { status: 400 }
    );
  }
  if (sizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: "too_large", maxBytes: MAX_BYTES, message: "Imagem deve ter até 2 MiB" },
      { status: 413 }
    );
  }

  const webinar = await prisma.webinar.findUnique({ where: { id: webinarId } });
  if (!webinar || webinar.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ext = EXT_BY_MIME[mimeType];
  const key = `offer/${webinarId}/${kind}.${ext}`;
  const uploadUrl = await presignPut(HLS_BUCKET, key, mimeType, 15 * 60);
  const publicBase = process.env.S3_PUBLIC_BASE_URL ?? "";
  const publicUrl = `${publicBase}/${HLS_BUCKET}/${key}`;
  return NextResponse.json({ uploadUrl, publicUrl, key });
}
