import { defineConfig } from "@trigger.dev/sdk/v3";
import { ffmpeg } from "@trigger.dev/build/extensions/core";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "proj_rtkavlxxpignxohjklfu",
  runtime: "node",
  logLevel: "log",
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true
    }
  },
  dirs: ["./src/trigger"],
  build: {
    extensions: [
      ffmpeg({ version: "7" }),
      prismaExtension({
        mode: "legacy",
        schema: "../../packages/db/prisma/schema.prisma",
        version: "5.22.0",
        migrate: false
      })
    ]
  }
});
