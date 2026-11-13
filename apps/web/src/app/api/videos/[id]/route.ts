import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canAccessVideo } from "@/lib/webinar-access";
import { prisma } from "db";

const patchSchema = z.object({
  customThumbUrl: z.string().url().optional().or(z.null()),
  name: z.string().trim().min(1).max(255).optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const video = await prisma.video.findUnique({ where: { id } });
  if (!canAccessVideo(session, video)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.video.update({
    where: { id },
    // Rename-only requests must not clear the thumbnail.
    data: parsed.data.name !== undefined && parsed.data.customThumbUrl === undefined
      ? { name: parsed.data.name }
      : { customThumbUrl: parsed.data.customThumbUrl ?? null, ...(parsed.data.name !== undefined && { name: parsed.data.name }) }
  });

  return NextResponse.json({ ok: true });
}
