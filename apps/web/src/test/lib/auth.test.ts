import { describe, it, expect, beforeEach, vi } from "vitest";

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
    vi.resetModules();
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

  it("throws when BETTER_AUTH_SECRET is missing", async () => {
    delete process.env.BETTER_AUTH_SECRET;
    await expect(isolatedImport()).rejects.toThrow(/BETTER_AUTH_SECRET/);
  });

  it("throws when BETTER_AUTH_SECRET is the .env.example placeholder", async () => {
    process.env.BETTER_AUTH_SECRET = "change-me-32-chars-minimum-please";
    await expect(isolatedImport()).rejects.toThrow(/placeholder/i);
  });

  it("throws when BETTER_AUTH_SECRET is shorter than 32 chars", async () => {
    process.env.BETTER_AUTH_SECRET = "too-short";
    await expect(isolatedImport()).rejects.toThrow(/32 characters/);
  });

  it("throws when BETTER_AUTH_URL is missing", async () => {
    delete process.env.BETTER_AUTH_URL;
    await expect(isolatedImport()).rejects.toThrow(/BETTER_AUTH_URL/);
  });
});
