import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "db";
import { auth } from "@/lib/auth";

const schema = z.object({
  enabled: z.boolean(), name: z.string().trim().min(1).max(60),
  model: z.string().trim().regex(/^[a-zA-Z0-9._-]{1,100}$/),
  instructions: z.string().trim().max(20000)
}).refine(data => !data.enabled || data.instructions.length >= 20, { message: "Preencha as instruções antes de ativar." });
async function owned(id: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as { role?: string }).role !== "admin") return null;
  return prisma.webinar.findFirst({ where: { id, ownerId: session.user.id } });
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const webinar = await owned((await params).id);
  if (!webinar) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ enabled: webinar.chatAiEnabled, name: webinar.chatAiName, model: webinar.chatAiModel,
    instructions: webinar.chatAiInstructions, providerReady: !!process.env.OPENAI_API_KEY }, { headers: { "cache-control": "private, no-store" } });
}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const webinar = await owned((await params).id);
  if (!webinar) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  if (parsed.data.enabled && !process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Configure OPENAI_API_KEY no servidor antes de ativar." }, { status: 409 });
  const data = parsed.data;
  await prisma.$transaction(async tx => {
    // Serialize configuration changes against workers that are committing a reply.
    await tx.webinar.update({ where: { id: webinar.id }, data: {
      chatAiEnabled: data.enabled, chatAiName: data.name, chatAiModel: data.model, chatAiInstructions: data.instructions
    } });
    await tx.lead.updateMany({ where: { webinarId: webinar.id }, data: {
      chatVersion: { increment: 1 }, aiLeaseToken: null, aiLeaseUntil: null, aiAttempts: 0, aiNextAttemptAt: null
    } });
  });
  return NextResponse.json({ ok: true });
}
