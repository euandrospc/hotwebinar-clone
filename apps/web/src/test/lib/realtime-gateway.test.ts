import { createServer, type Server as HttpServer } from "node:http";
import { once as nodeOnce, EventEmitter } from "node:events";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachRealtimeGateway } from "@/server/realtime/gateway";

const state = vi.hoisted(() => ({
  revoked: false,
  touch: vi.fn(async () => true), remove: vi.fn(async () => {}),
  subscriber: null as unknown as EventEmitter & { status: string; subscribe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> },
  redis: null as unknown as EventEmitter & { status: string }
}));
vi.mock("@/server/realtime/redis", async () => {
  const { EventEmitter } = await import("node:events");
  state.subscriber = Object.assign(new EventEmitter(), { status: "ready", subscribe: vi.fn(async () => 1), disconnect: vi.fn() });
  state.redis = Object.assign(new EventEmitter(), { status: "ready", ping: vi.fn(async () => "PONG") });
  return { createRedisSubscriber: () => state.subscriber, getRedis: () => state.redis };
});
vi.mock("@/server/realtime/bus", () => ({
  flushPresenceEvents: vi.fn(async () => {}),
  realtimeChannel: () => "events",
  parseRealtimeEnvelope: (raw: string) => JSON.parse(raw)
}));
vi.mock("@/server/realtime/presence", () => ({
  prunePresence: vi.fn(async () => {}), touchPresence: state.touch, removePresence: state.remove
}));
vi.mock("@/server/realtime/auth", async (original) => {
  const actual = await original<typeof import("@/server/realtime/auth")>();
  return {
    ...actual,
    authenticateRealtime: vi.fn(async (headers, scope) => {
      if (state.revoked) return null;
      if (scope.kind === "staff" && headers.cookie === "staff=yes") return { kind: "staff", userId: "staff", rooms: ["staff"] };
      if (scope.kind === "lead" && headers.cookie?.startsWith("lead=")) {
        const leadId = headers.cookie.slice(5);
        return { kind: "lead", leadId, webinarId: "w1", rooms: [`lead:${leadId}`] };
      }
      return null;
    })
  };
});

let http: HttpServer;
let gateway: ReturnType<typeof attachRealtimeGateway>;
let url: string;
let clients: Socket[] = [];

beforeEach(async () => {
  vi.clearAllMocks();
  state.revoked = false;
  state.subscriber.removeAllListeners();
  state.redis.removeAllListeners();
  state.subscriber.status = "ready";
  state.redis.status = "ready";
  http = createServer();
  gateway = attachRealtimeGateway(http, { authorizationIntervalMs: 100, presenceCleanupMs: 100 });
  http.listen(0, "127.0.0.1");
  await nodeOnce(http, "listening");
  url = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
});
afterEach(async () => {
  clients.forEach((client) => client.disconnect());
  clients = [];
  await gateway.close();
});

function client(cookie: string, scope: object = { kind: "lead" }, origin: string | null = url) {
  const socket = connect(url, {
    transports: ["websocket"], auth: { scope }, reconnection: false, forceNew: true,
    extraHeaders: { Cookie: cookie, ...(origin ? { Origin: origin } : {}) }
  });
  clients.push(socket);
  return socket;
}

function socketEvent(socket: Socket, event: string, predicate?: (value: unknown) => boolean): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, listener); reject(new Error(`Timed out waiting for ${event}`)); }, 3_000);
    function listener(...args: unknown[]) {
      if (predicate && !predicate(args[0])) return;
      clearTimeout(timer);
      socket.off(event, listener);
      resolve(args);
    }
    socket.on(event, listener);
  });
}

describe("WebSocket gateway", () => {
  it("requires same-origin connections and authenticated scopes", async () => {
    const foreign = client("lead=l1", { kind: "lead" }, "https://evil.example");
    await socketEvent(foreign, "connect_error");
    expect(foreign.connected).toBe(false);
    const missing = client("lead=l1", { kind: "lead" }, null);
    await socketEvent(missing, "connect_error");
    const unauthenticated = client("", { kind: "staff" });
    await socketEvent(unauthenticated, "connect_error");
    expect(unauthenticated.connected).toBe(false);
  });

  it("delivers persisted events to the intended lead and staff without leaking to another lead", async () => {
    const first = client("lead=l1");
    const second = client("lead=l2");
    const staff = client("staff=yes", { kind: "staff" });
    await Promise.all([socketEvent(first, "connect"), socketEvent(second, "connect"), socketEvent(staff, "connect")]);
    const secondEvents: unknown[] = [];
    second.on("realtime:event", (event) => { if (event.type === "chat") secondEvents.push(event); });
    const receivedFirst = socketEvent(first, "realtime:event", (event) => (event as { type: string }).type === "chat");
    const receivedStaff = socketEvent(staff, "realtime:event", (event) => (event as { type: string }).type === "chat");
    const event = { type: "chat", leadId: "l1", webinarId: "w1", message: { id: "m1", text: "Private" } };
    state.subscriber.emit("message", "events", JSON.stringify({ rooms: ["lead:l1", "staff"], event }));
    expect((await receivedFirst)[0]).toEqual(event);
    expect((await receivedStaff)[0]).toEqual(event);
    expect(secondEvents).toEqual([]);
  });

  it("uses the authenticated lead for presence and clears its connection on disconnect", async () => {
    const socket = client("lead=l1");
    await socketEvent(socket, "connect");
    const connectionId = socket.id;
    socket.emit("presence:heartbeat", { playing: true, leadId: "forged" });
    await vi.waitFor(() => expect(state.touch).toHaveBeenCalledWith("l1", "w1", connectionId));
    socket.emit("presence:heartbeat", { playing: true });
    expect(state.touch).toHaveBeenCalledTimes(1);
    socket.disconnect();
    await vi.waitFor(() => expect(state.remove).toHaveBeenCalledWith("l1", connectionId));
  });

  it("disconnects sessions revoked after connection", async () => {
    const socket = client("staff=yes", { kind: "staff" });
    await socketEvent(socket, "connect");
    const disconnected = socketEvent(socket, "disconnect");
    state.revoked = true;
    await disconnected;
    expect(socket.connected).toBe(false);
  });

  it("announces fallback when Redis disconnects and resync after recovery", async () => {
    const socket = client("lead=l1");
    await socketEvent(socket, "connect");
    const unavailable = socketEvent(socket, "realtime:unavailable");
    state.subscriber.status = "reconnecting";
    state.subscriber.emit("close");
    await unavailable;
    const recovered = socketEvent(socket, "realtime:event");
    state.subscriber.status = "ready";
    state.subscriber.emit("ready");
    expect((await recovered)[0]).toEqual({ type: "resync" });
  });
});
