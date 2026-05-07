import { cookies, headers } from "next/headers";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { auth } from "@/lib/auth";

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes since last lead activity

function refererAllowed(req: Request, isAdmin: boolean): boolean {
  // Admin with valid session = trusted; no referer gate (browsers may strip
  // Referer from media requests via Referrer-Policy or extensions).
  if (isAdmin) return true;
  const ref = req.headers.get("referer") ?? "";
  if (!ref) return false;
  if (/\/[^/]+\/live(\/|$|\?)/.test(ref)) return true;
  return false;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  if (!/^[A-Za-z0-9_-]+$/.test(videoId)) {
    return new Response("invalid", { status: 400 });
  }

  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video || !video.encKey) return new Response("not found", { status: 404 });

  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  let isAdmin = false;
  if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { webinar: true }
    });
    if (!lead) return new Response("unauthorized", { status: 401 });
    // Webinar must be linked to this video
    if (lead.webinar.videoId !== videoId) {
      return new Response("forbidden", { status: 403 });
    }
    // Session TTL: 15min since last activity (lastSeenAt is bumped by /api/track,
    // /api/offer-click, opt-in, etc.)
    const elapsed = Date.now() - lead.lastSeenAt.getTime();
    if (elapsed > SESSION_TTL_MS) {
      return new Response("session expired", { status: 401 });
    }
  } else {
    // Admin can preview encrypted videos (videos table, library picker)
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return new Response("unauthorized", { status: 401 });
    if (video.ownerId !== session.user.id) {
      return new Response("forbidden", { status: 403 });
    }
    isAdmin = true;
  }

  if (!refererAllowed(req, isAdmin)) {
    return new Response("forbidden", { status: 403 });
  }

  const keyBytes = Buffer.from(video.encKey, "hex");
  if (keyBytes.length !== 16) return new Response("invalid key", { status: 500 });

  return new Response(keyBytes, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "private, no-store",
      "content-length": String(keyBytes.length)
    }
  });
}
