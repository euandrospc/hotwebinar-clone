import cluster from "node:cluster";
import { createServer } from "node:http";
import { availableParallelism } from "node:os";
import nextEnv from "@next/env";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
nextEnv.loadEnvConfig(process.cwd(), dev);

const portArg = process.argv.findIndex((arg) => arg === "-p" || arg === "--port");
const port = Number(portArg >= 0 ? process.argv[portArg + 1] : process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
const hostname = process.env.HOSTNAME_BIND || "0.0.0.0";

// One Node process saturates a single core during a live; fork one HTTP worker per core instead.
// Realtime events and presence go through Redis, so workers need no sticky sessions.
const concurrency = dev ? 1 : Math.max(1, Math.trunc(Number(process.env.WEB_CONCURRENCY)) || Math.min(4, availableParallelism()));
if (cluster.isPrimary && concurrency > 1) {
  // Round-robin is Linux's default; set it so Windows doesn't pile connections on one worker.
  cluster.schedulingPolicy = cluster.SCHED_RR;
  let stopping = false;
  // The first worker also runs the interval jobs (AI replies, audience samples, GeoIP, webhooks) so they don't multiply.
  const fork = (background: boolean) => {
    const worker = cluster.fork({ BRAVY_BACKGROUND_WORKERS: background ? "1" : "0" });
    worker.on("exit", (code, signal) => {
      if (stopping) return;
      console.error(`Web worker ${worker.process.pid} exited (${signal || code}); starting a new one.`);
      setTimeout(() => fork(background), 1_000).unref();
    });
  };
  for (let i = 0; i < concurrency; i++) fork(i === 0);
  console.info(`Bravy Lives starting ${concurrency} web workers on port ${port}`);
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    setTimeout(() => process.exit(1), 12_000).unref();
    for (const worker of Object.values(cluster.workers ?? {})) worker?.process.kill("SIGTERM");
    cluster.on("exit", () => { if (!Object.keys(cluster.workers ?? {}).length) process.exit(0); });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  // The primary only supervises workers; never fall through to the server code below.
  await new Promise<never>(() => {});
}
const runBackgroundJobs = cluster.isPrimary || process.env.BRAVY_BACKGROUND_WORKERS === "1";

// Load modules that read secrets only after Next's environment files are loaded.
const { attachRealtimeGateway } = await import("./src/server/realtime/gateway");
const { closeRedis } = await import("./src/server/realtime/redis");
const app = next({ dev, hostname, port });
await app.prepare();
const handler = app.getRequestHandler();
const upgrade = app.getUpgradeHandler();
const server = createServer((request, response) => {
  void handler(request, response).catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end("Internal server error");
  });
});
const gateway = attachRealtimeGateway(server);
const { startAttendanceAiWorker } = await import("./src/server/attendance/ai");
const stopAttendanceAi = runBackgroundJobs ? startAttendanceAiWorker() : () => {};
const { startAudienceRecorder } = await import("./src/server/audience-history");
const stopAudienceRecorder = runBackgroundJobs ? startAudienceRecorder() : () => {};
const { startGeoIpWorker } = await import("./src/server/geoip-worker");
const stopGeoIpWorker = runBackgroundJobs ? startGeoIpWorker() : async () => {};
const { startWebhookWorker, closeWebhookQueue } = await import("jobs");
const { deliverWebhook } = await import("./src/server/webhook-delivery");
const stopWebhookWorker = runBackgroundJobs ? startWebhookWorker(deliverWebhook) : async () => {};
server.on("upgrade", (request, socket, head) => {
  if (!request.url?.startsWith("/socket.io/")) void upgrade(request, socket, head);
});

server.listen(port, hostname, () => {
  console.info(`Bravy Lives listening on http://localhost:${port} (WebSocket enabled)`);
});
server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(`Web server failed: ${error.code || "unknown"}`);
  process.exit(1);
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  stopAttendanceAi();
  stopAudienceRecorder();
  await stopGeoIpWorker();
  await stopWebhookWorker();
  await closeWebhookQueue();
  await gateway.close();
  await closeRedis();
  await app.close();
  clearTimeout(timeout);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
