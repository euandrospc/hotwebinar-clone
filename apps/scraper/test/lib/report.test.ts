import { describe, it, expect } from "vitest";
import { buildReport, type Analysis } from "../../src/lib/report.js";

const analysis: Analysis = {
  runId: "2026-05-03T10-00-00",
  endpoints: [
    {
      method: "GET",
      pathPattern: "/api/webinars/:id",
      samples: 2,
      statusCodes: [200, 404],
      requestBodySchema: { kind: "unknown" },
      responseSchema: {
        kind: "object",
        fields: {
          id: { kind: "primitive", type: "string", optional: false, nullable: false },
          title: { kind: "primitive", type: "string", optional: false, nullable: false },
        },
      },
    },
  ],
  entities: {
    Webinar: {
      kind: "object",
      fields: {
        id: { kind: "primitive", type: "string", optional: false, nullable: false },
      },
    },
  },
  pages: [
    { route: "/dashboard", url: "https://x/dashboard", status: 200, requestCount: 12, screenshot: "dashboard/screenshot.png" },
  ],
};

describe("report builder", () => {
  it("includes the run id in the title", () => {
    const md = buildReport(analysis);
    expect(md).toContain("# Capture Report — 2026-05-03T10-00-00");
  });

  it("renders the endpoints table", () => {
    const md = buildReport(analysis);
    expect(md).toContain("| Method | Path | Samples | Status codes |");
    expect(md).toContain("| GET | `/api/webinars/:id` | 2 | 200, 404 |");
  });

  it("renders entities as code blocks", () => {
    const md = buildReport(analysis);
    expect(md).toMatch(/### `Webinar`[\s\S]+id:\s*string/);
  });

  it("renders the pages table", () => {
    const md = buildReport(analysis);
    expect(md).toContain("| Route | Status | Requests | Screenshot |");
    expect(md).toContain("| `/dashboard` | 200 | 12 | `dashboard/screenshot.png` |");
  });

  it("renders empty arrays as sentinel lines", () => {
    const md = buildReport({ runId: "x", endpoints: [], entities: {}, pages: [] });
    expect(md).toContain("_No endpoints captured._");
    expect(md).toContain("_No entities captured._");
    expect(md).toContain("_No pages captured._");
    expect(md).not.toContain("| Method |");
  });

  it("escapes pipe characters in path pattern", () => {
    const md = buildReport({
      runId: "x",
      endpoints: [{
        method: "GET",
        pathPattern: "/api/items?filter=a|b",
        samples: 1,
        statusCodes: [200],
        requestBodySchema: { kind: "unknown" },
        responseSchema: { kind: "unknown" },
      }],
      entities: {},
      pages: [],
    });
    expect(md).toContain("/api/items?filter=a\\|b");
  });

  it("renders nullable primitive with proper spacing", () => {
    const md = buildReport({
      runId: "x",
      endpoints: [],
      entities: {
        Webinar: {
          kind: "object",
          fields: {
            title: { kind: "primitive", type: "string", optional: false, nullable: true },
          },
        },
      },
      pages: [],
    });
    expect(md).toContain("title: string | null");
  });

  it("renders nullable object schema", () => {
    const md = buildReport({
      runId: "x",
      endpoints: [],
      entities: {
        Wrapper: {
          kind: "object",
          fields: {
            inner: {
              kind: "object",
              fields: { id: { kind: "primitive", type: "string", optional: false, nullable: false } },
              nullable: true,
            },
          },
        },
      },
      pages: [],
    });
    expect(md).toMatch(/inner:[\s\S]+\}\s*\| null/);
  });

  it("sorts status codes ascending", () => {
    const md = buildReport({
      runId: "x",
      endpoints: [{
        method: "GET",
        pathPattern: "/api/x",
        samples: 1,
        statusCodes: [500, 200, 404],
        requestBodySchema: { kind: "unknown" },
        responseSchema: { kind: "unknown" },
      }],
      entities: {},
      pages: [],
    });
    expect(md).toContain("200, 404, 500");
  });
});
