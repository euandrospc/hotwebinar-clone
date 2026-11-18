import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  localWebinar: vi.fn(), remoteWebinar: vi.fn(), execute: vi.fn(), transaction: vi.fn(),
  localWebinars: vi.fn(), remoteWebinars: vi.fn(),
  prismaConstructor: vi.fn(), redisConstructor: vi.fn(), disconnect: vi.fn(),
  ready: vi.fn(), zrange: vi.fn(), hmget: vi.fn(), snapshot: vi.fn()
}));
vi.mock("db", () => ({
  prisma: { webinar: { findFirst: mocks.localWebinar, findMany: mocks.localWebinars } },
  PrismaClient: class {
    constructor(options: unknown) { mocks.prismaConstructor(options); }
    $transaction = mocks.transaction;
    $disconnect = mocks.disconnect;
  }
}));
vi.mock("ioredis", () => ({ default: class {
  constructor(url: string, options: unknown) { mocks.redisConstructor(url, options); }
  on() { return this; }
  disconnect() {}
  zrangebyscore = mocks.zrange;
  hmget = mocks.hmget;
} }));
vi.mock("@/server/realtime/redis", () => ({ waitForRedisReady: mocks.ready }));
vi.mock("@/server/webinar-realtime-v5", () => ({ getWebinarRealtimeSnapshot: mocks.snapshot }));

const now = new Date("2026-11-17T23:00:00.000Z");
const transaction = { $executeRaw: mocks.execute, webinar: { findFirst: mocks.remoteWebinar, findMany: mocks.remoteWebinars } };
const input = { webinarId: "remote-webinar", viewer: { id: "local-admin", role: "admin" }, host: "localhost:3010" };
const source = () => import("@/server/realtime-source-v5");

beforeEach(() => {
  vi.resetModules();
  for (const fn of Object.values(mocks)) fn.mockReset();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("REALTIME_READONLY_DATABASE_URL", "postgresql://readonly:fake@db.example/app");
  vi.stubEnv("REALTIME_READONLY_REDIS_URL", "redis://:fake@redis.example:6379");
  mocks.localWebinar.mockResolvedValue({ id: input.webinarId });
  mocks.remoteWebinar.mockResolvedValue({ id: input.webinarId });
  mocks.localWebinars.mockResolvedValue([]);
  mocks.remoteWebinars.mockResolvedValue([]);
  mocks.execute.mockResolvedValue(0);
  mocks.disconnect.mockResolvedValue(undefined);
  mocks.ready.mockResolvedValue(true);
  mocks.zrange.mockResolvedValue([]);
  mocks.hmget.mockResolvedValue([]);
  mocks.transaction.mockImplementation(async callback => callback(transaction));
  mocks.snapshot.mockImplementation(async (_id, dependencies) => {
    const online = dependencies ? await dependencies.readOnline(now) : { leadIds: new Set(), byWebinar: new Map() };
    return { updatedAt: now.toISOString(), online: online.leadIds.size, byWebinar: online.byWebinar,
      attendants: dependencies ? await dependencies.readAttendants({ webinarId: input.webinarId, from: now, to: now }) : undefined };
  });
});

