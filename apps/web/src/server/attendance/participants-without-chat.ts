import { prisma, Prisma } from "db";
import { getOnlineSnapshot } from "@/lib/online";

// The player sends one VIDEO_TICK about every 30 s, only while the tab is visible and the
// video advances (tracker.tsx). Counting ticks inside a window measures the watch time of
// that live. Lead.permanenceFired cannot be used: it is set once per lead and never reset,
// so it says nothing about today's session of a recurring room.
export const TICK_SECONDS = 30;
const SHARE_MS = 5_000;
const PLACEHOLDER_EMAIL_DOMAIN = "@no-email.invalid";

export interface ParticipantsWithoutChatQuery {
  webinarId: string;
  range: { gte: Date; lt: Date };
  minWatchedSec: number;
  onlineOnly: boolean;
  page: number;
  pageSize: number;
}

export interface ParticipantWithoutChat {
  leadId: string;
  name: string;
  firstName: string | null;
  phone: string | null;
  email: string | null;
  watchedSecInRange: number;
  lastSeenAt: string;
  online: boolean;
}

export interface ParticipantsWithoutChatPage {
  total: number;
  leads: ParticipantWithoutChat[];
}

type Row = {
  id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  lastSeenAt: Date | null;
  ticks: number | null;
  total: number;
};

export function getFirstName(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0]?.replace(/^[,.;:!?]+|[,.;:!?]+$/g, "") ?? "";
  if (!first || first.includes("@") || !/\p{L}/u.test(first)) return null;
  return first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1).toLocaleLowerCase("pt-BR");
}

export async function loadParticipantsWithoutChat(query: ParticipantsWithoutChatQuery): Promise<ParticipantsWithoutChatPage> {
  const snapshot = await getOnlineSnapshot();
  const onlineIds = [...snapshot.leadIds];
  if (query.onlineOnly && !snapshot.byWebinar.get(query.webinarId)) return { total: 0, leads: [] };

  const minTicks = Math.max(1, Math.ceil(query.minWatchedSec / TICK_SECONDS));
  const onlineFilter = query.onlineOnly ? Prisma.sql`AND l.id = ANY(${onlineIds}::text[])` : Prisma.empty;
  // Timestamps are stored as UTC without time zone, as in the other raw queries.
  const rows = await prisma.$queryRaw<Row[]>`
    WITH eligible AS (
      SELECT l.id, l.name, l.phone, l.email, l."lastSeenAt", t.ticks::integer AS ticks
      FROM (
        SELECT e."leadId", count(*) AS ticks
        FROM event e
        WHERE e."webinarId" = ${query.webinarId} AND e.kind = 'VIDEO_TICK' AND e."leadId" IS NOT NULL
          AND e."createdAt" >= (${query.range.gte.toISOString()}::timestamptz AT TIME ZONE 'UTC')
          AND e."createdAt" < (${query.range.lt.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY e."leadId"
        HAVING count(*) >= ${minTicks}::integer
      ) t
      JOIN lead l ON l.id = t."leadId"
      WHERE l."attendanceClosedAt" IS NULL
        AND NOT EXISTS (SELECT 1 FROM lead_chat_message m WHERE m."leadId" = l.id)
        ${onlineFilter}
    )
    SELECT p.*, c.total
    FROM (SELECT count(*)::integer AS total FROM eligible) c
    LEFT JOIN LATERAL (
      SELECT * FROM eligible
      ORDER BY "lastSeenAt" DESC, id
      LIMIT ${query.pageSize}::integer OFFSET ${(query.page - 1) * query.pageSize}::integer
    ) p ON true
  `;

  const online = new Set(onlineIds);
  return {
    total: rows[0]?.total ?? 0,
    leads: rows.flatMap((row) => row.id && row.lastSeenAt ? [{
      leadId: row.id,
      name: row.name ?? "",
      firstName: getFirstName(row.name),
      phone: row.phone,
      email: row.email && !row.email.endsWith(PLACEHOLDER_EMAIL_DOMAIN) ? row.email : null,
      watchedSecInRange: (row.ticks ?? 0) * TICK_SECONDS,
      lastSeenAt: row.lastSeenAt.toISOString(),
      online: online.has(row.id)
    }] : [])
  };
}

// Automations poll this during a live. Identical requests share one in-flight load and its
// result for a few seconds, so many pollers cost one query, as with the conversation list.
const cache = new Map<string, { data: Promise<ParticipantsWithoutChatPage>; settledAt: number | null }>();

export function getParticipantsWithoutChat(query: ParticipantsWithoutChatQuery): Promise<ParticipantsWithoutChatPage> {
  const key = [query.webinarId, query.range.gte.toISOString(), query.range.lt.toISOString(),
    query.minWatchedSec, query.onlineOnly ? 1 : 0, query.page, query.pageSize].join("|");
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && (hit.settledAt === null || now - hit.settledAt < SHARE_MS)) return hit.data;
  for (const [k, entry] of cache) {
    if (entry.settledAt !== null && now - entry.settledAt >= SHARE_MS) cache.delete(k);
  }
  const entry: { data: Promise<ParticipantsWithoutChatPage>; settledAt: number | null } = {
    data: loadParticipantsWithoutChat(query),
    settledAt: null
  };
  cache.set(key, entry);
  entry.data.then(
    () => { entry.settledAt = Date.now(); },
    () => { if (cache.get(key) === entry) cache.delete(key); }
  );
  return entry.data;
}
