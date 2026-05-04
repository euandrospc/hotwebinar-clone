# Capture Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Playwright-based pipeline that captures the original React-SPA webinar platform's pages, network traffic, and inferred data shapes into a structured artifact set plus a human-readable `REPORT.md`.

**Architecture:** Four independent stages (record → replay → crawl → analyze), each with a defined input artifact and output artifact, runnable individually or as a single chain. Pure unit tests cover the inference and parsing libraries; one integration test covers the crawler against a local fixture server.

**Tech Stack:** Node 20+, TypeScript, Playwright (`chromium`), `vitest`, `dotenv`, `tsx`, `pnpm` workspaces. No production dependencies on the web app or DB packages.

**Spec:** [2026-05-03-capture-phase-design.md](../specs/2026-05-03-capture-phase-design.md)

---

## Pre-flight

The repository already contains an untracked scaffold (created during brainstorming). The capture phase must rebuild `apps/scraper/` from scratch via TDD — the existing files there are not test-driven and do not match this plan's structure. Other scaffolded paths (`apps/web/`, `packages/db/`, `docker-compose.yml`, `COOLIFY.md`) are **out of scope for this phase** and must be left untouched.

The user has stated they prefer not to commit during this phase. Each task includes a commit step; the user may skip those steps and batch-commit later. The plan assumes commits happen — if you skip them, run `git status` between tasks so nothing accumulates undetected.

## File Structure

```
apps/scraper/
├── package.json              workspace package, deps + scripts
├── tsconfig.json             strict TS, ESM, vitest-compatible
├── vitest.config.ts          test runner config
├── routes.txt                fallback routes for crawl
├── README.md                 usage docs
├── src/
│   ├── config.ts             env loader, paths, run-id generator
│   ├── lib/
│   │   ├── network.ts        request/response capture types + listener factory
│   │   ├── auth.ts           localStorage["user-storage"] extraction helpers
│   │   ├── schema-infer.ts   JSON sample(s) → inferred schema
│   │   └── report.ts         analysis artifacts → REPORT.md string
│   └── stages/
│       ├── 01-record.ts      interactive: launches headed browser, saves auth-state
│       ├── 02-replay.ts      reads recorded flow, captures network into capture/<run>/replay/
│       ├── 03-crawl.ts       sidebar-driven GET crawl into capture/<run>/crawl/
│       └── 04-analyze.ts     reads requests.json artifacts, writes analysis/
└── test/
    ├── lib/
    │   ├── network.test.ts
    │   ├── schema-infer.test.ts
    │   └── report.test.ts
    └── stages/
        └── crawl.test.ts     integration test with local fixture server
```

Root-level files touched:
- `pnpm-workspace.yaml` — already exists, leave unchanged
- `package.json` — already exists, add `scrape:*` scripts in Task 11
- `.gitignore` — already contains `apps/scraper/capture` and `apps/scraper/auth-state.json`; extend in Task 11
- `.env.example` — already contains `TARGET_*`; extend in Task 11

## File responsibilities

- **`config.ts`** — single source of truth for env-derived configuration. Throws on missing required env at startup. Exports paths and a `newRunId()` helper.
- **`lib/network.ts`** — pure logic for the capture entry shape and a Playwright-agnostic listener factory tested against fake objects.
- **`lib/auth.ts`** — JWT extraction from a Playwright `Page` plus pure helpers for parsing the `user-storage` blob.
- **`lib/schema-infer.ts`** — pure function: `infer(samples: unknown[]) → InferredSchema`. No I/O.
- **`lib/report.ts`** — pure function: `buildReport(analysis: Analysis) → string`. No I/O.
- **Stages** — thin orchestrators. They open browsers, call `lib/*`, write files. Coverage comes from running them, not from unit tests, except for `03-crawl` which has an integration test against a fixture.

---

## Task 1: Bootstrap scraper package and test runner

**Files:**
- Delete: `apps/scraper/src/`, `apps/scraper/package.json`, `apps/scraper/tsconfig.json`, `apps/scraper/README.md`, `apps/scraper/routes.txt` (existing scaffold)
- Create: `apps/scraper/package.json`
- Create: `apps/scraper/tsconfig.json`
- Create: `apps/scraper/vitest.config.ts`
- Create: `apps/scraper/test/sanity.test.ts`

- [ ] **Step 1: Remove the existing scaffold under `apps/scraper/`**

```bash
rm -rf apps/scraper
mkdir -p apps/scraper/src apps/scraper/test
```

- [ ] **Step 2: Write `apps/scraper/package.json`**

```json
{
  "name": "scraper",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "scrape:record": "tsx src/stages/01-record.ts",
    "scrape:replay": "tsx src/stages/02-replay.ts",
    "scrape:crawl": "tsx src/stages/03-crawl.ts",
    "scrape:analyze": "tsx src/stages/04-analyze.ts",
    "scrape:all": "pnpm scrape:replay && pnpm scrape:crawl && pnpm scrape:analyze"
  },
  "dependencies": {
    "playwright": "1.48.0",
    "dotenv": "16.4.5"
  },
  "devDependencies": {
    "tsx": "4.19.1",
    "typescript": "5.6.3",
    "vitest": "2.1.4",
    "@types/node": "22.7.5"
  }
}
```

- [ ] **Step 3: Write `apps/scraper/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "test/**/*", "vitest.config.ts"]
}
```

- [ ] **Step 4: Write `apps/scraper/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Write the sanity test `apps/scraper/test/sanity.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Install dependencies and run the sanity test**

Run from repo root:

```bash
pnpm install
pnpm --filter scraper test
```

Expected: vitest reports `1 passed`. If `pnpm install` fails because `playwright` browsers are missing, that is fine — they are installed separately in Task 7.

- [ ] **Step 7: Commit**

```bash
git add apps/scraper/package.json apps/scraper/tsconfig.json apps/scraper/vitest.config.ts apps/scraper/test/sanity.test.ts package.json pnpm-lock.yaml
git commit -m "chore(scraper): bootstrap package with vitest"
```

---

## Task 2: Config and env loader

**Files:**
- Create: `apps/scraper/src/config.ts`
- Create: `apps/scraper/test/lib/config.test.ts`

- [ ] **Step 1: Write the failing test `apps/scraper/test/lib/config.test.ts`**

```ts
import { describe, it, expect, afterEach, beforeEach } from "vitest";

const REQUIRED = ["TARGET_BASE_URL", "TARGET_LOGIN_EMAIL", "TARGET_LOGIN_PASSWORD"];

function isolatedImport() {
  return import(`../../src/config.ts?${Date.now()}`);
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
    expect(config.maxDepth).toBe(3); // default
    expect(config.crawlDelayMs).toBe(500); // default
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter scraper test
```

Expected: FAIL — `Cannot find module '../../src/config.ts'`.

- [ ] **Step 3: Implement `apps/scraper/src/config.ts`**

```ts
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function must(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Env ${key} is not a number: ${raw}`);
  return n;
}

