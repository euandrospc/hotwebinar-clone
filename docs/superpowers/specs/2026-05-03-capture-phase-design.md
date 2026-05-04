# Capture Phase Design

**Project:** hotwebinar-clone
**Date:** 2026-05-03
**Status:** Approved
**Scope:** Phase 1 of N — reverse-engineer original platform via Playwright capture. Subsequent phases (schema generation, Next.js codegen, deployment) are separate sub-projects.

## Goal

Capture enough information from the original (React SPA, JWT-authenticated) webinar platform to design a Next.js + Better Auth + Prisma rewrite. Output is a structured set of artifacts plus a human-readable `REPORT.md` that drives the next design cycle.

## Non-goals

- Migrating real production data
- Deploying anything
- Writing the rewrite itself
- Bypassing the original platform's auth (we use legitimate owner credentials)

## Context

Owner of the original platform wants to rewrite it in Node + Next.js 15 (App Router), Better Auth, Prisma + Postgres on Coolify, video stored as recorded files simulating live. Original is a React SPA storing JWT in `localStorage["user-storage"]`. Sidebar uses real `<a href>` tags.

Owner provided credentials privately. Credentials live only in local `.env` (gitignored). The plain-text password shared in chat must be rotated by the owner.

## Architecture

Pipeline of independent stages. Each stage reads a defined input artifact and writes a defined output artifact. Re-running one stage does not invalidate others.

```
apps/scraper/
├── src/
│   ├── stages/
│   │   ├── 01-record.ts       interactive Playwright codegen
│   │   ├── 02-replay.ts       executes recorded script, captures network
│   │   ├── 03-crawl.ts        auto-crawl GET via sidebar <a>
│   │   └── 04-analyze.ts      reads HARs, infers schemas, generates REPORT.md
│   ├── lib/
│   │   ├── auth.ts            extracts JWT from localStorage["user-storage"]
│   │   ├── network.ts         intercepts requests/responses → JSON
│   │   ├── schema-infer.ts    JSON sample → inferred schema
│   │   └── report.ts          assembles REPORT.md from artifacts
│   ├── config.ts              env + paths
│   └── *.test.ts              vitest unit tests co-located
├── recorded/                  output of stage 1 (gitignored)
│   ├── flow.spec.ts
│   └── auth-state.json
├── capture/                   output of stages 2+3+4 (gitignored)
│   └── <run-id>/
│       ├── replay/<rota-slug>/
│       ├── crawl/<rota-slug>/
│       └── analysis/
└── routes.txt                 fallback for routes auto-crawl misses
```

Run command: `pnpm scrape:all` runs `02 → 03 → 04` in sequence. Each stage also runnable individually (`pnpm scrape:record`, `pnpm scrape:replay`, etc).

## Components

### `stages/01-record.ts` — Interactive
- `chromium.launch({ headless: false })`
- Opens Playwright Inspector via `page.pause()` so the user can interact
- User navigates and clicks naturally; Inspector records the actions
- On close: writes `recorded/flow.spec.ts` and `recorded/auth-state.json` (cookies + localStorage including the JWT)

### `stages/02-replay.ts` — Replay with capture
- Reads `recorded/flow.spec.ts`
- Loads `recorded/auth-state.json` into the context
- Runs the script and intercepts every request/response via `page.on("response")`
- On every detected URL change, creates `capture/<run-id>/replay/<rota-slug>/`
- Saves: post-render HTML, full-page screenshot, HAR, `requests.json`, `meta.json`

### `stages/03-crawl.ts` — GET-only crawl
- Loads `recorded/auth-state.json`
- Starts at `/dashboard` (or configurable start route)
- Extracts `<a href>` from the sidebar (selector configurable via `SIDEBAR_SELECTOR` env)
- Visits each new internal route, captures the same artifacts as replay
- For lists (heuristic: many similar `<a>` siblings), enters the first item to capture `/resource/:id`
- Dedupes by normalized path. Hard limits: `MAX_PAGES=200`, `MAX_DEPTH=3` (configurable)
- Writes `_discovered.json` listing every route seen and how it was discovered

### `stages/04-analyze.ts` — Analysis
- Reads every `requests.json` from `replay/` and `crawl/`
- Filters for `Content-Type: application/json` API responses
- Groups by endpoint (method + normalized path, e.g. `/api/webinars/:id`)
- For each endpoint: collects request body sample + response body sample
- Calls `lib/schema-infer.ts` to derive a schema (recursive: string / number / boolean / array / nested object, optional/nullable detection)
- Detects entities (top-level keys recurring in list responses)
- Writes `endpoints.json`, `entities.json`, `pages.json`, and `REPORT.md`

### `lib/auth.ts` — JWT extraction
- `await page.evaluate(() => JSON.parse(localStorage.getItem("user-storage") ?? "{}"))`
- Persists into `auth-state.json` under `origins[].localStorage`
- Playwright's native `storageState` option restores it across runs

### `lib/network.ts` — Network interception
- Single response listener; emits `{ url, method, status, resourceType, requestHeaders, requestBody, responseHeaders, responseBody, timing }`
- Truncates bodies > 200 KB (configurable), flagging `truncated: true`
- Skips body capture for `Content-Type: video/*`, `image/*`, `font/*` (keeps headers and metadata only)

### `lib/schema-infer.ts` — JSON → schema
- Input: array of JSON samples for a single endpoint
- Output: `{ field: { type, optional, nullable, sample } }`
- Merges optionality and nullability across samples; detects array element schemas

