import { describe, it, expect, beforeAll, afterAll } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { analyze } from "../../src/stages/04-analyze.js";

let runDir: string;

beforeAll(async () => {
  runDir = await fs.mkdtemp(path.join(os.tmpdir(), "analyze-test-"));
  const dir = path.join(runDir, "replay", "api_webinars_1");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "requests.json"),
    JSON.stringify([
      {
        url: "https://api.example.com/api/webinars/1",
        method: "GET",
        status: 200,
        resourceType: "fetch",
        requestHeaders: {},
        requestBody: null,
        responseHeaders: { "content-type": "application/json" },
        responseBody: JSON.stringify({ id: 1, title: "Test", videoUrl: "x" }),
        timing: 100,
        truncated: false,
      },
      {
        url: "https://api.example.com/api/webinars/2",
        method: "GET",
        status: 200,
        resourceType: "fetch",
        requestHeaders: {},
        requestBody: null,
        responseHeaders: { "content-type": "application/json" },
        responseBody: JSON.stringify({ id: 2, title: "Other", videoUrl: "y" }),
        timing: 110,
        truncated: false,
      },
    ]),
  );
  await fs.writeFile(
    path.join(dir, "meta.json"),
    JSON.stringify({ route: "/api/webinars/1", url: "x", status: 200, requestCount: 2 }),
  );
});

afterAll(async () => {
  await fs.rm(runDir, { recursive: true, force: true });
});

describe("analyze stage", () => {
  it("groups requests by normalized path and infers schema", async () => {
    const result = await analyze({ runDir, runId: "test-run" });
    const ep = result.endpoints.find((e) => e.pathPattern === "/api/webinars/:id");
    expect(ep).toBeDefined();
    expect(ep!.method).toBe("GET");
    expect(ep!.samples).toBe(2);
    if (ep!.responseSchema.kind !== "object") throw new Error("expected object");
    expect(ep!.responseSchema.fields.id).toBeDefined();
    expect(ep!.responseSchema.fields.title).toBeDefined();
  });

  it("writes REPORT.md and analysis JSON files", async () => {
    await analyze({ runDir, runId: "test-run" });
    const report = await fs.readFile(path.join(runDir, "analysis", "REPORT.md"), "utf8");
    expect(report).toContain("# Capture Report — test-run");
    const endpoints = JSON.parse(await fs.readFile(path.join(runDir, "analysis", "endpoints.json"), "utf8"));
    expect(Array.isArray(endpoints)).toBe(true);
  });
});
