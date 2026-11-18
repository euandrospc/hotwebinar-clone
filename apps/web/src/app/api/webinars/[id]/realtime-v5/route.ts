import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toAccessUser } from "@/lib/webinar-access";
import { getRealtimeSourceSnapshot, RealtimeSourceNotFoundError } from "@/server/realtime-source-v5";

export const dynamic = "force-dynamic";
const responseHeaders = { "cache-control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: responseHeaders });

  const { id } = await params;
  try {
    const snapshot = await getRealtimeSourceSnapshot({ webinarId: id, viewer: toAccessUser(session), host: requestHeaders.get("host") });
    return NextResponse.json(snapshot, { headers: responseHeaders });
  } catch (error) {
    const missing = error instanceof RealtimeSourceNotFoundError;
    return NextResponse.json({ error: missing ? "Not found" : "Realtime data unavailable" }, { status: missing ? 404 : 503, headers: responseHeaders });
  }
}
