import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAttendant } from "@/lib/attendant-session";
import { verifyLeadCookie } from "@/lib/lead-session";
import { prisma } from "db";
import { getLinkPreview } from "@/server/attendance/link-preview";
import { createLimiter } from "@/lib/rate-limit";

const limiter = createLimiter({ max: 60, windowMs: 60_000 });

export async function GET(request: Request) {
  const staff = await requireAttendant();
  const leadId = staff ? null : verifyLeadCookie((await cookies()).get("hw_lead")?.value);
  if (!staff && (!leadId || !await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } }))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!limiter.check(staff?.user.id ?? leadId!)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const url = new URL(request.url).searchParams.get("url");
  if (!url || url.length > 2048) return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  try { return NextResponse.json(await getLinkPreview(url), { headers: { "cache-control": "private, max-age=600" } }); }
  catch { return NextResponse.json({ error: "preview_unavailable" }, { status: 422 }); }
}
