import Redis from "ioredis";
import { PrismaClient, prisma } from "db";
import type { OnlineSnapshot } from "@/lib/online";
import type { RealtimeWebinarOption } from "@/lib/webinar-realtime-v5";
import { isAdminUser, ownerScope, type AccessUser } from "@/lib/webinar-access";
import { getWebinarRealtimeSnapshot } from "./webinar-realtime-v5";
import { waitForRedisReady } from "./realtime/redis";

export class RealtimeSourceNotFoundError extends Error {
  constructor() { super("Realtime webinar not found"); }
}

export class RealtimeSourceUnavailableError extends Error {
  constructor() { super("Realtime data source unavailable"); }
}

const presenceWindowMs = 45_000;
const presenceKey = "hotwebinar:realtime:v1:presence";
const presenceMetadataKey = "hotwebinar:realtime:v1:presence-metadata";
type RemoteConfig = { databaseUrl: string; redisUrl: string };
let cached: (RemoteConfig & { database: PrismaClient; redis: Redis }) | undefined;

function remoteConfig(host: string | null): RemoteConfig | null {
  // The operational connection is a local development aid only. Production and
  // external hosts always use the application's ordinary authorized source.
  if (process.env.NODE_ENV !== "development" || !host
    || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host)) return null;
  const databaseUrl = process.env.REALTIME_READONLY_DATABASE_URL;
  const redisUrl = process.env.REALTIME_READONLY_REDIS_URL;
  if (!databaseUrl && !redisUrl) return null;
  // A partial configuration must not silently display empty local data as live.
  if (!databaseUrl || !redisUrl) throw new RealtimeSourceUnavailableError();
  return { databaseUrl, redisUrl };
}

function remoteClients(config: RemoteConfig) {
  if (cached?.databaseUrl === config.databaseUrl && cached.redisUrl === config.redisUrl) return cached;
  if (cached) {
    void cached.database.$disconnect().catch(() => {});
    cached.redis.disconnect();
  }
  const database = new PrismaClient({ datasources: { db: { url: config.databaseUrl } }, log: [] });
  const redis = new Redis(config.redisUrl, {
    connectTimeout: 2_000, commandTimeout: 2_000, maxRetriesPerRequest: 1,
    enableOfflineQueue: false, enableReadyCheck: false,
    retryStrategy: attempt => Math.min(attempt * 200, 2_000)
  });
  redis.on("error", () => {}); // Never print connection strings or provider errors.
  cached = { ...config, database, redis };
  return cached;
}

/** Read the production leases without invoking its pruning/publication code. */
async function readRemotePresence(redis: Redis, now: Date): Promise<OnlineSnapshot> {
  if (!await waitForRedisReady(redis, 2_000)) throw new RealtimeSourceUnavailableError();
  const connections = await redis.zrangebyscore(presenceKey, now.getTime() - presenceWindowMs, now.getTime());
  const leadIds = new Set<string>();
  const byWebinar = new Map<string, number>();
  if (!connections.length) return { leadIds, byWebinar };
  const metadata = await redis.hmget(presenceMetadataKey, ...connections);
  for (const raw of metadata) {
    if (!raw) continue; // A connection can disappear between the two reads.
    try {
      const member: unknown = JSON.parse(raw);
      if (!member || typeof member !== "object" || !("leadId" in member) || !("webinarId" in member)
        || typeof member.leadId !== "string" || !member.leadId || typeof member.webinarId !== "string" || !member.webinarId
        || leadIds.has(member.leadId)) continue;
      leadIds.add(member.leadId);
      byWebinar.set(member.webinarId, (byWebinar.get(member.webinarId) ?? 0) + 1);
    } catch { /* Ignore invalid metadata, never manufacture a person from it. */ }
  }
  return { leadIds, byWebinar };
}

async function readWebinarOptions(database: Pick<PrismaClient, "webinar">, viewer: AccessUser): Promise<RealtimeWebinarOption[]> {
  // Match the main list's default scope: drafts and archived webinars remain
  // available, including a currently selected webinar in either state.
  const webinars = await database.webinar.findMany({
    where: ownerScope(viewer),
    select: { id: true, title: true, name: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return webinars.map(webinar => ({
    id: webinar.id,
    title: webinar.title?.trim() || webinar.name?.trim() || "Webinar",
  }));
}

/** Page-only navigation metadata. Polling snapshots never fetch this list. */
export async function getRealtimeSourceWebinars({ viewer, host }: {
  viewer: AccessUser;
  host: string | null;
}): Promise<RealtimeWebinarOption[]> {
  if (!viewer.id) throw new RealtimeSourceNotFoundError();
  try {
    const config = remoteConfig(host);
    if (!config) return await readWebinarOptions(prisma, viewer);
    if (!isAdminUser(viewer)) throw new RealtimeSourceNotFoundError();
    const { database } = remoteClients(config);
    return await database.$transaction(async transaction => {
      await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
      return readWebinarOptions(transaction, viewer);
    }, { isolationLevel: "RepeatableRead", maxWait: 5_000, timeout: 20_000 });
  } catch (error) {
    if (error instanceof RealtimeSourceNotFoundError) throw error;
    throw new RealtimeSourceUnavailableError();
  }
}

/** Authentication remains local. The selected source independently authorizes
 * the webinar before reading any metrics. No remote connection can write. */
export async function getRealtimeSourceSnapshot({ webinarId, viewer, host }: {
  webinarId: string;
  viewer: AccessUser;
  host: string | null;
}) {
  if (!viewer.id) throw new RealtimeSourceNotFoundError();
  try {
    const config = remoteConfig(host);
    if (!config) {
      const webinar = await prisma.webinar.findFirst({ where: { id: webinarId, ...ownerScope(viewer) }, select: { id: true } });
      if (!webinar) throw new RealtimeSourceNotFoundError();
      return await getWebinarRealtimeSnapshot(webinar.id);
    }
    // Local non-admin accounts cannot use local ownership to read production.
    if (!isAdminUser(viewer)) throw new RealtimeSourceNotFoundError();
    const { database, redis } = remoteClients(config);
    return await database.$transaction(async transaction => {
      await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
      const webinar = await transaction.webinar.findFirst({ where: { id: webinarId, ...ownerScope(viewer) }, select: { id: true } });
      if (!webinar) throw new RealtimeSourceNotFoundError();
      return getWebinarRealtimeSnapshot(webinar.id, {
        db: transaction,
        readOnline: now => readRemotePresence(redis, now),
        // Read-only previews do not collect remote staff leases. Local logins
        // must never be combined with remote counts or shown as remote presence.
        readAttendants: async () => undefined
      });
    }, { isolationLevel: "RepeatableRead", maxWait: 5_000, timeout: 20_000 });
  } catch (error) {
    if (error instanceof RealtimeSourceNotFoundError) throw error;
    // Do not let Prisma/ioredis errors leak URLs or credentials to HTML/JSON/logs.
    throw new RealtimeSourceUnavailableError();
  }
}