describe("realtime page webinar options", () => {
  const selectedFields = { id: true, title: true, name: true };
  const orderBy = [{ createdAt: "desc" }, { id: "asc" }];

  it("lists only locally owned webinars for a non-admin, including all statuses", async () => {
    vi.stubEnv("REALTIME_READONLY_DATABASE_URL", "");
    vi.stubEnv("REALTIME_READONLY_REDIS_URL", "");
    mocks.localWebinars.mockResolvedValue([
      { id: "draft", title: " Draft title ", name: "Internal draft" },
      { id: "archived", title: " ", name: " Archived name " },
      { id: "unnamed", title: null, name: " " },
    ]);
    const result = await (await source()).getRealtimeSourceWebinars({ viewer: { id: "owner", role: "owner" }, host: input.host });
    expect(mocks.localWebinars).toHaveBeenCalledWith({ where: { ownerId: "owner" }, select: selectedFields, orderBy });
    expect(result).toEqual([
      { id: "draft", title: "Draft title" }, { id: "archived", title: "Archived name" }, { id: "unnamed", title: "Webinar" },
    ]);
    expect(mocks.prismaConstructor).not.toHaveBeenCalled();
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });

  it("lists remote admin options read-only and never uses local metadata or metric polling", async () => {
    mocks.remoteWebinars.mockResolvedValue([{ id: "remote", title: "Production title", name: "Internal" }]);
    const result = await (await source()).getRealtimeSourceWebinars(input);
    expect(result).toEqual([{ id: "remote", title: "Production title" }]);
    expect(mocks.remoteWebinars).toHaveBeenCalledWith({ where: {}, select: selectedFields, orderBy });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead", maxWait: 5_000, timeout: 20_000 });
    expect(mocks.execute.mock.calls[0][0].join("")).toBe("SET TRANSACTION READ ONLY");
    expect(mocks.execute.mock.invocationCallOrder[0]).toBeLessThan(mocks.remoteWebinars.mock.invocationCallOrder[0]);
    expect(mocks.localWebinars).not.toHaveBeenCalled();
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.zrange).not.toHaveBeenCalled();
  });

  it("denies missing users and local non-admins before exposing remote options", async () => {
    const provider = await source();
    await expect(provider.getRealtimeSourceWebinars({ ...input, viewer: { id: "" } })).rejects.toBeInstanceOf(provider.RealtimeSourceNotFoundError);
    await expect(provider.getRealtimeSourceWebinars({ ...input, viewer: { id: "ordinary-user", role: "owner" } })).rejects.toBeInstanceOf(provider.RealtimeSourceNotFoundError);
    expect(mocks.prismaConstructor).not.toHaveBeenCalled();
    expect(mocks.localWebinars).not.toHaveBeenCalled();
    expect(mocks.remoteWebinars).not.toHaveBeenCalled();
  });

  it.each([
    ["production", "localhost:3010"],
    ["development", "public.example"],
  ])("ignores remote configuration for page options in %s on %s", async (nodeEnv, host) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    await (await source()).getRealtimeSourceWebinars({ ...input, host });
    expect(mocks.localWebinars).toHaveBeenCalledWith({ where: {}, select: selectedFields, orderBy });
    expect(mocks.remoteWebinars).not.toHaveBeenCalled();
    expect(mocks.prismaConstructor).not.toHaveBeenCalled();
  });

  it("sanitizes option failures without silently selecting another source", async () => {
    const provider = await source();
    mocks.remoteWebinars.mockRejectedValue(new Error("Failed postgresql://secret@provider"));
    await expect(provider.getRealtimeSourceWebinars(input)).rejects.toEqual(new provider.RealtimeSourceUnavailableError());
    expect(mocks.localWebinars).not.toHaveBeenCalled();
    vi.stubEnv("REALTIME_READONLY_REDIS_URL", "");
    await expect(provider.getRealtimeSourceWebinars(input)).rejects.toEqual(new provider.RealtimeSourceUnavailableError());
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("realtime operational read-only source", () => {
  it("opens a repeatable-read transaction and makes it read-only before authorizing or reading metrics", async () => {
    const { getRealtimeSourceSnapshot } = await source();
    await getRealtimeSourceSnapshot(input);
    expect(mocks.prismaConstructor).toHaveBeenCalledWith({ datasources: { db: { url: "postgresql://readonly:fake@db.example/app" } }, log: [] });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead", maxWait: 5_000, timeout: 20_000 });
    expect(mocks.execute.mock.calls[0][0].join("")).toBe("SET TRANSACTION READ ONLY");
    expect(mocks.execute.mock.invocationCallOrder[0]).toBeLessThan(mocks.remoteWebinar.mock.invocationCallOrder[0]);
    expect(mocks.remoteWebinar).toHaveBeenCalledWith({ where: { id: input.webinarId }, select: { id: true } });
    expect(mocks.snapshot).toHaveBeenCalledWith(input.webinarId, expect.objectContaining({ db: transaction }));
    expect(mocks.localWebinar).not.toHaveBeenCalled();
  });

  it("reads only active leases at the frozen cutoff, deduplicating tabs and preserving webinar counts", async () => {
    mocks.zrange.mockResolvedValue(["a-tab1", "a-tab2", "b-tab", "invalid", "gone"]);
    mocks.hmget.mockResolvedValue([
      JSON.stringify({ leadId: "a", webinarId: "one" }), JSON.stringify({ leadId: "a", webinarId: "one" }),
      JSON.stringify({ leadId: "b", webinarId: "two" }), "not-json", null
    ]);
    const result = await (await source()).getRealtimeSourceSnapshot(input);
    expect(mocks.ready).toHaveBeenCalledWith(expect.anything(), 2_000);
    expect(mocks.zrange).toHaveBeenCalledWith("hotwebinar:realtime:v1:presence", now.getTime() - 45_000, now.getTime());
    expect(mocks.hmget).toHaveBeenCalledWith("hotwebinar:realtime:v1:presence-metadata", "a-tab1", "a-tab2", "b-tab", "invalid", "gone");
    expect(result.online).toBe(2);
    expect((result as unknown as { byWebinar: Map<string, number> }).byWebinar).toEqual(new Map([["one", 1], ["two", 1]]));
    expect(result.attendants).toBeUndefined();
  });

  it.each(["production", "test"])("ignores operational credentials in %s", async nodeEnv => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    await (await source()).getRealtimeSourceSnapshot({ ...input, viewer: { id: "owner", role: "owner" } });
    expect(mocks.localWebinar).toHaveBeenCalledWith({ where: { id: input.webinarId, ownerId: "owner" }, select: { id: true } });
    expect(mocks.snapshot).toHaveBeenCalledWith(input.webinarId);
    expect(mocks.prismaConstructor).not.toHaveBeenCalled();
    expect(mocks.redisConstructor).not.toHaveBeenCalled();
  });

  it.each([null, "example.com", "localhost.example.com", "localhost:3010@example.com", "127.0.0.2", "localhost."])("does not enable remote data on an external or invalid host %s", async host => {
    await (await source()).getRealtimeSourceSnapshot({ ...input, host });
    expect(mocks.localWebinar).toHaveBeenCalled();
    expect(mocks.prismaConstructor).not.toHaveBeenCalled();
  });

  it.each(["127.0.0.1:3010", "[::1]:3010"])("accepts the exact loopback host %s", async host => {
    await (await source()).getRealtimeSourceSnapshot({ ...input, host });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.localWebinar).not.toHaveBeenCalled();
  });

  it("uses the ordinary source when neither operational credential is configured", async () => {
    vi.stubEnv("REALTIME_READONLY_DATABASE_URL", "");
    vi.stubEnv("REALTIME_READONLY_REDIS_URL", "");
    await (await source()).getRealtimeSourceSnapshot(input);
    expect(mocks.localWebinar).toHaveBeenCalled();
    expect(mocks.prismaConstructor).not.toHaveBeenCalled();
  });

  it("does not fall back to empty local data when operational configuration is incomplete", async () => {
    vi.stubEnv("REALTIME_READONLY_REDIS_URL", "");
    const provider = await source();
    await expect(provider.getRealtimeSourceSnapshot(input)).rejects.toBeInstanceOf(provider.RealtimeSourceUnavailableError);
    expect(mocks.localWebinar).not.toHaveBeenCalled();
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });

  it("denies local non-admins and missing remote webinars without reading metric data", async () => {
    const provider = await source();
    await expect(provider.getRealtimeSourceSnapshot({ ...input, viewer: { id: "ordinary-user", role: "owner" } })).rejects.toBeInstanceOf(provider.RealtimeSourceNotFoundError);
    expect(mocks.prismaConstructor).not.toHaveBeenCalled();
    mocks.remoteWebinar.mockResolvedValue(null);
    await expect(provider.getRealtimeSourceSnapshot(input)).rejects.toBeInstanceOf(provider.RealtimeSourceNotFoundError);
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.zrange).not.toHaveBeenCalled();
  });

  it("does not show zero presence on connection failure and strips underlying provider details", async () => {
    const provider = await source();
    mocks.ready.mockResolvedValue(false);
    await expect(provider.getRealtimeSourceSnapshot(input)).rejects.toThrow("Realtime data source unavailable");
    expect(mocks.zrange).not.toHaveBeenCalled();
    mocks.ready.mockResolvedValue(true);
    mocks.zrange.mockRejectedValue(new Error("Connection failed redis://secret@provider"));
    await expect(provider.getRealtimeSourceSnapshot(input)).rejects.toEqual(new provider.RealtimeSourceUnavailableError());
    mocks.transaction.mockRejectedValue(new Error("Failed postgresql://secret@provider"));
    await expect(provider.getRealtimeSourceSnapshot(input)).rejects.toEqual(new provider.RealtimeSourceUnavailableError());
  });

  it("reuses the dedicated clients without reconnecting every poll", async () => {
    const provider = await source();
    await provider.getRealtimeSourceSnapshot(input);
    await provider.getRealtimeSourceSnapshot(input);
    expect(mocks.prismaConstructor).toHaveBeenCalledOnce();
    expect(mocks.redisConstructor).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });
});
