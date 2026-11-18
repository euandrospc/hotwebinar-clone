import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { createLimiter } from "@/lib/rate-limit";
import { updateStaffPresence } from "@/server/realtime/staff-presence-v5";

const inputSchema = z.object({ tabId: z.string().uuid(), active: z.boolean() }).strict();
const limiter = createLimiter({ max: 120, windowMs: 60_000 });
const responseHeaders = { "cache-control": "private, no-store" };

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.username || parsed.password || !["http:", "https:"].includes(parsed.protocol)) return false;
    if (parsed.origin === new URL(request.url).origin) return true;
    return Boolean(process.env.BETTER_AUTH_URL && parsed.origin === new URL(process.env.BETTER_AUTH_URL).origin);
  } catch { return false; }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers: responseHeaders });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: responseHeaders });
  const activeSession = await prisma.session.findFirst({
    where: { id: session.session.id, userId: session.user.id, expiresAt: { gt: new Date() }, user: { role: { in: ["admin", "attendant"] } } },
    select: { id: true, userId: true },
  });
  if (!activeSession) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: responseHeaders });
  if (!limiter.check(activeSession.userId)) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: responseHeaders });
  const body = await request.text();
  let input: unknown;
  try { input = body.length <= 512 ? JSON.parse(body) : null; } catch { input = null; }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400, headers: responseHeaders });
  const available = await updateStaffPresence({ userId: activeSession.userId, sessionId: activeSession.id, tabId: parsed.data.tabId }, parsed.data.active);
  return NextResponse.json({ available }, { status: available ? 200 : 503, headers: responseHeaders });
}