export const config = {
  baseUrl: must("TARGET_BASE_URL"),
  email: must("TARGET_LOGIN_EMAIL"),
  password: must("TARGET_LOGIN_PASSWORD"),

  loginPath: process.env.TARGET_LOGIN_PATH ?? "/login",
  sidebarSelector: process.env.SIDEBAR_SELECTOR ?? "aside a, nav a",
  startRoute: process.env.CRAWL_START_ROUTE ?? "/dashboard",

  maxPages: num("MAX_PAGES", 200),
  maxDepth: num("MAX_DEPTH", 3),
  crawlDelayMs: num("CRAWL_DELAY_MS", 500),
  bodyMaxBytes: num("BODY_MAX_BYTES", 200_000),

  recordedDir: path.resolve(root, "recorded"),
  captureDir: path.resolve(root, "capture"),
  routesFile: path.resolve(root, "routes.txt"),
  authStatePath: path.resolve(root, "recorded", "auth-state.json"),
  flowSpecPath: path.resolve(root, "recorded", "flow.spec.ts"),
};

export function newRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export type Config = typeof config;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter scraper test
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/src/config.ts apps/scraper/test/lib/config.test.ts
git commit -m "feat(scraper): add config and run-id helper"
```

---

## Task 3: Network capture library

**Files:**
- Create: `apps/scraper/src/lib/network.ts`
- Create: `apps/scraper/test/lib/network.test.ts`

- [ ] **Step 1: Write the failing test `apps/scraper/test/lib/network.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { capturedFromResponse, type FakeRequest, type FakeResponse } from "../../src/lib/network.js";

function fakeReq(over: Partial<FakeRequest> = {}): FakeRequest {
  return {
    url: () => "https://api.example.com/items/1",
    method: () => "GET",
    resourceType: () => "fetch",
    headers: () => ({ accept: "application/json" }),
    postData: () => null,
    ...over,
  };
}

function fakeResp(over: Partial<FakeResponse> = {}, req: FakeRequest = fakeReq()): FakeResponse {
  return {
    request: () => req,
    status: () => 200,
    headers: () => ({ "content-type": "application/json" }),
    body: async () => Buffer.from(JSON.stringify({ id: 1 })),
    ...over,
  };
}

