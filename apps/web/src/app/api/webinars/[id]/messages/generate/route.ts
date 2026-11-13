import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canAccessWebinar } from "@/lib/webinar-access";
import { createLimiter } from "@/lib/rate-limit";
import { prisma } from "db";
import { SalesAiError } from "@/server/sales-ai";
import { chatTimes, generateChatScript, toChatRows } from "@/server/chat-script-ai";

// Per user: each call is a paid model request.
const chatAiLimiter = createLimiter({ max: 5, windowMs: 60_000 });
const messages: Record<string, string> = {
  provider_missing: "Configure a integração de IA",
  provider_rate_limited: "A IA está ocupada. Tente novamente em instantes.",
  provider_unavailable: "A IA não respondeu. Tente novamente.",
  invalid_output: "A IA devolveu uma resposta inválida. Tente novamente."
};

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const webinar = await prisma.webinar.findUnique({ where: { id }, include: { video: { select: { durationSec: true } } } });
  if (!canAccessWebinar(session, webinar)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!chatAiLimiter.check(session.user.id)) {
    return NextResponse.json({ error: "rate_limited", message: "Muitas gerações seguidas. Aguarde um minuto." }, { status: 429 });
  }

  const data = { ...webinar, durationSec: webinar.video?.durationSec ?? null };
  try {
    const times = chatTimes(data);
    const rows = toChatRows(await generateChatScript(webinar.chatAiModel, data, times), times);
    return NextResponse.json({ messages: rows }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const code = error instanceof SalesAiError ? error.code : "provider_unavailable";
    const status = error instanceof SalesAiError ? error.status : 502;
    return NextResponse.json({ error: code, message: messages[code] ?? messages.provider_unavailable }, { status });
  }
}
