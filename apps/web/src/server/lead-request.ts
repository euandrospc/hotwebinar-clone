import { prisma } from "db";
import { readLeadCookieForWebinar, type LeadCookieReader } from "@/lib/lead-session";

const validId = (value: string | null) => value !== null && /^[A-Za-z0-9_-]{1,128}$/.test(value);

/**
 * URL ids are only selectors; authorization always comes from a verified cookie
 * and the matching database relationship. Legacy HTTP clients use the exact
 * same-origin /slug/live Referer; requests with no provable scope fail closed.
 */
export async function resolveLeadRequest(request: Request, store: LeadCookieReader) {
  const url = new URL(request.url);
  let webinarId = url.searchParams.get("webinarId");
  const expectedLeadId = url.searchParams.get("leadId");
  if (url.searchParams.has("leadId") && !validId(expectedLeadId)) return null;
  if (url.searchParams.has("webinarId")) {
    if (!validId(webinarId)) return null;
  } else {
    // No accepting arbitrary ids or whichever lead happens to be in hw_lead.
    const referer = request.headers.get("referer");
    if (!referer) return null;
    let refererUrl: URL;
    try { refererUrl = new URL(referer); } catch { return null; }
    if (refererUrl.origin !== url.origin) {
      // Reverse proxies may expose the configured public origin while Next's
      // incoming URL uses an internal host. Never trust arbitrary forwarded hosts.
      try {
        if (!process.env.BETTER_AUTH_URL || refererUrl.origin !== new URL(process.env.BETTER_AUTH_URL).origin) return null;
      } catch { return null; }
    }
    const match = /^\/([^/]+)\/live\/?$/.exec(refererUrl.pathname);
    if (!match) return null;
    let slug: string;
    try { slug = decodeURIComponent(match[1]); } catch { return null; }
    const webinar = await prisma.webinar.findUnique({ where: { slug }, select: { id: true } });
    if (!webinar) return null;
    webinarId = webinar.id;
  }
  const leadId = readLeadCookieForWebinar(store, webinarId!);
  if (!leadId || (expectedLeadId !== null && leadId !== expectedLeadId)) return null;
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { webinar: true } });
  return lead?.webinarId === webinarId ? lead : null;
}
