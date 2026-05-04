import { describe, it, expect, beforeEach } from "vitest";

function setEnv() {
  process.env.DATABASE_URL = "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public";
  process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-chars-long-okay";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
}

async function isolatedImport() {
  return import("@/lib/auth");
}

describe("auth instance", () => {
  beforeEach(() => {
    setEnv();
  });

  it("exports an auth object with handler and api", async () => {
    const { auth } = await isolatedImport();
    expect(auth).toBeDefined();
    expect(typeof auth.handler).toBe("function");
    expect(auth.api).toBeDefined();
  });

  it("exposes Session type via $Infer", async () => {
    const mod = await isolatedImport();
    expect(mod.auth.$Infer).toBeDefined();
  });
});
