import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startFixtureServer, type FixtureServer } from "../fixtures/server.js";
import { crawl } from "../../src/stages/03-crawl.js";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

let server: FixtureServer;
let outDir: string;

beforeAll(async () => {
  server = await startFixtureServer();
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), "crawl-test-"));
});

afterAll(async () => {
  await server.close();
  await fs.rm(outDir, { recursive: true, force: true });
});

describe("crawl stage", () => {
  it("discovers sidebar routes and dedupes", async () => {
    const result = await crawl({
      baseUrl: server.url,
      startRoute: "/dashboard",
      sidebarSelector: "aside a",
      maxDepth: 3,
      maxPages: 50,
      crawlDelayMs: 0,
      bodyMaxChars: 200_000,
      outDir,
    });
    const paths = result.discovered.map((d) => d.path).sort();
    expect(paths).toContain("/dashboard");
    expect(paths).toContain("/webinars");
    expect(paths).toContain("/leads");
    expect(paths).toContain("/settings");
    // /dashboard is duplicated in the fixture sidebar — must be deduped to 1
    const dupes = paths.filter((p) => p === "/dashboard");
    expect(dupes.length).toBe(1);
  });

  it("respects maxPages", async () => {
    const result = await crawl({
      baseUrl: server.url,
      startRoute: "/dashboard",
      sidebarSelector: "aside a",
      maxDepth: 3,
      maxPages: 2,
      crawlDelayMs: 0,
      bodyMaxChars: 200_000,
      outDir,
    });
    expect(result.discovered.length).toBeLessThanOrEqual(2);
  });
});
