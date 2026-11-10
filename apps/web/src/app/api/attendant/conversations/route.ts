import { attendanceRange } from "@/lib/attendance-range";
import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/attendant-session";
import { loadConversations, sharedConversationList } from "@/server/attendance/conversation-list";

export async function GET(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const webinarId = params.get("webinarId") || undefined;
  const leadId = params.get("leadId") || undefined;
  let range;
  try { range = attendanceRange(params.get("from"), params.get("to"), new Date(), { fromTime: params.get("fromTime"), toTime: params.get("toTime") }); }
  catch { return NextResponse.json({ error: "invalid_range" }, { status: 400 }); }

  // A single-lead lookup is cheap and must reflect the latest state when a link is opened.
  const payload = leadId
    ? await loadConversations(range, webinarId, leadId)
    : await sharedConversationList(`${webinarId ?? ""}|${range.gte.toISOString()}|${range.lt.toISOString()}`, () => loadConversations(range, webinarId));
  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
