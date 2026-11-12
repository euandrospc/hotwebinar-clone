import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAttendant } from "@/lib/attendant-session";
import { resolveLeadRequest } from "@/server/lead-request";
import { getLinkPreview } from "@/server/attendance/link-preview";
import { leadLinkPreviewLimiter, staffLinkPreviewLimiter } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const staff = await requireAttendant();
  const lead = staff ? null : await resolveLeadRequest(request, await cookies());
  if (!staff && !lead) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const allowed = staff ? staffLinkPreviewLimiter.check(staff.user.id) : leadLinkPreviewLimiter.check(lead!.id);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const url = new URL(request.url).searchParams.get("url");
  if (!url || url.length > 2048) return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  try { return NextResponse.json(await getLinkPreview(url), { headers: { "cache-control": "private, max-age=600" } }); }
  catch { return NextResponse.json({ error: "preview_unavailable" }, { status: 422 }); }
}