describe("network capture", () => {
  it("builds a Captured entry from a JSON response", async () => {
    const c = await capturedFromResponse(fakeResp(), { startedAt: 1000, now: () => 1234, bodyMaxBytes: 200_000 });
    expect(c.url).toBe("https://api.example.com/items/1");
    expect(c.method).toBe("GET");
    expect(c.status).toBe(200);
    expect(c.requestBody).toBeNull();
    expect(c.responseBody).toBe('{"id":1}');
    expect(c.truncated).toBe(false);
    expect(c.timing).toBe(234);
  });

  it("truncates oversized bodies and flags them", async () => {
    const big = "x".repeat(500);
    const resp = fakeResp({ body: async () => Buffer.from(big) });
    const c = await capturedFromResponse(resp, { startedAt: 0, now: () => 0, bodyMaxBytes: 100 });
    expect(c.responseBody!.length).toBe(100);
    expect(c.truncated).toBe(true);
  });

  it("skips body for binary content types", async () => {
    const resp = fakeResp({
      headers: () => ({ "content-type": "video/mp4" }),
      body: async () => Buffer.from([0, 1, 2, 3]),
    });
    const c = await capturedFromResponse(resp, { startedAt: 0, now: () => 0, bodyMaxBytes: 100 });
    expect(c.responseBody).toBeNull();
    expect(c.truncated).toBe(false);
  });

  it("handles body() throwing (no body available)", async () => {
    const resp = fakeResp({
      body: async () => {
        throw new Error("no body");
      },
    });
    const c = await capturedFromResponse(resp, { startedAt: 0, now: () => 0, bodyMaxBytes: 100 });
    expect(c.responseBody).toBeNull();
  });

  it("captures POST request body", async () => {
    const req = fakeReq({ method: () => "POST", postData: () => '{"a":1}' });
    const c = await capturedFromResponse(fakeResp({}, req), { startedAt: 0, now: () => 0, bodyMaxBytes: 100 });
    expect(c.method).toBe("POST");
    expect(c.requestBody).toBe('{"a":1}');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter scraper test test/lib/network.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/scraper/src/lib/network.ts`**

```ts
export type FakeRequest = {
  url(): string;
  method(): string;
  resourceType(): string;
  headers(): Record<string, string>;
  postData(): string | null;
};

export type FakeResponse = {
  request(): FakeRequest;
  status(): number;
  headers(): Record<string, string>;
  body(): Promise<Buffer>;
};

export type Captured = {
  url: string;
  method: string;
  status: number;
  resourceType: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
  timing: number;
  truncated: boolean;
};

export type CaptureOptions = {
  startedAt: number;
  now: () => number;
  bodyMaxBytes: number;
};

const BINARY_TYPES = ["video/", "image/", "font/", "audio/", "application/octet-stream"];

function isBinary(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return BINARY_TYPES.some((p) => lower.startsWith(p));
}

export async function capturedFromResponse(resp: FakeResponse, opts: CaptureOptions): Promise<Captured> {
  const req = resp.request();
  const responseHeaders = resp.headers();
  let body: string | null = null;
  let truncated = false;

  if (!isBinary(responseHeaders["content-type"])) {
    try {
      const buf = await resp.body();
      const str = buf.toString("utf8");
      if (str.length > opts.bodyMaxBytes) {
        body = str.slice(0, opts.bodyMaxBytes);
        truncated = true;
      } else {
        body = str;
      }
    } catch {
      body = null;
    }
  }

  return {
    url: req.url(),
    method: req.method(),
    status: resp.status(),
    resourceType: req.resourceType(),
    requestHeaders: req.headers(),
    requestBody: req.postData(),
    responseHeaders,
    responseBody: body,
    timing: opts.now() - opts.startedAt,
    truncated,
  };
}

export type CaptureSink = {
  push(c: Captured): void;
  drain(): Captured[];
};

export function createSink(): CaptureSink {
  const buf: Captured[] = [];
  return {
    push: (c) => void buf.push(c),
    drain: () => buf.splice(0, buf.length),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter scraper test test/lib/network.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/src/lib/network.ts apps/scraper/test/lib/network.test.ts
git commit -m "feat(scraper): add network capture lib"
```

---

## Task 4: Auth (JWT extraction) helpers

**Files:**
- Create: `apps/scraper/src/lib/auth.ts`
- Create: `apps/scraper/test/lib/auth.test.ts`

- [ ] **Step 1: Write the failing test `apps/scraper/test/lib/auth.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { extractJwtFromUserStorage } from "../../src/lib/auth.js";

describe("extractJwtFromUserStorage", () => {
  it("returns null when storage is empty", () => {
    expect(extractJwtFromUserStorage(null)).toBeNull();
    expect(extractJwtFromUserStorage("")).toBeNull();
    expect(extractJwtFromUserStorage("not-json")).toBeNull();
  });

  it("finds token at common keys", () => {
    expect(extractJwtFromUserStorage(JSON.stringify({ token: "abc" }))).toBe("abc");
    expect(extractJwtFromUserStorage(JSON.stringify({ accessToken: "def" }))).toBe("def");
    expect(extractJwtFromUserStorage(JSON.stringify({ jwt: "ghi" }))).toBe("ghi");
  });

  it("walks zustand-style { state: { token } } shapes", () => {
    const blob = JSON.stringify({ state: { user: { token: "zus" } }, version: 0 });
    expect(extractJwtFromUserStorage(blob)).toBe("zus");
  });

  it("returns null when no token-like field exists", () => {
    expect(extractJwtFromUserStorage(JSON.stringify({ name: "x" }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter scraper test test/lib/auth.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/scraper/src/lib/auth.ts`**

```ts
import type { Page } from "playwright";

const TOKEN_KEYS = ["token", "accessToken", "jwt", "access_token", "id_token", "idToken"];

function findToken(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  for (const k of TOKEN_KEYS) {
    const v = (node as Record<string, unknown>)[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  for (const v of Object.values(node as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      const found = findToken(v);
      if (found) return found;
    }
  }
  return null;
}

export function extractJwtFromUserStorage(raw: string | null): string | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return findToken(parsed);
}

export async function readUserStorage(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem("user-storage"));
}

export async function readJwt(page: Page): Promise<string | null> {
  const raw = await readUserStorage(page);
  return extractJwtFromUserStorage(raw);
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter scraper test test/lib/auth.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/src/lib/auth.ts apps/scraper/test/lib/auth.test.ts
git commit -m "feat(scraper): add JWT extraction helpers"
```

---

## Task 5: Schema inference

**Files:**
- Create: `apps/scraper/src/lib/schema-infer.ts`
- Create: `apps/scraper/test/lib/schema-infer.test.ts`

- [ ] **Step 1: Write the failing test `apps/scraper/test/lib/schema-infer.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { infer, type Schema } from "../../src/lib/schema-infer.js";

describe("schema-infer", () => {
  it("infers primitive types from a single sample", () => {
    expect(infer([{ id: 1, name: "a", active: true }])).toEqual<Schema>({
      kind: "object",
      fields: {
        id: { kind: "primitive", type: "number", optional: false, nullable: false },
        name: { kind: "primitive", type: "string", optional: false, nullable: false },
        active: { kind: "primitive", type: "boolean", optional: false, nullable: false },
      },
    });
  });

  it("marks fields optional when missing in some samples", () => {
    const s = infer([{ id: 1, name: "a" }, { id: 2 }]);
    expect(s).toEqual<Schema>({
      kind: "object",
      fields: {
        id: { kind: "primitive", type: "number", optional: false, nullable: false },
        name: { kind: "primitive", type: "string", optional: true, nullable: false },
      },
    });
  });

  it("marks fields nullable when null seen", () => {
    const s = infer([{ id: 1, name: null }, { id: 2, name: "b" }]);
    expect(s.kind).toBe("object");
    if (s.kind !== "object") return;
    expect(s.fields.name).toEqual({ kind: "primitive", type: "string", optional: false, nullable: true });
  });

  it("infers arrays of primitives", () => {
    const s = infer([{ tags: ["a", "b"] }]);
    if (s.kind !== "object") throw new Error("expected object");
    expect(s.fields.tags).toEqual({
      kind: "array",
      element: { kind: "primitive", type: "string", optional: false, nullable: false },
      optional: false,
      nullable: false,
    });
  });

  it("infers arrays of objects by merging element schemas", () => {
    const s = infer([{ items: [{ a: 1 }, { a: 2, b: "x" }] }]);
    if (s.kind !== "object") throw new Error("expected object");
    const arr = s.fields.items;
    if (arr.kind !== "array" || arr.element.kind !== "object") throw new Error("expected array of objects");
    expect(arr.element.fields.a).toEqual({
      kind: "primitive",
      type: "number",
      optional: false,
      nullable: false,
    });
    expect(arr.element.fields.b).toEqual({
      kind: "primitive",
      type: "string",
      optional: true,
      nullable: false,
    });
  });

  it("infers nested objects", () => {
    const s = infer([{ user: { id: 1, email: "x@y" } }]);
    if (s.kind !== "object") throw new Error();
    expect(s.fields.user.kind).toBe("object");
  });

  it("returns unknown for empty samples", () => {
    expect(infer([])).toEqual({ kind: "unknown" });
  });

  it("handles top-level arrays", () => {
    const s = infer([[{ id: 1 }, { id: 2 }]]);
    expect(s.kind).toBe("array");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter scraper test test/lib/schema-infer.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/scraper/src/lib/schema-infer.ts`**

```ts
export type Primitive = "string" | "number" | "boolean";

export type PrimitiveSchema = {
  kind: "primitive";
  type: Primitive;
  optional: boolean;
  nullable: boolean;
};

export type ArraySchema = {
  kind: "array";
  element: Schema;
  optional: boolean;
  nullable: boolean;
};

export type ObjectSchema = {
  kind: "object";
  fields: Record<string, Schema>;
  optional?: boolean;
  nullable?: boolean;
};

export type UnknownSchema = { kind: "unknown" };

export type Schema = PrimitiveSchema | ArraySchema | ObjectSchema | UnknownSchema;

function classify(value: unknown): Primitive | "object" | "array" | "null" | "undefined" | "unknown" {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return t;
  if (t === "object") return "object";
  return "unknown";
}

function inferOne(value: unknown): Schema {
  const k = classify(value);
  switch (k) {
    case "string":
    case "number":
    case "boolean":
      return { kind: "primitive", type: k, optional: false, nullable: false };
    case "array": {
      const arr = value as unknown[];
      const element = arr.length === 0 ? ({ kind: "unknown" } as Schema) : mergeMany(arr.map(inferOne));
      return { kind: "array", element, optional: false, nullable: false };
    }
    case "object": {
      const obj = value as Record<string, unknown>;
      const fields: Record<string, Schema> = {};
      for (const [k2, v] of Object.entries(obj)) fields[k2] = inferOne(v);
      return { kind: "object", fields };
    }
    default:
      return { kind: "unknown" };
  }
}

function merge(a: Schema, b: Schema): Schema {
  if (a.kind === "unknown") return b;
  if (b.kind === "unknown") return a;
  if (a.kind !== b.kind) return { kind: "unknown" };
  if (a.kind === "primitive" && b.kind === "primitive") {
    if (a.type !== b.type) return { kind: "unknown" };
    return {
      kind: "primitive",
      type: a.type,
      optional: a.optional || b.optional,
      nullable: a.nullable || b.nullable,
    };
  }
  if (a.kind === "array" && b.kind === "array") {
    return {
      kind: "array",
      element: merge(a.element, b.element),
      optional: a.optional || b.optional,
      nullable: a.nullable || b.nullable,
    };
  }
  if (a.kind === "object" && b.kind === "object") {
    const keys = new Set([...Object.keys(a.fields), ...Object.keys(b.fields)]);
    const fields: Record<string, Schema> = {};
    for (const k of keys) {
      const av = a.fields[k];
      const bv = b.fields[k];
      if (av && bv) fields[k] = merge(av, bv);
      else fields[k] = setOptional(av ?? bv!, true);
    }
    return { kind: "object", fields };
  }
  return { kind: "unknown" };
}

function setOptional(s: Schema, optional: boolean): Schema {
  if (s.kind === "primitive" || s.kind === "array") return { ...s, optional };
  return s;
}

function mergeMany(samples: Schema[]): Schema {
  return samples.reduce<Schema>((acc, s) => merge(acc, s), { kind: "unknown" });
}

export function infer(samples: unknown[]): Schema {
  if (samples.length === 0) return { kind: "unknown" };
  // null samples → mark nullable on a non-null neighbor's schema
  const nonNull = samples.filter((s) => s !== null && s !== undefined);
  const seenNull = nonNull.length !== samples.length;

  if (nonNull.length === 0) return { kind: "unknown" };
  let merged = mergeMany(nonNull.map(inferOne));
  if (seenNull) merged = applyNullable(merged);
  return merged;
}

function applyNullable(s: Schema): Schema {
  if (s.kind === "primitive" || s.kind === "array") return { ...s, nullable: true };
  return s;
}

// helper: per-field nullable propagation when a sibling is null
function deepMergeNullable(parent: Schema, sibling: unknown): Schema {
  if (parent.kind !== "object" || !sibling || typeof sibling !== "object") return parent;
  const sib = sibling as Record<string, unknown>;
  const fields: Record<string, Schema> = {};
  for (const [k, v] of Object.entries(parent.fields)) {
    if (sib[k] === null && (v.kind === "primitive" || v.kind === "array")) {
      fields[k] = { ...v, nullable: true };
    } else {
      fields[k] = v;
    }
  }
  return { kind: "object", fields };
}

// re-export with per-sample null propagation for the object case
export function inferDeep(samples: unknown[]): Schema {
  let s = infer(samples);
  for (const sample of samples) s = deepMergeNullable(s, sample);
  return s;
}
```

> **Note:** the test for the `nullable` field-level case uses object samples with `null` field values. The `infer` function handles top-level nullability; field-level null detection happens through `inferDeep`. Since the test for nullability covers field-level null, the test imports `infer` — adjust by using the internal merge through inferDeep when objects with null fields are given. **Re-read the failing test before implementing this section** — if the test fails on the nullable case, switch the test (or the export) to use `inferDeep`. Track this as a sub-step:

- [ ] **Step 3a: Verify the nullable-field test passes**

If it fails, change the test to import `inferDeep` instead of `infer` for the nullable case, and re-export `inferDeep as infer` in the source. Pick whichever keeps the API named `infer`. Re-run.

- [ ] **Step 4: Run all tests**

```bash
pnpm --filter scraper test test/lib/schema-infer.test.ts
```

Expected: 8 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/src/lib/schema-infer.ts apps/scraper/test/lib/schema-infer.test.ts
git commit -m "feat(scraper): add JSON schema inference"
```

---

## Task 6: Report builder

**Files:**
- Create: `apps/scraper/src/lib/report.ts`
- Create: `apps/scraper/test/lib/report.test.ts`

- [ ] **Step 1: Write the failing test `apps/scraper/test/lib/report.test.ts`**

```ts
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
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter scraper test test/lib/report.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/scraper/src/lib/report.ts`**

```ts
import type { Schema } from "./schema-infer.js";

export type EndpointAnalysis = {
  method: string;
  pathPattern: string;
  samples: number;
  statusCodes: number[];
  requestBodySchema: Schema;
  responseSchema: Schema;
};

export type PageAnalysis = {
  route: string;
  url: string;
  status: number;
  requestCount: number;
  screenshot: string;
};

export type Analysis = {
  runId: string;
  endpoints: EndpointAnalysis[];
  entities: Record<string, Schema>;
  pages: PageAnalysis[];
};

function renderSchema(s: Schema, indent = 0): string {
  const pad = "  ".repeat(indent);
  switch (s.kind) {
    case "primitive": {
      const flags: string[] = [];
      if (s.optional) flags.push("?");
      if (s.nullable) flags.push("| null");
      return `${s.type}${flags.join(" ")}`;
    }
    case "array":
      return `Array<${renderSchema(s.element, indent)}>`;
    case "object": {
      const lines = ["{"];
      for (const [k, v] of Object.entries(s.fields)) {
        lines.push(`${pad}  ${k}: ${renderSchema(v, indent + 1)}`);
      }
      lines.push(`${pad}}`);
      return lines.join("\n");
    }
    case "unknown":
      return "unknown";
  }
}

export function buildReport(a: Analysis): string {
  const out: string[] = [];
  out.push(`# Capture Report — ${a.runId}`, "");

  out.push("## Endpoints", "");
  out.push("| Method | Path | Samples | Status codes |");
  out.push("|--------|------|---------|--------------|");
  for (const e of a.endpoints) {
    out.push(`| ${e.method} | \`${e.pathPattern}\` | ${e.samples} | ${e.statusCodes.join(", ")} |`);
  }
  out.push("");

  out.push("## Entities", "");
  for (const [name, schema] of Object.entries(a.entities)) {
    out.push(`### \`${name}\``, "");
    out.push("```");
    out.push(renderSchema(schema));
    out.push("```", "");
  }

  out.push("## Pages", "");
  out.push("| Route | Status | Requests | Screenshot |");
  out.push("|-------|--------|----------|------------|");
  for (const p of a.pages) {
    out.push(`| \`${p.route}\` | ${p.status} | ${p.requestCount} | \`${p.screenshot}\` |`);
  }
  out.push("");

  return out.join("\n");
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter scraper test test/lib/report.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/src/lib/report.ts apps/scraper/test/lib/report.test.ts
git commit -m "feat(scraper): add report builder"
```

---

## Task 7: Stage 01 — interactive recorder

**Files:**
- Create: `apps/scraper/src/stages/01-record.ts`
- Manual smoke test only (interactive — no automated test).

- [ ] **Step 1: Install Playwright browsers**

```bash
cd apps/scraper && pnpm exec playwright install chromium --with-deps && cd -
```

Expected: chromium installed under `~/.cache/ms-playwright/` (or platform equivalent).

- [ ] **Step 2: Implement `apps/scraper/src/stages/01-record.ts`**

```ts
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

async function main() {
  await fs.mkdir(config.recordedDir, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const loginUrl = new URL(config.loginPath, config.baseUrl).toString();
  console.log("Opening", loginUrl);
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

  console.log("");
  console.log("=== Manual session ===");
  console.log("1. Log in to the platform");
  console.log("2. Navigate through any flows you want recorded");
  console.log("3. Close the browser window when done");
  console.log("");

  await page.waitForEvent("close", { timeout: 0 }).catch(() => undefined);

  await ctx.storageState({ path: config.authStatePath });
  console.log("Saved auth state →", config.authStatePath);

  // Minimal placeholder flow.spec.ts — replay just visits captured route history
  const history = await page.evaluate(() => {
    return Array.from(performance.getEntriesByType("navigation")).map((e) => (e as PerformanceNavigationTiming).name);
  }).catch(() => [] as string[]);
  const flow = `// Auto-generated by 01-record. Edit freely.
// Replay reads this file as a list of URLs to revisit.
export const visitedUrls: string[] = ${JSON.stringify(history, null, 2)};
`;
  await fs.writeFile(config.flowSpecPath, flow);
  console.log("Saved flow →", config.flowSpecPath);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

> **Note on `flow.spec.ts`:** The spec described capturing a Playwright Inspector codegen output. Inspector codegen runs through the `playwright codegen` CLI, which is interactive and not embeddable. The simpler approach used here saves the visited URLs only; replay (Task 8) re-visits those URLs with the saved auth state. If a fully scripted replay (clicks, form fills) is needed later, re-record using `pnpm exec playwright codegen <URL>` and paste the output into `recorded/flow.spec.ts` manually.

- [ ] **Step 3: Smoke test**

Pre-req: a `.env` file at the repo root with `TARGET_BASE_URL`, `TARGET_LOGIN_EMAIL`, `TARGET_LOGIN_PASSWORD` filled in. Then:

```bash
pnpm --filter scraper scrape:record
```

Expected: a Chromium window opens at the login URL. Log in, click around a few pages (e.g. dashboard, webinars, leads). Close the window. Terminal prints `Saved auth state → …recorded/auth-state.json` and `Saved flow → …recorded/flow.spec.ts`.

- [ ] **Step 4: Verify artifacts exist**

```bash
ls -la apps/scraper/recorded/
```

Expected: `auth-state.json` and `flow.spec.ts`. The `auth-state.json` should contain `cookies` and `origins` arrays — `origins[0].localStorage` should include an entry with name `user-storage`.

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/src/stages/01-record.ts
git commit -m "feat(scraper): add interactive record stage"
```

---

## Task 8: Stage 02 — replay with capture

**Files:**
- Create: `apps/scraper/src/stages/02-replay.ts`

- [ ] **Step 1: Implement `apps/scraper/src/stages/02-replay.ts`**

```ts
import { chromium, type Response } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { config, newRunId } from "../config.js";
import { capturedFromResponse, type Captured } from "../lib/network.js";
import { visitedUrls } from "../../recorded/flow.spec.js";

function safeName(p: string): string {
  return p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
}

function pathFromUrl(u: string): string {
  try {
    return new URL(u).pathname;
  } catch {
    return u;
  }
}

async function captureRoute(targetUrl: string, runDir: string): Promise<void> {
  const slug = safeName(pathFromUrl(targetUrl));
  const dir = path.join(runDir, "replay", slug);
  await fs.mkdir(dir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: config.authStatePath,
    recordHar: { path: path.join(dir, "network.har"), content: "embed" },
  });
  const page = await ctx.newPage();

  const startedAt = Date.now();
  const captured: Captured[] = [];
  page.on("response", async (resp: Response) => {
    try {
      const c = await capturedFromResponse(resp, {
        startedAt,
        now: () => Date.now(),
        bodyMaxBytes: config.bodyMaxBytes,
      });
      captured.push(c);
    } catch {
      // ignore individual failures
    }
  });

  console.log(" ->", targetUrl);
  let status = 0;
  try {
    const resp = await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30_000 });
    status = resp?.status() ?? 0;
  } catch (e) {
    console.warn("   nav error:", (e as Error).message);
  }

  const html = await page.content();
  await fs.writeFile(path.join(dir, "page.html"), html);
  await page.screenshot({ path: path.join(dir, "screenshot.png"), fullPage: true });
  await fs.writeFile(path.join(dir, "requests.json"), JSON.stringify(captured, null, 2));
  await fs.writeFile(
    path.join(dir, "meta.json"),
    JSON.stringify(
      { route: pathFromUrl(targetUrl), url: targetUrl, status, requestCount: captured.length, capturedAt: new Date().toISOString() },
      null,
      2,
    ),
  );

  await ctx.close();
  await browser.close();
}

async function main() {
  if (!visitedUrls?.length) {
    console.error("recorded/flow.spec.ts has no visitedUrls. Run scrape:record first.");
    process.exit(1);
  }

  const runId = newRunId();
  const runDir = path.join(config.captureDir, runId);
  await fs.mkdir(runDir, { recursive: true });
  console.log("Run:", runDir);

  for (const url of visitedUrls) {
    await captureRoute(url, runDir);
  }

  // Update capture/latest copy
  const latest = path.join(config.captureDir, "latest");
  await fs.rm(latest, { recursive: true, force: true });
  await fs.cp(runDir, latest, { recursive: true });

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke test**

Pre-req: Task 7 has produced `recorded/auth-state.json` and `recorded/flow.spec.ts`.

```bash
pnpm --filter scraper scrape:replay
```

Expected: terminal prints `Run: …capture/<run-id>` and one `->` line per visited URL. `apps/scraper/capture/<run-id>/replay/<slug>/` contains `page.html`, `screenshot.png`, `network.har`, `requests.json`, `meta.json` for each route.

- [ ] **Step 3: Verify capture content**

```bash
ls apps/scraper/capture/latest/replay
```

Expected: at least one slug folder with all five files.

- [ ] **Step 4: Commit**

```bash
git add apps/scraper/src/stages/02-replay.ts
git commit -m "feat(scraper): add replay stage with network capture"
```

---

## Task 9: Stage 03 — sidebar crawl + integration test

**Files:**
- Create: `apps/scraper/src/stages/03-crawl.ts`
- Create: `apps/scraper/test/stages/crawl.test.ts`
- Create: `apps/scraper/test/fixtures/server.ts`
- Create: `apps/scraper/routes.txt`

- [ ] **Step 1: Write the failing integration test `apps/scraper/test/stages/crawl.test.ts`**

This test boots a tiny HTTP server with a fake sidebar, runs the crawler module against it, and asserts that the right routes were discovered and captured.

```ts
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
      outDir,
    });
    const paths = result.discovered.map((d) => d.path).sort();
    expect(paths).toContain("/dashboard");
    expect(paths).toContain("/webinars");
    expect(paths).toContain("/leads");
    expect(paths).toContain("/settings");
    // dedupe: /webinars listed in sidebar should appear once
    const dupes = paths.filter((p) => p === "/webinars");
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
      outDir,
    });
    expect(result.discovered.length).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Implement the fixture server `apps/scraper/test/fixtures/server.ts`**

```ts
import http from "node:http";
import type { AddressInfo } from "node:net";

const SIDEBAR = `
<aside>
  <a href="/dashboard">Dashboard</a>
  <a href="/webinars">Webinars</a>
  <a href="/leads">Leads</a>
  <a href="/settings">Settings</a>
  <a href="/dashboard">Dashboard (dup)</a>
</aside>
`;

function page(title: string): string {
  return `<!doctype html><html><head><title>${title}</title></head><body>${SIDEBAR}<main><h1>${title}</h1></main></body></html>`;
}

const ROUTES: Record<string, string> = {
  "/dashboard": page("Dashboard"),
  "/webinars": page("Webinars"),
  "/leads": page("Leads"),
  "/settings": page("Settings"),
};

export type FixtureServer = { url: string; close: () => Promise<void> };

export function startFixtureServer(): Promise<FixtureServer> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? "/";
      const body = ROUTES[url];
      if (!body) {
        res.writeHead(404, { "content-type": "text/html" });
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end(body);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({
        url,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm --filter scraper test test/stages/crawl.test.ts
```

Expected: FAIL — `crawl` not exported from `src/stages/03-crawl.ts`.

- [ ] **Step 4: Implement `apps/scraper/src/stages/03-crawl.ts`**

```ts
import { chromium, type Browser, type Response } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { config, newRunId } from "../config.js";
import { capturedFromResponse, type Captured } from "../lib/network.js";

export type CrawlOptions = {
  baseUrl: string;
  startRoute: string;
  sidebarSelector: string;
  maxDepth: number;
  maxPages: number;
  crawlDelayMs: number;
  outDir: string;
  authStatePath?: string;
  headless?: boolean;
};

export type Discovered = {
  path: string;
  origin: string;
  status: number;
  requestCount: number;
};

export type CrawlResult = {
  discovered: Discovered[];
};

function safeName(p: string): string {
  return p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
}

function normalizePath(u: string): string {
  try {
    const parsed = new URL(u);
    return parsed.pathname.replace(/\/$/, "") || "/";
  } catch {
    return u;
  }
}

function isInternal(u: string, baseUrl: string): boolean {
  try {
    const a = new URL(u);
    const b = new URL(baseUrl);
    return a.host === b.host;
  } catch {
    return false;
  }
}

export async function crawl(opts: CrawlOptions): Promise<CrawlResult> {
  await fs.mkdir(opts.outDir, { recursive: true });
  const browser: Browser = await chromium.launch({ headless: opts.headless ?? true });
  const ctx = await browser.newContext(
    opts.authStatePath ? { storageState: opts.authStatePath } : {},
  );

  const queue: Array<{ pathName: string; depth: number; origin: string }> = [
    { pathName: opts.startRoute, depth: 0, origin: "start" },
  ];
  const seen = new Set<string>();
  const discovered: Discovered[] = [];

  while (queue.length > 0 && discovered.length < opts.maxPages) {
    const item = queue.shift()!;
    if (seen.has(item.pathName)) continue;
    seen.add(item.pathName);

    const page = await ctx.newPage();
    const startedAt = Date.now();
    const captured: Captured[] = [];
    page.on("response", async (resp: Response) => {
      try {
        const c = await capturedFromResponse(resp, {
          startedAt,
          now: () => Date.now(),
          bodyMaxBytes: 200_000,
        });
        captured.push(c);
      } catch {
        // ignore
      }
    });

    const url = new URL(item.pathName, opts.baseUrl).toString();
    let status = 0;
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      status = resp?.status() ?? 0;
    } catch (e) {
      // capture as failed page
    }

    const slug = safeName(item.pathName);
    const dir = path.join(opts.outDir, "crawl", slug);
    await fs.mkdir(dir, { recursive: true });
    const html = await page.content();
    await fs.writeFile(path.join(dir, "page.html"), html);
    await page.screenshot({ path: path.join(dir, "screenshot.png"), fullPage: true }).catch(() => undefined);
    await fs.writeFile(path.join(dir, "requests.json"), JSON.stringify(captured, null, 2));
    await fs.writeFile(
      path.join(dir, "meta.json"),
      JSON.stringify({ route: item.pathName, url, status, requestCount: captured.length, depth: item.depth, origin: item.origin }, null, 2),
    );

    discovered.push({ path: item.pathName, origin: item.origin, status, requestCount: captured.length });

    // discover further routes
    if (item.depth < opts.maxDepth) {
      const hrefs = await page.$$eval(opts.sidebarSelector, (els) =>
        els.map((el) => (el as HTMLAnchorElement).href).filter(Boolean),
      );
      for (const href of hrefs) {
        if (!isInternal(href, opts.baseUrl)) continue;
        const np = normalizePath(href);
        if (!seen.has(np)) queue.push({ pathName: np, depth: item.depth + 1, origin: item.pathName });
      }
    }

    await page.close();
    if (opts.crawlDelayMs > 0) await new Promise((r) => setTimeout(r, opts.crawlDelayMs));
  }

  await ctx.close();
  await browser.close();

  await fs.writeFile(path.join(opts.outDir, "crawl", "_discovered.json"), JSON.stringify(discovered, null, 2));
  return { discovered };
}

async function main() {
  const runId = newRunId();
  const outDir = path.join(config.captureDir, runId);
  await fs.mkdir(outDir, { recursive: true });
  console.log("Run:", outDir);

  await crawl({
    baseUrl: config.baseUrl,
    startRoute: config.startRoute,
    sidebarSelector: config.sidebarSelector,
    maxDepth: config.maxDepth,
    maxPages: config.maxPages,
    crawlDelayMs: config.crawlDelayMs,
    outDir,
    authStatePath: config.authStatePath,
    headless: !process.argv.includes("--headed"),
  });

  // Update capture/latest
  const latest = path.join(config.captureDir, "latest");
  await fs.rm(latest, { recursive: true, force: true });
  await fs.cp(outDir, latest, { recursive: true });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm --filter scraper test test/stages/crawl.test.ts
```

Expected: 2 passing.

- [ ] **Step 6: Create `apps/scraper/routes.txt`**

```text
# One route per line, relative to TARGET_BASE_URL. Lines starting with # are ignored.
# Used by stage 03 only when sidebar discovery misses a route you care about.
# Examples:
# /webinars/some-specific-id
# /admin/hidden-page
```

- [ ] **Step 7: Commit**

```bash
git add apps/scraper/src/stages/03-crawl.ts apps/scraper/test/stages/crawl.test.ts apps/scraper/test/fixtures/server.ts apps/scraper/routes.txt
git commit -m "feat(scraper): add crawl stage with fixture-server integration test"
```

---

## Task 10: Stage 04 — analyze captured runs

**Files:**
- Create: `apps/scraper/src/stages/04-analyze.ts`
- Create: `apps/scraper/test/stages/analyze.test.ts`

- [ ] **Step 1: Write the failing test `apps/scraper/test/stages/analyze.test.ts`**

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter scraper test test/stages/analyze.test.ts
```

Expected: FAIL — `analyze` not exported.

- [ ] **Step 3: Implement `apps/scraper/src/stages/04-analyze.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { config, newRunId } from "../config.js";
import { infer, type Schema } from "../lib/schema-infer.js";
import { buildReport, type Analysis, type EndpointAnalysis, type PageAnalysis } from "../lib/report.js";
import type { Captured } from "../lib/network.js";

export type AnalyzeOptions = { runDir: string; runId: string };

const ID_RE = /^[0-9]+$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[a-z0-9]{16,}$/i;

function normalizePath(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const segs = u.pathname.split("/").map((s) => (ID_RE.test(s) ? ":id" : s));
    return segs.join("/").replace(/\/$/, "") || "/";
  } catch {
    return rawUrl;
  }
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function findRequestFiles(runDir: string): Promise<string[]> {
  const out: string[] = [];
  for (const sub of ["replay", "crawl"]) {
    const base = path.join(runDir, sub);
    const exists = await fs.stat(base).catch(() => null);
    if (!exists) continue;
    for (const slug of await fs.readdir(base)) {
      if (slug.startsWith("_")) continue;
      const f = path.join(base, slug, "requests.json");
      if (await fs.stat(f).catch(() => null)) out.push(f);
    }
  }
  return out;
}

async function findMetaFiles(runDir: string): Promise<string[]> {
  const out: string[] = [];
  for (const sub of ["replay", "crawl"]) {
    const base = path.join(runDir, sub);
    const exists = await fs.stat(base).catch(() => null);
    if (!exists) continue;
    for (const slug of await fs.readdir(base)) {
      if (slug.startsWith("_")) continue;
      const f = path.join(base, slug, "meta.json");
      if (await fs.stat(f).catch(() => null)) out.push(f);
    }
  }
  return out;
}

function guessEntityName(pathPattern: string): string | null {
  const parts = pathPattern.split("/").filter(Boolean);
  // /api/webinars/:id → "Webinar"
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i] !== ":id" && parts[i] !== "api") {
      const word = parts[i].replace(/[^a-z0-9]/gi, "");
      if (word.length === 0) continue;
      const singular = word.endsWith("s") ? word.slice(0, -1) : word;
      return singular.charAt(0).toUpperCase() + singular.slice(1);
    }
  }
  return null;
}

export async function analyze(opts: AnalyzeOptions): Promise<Analysis> {
  const reqFiles = await findRequestFiles(opts.runDir);
  type Group = { method: string; pathPattern: string; statusCodes: Set<number>; reqBodies: unknown[]; resBodies: unknown[] };
  const groups = new Map<string, Group>();

  for (const f of reqFiles) {
    const items = (await readJson<Captured[]>(f)) ?? [];
    for (const c of items) {
      if (!c.responseHeaders["content-type"]?.includes("application/json")) continue;
      const pathPattern = normalizePath(c.url);
      const key = `${c.method} ${pathPattern}`;
      let g = groups.get(key);
      if (!g) {
        g = { method: c.method, pathPattern, statusCodes: new Set(), reqBodies: [], resBodies: [] };
        groups.set(key, g);
      }
      g.statusCodes.add(c.status);
      if (c.requestBody) {
        try { g.reqBodies.push(JSON.parse(c.requestBody)); } catch { /* ignore */ }
      }
      if (c.responseBody) {
        try { g.resBodies.push(JSON.parse(c.responseBody)); } catch { /* ignore */ }
      }
    }
  }

  const endpoints: EndpointAnalysis[] = [];
  const entities: Record<string, Schema> = {};

  for (const g of groups.values()) {
    const responseSchema = infer(g.resBodies);
    const requestBodySchema = infer(g.reqBodies);
    endpoints.push({
      method: g.method,
      pathPattern: g.pathPattern,
      samples: g.resBodies.length || g.reqBodies.length,
      statusCodes: [...g.statusCodes].sort(),
      requestBodySchema,
      responseSchema,
    });
    const name = guessEntityName(g.pathPattern);
    if (name && responseSchema.kind === "object") {
      entities[name] = entities[name] ? infer([entities[name], responseSchema]) : responseSchema;
    }
  }

  endpoints.sort((a, b) => a.pathPattern.localeCompare(b.pathPattern) || a.method.localeCompare(b.method));

  const pages: PageAnalysis[] = [];
  for (const f of await findMetaFiles(opts.runDir)) {
    const meta = await readJson<{ route: string; url: string; status: number; requestCount: number }>(f);
    if (!meta) continue;
    pages.push({
      route: meta.route,
      url: meta.url,
      status: meta.status,
      requestCount: meta.requestCount,
      screenshot: path.relative(opts.runDir, path.join(path.dirname(f), "screenshot.png")).replace(/\\/g, "/"),
    });
  }

  const analysis: Analysis = { runId: opts.runId, endpoints, entities, pages };

  const outDir = path.join(opts.runDir, "analysis");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "endpoints.json"), JSON.stringify(endpoints, null, 2));
  await fs.writeFile(path.join(outDir, "entities.json"), JSON.stringify(entities, null, 2));
  await fs.writeFile(path.join(outDir, "pages.json"), JSON.stringify(pages, null, 2));
  await fs.writeFile(path.join(outDir, "REPORT.md"), buildReport(analysis));

  return analysis;
}

async function main() {
  const latest = path.join(config.captureDir, "latest");
  const runDir = (await fs.stat(latest).catch(() => null)) ? latest : path.join(config.captureDir, newRunId());
  const runId = path.basename(runDir);
  console.log("Analyzing:", runDir);
  const a = await analyze({ runDir, runId });
  console.log(`Endpoints: ${a.endpoints.length}, Entities: ${Object.keys(a.entities).length}, Pages: ${a.pages.length}`);
  console.log("REPORT →", path.join(runDir, "analysis", "REPORT.md"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

> **Note on the `entities` merge:** the line `entities[name] = entities[name] ? infer([entities[name], responseSchema]) : responseSchema;` is incorrect — `infer` takes raw samples, not pre-inferred schemas. Replace it with a direct merge. Implement the merge by exporting a helper from `lib/schema-infer.ts` (e.g. `mergeSchemas(a: Schema, b: Schema): Schema`) and import it here. Add a unit test for `mergeSchemas` in `test/lib/schema-infer.test.ts` that asserts merging two `object` schemas with overlapping/disjoint fields produces the union with optionality propagation.

- [ ] **Step 3a: Add `mergeSchemas` export to `lib/schema-infer.ts`**

Refactor: extract the existing internal `merge` function to a public export named `mergeSchemas`. Then update `04-analyze.ts` to use it: `entities[name] = entities[name] ? mergeSchemas(entities[name], responseSchema) : responseSchema;`. Add a test:

```ts
it("mergeSchemas merges two object schemas", () => {
  const a: Schema = { kind: "object", fields: { id: { kind: "primitive", type: "number", optional: false, nullable: false } } };
  const b: Schema = { kind: "object", fields: { id: { kind: "primitive", type: "number", optional: false, nullable: false }, name: { kind: "primitive", type: "string", optional: false, nullable: false } } };
  const m = mergeSchemas(a, b);
  if (m.kind !== "object") throw new Error("expected object");
  expect(m.fields.id.kind).toBe("primitive");
  expect(m.fields.name).toEqual({ kind: "primitive", type: "string", optional: true, nullable: false });
});
```

(import `mergeSchemas` in the test alongside `infer`.)

- [ ] **Step 4: Run the analyze test to verify it passes**

```bash
pnpm --filter scraper test test/stages/analyze.test.ts test/lib/schema-infer.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/src/stages/04-analyze.ts apps/scraper/src/lib/schema-infer.ts apps/scraper/test/stages/analyze.test.ts apps/scraper/test/lib/schema-infer.test.ts
git commit -m "feat(scraper): add analyze stage producing REPORT.md"
```

---

## Task 11: Wiring — root scripts, env example, gitignore, README

**Files:**
- Modify: `package.json` (root)
- Modify: `.env.example`
- Modify: `.gitignore`
- Create: `apps/scraper/README.md`

- [ ] **Step 1: Update root `package.json` scripts**

Open `package.json` at the repo root and replace the `scripts` block with:

```json
"scripts": {
  "dev": "pnpm --filter web dev",
  "build": "pnpm -r build",
  "test": "pnpm -r test",
  "scrape:record": "pnpm --filter scraper scrape:record",
  "scrape:replay": "pnpm --filter scraper scrape:replay",
  "scrape:crawl": "pnpm --filter scraper scrape:crawl",
  "scrape:analyze": "pnpm --filter scraper scrape:analyze",
  "scrape:all": "pnpm --filter scraper scrape:all",
  "db:push": "pnpm --filter db prisma db push",
  "db:generate": "pnpm --filter db prisma generate",
  "db:studio": "pnpm --filter db prisma studio"
}
```

- [ ] **Step 2: Extend `.env.example`**

Append the following block to `.env.example`:

```
# Scraper extras (all optional)
TARGET_LOGIN_PATH=/login
SIDEBAR_SELECTOR="aside a, nav a"
CRAWL_START_ROUTE=/dashboard
MAX_PAGES=200
MAX_DEPTH=3
CRAWL_DELAY_MS=500
BODY_MAX_BYTES=200000
```

- [ ] **Step 3: Extend `.gitignore`**

Confirm `.gitignore` includes the following lines (add any that are missing):

```
apps/scraper/capture/
apps/scraper/recorded/
apps/scraper/recorded/auth-state.json
```

- [ ] **Step 4: Write `apps/scraper/README.md`**

```markdown
# scraper

Captures the original platform with Playwright. Local-only — never deploy.

## Setup

From repo root:

```bash
pnpm install
cd apps/scraper && pnpm exec playwright install chromium --with-deps && cd -
cp .env.example .env
# Fill in TARGET_BASE_URL, TARGET_LOGIN_EMAIL, TARGET_LOGIN_PASSWORD
```

## Pipeline

1. **Record** — opens a headed browser; you log in and click around. Saves auth state and visited URLs.
   ```bash
   pnpm scrape:record
   ```
2. **Replay** — re-visits recorded URLs headless, captures HTML, screenshots, HAR, requests.
   ```bash
   pnpm scrape:replay
   ```
3. **Crawl** — auto-crawls the sidebar starting from `CRAWL_START_ROUTE`. Default headless; pass `--headed` to watch.
   ```bash
   pnpm scrape:crawl
   pnpm scrape:crawl -- --headed
   ```
4. **Analyze** — reads all `requests.json` from the latest run, infers schemas, writes `REPORT.md`.
   ```bash
   pnpm scrape:analyze
   ```
   Or all three non-interactive stages at once:
   ```bash
   pnpm scrape:all
   ```

## Output

```
apps/scraper/
├── recorded/                   gitignored
│   ├── auth-state.json
│   └── flow.spec.ts
└── capture/                    gitignored
    ├── <run-id>/
    │   ├── replay/<slug>/{page.html,screenshot.png,network.har,requests.json,meta.json}
    │   ├── crawl/<slug>/{...}
    │   └── analysis/{endpoints.json,entities.json,pages.json,REPORT.md}
    └── latest/                  copy of the most recent run
```

## Tests

```bash
pnpm --filter scraper test
```

Unit tests cover `lib/*`. The crawl stage has an integration test against a local fixture HTTP server. There are no live E2E tests against the original platform — validation is manual via the generated `REPORT.md`.
```

- [ ] **Step 5: Run the full test suite**

```bash
pnpm --filter scraper test
```

Expected: all tests passing (sanity, config, network, auth, schema-infer, report, crawl, analyze).

- [ ] **Step 6: Run the typecheck**

```bash
pnpm --filter scraper typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json .env.example .gitignore apps/scraper/README.md
git commit -m "chore(scraper): wire root scripts and docs"
```

---

## Final acceptance check

- [ ] **Step 1: Confirm DoD items from the spec**

Walk through the spec's "Definition of Done" section:

1. `pnpm scrape:record` opens a browser and saves `recorded/flow.spec.ts` + `recorded/auth-state.json` after the user closes the window
2. `pnpm scrape:replay` produces ≥ 3 routes under `capture/<run>/replay/`
3. `pnpm scrape:crawl` discovers ≥ 10 routes via the sidebar
4. `pnpm scrape:analyze` produces a `REPORT.md` containing an endpoints table (≥ 10), entity schemas (≥ 3), and a pages list
5. Re-running any single stage does not invalidate prior artifacts
6. `.gitignore` blocks `capture/`, `recorded/`, `auth-state*.json`
7. No credentials hardcoded; everything via `.env`

If any item fails, file a follow-up task and address before declaring the phase complete.

- [ ] **Step 2: Final commit (if anything changed during acceptance)**

```bash
git status
git add -p
git commit -m "chore(scraper): acceptance fixes"
```

---

## Self-Review (notes left for the implementer)

- **Spec coverage:** every section of the spec is mapped to tasks 1–11. Definition-of-Done checks live in the final acceptance section.
- **Task 5 caveat:** the nullable test logic uses `inferDeep` (with field-level null propagation). If the test is ever flaky on the nullable case, switch back to using `inferDeep` directly.
- **Task 7 simplification:** Playwright's `codegen` CLI is not embeddable. Stage 1 saves visited URLs only. If full action replay is needed (clicks, form fills), record manually via `pnpm exec playwright codegen <URL>` and paste the script into `recorded/flow.spec.ts`.
- **Task 10 caveat:** `mergeSchemas` must be exported from `lib/schema-infer.ts`. The plan refactors the internal `merge` to a public export and updates the analyze stage accordingly.
- **Out of scope:** generating Prisma schema from `entities.json`, generating Next.js routes from `pages.json`, deployment. Those are subsequent phases with their own brainstorm + plan + execution cycles.
