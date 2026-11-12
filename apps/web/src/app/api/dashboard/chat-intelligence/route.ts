import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/roles";
import { getChatIntelligenceReport, processChatIntelligenceBatch, ChatIntelligenceError } from "@/server/dashboard/chat-intelligence";

const responseHeaders = { "cache-control": "private, no-store" };
const inputSchema = z.object({
  webinarId: z.string().trim().min(1).max(128),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true })
}).strict().refine((value) => new Date(value.from) <= new Date(value.to));

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const target = new URL(request.url);
    if (parsed.username || parsed.password || !["http:", "https:"].includes(parsed.protocol)) return false;
    if (parsed.origin === target.origin) return true;
    // Deployments behind a reverse proxy may expose the configured public
    // origin while Next receives an internal URL. Only that explicit origin is trusted.
    const configured = process.env.BETTER_AUTH_URL;
    return Boolean(configured && parsed.origin === new URL(configured).origin);
  } catch { return false; }
}
async function handle(request: Request, process: boolean) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: responseHeaders });
  if (!hasRole((session.user as { role?: string }).role, ADMIN_ROLES)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: responseHeaders });
  if (process && !sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers: responseHeaders });
  const url = new URL(request.url);
  const parsed = inputSchema.safeParse(process ? await request.json().catch(() => null) : {
    webinarId: url.searchParams.get("webinarId"), from: url.searchParams.get("from"), to: url.searchParams.get("to")
  });
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400, headers: responseHeaders });
  const scope = { webinarId: parsed.data.webinarId, from: new Date(parsed.data.from), to: new Date(parsed.data.to) };
  try {
    const data = process ? await processChatIntelligenceBatch(session.user, scope) : await getChatIntelligenceReport(session.user, scope);
    return NextResponse.json(data, { headers: responseHeaders });
  } catch (error) {
    const known = error instanceof ChatIntelligenceError;
    return NextResponse.json({ error: known ? error.code : "analysis_unavailable" }, { status: known ? error.status : 500, headers: responseHeaders });
  }
}
export async function GET(request: Request) { return handle(request, false); }
export async function POST(request: Request) { return handle(request, true); }
