import { defineConfig, devices } from "@playwright/test";

const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "test-password-min-12";

export default defineConfig({
  testDir: "./src/test/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure"
  },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "e2e-test-secret-at-least-32-chars-long-okay",
      BETTER_AUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_BETTER_AUTH_URL: "http://localhost:3000",
      SEED_ADMIN_EMAIL: E2E_ADMIN_EMAIL,
      SEED_ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
      SEED_ADMIN_NAME: "E2E Admin"
    }
  }
});
