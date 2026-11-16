/** @type {import('next').NextConfig} */
const nextConfig = {
  // No "output: standalone": the Dockerfile copies the whole /app tree into the
  // runner and launches with `next start`, which is incompatible with standalone
  // output (Next logs a warning and can serve a stale/incorrect build). Plain
  // build + `next start` over the copied tree is what this deploy actually uses.
  transpilePackages: ["db", "jobs"],
  // BullMQ loads Lua scripts and optional native modules at runtime.
  serverExternalPackages: ["bullmq", "ioredis"],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" }
  }
};

export default nextConfig;
