import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/attendant-session";
import { getChatMessages } from "@/server/chat-message";

export async function GET(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  return NextResponse.json(
    { messages: await getChatMessages(leadId, url.searchParams.get("after")) },
    { headers: { "cache-control": "private, no-store" } }
  );
}
