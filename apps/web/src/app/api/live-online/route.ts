import { NextResponse } from "next/server";
import { getOnlineSnapshot } from "@/lib/online";

// Public "N online" for the player chat header; same snapshot as the admin dashboard.
export async function GET(request: Request) {
  const webinarId = new URL(request.url).searchParams.get("webinarId");
  if (!webinarId) return NextResponse.json({ error: "missing webinarId" }, { status: 400 });
  const snap = await getOnlineSnapshot();
  return NextResponse.json({ online: snap.byWebinar.get(webinarId) ?? 0 }, { headers: { "cache-control": "no-store" } });
}
