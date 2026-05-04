import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "db";

const patchSchema = z.object({
  customThumbUrl: z.string().url().optional().or(z.null())
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.video.update({
    where: { id },
    data: { customThumbUrl: parsed.data.customThumbUrl ?? null }
  });

  return NextResponse.json({ ok: true });
}
