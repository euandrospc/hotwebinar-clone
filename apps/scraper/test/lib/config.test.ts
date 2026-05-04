import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

const REQUIRED = ["TARGET_BASE_URL", "TARGET_LOGIN_EMAIL", "TARGET_LOGIN_PASSWORD"];

async function isolatedImport() {
  vi.resetModules();
  return import("../../src/config.ts");
}

describe("config", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of REQUIRED) {
      saved[k] = process.env[k];
      process.env[k] = `value-for-${k}`;
    }
    process.env.MAX_PAGES = "42";
  });

  afterEach(() => {
    for (const k of REQUIRED) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    delete process.env.MAX_PAGES;
  });

  it("exposes required env values", async () => {
    const { config } = await isolatedImport();
    expect(config.baseUrl).toBe("value-for-TARGET_BASE_URL");
    expect(config.email).toBe("value-for-TARGET_LOGIN_EMAIL");
    expect(config.password).toBe("value-for-TARGET_LOGIN_PASSWORD");
  });

  it("parses optional numeric overrides with defaults", async () => {
    const { config } = await isolatedImport();
    expect(config.maxPages).toBe(42);
    expect(config.maxDepth).toBe(3);
    expect(config.crawlDelayMs).toBe(500);
  });

  it("generates iso-stamp run ids", async () => {
    const { newRunId } = await isolatedImport();
    const id = newRunId();
    expect(id).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
  });

  it("throws on missing required env", async () => {
    delete process.env.TARGET_BASE_URL;
    await expect(isolatedImport()).rejects.toThrow(/TARGET_BASE_URL/);
  });
});
