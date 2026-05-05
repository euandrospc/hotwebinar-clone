import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [
      ["src/test/components/**", "jsdom"]
    ],
    include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    fileParallelism: false,
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
