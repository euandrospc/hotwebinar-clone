import { createServer } from "node:http";
import nextEnv from "@next/env";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
nextEnv.loadEnvConfig(process.cwd(), dev);

const portArg = process.argv.findIndex((arg) => arg === "-p" || arg === "--port");
const port = Number(portArg >= 0 ? process.argv[portArg + 1] : process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
const hostname = process.env.HOSTNAME_BIND || "0.0.0.0";

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
  await gateway.close();
  await closeRedis();
  await app.close();
  clearTimeout(timeout);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