### `lib/report.ts` — REPORT generator
- Sections in `REPORT.md`:
  1. Endpoints table (method, path pattern, sample count, status codes seen)
  2. Entities (inferred schemas as code blocks)
  3. Pages crawled (route, status, screenshot link, request count)
  4. Detected UI patterns (sidebar items, modals, forms — heuristic)

## Data Flow

### Stage 1 (record)
| in | out |
|---|---|
| `TARGET_BASE_URL`, `TARGET_LOGIN_EMAIL`, `TARGET_LOGIN_PASSWORD` (env); user interaction in browser | `recorded/flow.spec.ts`, `recorded/auth-state.json` |

### Stage 2 (replay)
| in | out |
|---|---|
| `recorded/flow.spec.ts`, `recorded/auth-state.json` | `capture/<run-id>/replay/<rota-slug>/{page.html, screenshot.png, network.har, requests.json, meta.json}` |

### Stage 3 (crawl)
| in | out |
|---|---|
| `recorded/auth-state.json`, `routes.txt` (optional fallback), `SIDEBAR_SELECTOR` env | `capture/<run-id>/crawl/<rota-slug>/{...}`, `capture/<run-id>/crawl/_discovered.json` |

### Stage 4 (analyze)
| in | out |
|---|---|
| `capture/<run-id>/replay/**/requests.json`, `capture/<run-id>/crawl/**/requests.json` | `capture/<run-id>/analysis/{endpoints.json, entities.json, pages.json, REPORT.md}` |

### Run isolation
- Run ID is the ISO timestamp `YYYY-MM-DDTHH-MM-SS`. Each run lives in its own folder; nothing overwrites previous runs.
- `capture/latest/` is a copy (not symlink — Windows-friendly) pointing to the most recent run.

### `requests.json` entry shape
```json
{
  "url": "https://api.original.com/webinars/abc123",
  "method": "GET",
  "status": 200,
  "resourceType": "fetch",
  "requestHeaders": { "authorization": "Bearer …", "accept": "application/json" },
  "requestBody": null,
  "responseHeaders": { "content-type": "application/json" },
  "responseBody": "{\"id\":\"abc123\",\"title\":\"…\"}",
  "timing": 1234,
  "truncated": false
}
```

### `endpoints.json` entry shape
```json
{
  "method": "GET",
  "pathPattern": "/api/webinars/:id",
  "samples": 3,
  "statusCodes": [200, 404],
  "requestBodySchema": null,
  "responseSchema": { "id": "string", "title": "string", "videoUrl": "string" }
}
```

## Error handling and edge cases

- **Login failure (stage 1):** detect via timeout on email/password selectors or unchanged URL post-login. Fall back to a visible browser pause and a terminal prompt asking the user to finish login manually and press ENTER.
- **JWT expires mid-crawl:** detect via 401 on any API response. Abort the stage with a clear message: "JWT expired, re-run `01-record`." No automatic refresh (refresh logic is platform-specific and out of scope).
- **404 / 500 from a route:** still capture the response (status is in `requests.json`). Log a warning, continue. Write `_errors.json` listing problematic routes.
- **Crawl loops:** dedupe by normalized path (strip query strings, replace IDs with `:id`). Hard limit `MAX_PAGES=200`, `MAX_DEPTH=3`.
- **Rate limiting:** configurable `CRAWL_DELAY_MS=500` between page visits. On 429: exponential backoff 1 s → 2 s → 4 s → abort.
- **Large response bodies:** see `lib/network.ts` rules above (skip video/image/font, truncate JSON > 200 KB).
- **Mid-run crash:** run-id isolation means nothing else is corrupted. `04-analyze` accepts incomplete runs, warning about gaps.
- **WebSockets:** capture via `page.on("websocket")`, save frames to `<rota>/websocket.json`. Useful because the original may use WS for chat.
- **Storage state drift:** re-snapshot `storageState` at the end of every route to capture any JWT refresh; detect changes and update `auth-state.json` as a copy `auth-state.<run-id>.json`.

## Testing

High-value, low-cost tests only.

- `lib/schema-infer.test.ts` — given an array of JSON samples, asserts the inferred schema (string, number, optional, nested, array)
- `lib/network.test.ts` — parser handles null bodies, binary bodies, and truncation correctly
- `stages/03-crawl.test.ts` — integration test against a local HTML fixture (mini Express server with a fake sidebar) to verify dedupe and depth limits

No live E2E tests against the original platform — too brittle. Validation is manual via the generated `REPORT.md`.

Stack: `vitest`. Tests are co-located as `*.test.ts`.

## Definition of Done

1. `pnpm scrape:record` opens a browser, saves `flow.spec.ts` and `auth-state.json` after the user finishes interacting
2. `pnpm scrape:replay` produces `capture/<run>/replay/` with ≥ 3 routes, each containing HTML, HAR, `requests.json`, and a screenshot
3. `pnpm scrape:crawl` discovers ≥ 10 routes via the sidebar and captures all of them
4. `pnpm scrape:analyze` produces `REPORT.md` containing:
   - Endpoints table with ≥ 10 unique endpoints
   - Inferred schemas for ≥ 3 entities (e.g. User, Webinar, Lead)
   - Pages-crawled list with status codes
5. Any individual stage can be re-run without invalidating the others' artifacts
6. `.gitignore` blocks `capture/`, `recorded/`, and any `auth-state*.json`
7. No credentials are hardcoded; everything goes through `.env`

## Out of scope (future phases)

- Generating Prisma schema from `entities.json`
- Generating Next.js routes from `pages.json`
- Migrating real production data
- Deployment (Coolify config exists in the repo but is out of scope for this phase)
