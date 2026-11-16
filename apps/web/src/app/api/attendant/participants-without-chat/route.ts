import { NextResponse } from "next/server";
import { prisma } from "db";
import { attendanceRange } from "@/lib/attendance-range";
import { requireAttendant } from "@/lib/attendant-session";
import { parseLeadsPagination } from "@/lib/leads-pagination";
import { getParticipantsWithoutChat } from "@/server/attendance/participants-without-chat";

/**
 * Leads of one live (webinar + period, today by default) who watched at least the
 * permanence time inside the period and never had a chat message or a closed attendance.
 *
 * Each lead that gets a message leaves the list, so automations sending messages should
 * keep reading page 1 until it is empty instead of advancing pages.
 */
export async function GET(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const webinarId = params.get("webinarId");
  const rawMin = params.get("minWatchedSec");
  if (!webinarId || (rawMin !== null && !/^\d{1,6}$/.test(rawMin))) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  let range;
  try { range = attendanceRange(params.get("from"), params.get("to"), new Date(), { fromTime: params.get("fromTime"), toTime: params.get("toTime") }); }
  catch { return NextResponse.json({ error: "invalid_range" }, { status: 400 }); }

  const webinar = await prisma.webinar.findUnique({ where: { id: webinarId }, select: { permanenceThresholdSec: true } });
  if (!webinar) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const minWatchedSec = rawMin === null ? webinar.permanenceThresholdSec : Number(rawMin);
  const onlineOnly = params.get("onlineOnly") === "1";
  const { page, pageSize } = parseLeadsPagination({ page: params.get("page") ?? undefined, pageSize: params.get("pageSize") ?? undefined });
  const result = await getParticipantsWithoutChat({ webinarId, range: { gte: range.gte, lt: range.lt }, minWatchedSec, onlineOnly, page, pageSize });

  return NextResponse.json({
    webinarId,
    range: { gte: range.gte.toISOString(), lt: range.lt.toISOString() },
    minWatchedSec,
    onlineOnly,
    page,
    pageSize,
    ...result
  }, { headers: { "cache-control": "no-store" } });
}
