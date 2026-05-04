import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/test/**/*.test.ts"],
    // Default env values for tests. Tests can still override or delete these
    // in beforeEach (e.g. auth.test.ts deletes BETTER_AUTH_SECRET to test
    // the negative path). These defaults exist so module-load-time env
    // validation (Prisma, Better Auth) doesn't fail before beforeEach runs.
    env: {
      DATABASE_URL: "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public",
      BETTER_AUTH_SECRET: "test-secret-at-least-32-chars-long-okay",
      BETTER_AUTH_URL: "http://localhost:3000"
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
