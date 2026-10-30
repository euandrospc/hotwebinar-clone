import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { authenticateRealtime, isAllowedRealtimeOrigin, validRealtimeScope, type RealtimeIdentity } from "./auth";
import { createRedisSubscriber, getRedis } from "./redis";
import { flushPresenceEvents, parseRealtimeEnvelope, realtimeChannel } from "./bus";
import { prunePresence, removePresence, touchPresence } from "./presence";

export function attachRealtimeGateway(httpServer: HttpServer, options: { authorizationIntervalMs?: number; presenceCleanupMs?: number } = {}) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    transports: ["websocket"],
    serveClient: false,
    maxHttpBufferSize: 4_096,
    pingInterval: 20_000,
    pingTimeout: 20_000,
    // The custom Next server forwards its own HMR upgrades separately.
    destroyUpgrade: false,
    allowRequest: (request, callback) => callback(null, isAllowedRealtimeOrigin(request.headers.origin, request.headers.host))
  });
  const subscriber = createRedisSubscriber();
  const redis = getRedis();
  let available = false;
  let subscribed = false;
  let closed = false;
  let refreshing = false;
  let pruning = false;

  function setAvailable(next: boolean) {
    if (closed || next === available) return;
    available = next;
    if (next) io.emit("realtime:event", { type: "resync" });
    else io.emit("realtime:unavailable");
  }

  async function subscribe() {
    if (!subscriber || subscriber.status !== "ready") return;
    try {
      await subscriber.subscribe(realtimeChannel());
      subscribed = true;
      setAvailable(redis?.status === "ready");
    } catch { subscribed = false; setAvailable(false); }
  }

  subscriber?.on("ready", () => void subscribe());
  const onSubscriberUnavailable = () => { subscribed = false; setAvailable(false); };
  subscriber?.on("close", onSubscriberUnavailable);
  subscriber?.on("error", onSubscriberUnavailable);
  redis?.on("ready", subscribe);
  const onRedisUnavailable = () => setAvailable(false);
  redis?.on("close", onRedisUnavailable);
  redis?.on("error", onRedisUnavailable);
  if (subscriber?.status === "ready") void subscribe();

  subscriber?.on("message", (channel, raw) => {
    if (channel !== realtimeChannel()) return;
    const envelope = parseRealtimeEnvelope(raw);
    if (envelope) io.to(envelope.rooms).emit("realtime:event", envelope.event);
  });

  io.use(async (socket, next) => {
    const scope: unknown = socket.handshake.auth?.scope;
    if (!validRealtimeScope(scope)) return next(new Error("unauthorized"));
    try {
      const identity = await authenticateRealtime(socket.request.headers, scope);
      if (!identity) return next(new Error("unauthorized"));
      socket.data.identity = identity;
      socket.data.scope = scope;
      next();
    } catch { next(new Error("unavailable")); }
  });

  io.on("connection", (socket) => {
    const identity: RealtimeIdentity = socket.data.identity;
    let playing = false;
    let writingPresence = false;
    let revision = 0;
    let lastHeartbeat = 0;
    void socket.join(identity.rooms);
    if (!available) socket.emit("realtime:unavailable");
    else socket.emit("realtime:event", { type: "resync" });

    async function syncPresence() {
      if (identity.kind !== "lead" || writingPresence) return;
      writingPresence = true;
      try {
        let applied: number;
        do {
          applied = revision;
          if (playing && socket.connected) await touchPresence(identity.leadId, identity.webinarId, socket.id);
          else await removePresence(identity.leadId, socket.id);
        } while (applied !== revision);
      } finally { writingPresence = false; }
    }

    socket.on("presence:heartbeat", (input: unknown) => {
      if (identity.kind !== "lead" || !input || typeof input !== "object") return;
      const nextPlaying = (input as { playing?: unknown }).playing;
      if (typeof nextPlaying !== "boolean") return;
      if (nextPlaying && playing && Date.now() - lastHeartbeat < 5_000) return;
      playing = nextPlaying;
      lastHeartbeat = playing ? Date.now() : 0;
      revision += 1;
      void syncPresence();
    });

    socket.on("disconnect", () => {
      playing = false;
      revision += 1;
      void syncPresence();
    });
  });

  const cleanup = setInterval(async () => {
    if (pruning || closed) return;
    pruning = true;
    try {
      if (!redis || redis.status !== "ready" || !subscribed) { setAvailable(false); return; }
      // A TCP socket can remain open during a network stall. Confirm the bus is
      // responsive instead of reporting a healthy realtime channel indefinitely.
      await redis.ping();
      setAvailable(true);
      await prunePresence();
      await flushPresenceEvents();
    } catch { setAvailable(false); }
    finally { pruning = false; }
  }, options.presenceCleanupMs ?? 2_000);
  cleanup.unref();

  const authorization = setInterval(async () => {
    if (refreshing || closed) return;
    refreshing = true;
    try {
      await Promise.all([...io.sockets.sockets.values()].map(async (socket) => {
        try {
          const identity = await authenticateRealtime(socket.request.headers, socket.data.scope);
          if (!identity || JSON.stringify(identity.rooms) !== JSON.stringify(socket.data.identity.rooms)) {
            socket.emit("realtime:unauthorized");
            socket.disconnect(true);
          }
        } catch {
          // Fail closed if access can no longer be verified.
          socket.emit("realtime:unavailable");
          socket.disconnect(true);
        }
      }));
    } finally { refreshing = false; }
  }, options.authorizationIntervalMs ?? 30_000);
  authorization.unref();

  return {
    io,
    async close() {
      closed = true;
      clearInterval(cleanup);
      clearInterval(authorization);
      redis?.off("ready", subscribe);
      redis?.off("close", onRedisUnavailable);
      redis?.off("error", onRedisUnavailable);
      subscriber?.disconnect();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    }
  };
}
