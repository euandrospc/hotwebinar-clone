import { cookies, headers } from "next/headers";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { auth } from "@/lib/auth";

const MIN_TTL_MS = 15 * 60 * 1000; // floor: 15 minutes
const TTL_BUFFER_MS = 5 * 60 * 1000; // grace beyond video duration

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
  const session = await auth.api.getSession({ headers: await headers() });
  let isAdmin = false;

  if (session && video.ownerId === session.user.id) {
    isAdmin = true;
  } else if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { webinar: true }
    });
    if (!lead) return new Response("unauthorized", { status: 401 });
    // Webinar must be linked to this video
    if (lead.webinar.videoId !== videoId) {
      return new Response("forbidden", { status: 403 });
    }
    // Session TTL = video duration + 5min buffer (floor 15min). Measured
    // from sessionStart so reloads during playback work as long as the
    // video itself is still in range.
    const durMs = video.durationSec ? video.durationSec * 1000 : 0;
    const ttl = Math.max(MIN_TTL_MS, durMs + TTL_BUFFER_MS);
    const elapsed = Date.now() - lead.sessionStart.getTime();
    if (elapsed > ttl) {
      return new Response("session expired", { status: 401 });
    }
  } else {
    return new Response("unauthorized", { status: 401 });
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
