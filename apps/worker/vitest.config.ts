import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/test/**/*.test.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public",
      REDIS_URL: "redis://localhost:6379",
      S3_ENDPOINT: "http://localhost:9000",
      S3_ACCESS_KEY: "test",
      S3_SECRET_KEY: "test-min-12chars",
      S3_BUCKET_ORIGINALS: "originals-private",
      S3_BUCKET_HLS: "hls-public",
      S3_PUBLIC_BASE_URL: "http://localhost:9000"
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
