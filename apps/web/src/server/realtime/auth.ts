import type { IncomingHttpHeaders } from "node:http";
import { prisma } from "db";
import { auth } from "../../lib/auth";
import { verifyLeadCookie } from "../../lib/lead-session";
import type { RealtimeScope } from "../../lib/realtime-protocol";

export type RealtimeIdentity =
  | { kind: "lead"; leadId: string; webinarId: string; rooms: string[] }
  | { kind: "staff" | "dashboard" | "webinar"; userId: string; rooms: string[] };

export function validRealtimeScope(value: unknown): value is RealtimeScope {
  if (!value || typeof value !== "object") return false;
  const scope = value as Record<string, unknown>;
  if (scope.kind === "webinar") return typeof scope.webinarId === "string" && scope.webinarId.length > 0 && scope.webinarId.length <= 128;
  return scope.kind === "lead" || scope.kind === "staff" || scope.kind === "dashboard";
}

export function isAllowedRealtimeOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return false;
    return parsed.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}

function requestHeaders(source: IncomingHttpHeaders): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(source)) {
    if (typeof value === "string") result.set(name, value);
    else if (value) result.set(name, value.join(", "));
  }
  return result;
}

function cookieValue(cookie: string | undefined, key: string): string | undefined {
  const item = cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${key}=`));
  if (!item) return;
  try { return decodeURIComponent(item.slice(key.length + 1)); } catch { return; }
}

export async function authenticateRealtime(
  headers: IncomingHttpHeaders,
  scope: RealtimeScope
): Promise<RealtimeIdentity | null> {
  if (!validRealtimeScope(scope)) return null;
  if (scope.kind === "lead") {
    const leadId = verifyLeadCookie(cookieValue(headers.cookie, "hw_lead"));
    if (!leadId) return null;
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, webinarId: true } });
    return lead ? { kind: "lead", leadId: lead.id, webinarId: lead.webinarId, rooms: [`lead:${lead.id}`] } : null;
  }

  const session = await auth.api.getSession({ headers: requestHeaders(headers) });
  if (!session) return null;
  // Recheck the DB even when Better Auth can serve a cached cookie session.
  const active = await prisma.session.findFirst({
    where: { id: session.session.id, userId: session.user.id, expiresAt: { gt: new Date() } },
    select: { user: { select: { id: true, role: true } } }
  });
  if (!active) return null;
  const user = active.user;
  if (scope.kind === "staff") {
    return ["admin", "attendant"].includes(user.role)
      ? { kind: "staff", userId: user.id, rooms: ["staff"] }
      : null;
  }
  if (user.role !== "admin") return null;
  if (scope.kind === "dashboard") return { kind: "dashboard", userId: user.id, rooms: [`dashboard:${user.id}`] };

  const webinar = await prisma.webinar.findFirst({ where: { id: scope.webinarId, ownerId: user.id }, select: { id: true } });
  return webinar ? { kind: "webinar", userId: user.id, rooms: [`webinar:${webinar.id}`] } : null;
}
