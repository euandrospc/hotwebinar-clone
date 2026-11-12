import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AB_VISITOR_COOKIE, abAssignmentCookieName, signAbAssignment, signAbVisitor, verifyAbVisitor } from "@/lib/ab-test-cookie";
import { allocateAbVisitor } from "@/server/ab-tests/assignment";
import { AbTestError } from "@/server/ab-tests/experiments";

export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" };

// Link previews and prefetching must not enter the experiment.
export async function HEAD() { return new NextResponse(null, { status: 204, headers }); }

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (/prefetch/i.test(`${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""}`)
    || /bot\b|crawler|spider|facebookexternalhit|WhatsApp|Slackbot|Discordbot|TelegramBot|LinkedInBot|Twitterbot|Google-InspectionTool/i.test(request.headers.get("user-agent") ?? "")) {
    return new NextResponse(null, { status: 204, headers });
  }
  try {
    const visitorId = verifyAbVisitor(request.cookies.get(AB_VISITOR_COOKIE)?.value) ?? randomUUID();
    const result = await allocateAbVisitor((await params).id, visitorId, request.nextUrl.searchParams, request.headers.get("user-agent"));
    const destination = new URL(`/${encodeURIComponent(result.slug)}`, request.url);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const value = request.nextUrl.searchParams.get(key);
      if (value) destination.searchParams.set(key, value.slice(0, 300));
    }
    const response = NextResponse.redirect(destination, { status: 307, headers });
    const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 };
    response.cookies.set(AB_VISITOR_COOKIE, signAbVisitor(visitorId), options);
    response.cookies.set(abAssignmentCookieName(result.webinarId), signAbAssignment(result.assignmentId), options);
    return response;
  } catch (error) {
    const known = error instanceof AbTestError;
    const message = known && error.status !== 404 ? error.message : "Este teste não está disponível.";
    return new NextResponse(message, { status: known ? error.status : 503, headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
  }
}
