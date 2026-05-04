# MVP Sub-plan B2 — Video Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the upload + HLS transcode pipeline. Owners upload up to 10 GiB direct to MinIO via presigned URLs; a dedicated worker process transcodes to a 360p/720p/1080p/1440p HLS adaptive ladder, generates thumbnails, and serves both via a public bucket. Wizard step 4 ships with three tabs (External URL / Upload / Library) and the videos library page replaces its B1 stub.

**Architecture:** Monorepo expanded with `apps/worker` (Node + ffmpeg in alpine Docker) and `packages/jobs` (BullMQ + IORedis). Web enqueues jobs via `packages/jobs`; worker consumes them. Two MinIO buckets: `originals-private` (raw, presigned) + `hls-public` (anonymous GetObject). Web reuses the existing Next.js + Prisma + Better Auth stack from sub-plans A and B1.

**Tech Stack:** Next.js 15 (extends), Prisma 5 + Postgres, BullMQ 5 + IORedis 5, AWS SDK v3 S3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`), MinIO, ffmpeg system binary, mime, vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-05-04-mvp-B2-video-pipeline-design.md`](../specs/2026-05-04-mvp-B2-video-pipeline-design.md)

**Sub-plan series:**
- A — Foundation ✅
- B1 — Admin Webinar CRUD ✅
- **B2 — Video pipeline (this plan)**
- C — Lead opt-in + public player — future
- E — Real analytics — future
- F — Coolify deploy — future

---

## Pre-flight

The repo on `feat/capture-phase` has 19 B1 commits + 16 sub-plan A commits. Postgres `hotwebinar-pg` runs locally. There is no Redis or MinIO yet — Task 1 of this plan adds them via `docker-compose.yml` updates so subsequent tasks can run integration tests. The user prefers a commit per task. Each task ends with a single commit.

The seeded admin (`admin@example.com` / `test-password-min-12`) survives across tasks; integration tests scope deletes by their own test-user IDs (sub-plan B1 tech debt around `fileParallelism: false` is intentionally not refactored here — track for B2 hygiene if time permits, but tests still pass).

## File structure

```
hotwebinar-clone/
├── packages/
│   ├── db/                                          existing
│   └── jobs/                                        NEW
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                             re-exports
│           ├── connection.ts                        IORedis singleton
│           ├── queue.ts                             BullMQ Queue("video")
│           └── types.ts                             QUEUE_NAME, JOB_TRANSCODE, JOB_DELETE_ASSETS, payloads
│
├── apps/
│   ├── web/                                         existing (extends)
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── storage/
│   │       │   │   ├── s3.ts                        S3Client config (MinIO/R2 compat)
│   │       │   │   ├── presign.ts                   presignPut/presignGet/headObject
│   │       │   │   └── buckets.ts                   bucket name constants
│   │       │   └── hooks/
│   │       │       ├── use-presigned-upload.ts      client state machine
│   │       │       └── use-poll-videos.ts           polling helper
│   │       ├── app/api/
│   │       │   ├── upload/init/route.ts             POST → presigned PUT + Video QUEUED
│   │       │   ├── upload/complete/route.ts         POST → enqueue transcode job
│   │       │   ├── upload/thumb/route.ts            POST → presigned PUT for custom thumb
│   │       │   ├── videos/route.ts                  GET (status polling) + PATCH (custom thumb apply)
│   │       │   └── videos/[id]/retry/route.ts       POST → re-enqueue failed
│   │       ├── server/actions/
│   │       │   ├── video.ts                         listVideos / deleteVideo (force flag) / setCustomThumb / retryTranscode
│   │       │   └── webinar.ts                       EXTEND updateWebinarStep4 with discriminated union
│   │       ├── components/
│   │       │   ├── videos/
│   │       │   │   ├── usage-bar.tsx
│   │       │   │   ├── upload-button.tsx
│   │       │   │   ├── upload-dialog.tsx
│   │       │   │   ├── upload-dropzone.tsx          shared with wizard step 4
│   │       │   │   ├── upload-progress.tsx
│   │       │   │   ├── library-picker.tsx           shared with wizard step 4
│   │       │   │   ├── videos-table.tsx
│   │       │   │   ├── video-row-actions.tsx
│   │       │   │   ├── delete-video-dialog.tsx
│   │       │   │   ├── thumb-edit-dialog.tsx
│   │       │   │   └── client-polling.tsx
│   │       │   └── wizard/
│   │       │       └── step-4-form.tsx              EXTEND with 3 tabs
│   │       ├── lib/validations/
│   │       │   └── webinar.ts                       EXTEND step4Schema with discriminated union
│   │       └── app/dashboard/
│   │           └── videos/page.tsx                  REPLACE B1 stub with real library
│   │
│   └── worker/                                      NEW
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── Dockerfile
│       ├── .dockerignore
│       └── src/
│           ├── index.ts                             bootstrap (Workers + signal handlers)
│           ├── env.ts                               fail-closed env validation
│           ├── jobs/
│           │   ├── transcode-video.ts               full pipeline
│           │   └── delete-video-assets.ts           cleanup MinIO
│           ├── lib/
│           │   ├── s3.ts                            download/upload/delete prefix
│           │   ├── ffmpeg.ts                        spawn + stderr → progress %
│           │   ├── ladder.ts                        ladder presets + skip-upscale
│           │   ├── temp.ts                          mkdtemp + cleanup
│           │   └── ensure-buckets.ts                bucket auto-create + policies
│           └── test/
│               ├── lib/
│               │   ├── ladder.test.ts
│               │   ├── ffmpeg.test.ts
│               │   └── s3.test.ts
│               └── jobs/
│                   └── transcode-video.test.ts
│
├── docker-compose.yml                              EXTEND (+minio, +redis, +worker)
└── .env.example                                    EXTEND
```

### File responsibilities

- **`packages/jobs/src/connection.ts`** — single IORedis client, lazy-instantiated, used by both web's Queue and worker's Worker.
- **`packages/jobs/src/types.ts`** — single source of truth for job names + payload shapes. Both web and worker import from here.
- **`apps/web/src/lib/storage/s3.ts`** — S3Client with `forcePathStyle: true` (MinIO requires path-style URLs).
- **`apps/web/src/lib/storage/presign.ts`** — wraps `getSignedUrl` for PUT/GET, plus `headObject` for upload-complete verification.
- **`apps/worker/src/lib/ffmpeg.ts`** — pure stderr parser + spawn helper. Stderr parser is unit-testable without spawning ffmpeg.
- **`apps/worker/src/lib/ladder.ts`** — pure function `selectLadder(sourceHeight)` returning the variants to encode. Trivially unit-testable.
- **`apps/worker/src/jobs/transcode-video.ts`** — orchestrator. Pulls `Video` from DB, runs lib helpers, updates DB. Tests mock S3 + ffmpeg.

---

## Task 1: Prisma migration `add_video_thumbs`

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add the two new fields to the existing `Video` model**

Open `packages/db/prisma/schema.prisma`. Find the `Video` model. Add `thumbUrl` and `customThumbUrl` after `hlsUrl`. The full updated `Video` block:

```prisma
model Video {
  id              String      @id @default(cuid())
  ownerId         String
  name            String
  source          VideoSource
  originalUrl     String?
  hlsUrl          String?
  thumbUrl        String?
  customThumbUrl  String?
  status          VideoStatus @default(QUEUED)
  progress        Int         @default(0)
  durationSec     Int?
  bytes           BigInt?
  errorMessage    String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  owner           User        @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  webinars        Webinar[]
  @@index([ownerId, createdAt])
  @@map("video")
}
```

- [ ] **Step 2: Run migration**

```bash
DATABASE_URL="postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public" \
  pnpm --filter db prisma migrate dev --name add_video_thumbs
```

Expected: `packages/db/prisma/migrations/<timestamp>_add_video_thumbs/migration.sql` generated and applied. SQL adds two `TEXT` columns nullable with no default.

- [ ] **Step 3: Regenerate client**

```bash
pnpm --filter db generate
```

- [ ] **Step 4: Verify columns exist**

```bash
docker exec hotwebinar-pg psql -U hotwebinar -d hotwebinar -c "\d video"
```

Expected: lists `thumbUrl` and `customThumbUrl` as `text` nullable.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): add Video.thumbUrl and customThumbUrl"
```

---

## Task 2: `packages/jobs` scaffold

**Files:**
- Create: `packages/jobs/package.json`
- Create: `packages/jobs/tsconfig.json`
- Create: `packages/jobs/src/index.ts`
- Create: `packages/jobs/src/connection.ts`
- Create: `packages/jobs/src/queue.ts`
- Create: `packages/jobs/src/types.ts`

- [ ] **Step 1: Create `packages/jobs/package.json`**

```json
{
  "name": "jobs",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "bullmq": "5.21.0",
    "ioredis": "5.4.1"
  },
  "devDependencies": {
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 2: Create `packages/jobs/tsconfig.json`**

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
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/jobs/src/types.ts`**

```ts
export const QUEUE_NAME = "video";

export const JOB_TRANSCODE = "transcode-video";
export const JOB_DELETE_ASSETS = "delete-video-assets";

export interface TranscodePayload {
  videoId: string;
}

export interface DeleteAssetsPayload {
  videoId: string;
  ownerId: string;
}

export type JobStage =
  | "downloading"
  | "probing"
  | "transcoding"
  | "uploading"
  | "thumbnail";

export interface JobProgress {
  pct: number;
  stage: JobStage;
}
```

- [ ] **Step 4: Create `packages/jobs/src/connection.ts`**

```ts
import { Redis, type RedisOptions } from "ioredis";

let cached: Redis | undefined;

export function getRedisConnection(): Redis {
  if (cached) return cached;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("Missing env: REDIS_URL");
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
  cached = new Redis(url, options);
  return cached;
}
```

(`maxRetriesPerRequest: null` is required by BullMQ — see https://docs.bullmq.io/guide/connections.)

- [ ] **Step 5: Create `packages/jobs/src/queue.ts`**

```ts
import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";
import { QUEUE_NAME } from "./types.js";

let cached: Queue | undefined;

export function getVideoQueue(): Queue {
  if (cached) return cached;
  cached = new Queue(QUEUE_NAME, { connection: getRedisConnection() });
  return cached;
}
```

- [ ] **Step 6: Create `packages/jobs/src/index.ts`**

```ts
export * from "./types.js";
export { getRedisConnection } from "./connection.js";
export { getVideoQueue } from "./queue.js";
```

- [ ] **Step 7: Install + typecheck**

```bash
pnpm install
pnpm --filter jobs exec tsc --noEmit
```

Expected: no errors. Lockfile updated to include `bullmq` + `ioredis`.

- [ ] **Step 8: Commit**

```bash
git add packages/jobs pnpm-lock.yaml
git commit -m "feat(jobs): scaffold BullMQ queue package"
```

---

## Task 3: Web storage library (TDD)

**Files:**
- Modify: `apps/web/package.json` (add `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `mime`, `jobs` workspace dep)
- Create: `apps/web/src/lib/storage/buckets.ts`
- Create: `apps/web/src/lib/storage/s3.ts`
- Create: `apps/web/src/lib/storage/presign.ts`
- Create: `apps/web/src/test/lib/storage/buckets.test.ts`
- Create: `apps/web/src/test/lib/storage/presign.test.ts`

- [ ] **Step 1: Add dependencies to `apps/web/package.json`**

Append to `dependencies`:

```json
"@aws-sdk/client-s3": "3.665.0",
"@aws-sdk/s3-request-presigner": "3.665.0",
"mime": "4.0.4",
"jobs": "workspace:*"
```

Run `pnpm install`. Lockfile updated.

- [ ] **Step 2: Write failing test `apps/web/src/test/lib/storage/buckets.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";

beforeEach(() => {
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
});

describe("buckets", () => {
  it("exposes originals + hls bucket names from env", async () => {
    const mod = await import("@/lib/storage/buckets.js?" + Date.now());
    expect(mod.ORIGINALS_BUCKET).toBe("originals-private");
    expect(mod.HLS_BUCKET).toBe("hls-public");
  });

  it("throws when S3_BUCKET_ORIGINALS is missing", async () => {
    delete process.env.S3_BUCKET_ORIGINALS;
    await expect(import("@/lib/storage/buckets.js?" + Date.now() + 1)).rejects.toThrow(/S3_BUCKET_ORIGINALS/);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
pnpm --filter web test src/test/lib/storage/buckets.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `apps/web/src/lib/storage/buckets.ts`**

```ts
function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const ORIGINALS_BUCKET = must("S3_BUCKET_ORIGINALS");
export const HLS_BUCKET = must("S3_BUCKET_HLS");
```

- [ ] **Step 5: Implement `apps/web/src/lib/storage/s3.ts`**

```ts
import { S3Client } from "@aws-sdk/client-s3";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

let cached: S3Client | undefined;

export function getS3Client(): S3Client {
  if (cached) return cached;
  cached = new S3Client({
    endpoint: must("S3_ENDPOINT"),
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: must("S3_ACCESS_KEY"),
      secretAccessKey: must("S3_SECRET_KEY")
    },
    forcePathStyle: true
  });
  return cached;
}
```

- [ ] **Step 6: Write failing test `apps/web/src/test/lib/storage/presign.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";

beforeEach(() => {
  process.env.S3_ENDPOINT = "http://localhost:9000";
  process.env.S3_REGION = "us-east-1";
  process.env.S3_ACCESS_KEY = "test-access";
  process.env.S3_SECRET_KEY = "test-secret-at-least-12";
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
});

describe("presign", () => {
  it("presignPut returns a URL containing the bucket and key", async () => {
    const { presignPut } = await import("@/lib/storage/presign.js?" + Date.now());
    const url = await presignPut("originals-private", "abc/raw.mp4", "video/mp4", 60);
    expect(url).toContain("originals-private");
    expect(url).toContain("abc/raw.mp4");
  });

  it("presignGet returns a URL containing the bucket and key", async () => {
    const { presignGet } = await import("@/lib/storage/presign.js?" + Date.now() + 1);
    const url = await presignGet("originals-private", "abc/raw.mp4", 60);
    expect(url).toContain("originals-private");
    expect(url).toContain("abc/raw.mp4");
  });
});
```

- [ ] **Step 7: Implement `apps/web/src/lib/storage/presign.ts`**

```ts
import { GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "./s3.js";

export async function presignPut(
  bucket: string,
  key: string,
  contentType: string,
  expiresInSec: number
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType
  });
  return getSignedUrl(getS3Client(), cmd, { expiresIn: expiresInSec });
}

export async function presignGet(
  bucket: string,
  key: string,
  expiresInSec: number
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(getS3Client(), cmd, { expiresIn: expiresInSec });
}

export async function headObject(bucket: string, key: string): Promise<{ exists: boolean; size?: number }> {
  try {
    const out = await getS3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { exists: true, size: typeof out.ContentLength === "number" ? out.ContentLength : undefined };
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && (err as { name?: string }).name === "NotFound") {
      return { exists: false };
    }
    if (err && typeof err === "object" && "$metadata" in err) {
      const meta = (err as { $metadata?: { httpStatusCode?: number } }).$metadata;
      if (meta?.httpStatusCode === 404) return { exists: false };
    }
    throw err;
  }
}
```

- [ ] **Step 8: Run tests + typecheck**

```bash
pnpm --filter web test src/test/lib/storage
pnpm --filter web typecheck
```

Expected: presign + buckets tests pass. Typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/storage apps/web/src/test/lib/storage pnpm-lock.yaml
git commit -m "feat(web): add S3 storage helpers (presign + buckets)"
```

---

## Task 4: docker-compose + env.example update

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `apps/web/.env.local` (NOT committed; user has to update locally)

- [ ] **Step 1: Replace `docker-compose.yml` with the dev compose**

Read current `docker-compose.yml` first (it's a tracked file from sub-plan A). Replace with:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: hotwebinar-pg
    environment:
      POSTGRES_USER: hotwebinar
      POSTGRES_PASSWORD: hotwebinar
      POSTGRES_DB: hotwebinar
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: hotwebinar-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data

  minio:
    image: minio/minio:latest
    container_name: hotwebinar-minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: hotwebinar
      MINIO_ROOT_PASSWORD: hotwebinar-min-12chars
    command: server /data --console-address ":9001"
    volumes:
      - miniodata:/data

volumes:
  pgdata:
  redisdata:
  miniodata:
```

(Keep `apps/scraper/` Postgres `hotwebinar-pg` running. The Postgres service in this compose uses the same name; if a standalone container is already running, stop it first via `docker stop hotwebinar-pg && docker rm hotwebinar-pg` before `docker compose up -d`.)

- [ ] **Step 2: Append to `.env.example`**

Read current `.env.example` (already has Web + Scraper sections from prior sub-plans). Append:

```env
# ============ Storage (MinIO / S3-compat) ============
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_ACCESS_KEY="hotwebinar"
S3_SECRET_KEY="hotwebinar-min-12chars"
S3_BUCKET_ORIGINALS="originals-private"
S3_BUCKET_HLS="hls-public"
S3_PUBLIC_BASE_URL="http://localhost:9000"

# ============ Queue (Redis) ============
REDIS_URL="redis://localhost:6379"

# ============ Upload limits ============
MAX_UPLOAD_BYTES="10737418240"

# ============ Worker ============
WORKER_CONCURRENCY="1"
```

- [ ] **Step 3: Bring services up**

```bash
docker compose up -d
docker compose ps
```

Expected: `postgres`, `redis`, `minio` running. If `postgres` fails because the standalone container is on port 5432, stop the standalone first.

- [ ] **Step 4: Verify Redis + MinIO reachable**

```bash
docker exec hotwebinar-redis redis-cli ping
```
Expected: `PONG`.

```bash
curl -fsS http://localhost:9000/minio/health/live
```
Expected: `200 OK`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore: add Redis + MinIO services for B2 video pipeline"
```

---

## Task 5: Worker scaffold

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/vitest.config.ts`
- Create: `apps/worker/Dockerfile`
- Create: `apps/worker/.dockerignore`
- Create: `apps/worker/src/env.ts`
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/src/test/sanity.test.ts`

- [ ] **Step 1: Create `apps/worker/package.json`**

```json
{
  "name": "worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "dev": "tsx --watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "3.665.0",
    "bullmq": "5.21.0",
    "ioredis": "5.4.1",
    "db": "workspace:*",
    "jobs": "workspace:*",
    "dotenv": "16.4.5"
  },
  "devDependencies": {
    "@types/node": "22.7.5",
    "tsx": "4.19.1",
    "typescript": "5.6.3",
    "vitest": "2.1.4"
  }
}
```

- [ ] **Step 2: Create `apps/worker/tsconfig.json`**

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
  "include": ["src/**/*", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `apps/worker/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/test/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
```

- [ ] **Step 4: Create `apps/worker/.dockerignore`**

```
node_modules
.next
dist
*.log
.env
.env.local
test
```

- [ ] **Step 5: Create `apps/worker/Dockerfile`**

```dockerfile
FROM node:20-alpine

RUN apk add --no-cache ffmpeg curl tini
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/jobs/package.json ./packages/jobs/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile --filter worker... --filter db... --filter jobs...

COPY packages/db ./packages/db
COPY packages/jobs ./packages/jobs
COPY apps/worker ./apps/worker

RUN pnpm --filter db generate

ENV NODE_ENV=production

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "--filter", "worker", "start"]
```

- [ ] **Step 6: Create `apps/worker/src/env.ts`**

```ts
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.resolve(repoRoot, ".env.local") });
dotenv.config({ path: path.resolve(repoRoot, ".env") });

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Env ${name} is not a number: ${raw}`);
  return n;
}

export const config = {
  databaseUrl: must("DATABASE_URL"),
  redisUrl: must("REDIS_URL"),
  s3Endpoint: must("S3_ENDPOINT"),
  s3Region: process.env.S3_REGION ?? "us-east-1",
  s3AccessKey: must("S3_ACCESS_KEY"),
  s3SecretKey: must("S3_SECRET_KEY"),
  s3BucketOriginals: must("S3_BUCKET_ORIGINALS"),
  s3BucketHls: must("S3_BUCKET_HLS"),
  s3PublicBaseUrl: must("S3_PUBLIC_BASE_URL"),
  workerConcurrency: num("WORKER_CONCURRENCY", 1),
  tmpRoot: process.env.WORKER_TMP_ROOT ?? "/tmp"
};
```

- [ ] **Step 7: Create `apps/worker/src/index.ts` (stub for sanity)**

```ts
import "./env.js";

console.log("[worker] booted");
```

(Real bootstrap with BullMQ Workers comes in Task 11 once jobs are implemented. Step 7 just produces a runnable scaffold.)

- [ ] **Step 8: Create `apps/worker/src/test/sanity.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 9: Install + typecheck + test**

```bash
pnpm install
pnpm --filter worker typecheck
pnpm --filter worker test
```

Expected: typecheck clean. 1 sanity test passes.

- [ ] **Step 10: Commit**

```bash
git add apps/worker pnpm-lock.yaml
git commit -m "feat(worker): scaffold with Dockerfile, env loader, and sanity test"
```

---

## Task 6: Worker `lib/ladder.ts` (TDD)

**Files:**
- Create: `apps/worker/src/lib/ladder.ts`
- Create: `apps/worker/src/test/lib/ladder.test.ts`

- [ ] **Step 1: Write failing test `apps/worker/src/test/lib/ladder.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { selectLadder, LADDER, type Variant } from "@/lib/ladder.js";

describe("selectLadder", () => {
  it("returns all 4 variants when source is 1440p+", () => {
    const r = selectLadder(1440);
    expect(r.map((v) => v.height)).toEqual([360, 720, 1080, 1440]);
  });

  it("excludes 1440p when source is 1080p", () => {
    const r = selectLadder(1080);
    expect(r.map((v) => v.height)).toEqual([360, 720, 1080]);
  });

  it("returns only 360p when source is 480p", () => {
    const r = selectLadder(480);
    expect(r.map((v) => v.height)).toEqual([360]);
  });

  it("returns single matching variant for sub-360p source", () => {
    const r = selectLadder(240);
    expect(r).toHaveLength(1);
    expect(r[0].height).toBe(240);
  });

  it("LADDER preset has expected fields per variant", () => {
    for (const v of LADDER) {
      expect(typeof v.height).toBe("number");
      expect(typeof v.width).toBe("number");
      expect(typeof v.bitrate).toBe("string");
      expect(typeof v.audioBitrate).toBe("string");
    }
  });

  it("Variant type is exported", () => {
    const v: Variant = { height: 720, width: 1280, bitrate: "2500k", audioBitrate: "128k" };
    expect(v.height).toBe(720);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter worker test src/test/lib/ladder.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/worker/src/lib/ladder.ts`**

```ts
export interface Variant {
  height: number;
  width: number;
  bitrate: string;
  audioBitrate: string;
}

export const LADDER: ReadonlyArray<Variant> = [
  { height: 360, width: 640, bitrate: "800k", audioBitrate: "96k" },
  { height: 720, width: 1280, bitrate: "2500k", audioBitrate: "128k" },
  { height: 1080, width: 1920, bitrate: "5000k", audioBitrate: "128k" },
  { height: 1440, width: 2560, bitrate: "8000k", audioBitrate: "192k" }
];

export function selectLadder(sourceHeight: number): Variant[] {
  if (sourceHeight <= 0) return [];
  const fitting = LADDER.filter((v) => v.height <= sourceHeight);
  if (fitting.length === 0) {
    // source is below the smallest preset; encode at source height with 360p bitrate
    const base = LADDER[0];
    return [{ ...base, height: sourceHeight, width: Math.round((sourceHeight * 16) / 9) }];
  }
  return fitting.map((v) => ({ ...v }));
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter worker test src/test/lib/ladder.test.ts
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/lib/ladder.ts apps/worker/src/test/lib/ladder.test.ts
git commit -m "feat(worker): add ladder preset selector"
```

---

## Task 7: Worker `lib/ffmpeg.ts` parser (TDD)

**Files:**
- Create: `apps/worker/src/lib/ffmpeg.ts`
- Create: `apps/worker/src/test/lib/ffmpeg.test.ts`

- [ ] **Step 1: Write failing test `apps/worker/src/test/lib/ffmpeg.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseFfmpegProgressLine, ffmpegPctFromTime } from "@/lib/ffmpeg.js";

describe("parseFfmpegProgressLine", () => {
  it("extracts elapsed seconds from 'time=' fragment", () => {
    const line = "frame= 1234 fps= 23 q=28.0 size=    2048kB time=00:00:42.50 bitrate= 394.6kbits/s";
    expect(parseFfmpegProgressLine(line)).toBeCloseTo(42.5, 1);
  });

  it("returns null for non-progress lines", () => {
    expect(parseFfmpegProgressLine("[hls @ 0x55] Opening segment for writing")).toBeNull();
  });

  it("handles minutes correctly", () => {
    const line = "frame=  100 fps= 23 q=28.0 size=    1024kB time=00:01:30.00 bitrate= 100.0kbits/s";
    expect(parseFfmpegProgressLine(line)).toBeCloseTo(90, 1);
  });

  it("handles hours correctly", () => {
    const line = "frame=  100 fps= 23 q=28.0 size=    1024kB time=01:00:00.00 bitrate= 100.0kbits/s";
    expect(parseFfmpegProgressLine(line)).toBeCloseTo(3600, 1);
  });
});

describe("ffmpegPctFromTime", () => {
  it("scales elapsed/total into [start, end]", () => {
    expect(ffmpegPctFromTime(0, 100, 10, 80)).toBe(10);
    expect(ffmpegPctFromTime(50, 100, 10, 80)).toBe(45);
    expect(ffmpegPctFromTime(100, 100, 10, 80)).toBe(80);
  });

  it("clamps over-shoot to upper bound", () => {
    expect(ffmpegPctFromTime(120, 100, 10, 80)).toBe(80);
  });

  it("returns lower bound when total is 0", () => {
    expect(ffmpegPctFromTime(50, 0, 10, 80)).toBe(10);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter worker test src/test/lib/ffmpeg.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/worker/src/lib/ffmpeg.ts`**

```ts
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const TIME_RE = /\btime=(\d+):(\d+):(\d+(?:\.\d+)?)/;

/**
 * Returns elapsed seconds parsed from a single ffmpeg stderr line, or null.
 */
export function parseFfmpegProgressLine(line: string): number | null {
  const m = line.match(TIME_RE);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const s = parseFloat(m[3]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || !Number.isFinite(s)) return null;
  return h * 3600 + min * 60 + s;
}

/**
 * Maps elapsed/total seconds onto [start, end] percentage range, clamped to end.
 */
export function ffmpegPctFromTime(
  elapsedSec: number,
  totalSec: number,
  start: number,
  end: number
): number {
  if (totalSec <= 0) return start;
  const ratio = Math.min(1, elapsedSec / totalSec);
  return Math.round(start + ratio * (end - start));
}

export interface FfmpegOptions {
  args: string[];
  onProgressLine?: (elapsedSec: number) => void;
}

export interface FfmpegResult {
  exitCode: number;
  stderrTail: string;
}

/**
 * Runs `ffmpeg` with the supplied args and resolves with exit code + stderr tail.
 * Streams stderr lines through `onProgressLine` for time-based progress reporting.
 */
export function runFfmpeg(opts: FfmpegOptions): Promise<FfmpegResult> {
  return new Promise((resolve) => {
    const proc: ChildProcessWithoutNullStreams = spawn("ffmpeg", opts.args, { stdio: ["ignore", "pipe", "pipe"] });
    let buffer = "";
    const stderrLines: string[] = [];
    const MAX_TAIL_LINES = 50;

    proc.stderr.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r\n|\r|\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        stderrLines.push(line);
        if (stderrLines.length > MAX_TAIL_LINES) stderrLines.shift();
        if (opts.onProgressLine) {
          const elapsed = parseFfmpegProgressLine(line);
          if (elapsed !== null) opts.onProgressLine(elapsed);
        }
      }
    });

    proc.on("close", (exitCode) => {
      if (buffer.length > 0) stderrLines.push(buffer);
      resolve({
        exitCode: exitCode ?? -1,
        stderrTail: stderrLines.join("\n").slice(-1024)
      });
    });
  });
}

/**
 * Returns the source video's height (px) and duration (sec) via ffprobe.
 */
export function ffprobe(inputPath: string): Promise<{ height: number; durationSec: number }> {
  return new Promise((resolve, reject) => {
    const args = [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=height:format=duration",
      "-of", "json",
      inputPath
    ];
    const proc = spawn("ffprobe", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
    proc.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed (${code}): ${stderr.slice(-512)}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as { streams?: Array<{ height?: number }>; format?: { duration?: string } };
        const height = parsed.streams?.[0]?.height ?? 0;
        const durationSec = parseFloat(parsed.format?.duration ?? "0");
        if (height <= 0 || !Number.isFinite(durationSec) || durationSec <= 0) {
          reject(new Error("ffprobe: invalid stream metadata"));
          return;
        }
        resolve({ height, durationSec });
      } catch (err) {
        reject(err);
      }
    });
  });
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter worker test src/test/lib/ffmpeg.test.ts
```

Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/lib/ffmpeg.ts apps/worker/src/test/lib/ffmpeg.test.ts
git commit -m "feat(worker): add ffmpeg parser and runner"
```

---

## Task 8: Worker `lib/s3.ts`, `lib/temp.ts`, `lib/ensure-buckets.ts`

**Files:**
- Create: `apps/worker/src/lib/s3.ts`
- Create: `apps/worker/src/lib/temp.ts`
- Create: `apps/worker/src/lib/ensure-buckets.ts`
- Create: `apps/worker/src/test/lib/temp.test.ts`

- [ ] **Step 1: Implement `apps/worker/src/lib/s3.ts`**

```ts
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  type _Object
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import fs from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { config } from "../env.js";

let cached: S3Client | undefined;

export function getS3(): S3Client {
  if (cached) return cached;
  cached = new S3Client({
    endpoint: config.s3Endpoint,
    region: config.s3Region,
    credentials: { accessKeyId: config.s3AccessKey, secretAccessKey: config.s3SecretKey },
    forcePathStyle: true
  });
  return cached;
}

export async function downloadObjectToFile(bucket: string, key: string, destPath: string): Promise<void> {
  const out = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!(out.Body instanceof Readable)) throw new Error(`S3 GetObject Body is not a readable stream for ${key}`);
  await fs.mkdir(destPath.replace(/[/\\][^/\\]*$/, ""), { recursive: true });
  await pipeline(out.Body, createWriteStream(destPath));
}

export async function uploadFileToObject(
  bucket: string,
  key: string,
  filePath: string,
  contentType: string
): Promise<void> {
  const body = createReadStream(filePath);
  const stat = await fs.stat(filePath);
  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: stat.size
    })
  );
}

export async function deletePrefix(bucket: string, prefix: string): Promise<number> {
  let deleted = 0;
  let token: string | undefined;
  while (true) {
    const out = await getS3().send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token })
    );
    const objects: _Object[] = out.Contents ?? [];
    for (const obj of objects) {
      if (!obj.Key) continue;
      await getS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
      deleted += 1;
    }
    if (!out.IsTruncated) break;
    token = out.NextContinuationToken;
  }
  return deleted;
}
```

- [ ] **Step 2: Implement `apps/worker/src/lib/temp.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { config } from "../env.js";

export interface TempDir {
  path: string;
  cleanup: () => Promise<void>;
}

export async function makeJobTempDir(jobId: string): Promise<TempDir> {
  const root = config.tmpRoot ?? os.tmpdir();
  const dir = path.join(root, `transcode-${jobId}-${Date.now()}`);
  await fs.mkdir(dir, { recursive: true });
  return {
    path: dir,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    }
  };
}
```

- [ ] **Step 3: Write failing test `apps/worker/src/test/lib/temp.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.S3_ENDPOINT = "http://localhost:9000";
  process.env.S3_ACCESS_KEY = "test";
  process.env.S3_SECRET_KEY = "test-min-12chars";
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
  process.env.S3_PUBLIC_BASE_URL = "http://localhost:9000";
  process.env.WORKER_TMP_ROOT = os.tmpdir();
});

describe("makeJobTempDir", () => {
  it("creates a writable directory and cleanup removes it", async () => {
    const { makeJobTempDir } = await import("@/lib/temp.js?" + Date.now());
    const tmp = await makeJobTempDir("job-1");
    await fs.writeFile(`${tmp.path}/touch.txt`, "ok");
    expect(await fs.readFile(`${tmp.path}/touch.txt`, "utf8")).toBe("ok");
    await tmp.cleanup();
    await expect(fs.access(tmp.path)).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter worker test src/test/lib/temp.test.ts
```

Expected: 1 passing.

- [ ] **Step 5: Implement `apps/worker/src/lib/ensure-buckets.ts`**

```ts
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand
} from "@aws-sdk/client-s3";
import { getS3 } from "./s3.js";
import { config } from "../env.js";

const PUBLIC_READ_POLICY = (bucket: string) =>
  JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/*`]
      }
    ]
  });

async function ensureBucket(name: string, publicRead: boolean): Promise<void> {
  const s3 = getS3();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: name }));
  } catch (err) {
    const code = (err as { name?: string }).name;
    if (code === "NotFound" || code === "NoSuchBucket") {
      await s3.send(new CreateBucketCommand({ Bucket: name }));
      console.log(`[worker] created bucket: ${name}`);
    } else {
      throw err;
    }
  }
  if (publicRead) {
    await s3.send(new PutBucketPolicyCommand({ Bucket: name, Policy: PUBLIC_READ_POLICY(name) }));
  }
}

export async function ensureBuckets(): Promise<void> {
  await ensureBucket(config.s3BucketOriginals, false);
  await ensureBucket(config.s3BucketHls, true);
}
```

- [ ] **Step 6: Run typecheck**

```bash
pnpm --filter worker typecheck
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/lib apps/worker/src/test/lib/temp.test.ts
git commit -m "feat(worker): add S3 helpers, temp dir mgmt, and bucket bootstrap"
```

---

## Task 9: Worker `jobs/transcode-video.ts` (TDD with mocks)

**Files:**
- Create: `apps/worker/src/jobs/transcode-video.ts`
- Create: `apps/worker/src/test/jobs/transcode-video.test.ts`

- [ ] **Step 1: Write the failing test `apps/worker/src/test/jobs/transcode-video.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";
import os from "node:os";

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.S3_ENDPOINT = "http://localhost:9000";
  process.env.S3_ACCESS_KEY = "test";
  process.env.S3_SECRET_KEY = "test-min-12chars";
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
  process.env.S3_PUBLIC_BASE_URL = "http://localhost:9000";
  process.env.WORKER_TMP_ROOT = os.tmpdir();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const TEST_USER = { id: "trv-user", email: "trv@example.com", name: "TR Tester" };

async function setupOwnerAndVideo(originalKey: string) {
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.cta.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.video.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  const video = await prisma.video.create({
    data: {
      ownerId: TEST_USER.id,
      name: "test.mp4",
      source: "UPLOAD",
      originalUrl: originalKey,
      status: "QUEUED",
      progress: 0
    }
  });
  return video;
}

describe("transcodeVideo", () => {
  it("transitions QUEUED → READY on happy path", async () => {
    const video = await setupOwnerAndVideo(`${"x".repeat(0)}videos/raw.mp4`);

    vi.mock("@/lib/s3.js", () => ({
      getS3: vi.fn(),
      downloadObjectToFile: vi.fn(async () => undefined),
      uploadFileToObject: vi.fn(async () => undefined),
      deletePrefix: vi.fn(async () => 0)
    }));
    vi.mock("@/lib/ffmpeg.js", () => ({
      ffprobe: vi.fn(async () => ({ height: 720, durationSec: 60 })),
      runFfmpeg: vi.fn(async (opts: { onProgressLine?: (s: number) => void }) => {
        opts.onProgressLine?.(60);
        return { exitCode: 0, stderrTail: "" };
      })
    }));
    vi.mock("@/lib/temp.js", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const ostmp = await import("node:os");
      return {
        makeJobTempDir: vi.fn(async (id: string) => {
          const dir = path.join(ostmp.tmpdir(), `t-${id}`);
          await fs.mkdir(dir, { recursive: true });
          // pre-create files the upload step expects
          await fs.writeFile(path.join(dir, "master.m3u8"), "");
          await fs.writeFile(path.join(dir, "360p.m3u8"), "");
          await fs.writeFile(path.join(dir, "720p.m3u8"), "");
          await fs.writeFile(path.join(dir, "thumb.jpg"), "");
          return { path: dir, cleanup: async () => fs.rm(dir, { recursive: true, force: true }) };
        })
      };
    });

    const { transcodeVideo } = await import("@/jobs/transcode-video.js");
    const fakeJob = {
      id: "test-job",
      data: { videoId: video.id },
      updateProgress: vi.fn(async () => undefined)
    };
    await transcodeVideo(fakeJob as never);

    const after = await prisma.video.findUnique({ where: { id: video.id } });
    expect(after?.status).toBe("READY");
    expect(after?.progress).toBe(100);
    expect(after?.hlsUrl).toContain("/master.m3u8");
    expect(after?.thumbUrl).toContain("/thumb.jpg");
    expect(after?.durationSec).toBe(60);
  });

  it("skips when Video.status is already READY (idempotent)", async () => {
    const video = await setupOwnerAndVideo("videos/raw.mp4");
    await prisma.video.update({ where: { id: video.id }, data: { status: "READY" } });

    vi.resetModules();
    vi.doMock("@/lib/s3.js", () => ({
      downloadObjectToFile: vi.fn(async () => { throw new Error("should not download"); }),
      uploadFileToObject: vi.fn(),
      deletePrefix: vi.fn(),
      getS3: vi.fn()
    }));
    vi.doMock("@/lib/ffmpeg.js", () => ({
      ffprobe: vi.fn(async () => { throw new Error("should not probe"); }),
      runFfmpeg: vi.fn()
    }));
    vi.doMock("@/lib/temp.js", () => ({
      makeJobTempDir: vi.fn(async () => { throw new Error("should not make tmp"); })
    }));
    const { transcodeVideo } = await import("@/jobs/transcode-video.js?" + Date.now());

    const fakeJob = { id: "j2", data: { videoId: video.id }, updateProgress: vi.fn(async () => undefined) };
    await transcodeVideo(fakeJob as never);

    const after = await prisma.video.findUnique({ where: { id: video.id } });
    expect(after?.status).toBe("READY");
  });

  it("transitions to FAILED when ffmpeg returns non-zero exit", async () => {
    const video = await setupOwnerAndVideo("videos/raw.mp4");

    vi.resetModules();
    vi.doMock("@/lib/s3.js", () => ({
      downloadObjectToFile: vi.fn(async () => undefined),
      uploadFileToObject: vi.fn(async () => undefined),
      deletePrefix: vi.fn(async () => 0),
      getS3: vi.fn()
    }));
    vi.doMock("@/lib/ffmpeg.js", () => ({
      ffprobe: vi.fn(async () => ({ height: 720, durationSec: 60 })),
      runFfmpeg: vi.fn(async () => ({ exitCode: 1, stderrTail: "fatal: corrupt" }))
    }));
    vi.doMock("@/lib/temp.js", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const ostmp = await import("node:os");
      return {
        makeJobTempDir: vi.fn(async (id: string) => {
          const dir = path.join(ostmp.tmpdir(), `t-${id}-fail`);
          await fs.mkdir(dir, { recursive: true });
          return { path: dir, cleanup: async () => fs.rm(dir, { recursive: true, force: true }) };
        })
      };
    });

    const { transcodeVideo } = await import("@/jobs/transcode-video.js?" + Date.now() + 1);
    const fakeJob = { id: "j3", data: { videoId: video.id }, updateProgress: vi.fn(async () => undefined) };
    await expect(transcodeVideo(fakeJob as never)).rejects.toThrow();

    const after = await prisma.video.findUnique({ where: { id: video.id } });
    expect(after?.status).toBe("FAILED");
    expect(after?.errorMessage).toContain("fatal: corrupt");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter worker test src/test/jobs/transcode-video.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/worker/src/jobs/transcode-video.ts`**

```ts
import path from "node:path";
import { type Job } from "bullmq";
import { prisma } from "db";
import type { TranscodePayload, JobProgress } from "jobs";
import { config } from "../env.js";
import { downloadObjectToFile, uploadFileToObject, deletePrefix } from "../lib/s3.js";
import { ffprobe, runFfmpeg, ffmpegPctFromTime } from "../lib/ffmpeg.js";
import { makeJobTempDir } from "../lib/temp.js";
import { selectLadder } from "../lib/ladder.js";

function publicUrl(key: string): string {
  return `${config.s3PublicBaseUrl}/${config.s3BucketHls}/${key}`;
}

async function reportProgress(job: Job, p: JobProgress) {
  await job.updateProgress(p);
  await prisma.video.update({
    where: { id: (job.data as TranscodePayload).videoId },
    data: { progress: Math.min(100, Math.max(0, Math.round(p.pct))) }
  });
}

export async function transcodeVideo(job: Job<TranscodePayload>): Promise<void> {
  const { videoId } = job.data;
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) {
    console.warn(`[transcode] video ${videoId} not found, skipping`);
    return;
  }
  if (video.status === "READY") {
    console.log(`[transcode] video ${videoId} already READY, skipping (idempotent)`);
    return;
  }
  if (!video.originalUrl) {
    throw new Error(`Video ${videoId} has no originalUrl`);
  }

  await prisma.video.update({ where: { id: videoId }, data: { status: "PROCESSING", progress: 0, errorMessage: null } });
  await reportProgress(job, { pct: 0, stage: "downloading" });

  const tmp = await makeJobTempDir(job.id ?? videoId);
  const rawPath = path.join(tmp.path, "raw");

  try {
    await downloadObjectToFile(config.s3BucketOriginals, video.originalUrl, rawPath);
    await reportProgress(job, { pct: 5, stage: "probing" });

    const probe = await ffprobe(rawPath);
    const ladder = selectLadder(probe.height);
    if (ladder.length === 0) throw new Error("Empty ladder for source height");

    await reportProgress(job, { pct: 10, stage: "transcoding" });

    // Build ffmpeg args: 1 input, N variants, HLS muxer with master playlist.
    const args: string[] = ["-y", "-i", rawPath];
    const variantOutputs: string[] = [];
    const masterEntries: string[] = [];

    for (const v of ladder) {
      const variantName = `${v.height}p`;
      const playlistFile = path.join(tmp.path, `${variantName}.m3u8`);
      args.push(
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-vf", `scale=-2:${v.height}`,
        "-b:v", v.bitrate,
        "-c:a", "aac",
        "-b:a", v.audioBitrate,
        "-hls_time", "6",
        "-hls_playlist_type", "vod",
        "-hls_segment_filename", path.join(tmp.path, `${variantName}_%03d.ts`),
        "-f", "hls",
        playlistFile
      );
      variantOutputs.push(playlistFile);
      const widthHint = v.width;
      masterEntries.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(v.bitrate, 10) * 1000},RESOLUTION=${widthHint}x${v.height}\n${variantName}.m3u8`
      );
    }

    const result = await runFfmpeg({
      args,
      onProgressLine: (elapsed) => {
        const pct = ffmpegPctFromTime(elapsed, probe.durationSec, 10, 80);
        void reportProgress(job, { pct, stage: "transcoding" });
      }
    });
    if (result.exitCode !== 0) {
      throw new Error(`ffmpeg exit ${result.exitCode}: ${result.stderrTail}`);
    }

    // Write master playlist.
    const masterPath = path.join(tmp.path, "master.m3u8");
    const masterBody = ["#EXTM3U", "#EXT-X-VERSION:3", ...masterEntries].join("\n") + "\n";
    const fs = await import("node:fs/promises");
    await fs.writeFile(masterPath, masterBody, "utf8");

    // Generate thumbnail at duration/2.
    await reportProgress(job, { pct: 80, stage: "thumbnail" });
    const thumbPath = path.join(tmp.path, "thumb.jpg");
    const thumbResult = await runFfmpeg({
      args: [
        "-y",
        "-ss", String(Math.max(0, probe.durationSec / 2)),
        "-i", rawPath,
        "-frames:v", "1",
        "-q:v", "5",
        "-vf", "scale=320:-2",
        thumbPath
      ]
    });
    if (thumbResult.exitCode !== 0) {
      console.warn(`[transcode] thumb gen failed: ${thumbResult.stderrTail.slice(-200)}`);
    }

    await reportProgress(job, { pct: 85, stage: "uploading" });

    // Upload all variants + segments + master + thumb to hls-public/<videoId>/.
    const entries = await fs.readdir(tmp.path);
    for (const entry of entries) {
      if (entry === "raw") continue;
      const local = path.join(tmp.path, entry);
      const stat = await fs.stat(local);
      if (!stat.isFile()) continue;
      const contentType = entry.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : entry.endsWith(".ts")
          ? "video/mp2t"
          : entry.endsWith(".jpg")
            ? "image/jpeg"
            : "application/octet-stream";
      await uploadFileToObject(config.s3BucketHls, `${videoId}/${entry}`, local, contentType);
    }

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "READY",
        hlsUrl: publicUrl(`${videoId}/master.m3u8`),
        thumbUrl: publicUrl(`${videoId}/thumb.jpg`),
        durationSec: Math.round(probe.durationSec),
        progress: 100,
        errorMessage: null
      }
    });
    await job.updateProgress({ pct: 100, stage: "uploading" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", errorMessage: msg.slice(0, 1024) }
    });
    // Best-effort cleanup of partial uploads
    await deletePrefix(config.s3BucketHls, `${videoId}/`).catch(() => undefined);
    throw err;
  } finally {
    await tmp.cleanup().catch(() => undefined);
  }
}
```

- [ ] **Step 4: Run to verify the tests pass**

```bash
pnpm --filter worker test src/test/jobs/transcode-video.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/jobs/transcode-video.ts apps/worker/src/test/jobs/transcode-video.test.ts
git commit -m "feat(worker): add transcode-video job (mocked tests)"
```

---

## Task 10: Worker `jobs/delete-video-assets.ts`

**Files:**
- Create: `apps/worker/src/jobs/delete-video-assets.ts`

- [ ] **Step 1: Implement `apps/worker/src/jobs/delete-video-assets.ts`**

```ts
import { type Job } from "bullmq";
import type { DeleteAssetsPayload } from "jobs";
import { config } from "../env.js";
import { deletePrefix } from "../lib/s3.js";

export async function deleteVideoAssets(job: Job<DeleteAssetsPayload>): Promise<void> {
  const { videoId } = job.data;
  const originalsDeleted = await deletePrefix(config.s3BucketOriginals, `${videoId}/`).catch((err) => {
    console.error(`[delete-assets] failed to clean originals for ${videoId}:`, err);
    return 0;
  });
  const hlsDeleted = await deletePrefix(config.s3BucketHls, `${videoId}/`).catch((err) => {
    console.error(`[delete-assets] failed to clean hls for ${videoId}:`, err);
    return 0;
  });
  console.log(`[delete-assets] video ${videoId} cleaned: ${originalsDeleted} originals, ${hlsDeleted} hls files`);
}
```

- [ ] **Step 2: Update `apps/worker/src/index.ts` to register both jobs**

```ts
import "./env.js";
import { Worker } from "bullmq";
import { getRedisConnection, QUEUE_NAME, JOB_TRANSCODE, JOB_DELETE_ASSETS } from "jobs";
import { transcodeVideo } from "./jobs/transcode-video.js";
import { deleteVideoAssets } from "./jobs/delete-video-assets.js";
import { ensureBuckets } from "./lib/ensure-buckets.js";
import { config } from "./env.js";

async function main() {
  await ensureBuckets();
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === JOB_TRANSCODE) return transcodeVideo(job);
      if (job.name === JOB_DELETE_ASSETS) return deleteVideoAssets(job);
      throw new Error(`Unknown job: ${job.name}`);
    },
    { connection: getRedisConnection(), concurrency: config.workerConcurrency }
  );

  worker.on("ready", () => console.log(`[worker] ready, concurrency ${config.workerConcurrency}`));
  worker.on("failed", (job, err) => console.error(`[worker] failed ${job?.id}: ${err.message}`));

  const shutdown = async () => {
    console.log("[worker] graceful shutdown");
    await worker.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter worker typecheck
```

Expected: clean.

- [ ] **Step 4: Smoke run**

```bash
pnpm --filter worker dev
```

Expected: prints `[worker] ready, concurrency 1`. Stop with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/jobs/delete-video-assets.ts apps/worker/src/index.ts
git commit -m "feat(worker): register transcode and delete-assets workers"
```

---

## Task 11: Web upload routes (TDD)

**Files:**
- Create: `apps/web/src/app/api/upload/init/route.ts`
- Create: `apps/web/src/app/api/upload/complete/route.ts`
- Create: `apps/web/src/app/api/upload/thumb/route.ts`
- Create: `apps/web/src/test/api/upload-init.test.ts`
- Create: `apps/web/src/test/api/upload-complete.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/api/upload-init.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "ui-user", email: "ui@example.com", name: "UI" };

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: TEST_USER, session: { id: "s", userId: TEST_USER.id } }) } }
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/storage/presign.js", () => ({
  presignPut: vi.fn(async () => "http://signed.example/abc"),
  presignGet: vi.fn(),
  headObject: vi.fn(async () => ({ exists: true, size: 1234 }))
}));

beforeEach(async () => {
  process.env.MAX_UPLOAD_BYTES = String(10 * 1024 * 1024 * 1024);
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
  await prisma.video.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
});
afterAll(async () => prisma.$disconnect());

describe("POST /api/upload/init", () => {
  it("returns presigned URL + new Video QUEUED", async () => {
    const { POST } = await import("@/app/api/upload/init/route");
    const req = new Request("http://localhost/api/upload/init", {
      method: "POST",
      body: JSON.stringify({ name: "vid.mp4", sizeBytes: 1_000_000, mimeType: "video/mp4" }),
      headers: { "content-type": "application/json" }
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.uploadUrl).toBe("http://signed.example/abc");
    expect(body.videoId).toBeDefined();
    const video = await prisma.video.findUnique({ where: { id: body.videoId } });
    expect(video?.status).toBe("QUEUED");
    expect(video?.source).toBe("UPLOAD");
  });

  it("rejects non-video MIME", async () => {
    const { POST } = await import("@/app/api/upload/init/route");
    const req = new Request("http://localhost/api/upload/init", {
      method: "POST",
      body: JSON.stringify({ name: "doc.pdf", sizeBytes: 1000, mimeType: "application/pdf" }),
      headers: { "content-type": "application/json" }
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects size > MAX_UPLOAD_BYTES", async () => {
    process.env.MAX_UPLOAD_BYTES = "1000";
    const { POST } = await import("@/app/api/upload/init/route");
    const req = new Request("http://localhost/api/upload/init", {
      method: "POST",
      body: JSON.stringify({ name: "vid.mp4", sizeBytes: 2000, mimeType: "video/mp4" }),
      headers: { "content-type": "application/json" }
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });
});
```

- [ ] **Step 2: Implement `apps/web/src/app/api/upload/init/route.ts`**

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { presignPut } from "@/lib/storage/presign";
import { ORIGINALS_BUCKET } from "@/lib/storage/buckets";

const inputSchema = z.object({
  name: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string()
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }
  const { name, sizeBytes, mimeType } = parsed.data;

  if (!mimeType.startsWith("video/")) {
    return NextResponse.json({ error: "invalid_mime", message: "MIME deve ser video/*" }, { status: 400 });
  }

  const maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024 * 1024);
  if (sizeBytes > maxBytes) {
    return NextResponse.json(
      { error: "too_large", maxBytes, sizeBytes, message: `Arquivo > ${(maxBytes / (1024 ** 3)).toFixed(1)} GiB` },
      { status: 413 }
    );
  }

  // Determine extension from name (fallback .mp4)
  const ext = (name.split(".").pop() ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";

  const video = await prisma.video.create({
    data: {
      ownerId: session.user.id,
      name,
      source: "UPLOAD",
      originalUrl: "", // filled after we know the key
      status: "QUEUED",
      progress: 0,
      bytes: BigInt(sizeBytes)
    }
  });

  const key = `${video.id}/raw.${ext}`;
  await prisma.video.update({ where: { id: video.id }, data: { originalUrl: key } });

  const uploadUrl = await presignPut(ORIGINALS_BUCKET, key, mimeType, 15 * 60);

  return NextResponse.json({
    videoId: video.id,
    uploadUrl,
    headers: { "Content-Type": mimeType }
  });
}
```

- [ ] **Step 3: Run upload-init test**

```bash
pnpm --filter web test src/test/api/upload-init.test.ts
```

Expected: 3 passing.

- [ ] **Step 4: Write failing test `apps/web/src/test/api/upload-complete.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "uc-user", email: "uc@example.com", name: "UC" };

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: TEST_USER, session: { id: "s", userId: TEST_USER.id } }) } }
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const headObjectMock = vi.fn(async () => ({ exists: true, size: 1000 }));
const queueAddMock = vi.fn(async () => ({ id: "j1" }));

vi.mock("@/lib/storage/presign.js", () => ({
  presignPut: vi.fn(),
  presignGet: vi.fn(),
  headObject: headObjectMock
}));
vi.mock("jobs", async () => ({
  getVideoQueue: () => ({ add: queueAddMock }),
  JOB_TRANSCODE: "transcode-video",
  JOB_DELETE_ASSETS: "delete-video-assets",
  QUEUE_NAME: "video"
}));

beforeEach(async () => {
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
  await prisma.video.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  headObjectMock.mockClear();
  queueAddMock.mockClear();
});
afterAll(async () => prisma.$disconnect());

describe("POST /api/upload/complete", () => {
  it("enqueues job when raw exists in MinIO", async () => {
    const v = await prisma.video.create({
      data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", originalUrl: `${"a"}/raw.mp4`, status: "QUEUED" }
    });
    headObjectMock.mockResolvedValueOnce({ exists: true, size: 100 });
    const { POST } = await import("@/app/api/upload/complete/route");
    const req = new Request("http://localhost/api/upload/complete", {
      method: "POST",
      body: JSON.stringify({ videoId: v.id }),
      headers: { "content-type": "application/json" }
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(queueAddMock).toHaveBeenCalledWith(
      "transcode-video",
      { videoId: v.id },
      expect.objectContaining({ attempts: 3 })
    );
  });

  it("rejects when HEAD object missing", async () => {
    const v = await prisma.video.create({
      data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", originalUrl: "y/raw.mp4", status: "QUEUED" }
    });
    headObjectMock.mockResolvedValueOnce({ exists: false });
    const { POST } = await import("@/app/api/upload/complete/route?" + Date.now());
    const req = new Request("http://localhost/api/upload/complete", {
      method: "POST",
      body: JSON.stringify({ videoId: v.id }),
      headers: { "content-type": "application/json" }
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("rejects when video belongs to other user", async () => {
    await prisma.user.create({ data: { id: "other", email: "other@example.com", name: "Other" } });
    const v = await prisma.video.create({
      data: { ownerId: "other", name: "x", source: "UPLOAD", originalUrl: "z/raw.mp4", status: "QUEUED" }
    });
    const { POST } = await import("@/app/api/upload/complete/route?" + (Date.now() + 1));
    const req = new Request("http://localhost/api/upload/complete", {
      method: "POST",
      body: JSON.stringify({ videoId: v.id }),
      headers: { "content-type": "application/json" }
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(queueAddMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Implement `apps/web/src/app/api/upload/complete/route.ts`**

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { headObject } from "@/lib/storage/presign";
import { ORIGINALS_BUCKET } from "@/lib/storage/buckets";
import { getVideoQueue, JOB_TRANSCODE } from "jobs";

const inputSchema = z.object({ videoId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const video = await prisma.video.findUnique({ where: { id: parsed.data.videoId } });
  if (!video || video.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!video.originalUrl) return NextResponse.json({ error: "missing_key" }, { status: 400 });

  const head = await headObject(ORIGINALS_BUCKET, video.originalUrl);
  if (!head.exists) {
    return NextResponse.json({ error: "raw_not_found" }, { status: 400 });
  }

  await getVideoQueue().add(
    JOB_TRANSCODE,
    { videoId: video.id },
    { attempts: 3, backoff: { type: "exponential", delay: 30_000 }, removeOnComplete: 100, removeOnFail: 100 }
  );

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Implement `apps/web/src/app/api/upload/thumb/route.ts`**

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { presignPut } from "@/lib/storage/presign";
import { HLS_BUCKET } from "@/lib/storage/buckets";

const inputSchema = z.object({ videoId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const video = await prisma.video.findUnique({ where: { id: parsed.data.videoId } });
  if (!video || video.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const key = `${video.id}/thumb-custom.jpg`;
  const uploadUrl = await presignPut(HLS_BUCKET, key, "image/jpeg", 15 * 60);
  return NextResponse.json({ uploadUrl, key });
}
```

- [ ] **Step 7: Run all upload tests**

```bash
pnpm --filter web test src/test/api/upload-init.test.ts src/test/api/upload-complete.test.ts
```

Expected: 6 passing.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/api/upload apps/web/src/test/api/upload-init.test.ts apps/web/src/test/api/upload-complete.test.ts
git commit -m "feat(web): add upload init/complete/thumb routes"
```

---

## Task 12: Web video routes + retry + PATCH custom thumb

**Files:**
- Create: `apps/web/src/app/api/videos/route.ts`
- Create: `apps/web/src/app/api/videos/[id]/route.ts` (PATCH custom thumb URL)
- Create: `apps/web/src/app/api/videos/[id]/retry/route.ts`

- [ ] **Step 1: Implement `apps/web/src/app/api/videos/route.ts` (GET listing)**

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "db";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const videos = await prisma.video.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      progress: true,
      durationSec: true,
      bytes: true,
      thumbUrl: true,
      customThumbUrl: true,
      hlsUrl: true,
      errorMessage: true,
      createdAt: true
    }
  });
  // Serialize bigint -> string
  const out = videos.map((v) => ({ ...v, bytes: v.bytes ? v.bytes.toString() : null }));
  return NextResponse.json({ videos: out });
}
```

- [ ] **Step 2: Implement `apps/web/src/app/api/videos/[id]/route.ts` (PATCH custom thumb)**

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "db";

const patchSchema = z.object({
  customThumbUrl: z.string().url().optional().or(z.null())
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.video.update({
    where: { id },
    data: { customThumbUrl: parsed.data.customThumbUrl ?? null }
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Implement `apps/web/src/app/api/videos/[id]/retry/route.ts`**

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { getVideoQueue, JOB_TRANSCODE } from "jobs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (video.status !== "FAILED") {
    return NextResponse.json({ error: "not_failed" }, { status: 409 });
  }

  await prisma.video.update({
    where: { id },
    data: { status: "QUEUED", errorMessage: null, progress: 0 }
  });
  await getVideoQueue().add(
    JOB_TRANSCODE,
    { videoId: id },
    { attempts: 3, backoff: { type: "exponential", delay: 30_000 } }
  );
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/videos
git commit -m "feat(web): add /api/videos GET, PATCH, and retry endpoints"
```

---

## Task 13: Web server actions for videos (TDD)

**Files:**
- Create: `apps/web/src/server/actions/video.ts`
- Create: `apps/web/src/test/server/actions/video.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/server/actions/video.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "vid-actions-user", email: "va@example.com", name: "VA" };

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: TEST_USER, session: { id: "s", userId: TEST_USER.id } }) } }
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const queueAddMock = vi.fn(async () => ({ id: "j1" }));
vi.mock("jobs", async () => ({
  getVideoQueue: () => ({ add: queueAddMock }),
  JOB_TRANSCODE: "transcode-video",
  JOB_DELETE_ASSETS: "delete-video-assets",
  QUEUE_NAME: "video"
}));

beforeEach(async () => {
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.cta.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.video.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  queueAddMock.mockClear();
});
afterAll(async () => prisma.$disconnect());

describe("listVideos", () => {
  it("scopes to owner", async () => {
    await prisma.user.create({ data: { id: "other", email: "o@e.com", name: "O" } });
    await prisma.video.create({ data: { ownerId: "other", name: "stranger", source: "UPLOAD", status: "READY" } });
    await prisma.video.create({ data: { ownerId: TEST_USER.id, name: "mine", source: "UPLOAD", status: "READY" } });
    const { listVideos } = await import("@/server/actions/video");
    const out = await listVideos();
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("mine");
  });
});

describe("deleteVideo", () => {
  it("blocks delete when video is in use without force", async () => {
    const v = await prisma.video.create({ data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", status: "READY" } });
    await prisma.webinar.create({ data: { ownerId: TEST_USER.id, videoId: v.id, name: "w", title: "w" } });
    const { deleteVideo } = await import("@/server/actions/video?" + Date.now());
    const r = await deleteVideo(v.id, false);
    expect(r).toMatchObject({ error: "in_use" });
    expect(await prisma.video.findUnique({ where: { id: v.id } })).not.toBeNull();
  });

  it("force-deletes and cascades videoId to null", async () => {
    const v = await prisma.video.create({ data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", status: "READY" } });
    const w = await prisma.webinar.create({ data: { ownerId: TEST_USER.id, videoId: v.id, name: "w", title: "w" } });
    const { deleteVideo } = await import("@/server/actions/video?" + (Date.now() + 1));
    const r = await deleteVideo(v.id, true);
    expect(r).toEqual({ ok: true });
    expect(await prisma.video.findUnique({ where: { id: v.id } })).toBeNull();
    const updatedWebinar = await prisma.webinar.findUnique({ where: { id: w.id } });
    expect(updatedWebinar?.videoId).toBeNull();
    expect(queueAddMock).toHaveBeenCalledWith("delete-video-assets", expect.objectContaining({ videoId: v.id }));
  });

  it("deletes immediately when no webinars use it", async () => {
    const v = await prisma.video.create({ data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", status: "READY" } });
    const { deleteVideo } = await import("@/server/actions/video?" + (Date.now() + 2));
    const r = await deleteVideo(v.id, false);
    expect(r).toEqual({ ok: true });
    expect(await prisma.video.findUnique({ where: { id: v.id } })).toBeNull();
  });
});

describe("setCustomThumb", () => {
  it("updates the customThumbUrl when value provided", async () => {
    const v = await prisma.video.create({ data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", status: "READY" } });
    const { setCustomThumb } = await import("@/server/actions/video?" + (Date.now() + 3));
    await setCustomThumb(v.id, "http://x/thumb-custom.jpg");
    const after = await prisma.video.findUnique({ where: { id: v.id } });
    expect(after?.customThumbUrl).toBe("http://x/thumb-custom.jpg");
  });
});

describe("retryTranscode", () => {
  it("only retries when status is FAILED", async () => {
    const v = await prisma.video.create({ data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", status: "READY" } });
    const { retryTranscode } = await import("@/server/actions/video?" + (Date.now() + 4));
    const r = await retryTranscode(v.id);
    expect(r).toMatchObject({ error: expect.any(String) });
  });

  it("re-enqueues a FAILED video", async () => {
    const v = await prisma.video.create({
      data: { ownerId: TEST_USER.id, name: "x", source: "UPLOAD", status: "FAILED", errorMessage: "boom" }
    });
    const { retryTranscode } = await import("@/server/actions/video?" + (Date.now() + 5));
    const r = await retryTranscode(v.id);
    expect(r).toEqual({ ok: true });
    const after = await prisma.video.findUnique({ where: { id: v.id } });
    expect(after?.status).toBe("QUEUED");
    expect(after?.errorMessage).toBeNull();
    expect(queueAddMock).toHaveBeenCalledWith("transcode-video", { videoId: v.id }, expect.any(Object));
  });
});
```

- [ ] **Step 2: Implement `apps/web/src/server/actions/video.ts`**

```ts
"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { getVideoQueue, JOB_TRANSCODE, JOB_DELETE_ASSETS } from "jobs";

type Result = { ok: true } | { error: string; webinars?: Array<{ id: string; title: string }> };

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function listVideos() {
  const session = await requireSession();
  const rows = await prisma.video.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" }
  });
  return rows.map((v) => ({
    id: v.id,
    name: v.name,
    source: v.source,
    status: v.status,
    progress: v.progress,
    durationSec: v.durationSec,
    bytes: v.bytes ? v.bytes.toString() : null,
    thumbUrl: v.thumbUrl,
    customThumbUrl: v.customThumbUrl,
    hlsUrl: v.hlsUrl,
    errorMessage: v.errorMessage,
    createdAt: v.createdAt
  }));
}

export async function deleteVideo(id: string, force: boolean): Promise<Result> {
  const session = await requireSession();
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== session.user.id) return { error: "not_found" };

  const webinars = await prisma.webinar.findMany({
    where: { videoId: id },
    select: { id: true, title: true }
  });
  if (webinars.length > 0 && !force) {
    return { error: "in_use", webinars };
  }
  await prisma.video.delete({ where: { id } });
  await getVideoQueue().add(JOB_DELETE_ASSETS, { videoId: id, ownerId: session.user.id }, { removeOnComplete: 100 });
  revalidatePath("/dashboard/videos");
  return { ok: true };
}

export async function setCustomThumb(id: string, customThumbUrl: string | null): Promise<Result> {
  const session = await requireSession();
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== session.user.id) return { error: "not_found" };
  await prisma.video.update({ where: { id }, data: { customThumbUrl } });
  revalidatePath("/dashboard/videos");
  return { ok: true };
}

export async function retryTranscode(id: string): Promise<Result> {
  const session = await requireSession();
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== session.user.id) return { error: "not_found" };
  if (video.status !== "FAILED") return { error: "not_failed" };
  await prisma.video.update({ where: { id }, data: { status: "QUEUED", errorMessage: null, progress: 0 } });
  await getVideoQueue().add(
    JOB_TRANSCODE,
    { videoId: id },
    { attempts: 3, backoff: { type: "exponential", delay: 30_000 } }
  );
  revalidatePath("/dashboard/videos");
  return { ok: true };
}
```

- [ ] **Step 3: Run video actions tests**

```bash
pnpm --filter web test src/test/server/actions/video.test.ts
```

Expected: all tests passing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/server/actions/video.ts apps/web/src/test/server/actions/video.test.ts
git commit -m "feat(web): add video server actions (list/delete/setCustomThumb/retry)"
```

---

## Task 14: Web client hooks (`use-presigned-upload`, `use-poll-videos`)

**Files:**
- Create: `apps/web/src/lib/hooks/use-presigned-upload.ts`
- Create: `apps/web/src/lib/hooks/use-poll-videos.ts`

- [ ] **Step 1: Implement `apps/web/src/lib/hooks/use-presigned-upload.ts`**

```ts
"use client";
import { useCallback, useRef, useState } from "react";

export type UploadState =
  | { status: "idle" }
  | { status: "init" }
  | { status: "uploading"; pct: number }
  | { status: "completing" }
  | { status: "polling"; videoId: string }
  | { status: "ready"; videoId: string }
  | { status: "failed"; error: string; videoId?: string };

export interface UsePresignedUploadOptions {
  onReady?: (videoId: string) => void;
}

export function usePresignedUpload(opts: UsePresignedUploadOptions = {}) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const start = useCallback(async (file: File) => {
    setState({ status: "init" });
    try {
      const initRes = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, sizeBytes: file.size, mimeType: file.type })
      });
      if (!initRes.ok) {
        const data = (await initRes.json().catch(() => null)) as { message?: string; error?: string } | null;
        throw new Error(data?.message ?? data?.error ?? `init failed (${initRes.status})`);
      }
      const { videoId, uploadUrl } = (await initRes.json()) as { videoId: string; uploadUrl: string };

      setState({ status: "uploading", pct: 0 });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setState({ status: "uploading", pct: Math.round((e.loaded / e.total) * 100) });
          }
        };
        xhr.onerror = () => reject(new Error("network_error"));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`upload failed (${xhr.status})`));
        };
        xhr.send(file);
      });

      setState({ status: "completing" });
      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId })
      });
      if (!completeRes.ok) {
        const data = (await completeRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `complete failed (${completeRes.status})`);
      }

      setState({ status: "polling", videoId });

      // Poll status every 3s up to 60 minutes.
      const deadline = Date.now() + 60 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const res = await fetch("/api/videos");
        if (!res.ok) continue;
        const data = (await res.json()) as { videos: Array<{ id: string; status: string; errorMessage?: string }> };
        const me = data.videos.find((v) => v.id === videoId);
        if (!me) continue;
        if (me.status === "READY") {
          setState({ status: "ready", videoId });
          opts.onReady?.(videoId);
          return;
        }
        if (me.status === "FAILED") {
          setState({ status: "failed", error: me.errorMessage ?? "transcode failed", videoId });
          return;
        }
      }
      setState({ status: "failed", error: "timeout", videoId });
    } catch (err) {
      setState({ status: "failed", error: err instanceof Error ? err.message : String(err) });
    }
  }, [opts]);

  const reset = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    setState({ status: "idle" });
  }, []);

  return { state, start, reset };
}
```

- [ ] **Step 2: Implement `apps/web/src/lib/hooks/use-poll-videos.ts`**

```ts
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function usePollVideos(enabled: boolean, intervalMs: number = 3000) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const handle = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(handle);
  }, [enabled, intervalMs, router]);
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/hooks
git commit -m "feat(web): add use-presigned-upload and use-poll-videos hooks"
```

---

## Task 15: Web video components

**Files:**
- Create: `apps/web/src/components/videos/usage-bar.tsx`
- Create: `apps/web/src/components/videos/upload-progress.tsx`
- Create: `apps/web/src/components/videos/upload-dropzone.tsx`
- Create: `apps/web/src/components/videos/upload-dialog.tsx`
- Create: `apps/web/src/components/videos/upload-button.tsx`
- Create: `apps/web/src/components/videos/library-picker.tsx`
- Create: `apps/web/src/components/videos/videos-table.tsx`
- Create: `apps/web/src/components/videos/video-row-actions.tsx`
- Create: `apps/web/src/components/videos/delete-video-dialog.tsx`
- Create: `apps/web/src/components/videos/thumb-edit-dialog.tsx`
- Create: `apps/web/src/components/videos/client-polling.tsx`

- [ ] **Step 1: `client-polling.tsx`**

```tsx
"use client";
import { usePollVideos } from "@/lib/hooks/use-poll-videos";

export function ClientPolling({ enabled, intervalMs }: { enabled: boolean; intervalMs?: number }) {
  usePollVideos(enabled, intervalMs);
  return null;
}
```

- [ ] **Step 2: `usage-bar.tsx`**

```tsx
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(2)} ${units[i]}`;
}

export function UsageBar({ usedBytes }: { usedBytes: number }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-sm font-medium">Armazenamento</p>
      <p className="mt-1 text-2xl font-semibold">{formatBytes(usedBytes)} usados</p>
    </div>
  );
}
```

- [ ] **Step 3: `upload-progress.tsx`**

```tsx
"use client";
import type { UploadState } from "@/lib/hooks/use-presigned-upload";

export function UploadProgress({ state }: { state: UploadState }) {
  if (state.status === "idle") return null;
  let label = "";
  let pct = 0;
  switch (state.status) {
    case "init": label = "Preparando..."; break;
    case "uploading": label = `Enviando ${state.pct}%`; pct = state.pct; break;
    case "completing": label = "Confirmando upload..."; pct = 100; break;
    case "polling": label = "Processando vídeo..."; pct = 100; break;
    case "ready": label = "Pronto!"; pct = 100; break;
    case "failed": label = `Erro: ${state.error}`; break;
  }
  return (
    <div className="mt-2 space-y-1 text-sm">
      <p className={state.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{label}</p>
      {state.status === "uploading" && (
        <div className="h-2 w-full overflow-hidden rounded bg-muted">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `upload-dropzone.tsx`**

```tsx
"use client";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { usePresignedUpload } from "@/lib/hooks/use-presigned-upload";
import { UploadProgress } from "./upload-progress";

export interface UploadDropzoneProps {
  onReady?: (videoId: string) => void;
}

export function UploadDropzone({ onReady }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, start } = usePresignedUpload({ onReady });

  function pickFile() {
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void start(file);
  }

  return (
    <div className="space-y-3 rounded-md border-2 border-dashed border-input p-8 text-center">
      <p className="text-sm text-muted-foreground">Selecione um arquivo de vídeo (até 10 GiB)</p>
      <Button type="button" onClick={pickFile} disabled={state.status !== "idle" && state.status !== "failed" && state.status !== "ready"}>
        Escolher arquivo
      </Button>
      <input ref={inputRef} type="file" accept="video/*" hidden onChange={onChange} />
      <UploadProgress state={state} />
    </div>
  );
}
```

- [ ] **Step 5: `upload-dialog.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel
} from "@/components/ui/alert-dialog";
import { UploadDropzone } from "./upload-dropzone";

export function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enviar novo vídeo</AlertDialogTitle>
          <AlertDialogDescription>
            O upload vai direto para o storage e o transcode HLS roda em background.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <UploadDropzone onReady={() => { router.refresh(); }} />
        <AlertDialogFooter>
          <AlertDialogCancel>Fechar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 6: `upload-button.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "./upload-dialog";

export function UploadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Enviar novo vídeo
      </Button>
      <UploadDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
```

- [ ] **Step 7: `library-picker.tsx`**

```tsx
"use client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LibraryVideo {
  id: string;
  name: string;
  thumbUrl: string | null;
  customThumbUrl: string | null;
  durationSec: number | null;
}

export function LibraryPicker({
  videos,
  selectedId,
  onSelect
}: {
  videos: LibraryVideo[];
  selectedId: string | null;
  onSelect: (videoId: string) => void;
}) {
  if (videos.length === 0) {
    return <p className="text-sm text-muted-foreground">Biblioteca vazia. Envie pela aba "Enviar novo".</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {videos.map((v) => {
        const thumb = v.customThumbUrl ?? v.thumbUrl;
        const selected = v.id === selectedId;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={cn(
              "relative overflow-hidden rounded-md border text-left transition",
              selected ? "ring-2 ring-primary" : "hover:border-primary/50"
            )}
          >
            <div className="aspect-video bg-muted">
              {thumb ? (
                <img src={thumb} alt={v.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  sem thumbnail
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="line-clamp-1 text-sm font-medium">{v.name}</p>
              {v.durationSec ? (
                <p className="text-xs text-muted-foreground">
                  {Math.floor(v.durationSec / 60)}:{String(v.durationSec % 60).padStart(2, "0")}
                </p>
              ) : null}
            </div>
            {selected && (
              <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-4 w-4" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 8: `videos-table.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { VideoRowActions } from "./video-row-actions";

export interface VideoRow {
  id: string;
  name: string;
  status: "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  progress: number;
  durationSec: number | null;
  bytes: string | null;
  thumbUrl: string | null;
  customThumbUrl: string | null;
  hlsUrl: string | null;
  errorMessage: string | null;
}

const STATUS_LABEL: Record<VideoRow["status"], string> = {
  QUEUED: "Em fila",
  PROCESSING: "Processando",
  READY: "Pronto",
  FAILED: "Falhou"
};

function formatBytes(s: string | null): string {
  if (!s) return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let cur = n / 1024; let i = 0;
  while (cur >= 1024 && i < units.length - 1) { cur /= 1024; i += 1; }
  return `${cur.toFixed(2)} ${units[i]}`;
}

function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideosTable({ rows }: { rows: VideoRow[] }) {
  if (rows.length === 0) {
    return <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">Nenhum vídeo — envie o primeiro.</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vídeo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Duração</TableHead>
          <TableHead>Tamanho</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((v) => {
          const thumb = v.customThumbUrl ?? v.thumbUrl;
          return (
            <TableRow key={v.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="aspect-video h-12 w-20 overflow-hidden rounded bg-muted">
                    {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div>
                    <p className="font-medium">{v.name}</p>
                    {v.errorMessage && <p className="text-xs text-destructive">{v.errorMessage}</p>}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={v.status === "READY" ? "default" : v.status === "FAILED" ? "destructive" : "outline"}>
                  {STATUS_LABEL[v.status]}
                </Badge>
                {v.status === "PROCESSING" && (
                  <div className="mt-2 h-2 w-32 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${v.progress}%` }} />
                  </div>
                )}
              </TableCell>
              <TableCell>{formatDuration(v.durationSec)}</TableCell>
              <TableCell>{formatBytes(v.bytes)}</TableCell>
              <TableCell>
                <VideoRowActions
                  id={v.id}
                  name={v.name}
                  status={v.status}
                  customThumbUrl={v.customThumbUrl}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 9: `video-row-actions.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, RefreshCw, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { retryTranscode } from "@/server/actions/video";
import { DeleteVideoDialog } from "./delete-video-dialog";
import { ThumbEditDialog } from "./thumb-edit-dialog";

export function VideoRowActions({
  id, name, status, customThumbUrl
}: {
  id: string; name: string; status: "QUEUED" | "PROCESSING" | "READY" | "FAILED"; customThumbUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [thumbOpen, setThumbOpen] = useState(false);

  function onRetry() {
    startTransition(async () => {
      const r = await retryTranscode(id);
      if ("ok" in r) {
        toast.success("Reenviado para processamento");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setThumbOpen(true)}>
            <ImageIcon className="mr-2 h-4 w-4" /> Editar thumbnail
          </DropdownMenuItem>
          {status === "FAILED" && (
            <DropdownMenuItem onClick={onRetry} disabled={pending}>
              <RefreshCw className="mr-2 h-4 w-4" /> {pending ? "..." : "Tentar novamente"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DeleteVideoDialog id={id} name={name}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </DeleteVideoDialog>
        </DropdownMenuContent>
      </DropdownMenu>
      <ThumbEditDialog
        open={thumbOpen}
        onOpenChange={setThumbOpen}
        videoId={id}
        currentCustomThumbUrl={customThumbUrl}
      />
    </>
  );
}
```

- [ ] **Step 10: `delete-video-dialog.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteVideo } from "@/server/actions/video";

export function DeleteVideoDialog({ id, name, children }: { id: string; name: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [force, setForce] = useState(false);
  const [webinars, setWebinars] = useState<Array<{ id: string; title: string }>>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onConfirm() {
    startTransition(async () => {
      const r = await deleteVideo(id, force);
      if ("ok" in r) {
        toast.success("Vídeo excluído");
        setOpen(false);
        router.refresh();
        return;
      }
      if (r.error === "in_use" && r.webinars) {
        setWebinars(r.webinars);
        return;
      }
      toast.error(r.error);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir vídeo?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{name}</strong> será removido permanentemente, incluindo os arquivos no storage.
            {webinars.length > 0 && (
              <>
                <p className="mt-3">Vídeo usado em {webinars.length} webinar(s):</p>
                <ul className="mt-1 ml-4 list-disc text-sm">
                  {webinars.map((w) => <li key={w.id}>{w.title || w.id}</li>)}
                </ul>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <Switch checked={force} onCheckedChange={setForce} />
                  Forçar exclusão (webinars perderão referência ao vídeo)
                </label>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" disabled={pending || (webinars.length > 0 && !force)} onClick={onConfirm}>
              {pending ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 11: `thumb-edit-dialog.tsx`**

```tsx
"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { setCustomThumb } from "@/server/actions/video";

export function ThumbEditDialog({
  open, onOpenChange, videoId, currentCustomThumbUrl
}: {
  open: boolean; onOpenChange: (v: boolean) => void; videoId: string; currentCustomThumbUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Thumb > 5 MB");
      return;
    }
    setUploading(true);
    try {
      const initRes = await fetch("/api/upload/thumb", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId })
      });
      if (!initRes.ok) throw new Error("init failed");
      const { uploadUrl, key } = (await initRes.json()) as { uploadUrl: string; key: string };
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error(`upload failed (${put.status})`);
      // Compute public URL using S3_PUBLIC_BASE_URL via server action
      const publicBaseUrl = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ?? "";
      const hlsBucket = process.env.NEXT_PUBLIC_S3_BUCKET_HLS ?? "hls-public";
      const customThumbUrl = `${publicBaseUrl}/${hlsBucket}/${key}`;
      const r = await setCustomThumb(videoId, customThumbUrl);
      if ("ok" in r) {
        toast.success("Thumbnail atualizada");
        router.refresh();
        onOpenChange(false);
      } else toast.error(r.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar thumbnail");
    } finally {
      setUploading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Editar thumbnail</AlertDialogTitle>
          <AlertDialogDescription>
            Envie uma imagem JPG/PNG (até 5 MB) ou deixe a thumbnail automática gerada pelo transcode.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {currentCustomThumbUrl && <img src={currentCustomThumbUrl} alt="thumb atual" className="aspect-video w-full rounded border object-cover" />}
        <div className="flex gap-2">
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? "Enviando..." : "Selecionar arquivo"}
          </Button>
          {currentCustomThumbUrl && (
            <Button
              variant="outline"
              onClick={async () => {
                await setCustomThumb(videoId, null);
                toast.success("Voltou para thumbnail automática");
                router.refresh();
                onOpenChange(false);
              }}
            >
              Voltar para auto
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
          }}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Fechar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 12: Add `NEXT_PUBLIC_S3_*` to `.env.example` for thumb URL construction**

Append to `.env.example`:

```env
# Public-facing S3 base + HLS bucket (browser uses these to construct thumb URLs)
NEXT_PUBLIC_S3_PUBLIC_BASE_URL="http://localhost:9000"
NEXT_PUBLIC_S3_BUCKET_HLS="hls-public"
```

Update `apps/web/.env.local` accordingly (user task — not committed).

- [ ] **Step 13: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 14: Commit**

```bash
git add apps/web/src/components/videos .env.example
git commit -m "feat(web): add video library components (table, dialogs, dropzone, picker)"
```

---

## Task 16: Replace `/dashboard/videos` stub with real library

**Files:**
- Modify: `apps/web/src/app/dashboard/videos/page.tsx`

- [ ] **Step 1: Replace the stub with the real library page**

```tsx
import { listVideos } from "@/server/actions/video";
import { UsageBar } from "@/components/videos/usage-bar";
import { UploadButton } from "@/components/videos/upload-button";
import { VideosTable, type VideoRow } from "@/components/videos/videos-table";
import { ClientPolling } from "@/components/videos/client-polling";

export default async function VideosPage() {
  const videos = await listVideos();
  const rows: VideoRow[] = videos.map((v) => ({
    id: v.id,
    name: v.name,
    status: v.status,
    progress: v.progress,
    durationSec: v.durationSec,
    bytes: v.bytes,
    thumbUrl: v.thumbUrl,
    customThumbUrl: v.customThumbUrl,
    hlsUrl: v.hlsUrl,
    errorMessage: v.errorMessage
  }));

  const usedBytes = rows.reduce((acc, r) => acc + (r.bytes ? Number(r.bytes) : 0), 0);
  const transientCount = rows.filter((r) => r.status === "QUEUED" || r.status === "PROCESSING").length;

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Vídeos</h1>
        <UploadButton />
      </div>
      <div className="mt-6">
        <UsageBar usedBytes={usedBytes} />
      </div>
      <div className="mt-6">
        <VideosTable rows={rows} />
      </div>
      <ClientPolling enabled={transientCount > 0} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + tests**

```bash
pnpm --filter web typecheck
pnpm --filter web test
```

Expected: typecheck clean. All web tests still passing (count is sub-plan B1 baseline + B2 additions).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/videos/page.tsx
git commit -m "feat(web): replace videos stub with real library page"
```

---

## Task 17: Wizard step 4 — 3 tabs

**Files:**
- Modify: `apps/web/src/lib/validations/webinar.ts` (extend `step4Schema`)
- Modify: `apps/web/src/server/actions/webinar.ts` (extend `updateWebinarStep4`)
- Modify: `apps/web/src/components/wizard/step-4-form.tsx` (3 tabs)
- Modify: `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-4/page.tsx` (provide library + initial)

- [ ] **Step 1: Replace `step4Schema` in `apps/web/src/lib/validations/webinar.ts`**

Find the existing `step4Schema` block. Replace it with a discriminated union:

```ts
export const step4ExternalSchema = z.object({
  mode: z.literal("external"),
  videoExternalUrl: z.string().url("Cole uma URL válida"),
  pitchAtSec: z.number().int().min(0).optional()
});
export const step4LibrarySchema = z.object({
  mode: z.literal("library"),
  videoId: z.string().min(1),
  pitchAtSec: z.number().int().min(0).optional()
});
export const step4UploadSchema = z.object({
  mode: z.literal("upload-complete"),
  videoId: z.string().min(1),
  pitchAtSec: z.number().int().min(0).optional()
});
export const step4Schema = z.discriminatedUnion("mode", [
  step4ExternalSchema,
  step4LibrarySchema,
  step4UploadSchema
]);
export type Step4Input = z.infer<typeof step4Schema>;
```

- [ ] **Step 2: Update existing webinar.test.ts for new step4 shape**

Read `apps/web/src/test/server/actions/webinar.test.ts`. The "updateWebinarStep4 creates an EXTERNAL Video" test passes `{ videoExternalUrl, pitchAtSec }`. Update it to pass `{ mode: "external", videoExternalUrl, pitchAtSec }`. The behavior assertions stay identical.

Same for `apps/web/src/test/lib/validations/webinar.test.ts` step4 test:

```ts
describe("step4Schema", () => {
  it("requires URL in external mode", () => {
    expect(step4Schema.safeParse({ mode: "external", videoExternalUrl: "not-a-url" }).success).toBe(false);
    expect(step4Schema.safeParse({ mode: "external", videoExternalUrl: "https://example.com/video.mp4" }).success).toBe(true);
  });
  it("library mode requires videoId", () => {
    expect(step4Schema.safeParse({ mode: "library", videoId: "" }).success).toBe(false);
    expect(step4Schema.safeParse({ mode: "library", videoId: "abc" }).success).toBe(true);
  });
});
```

- [ ] **Step 3: Update `updateWebinarStep4` in `apps/web/src/server/actions/webinar.ts`**

Replace the function body with:

```ts
export async function updateWebinarStep4(id: string, input: Step4Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step4Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }

  const data = parsed.data;
  let videoId: string | null = null;

  if (data.mode === "external") {
    if (owned.videoId) {
      await prisma.video.update({
        where: { id: owned.videoId },
        data: {
          source: "EXTERNAL",
          originalUrl: data.videoExternalUrl,
          hlsUrl: data.videoExternalUrl,
          status: "READY"
        }
      });
      videoId = owned.videoId;
    } else {
      const v = await prisma.video.create({
        data: {
          ownerId: session.user.id,
          name: owned.title || "Vídeo externo",
          source: "EXTERNAL",
          originalUrl: data.videoExternalUrl,
          hlsUrl: data.videoExternalUrl,
          status: "READY",
          progress: 100
        }
      });
      videoId = v.id;
    }
  } else {
    // library or upload-complete: validate video ownership + ready
    const v = await prisma.video.findUnique({ where: { id: data.videoId } });
    if (!v || v.ownerId !== session.user.id) {
      return { error: { field: "videoId", message: "Vídeo não encontrado" } };
    }
    if (v.status !== "READY") {
      return { error: { field: "videoId", message: "Vídeo ainda não está pronto" } };
    }
    videoId = v.id;
  }

  await prisma.webinar.update({
    where: { id },
    data: { videoId, pitchAtSec: data.pitchAtSec ?? null }
  });
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}
```

- [ ] **Step 4: Replace `apps/web/src/components/wizard/step-4-form.tsx` with 3-tab version**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import {
  step4ExternalSchema, step4LibrarySchema, type Step4Input
} from "@/lib/validations/webinar";
import { updateWebinarStep4 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SecondsInput } from "@/components/ui/seconds-input";
import { WizardNav } from "@/components/wizard/wizard-nav";
import { LibraryPicker, type LibraryVideo } from "@/components/videos/library-picker";
import { UploadDropzone } from "@/components/videos/upload-dropzone";

type Mode = "external" | "upload" | "library";

interface Step4FormProps {
  webinarId: string;
  initial: {
    mode: Mode;
    videoExternalUrl: string;
    selectedVideoId: string | null;
    pitchAtSec: number | undefined;
  };
  libraryVideos: LibraryVideo[];
}

const externalShape = step4ExternalSchema.omit({ mode: true });
type ExternalInput = z.infer<typeof externalShape>;

export function Step4Form({ webinarId, initial, libraryVideos }: Step4FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Mode>(initial.mode);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(initial.selectedVideoId);

  const externalForm = useForm<ExternalInput>({
    resolver: zodResolver(externalShape),
    defaultValues: {
      videoExternalUrl: initial.videoExternalUrl,
      pitchAtSec: initial.pitchAtSec
    }
  });

  function submit(input: Step4Input) {
    startTransition(async () => {
      const res = await updateWebinarStep4(webinarId, input);
      if ("ok" in res) router.push(`/dashboard/webinars/${webinarId}/step-5`);
      else toast.error(res.error.message);
    });
  }

  function onSubmitExternal(values: ExternalInput) {
    submit({ mode: "external", ...values });
  }

  function onLibrarySelect(videoId: string) {
    setSelectedVideoId(videoId);
  }

  function onLibraryContinue() {
    if (!selectedVideoId) {
      toast.error("Selecione um vídeo");
      return;
    }
    submit({
      mode: "library",
      videoId: selectedVideoId,
      pitchAtSec: externalForm.getValues("pitchAtSec")
    });
  }

  function onUploadReady(videoId: string) {
    setSelectedVideoId(videoId);
    submit({
      mode: "upload-complete",
      videoId,
      pitchAtSec: externalForm.getValues("pitchAtSec")
    });
  }

  return (
    <form onSubmit={externalForm.handleSubmit(onSubmitExternal)} className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-semibold">Vídeo</h2>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Mode)}>
        <TabsList>
          <TabsTrigger value="external">URL externa</TabsTrigger>
          <TabsTrigger value="upload">Enviar novo</TabsTrigger>
          <TabsTrigger value="library">Biblioteca</TabsTrigger>
        </TabsList>

        <TabsContent value="external" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="videoExternalUrl">URL do vídeo (mp4 / m3u8)</Label>
            <Input id="videoExternalUrl" {...externalForm.register("videoExternalUrl")} placeholder="https://cdn.example.com/v.mp4" />
            {externalForm.formState.errors.videoExternalUrl && (
              <p className="text-sm text-destructive">{externalForm.formState.errors.videoExternalUrl.message}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-4 space-y-4">
          <UploadDropzone onReady={onUploadReady} />
        </TabsContent>

        <TabsContent value="library" className="mt-4 space-y-4">
          <LibraryPicker
            videos={libraryVideos}
            selectedId={selectedVideoId}
            onSelect={onLibrarySelect}
          />
        </TabsContent>
      </Tabs>

      <div className="space-y-2">
        <Label>Momento "chegou no pitch"</Label>
        <Controller
          control={externalForm.control}
          name="pitchAtSec"
          render={({ field }) => (
            <SecondsInput value={field.value} onChange={field.onChange} aria-label="pitchAtSec" />
          )}
        />
      </div>

      {tab === "external" && <WizardNav webinarId={webinarId} step={4} submitting={pending} />}
      {tab === "library" && (
        <div className="mt-8 flex items-center justify-between border-t pt-4">
          <a href={`/dashboard/webinars/${webinarId}/step-3`} className="rounded-md border px-4 py-2 text-sm">← Voltar</a>
          <button
            type="button"
            onClick={onLibraryContinue}
            disabled={pending || !selectedVideoId}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Salvando..." : "Continuar →"}
          </button>
        </div>
      )}
      {tab === "upload" && (
        <p className="text-xs text-muted-foreground">Após o vídeo ficar pronto, ele será selecionado automaticamente para este webinar.</p>
      )}
    </form>
  );
}
```

- [ ] **Step 5: Update `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-4/page.tsx`**

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step4Form } from "@/components/wizard/step-4-form";
import type { LibraryVideo } from "@/components/videos/library-picker";

export default async function Step4Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id }, include: { video: true } });
  if (!w || w.ownerId !== session.user.id) notFound();

  const library = await prisma.video.findMany({
    where: { ownerId: session.user.id, status: "READY" },
    orderBy: { createdAt: "desc" }
  });
  const libraryVideos: LibraryVideo[] = library.map((v) => ({
    id: v.id,
    name: v.name,
    thumbUrl: v.thumbUrl,
    customThumbUrl: v.customThumbUrl,
    durationSec: v.durationSec
  }));

  const initialMode: "external" | "upload" | "library" =
    w.video?.source === "UPLOAD" ? "library" : "external";

  return (
    <Step4Form
      webinarId={id}
      initial={{
        mode: initialMode,
        videoExternalUrl: w.video?.source === "EXTERNAL" ? (w.video.originalUrl ?? "") : "",
        selectedVideoId: w.video?.source === "UPLOAD" ? w.videoId : null,
        pitchAtSec: w.pitchAtSec ?? undefined
      }}
      libraryVideos={libraryVideos}
    />
  );
}
```

- [ ] **Step 6: Run tests + typecheck**

```bash
pnpm --filter web typecheck
pnpm --filter web test
```

Expected: typecheck clean. All previously passing tests still pass; the modified webinar.test.ts also passes.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/validations/webinar.ts apps/web/src/server/actions/webinar.ts apps/web/src/components/wizard/step-4-form.tsx apps/web/src/app/dashboard/webinars/\[id\]/\(wizard\)/step-4 apps/web/src/test/server/actions/webinar.test.ts apps/web/src/test/lib/validations/webinar.test.ts
git commit -m "feat(web): wizard step 4 with 3 tabs (URL externa / Upload / Biblioteca)"
```

---

## Task 18: docker-compose worker service + final wiring

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Append a `worker` service to `docker-compose.yml`**

After the `minio` service block, add:

```yaml
  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    depends_on:
      - postgres
      - redis
      - minio
    environment:
      DATABASE_URL: postgresql://hotwebinar:hotwebinar@postgres:5432/hotwebinar?schema=public
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_REGION: us-east-1
      S3_ACCESS_KEY: hotwebinar
      S3_SECRET_KEY: hotwebinar-min-12chars
      S3_BUCKET_ORIGINALS: originals-private
      S3_BUCKET_HLS: hls-public
      S3_PUBLIC_BASE_URL: http://localhost:9000
      WORKER_CONCURRENCY: "1"
    restart: unless-stopped
```

This is opt-in — `docker compose up -d` builds and runs the worker. Local dev can also run `pnpm --filter worker dev` directly without Docker (the worker reads `.env.local` from repo root).

- [ ] **Step 2: Smoke test (optional, requires building image)**

```bash
docker compose build worker
docker compose up -d worker
docker compose logs --tail=30 worker
```

Expected: `[worker] ready, concurrency 1`. Stop with `docker compose stop worker`.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add worker service to docker-compose"
```

---

## Task 19: Final acceptance + final code review

- [ ] **Step 1: Walk through DoD**

1. Migration `add_video_thumbs` applies cleanly. ✓ Task 1.
2. `apps/worker` package + Dockerfile builds; `pnpm --filter worker typecheck` clean. ✓ Tasks 5–10.
3. `packages/jobs` exports `getVideoQueue`, `getRedisConnection`, types. ✓ Task 2.
4. `/api/upload/init` validates MIME + size, creates Video QUEUED + presigned PUT URL. ✓ Task 11.
5. Browser PUT direct to MinIO with XHR onprogress; `/api/upload/complete` enqueues. ✓ Tasks 11, 14.
6. Worker `transcode-video`: download → probe → ladder → ffmpeg HLS → thumb → upload → READY. ✓ Task 9.
7. Worker reports progress; web polling 3s updates UI. ✓ Tasks 9, 14, 16.
8. ffmpeg failure → BullMQ 3x retry; final fail → FAILED + stderr-tail. ✓ Task 9.
9. `/dashboard/videos`: usage bar + table. ✓ Tasks 15, 16.
10. Custom thumb upload via separate presigned PUT. ✓ Tasks 11, 12, 15.
11. Delete: blocks if `webinarsUsing > 0`; force toggle cascades. ✓ Tasks 13, 15.
12. Wizard step 4: 3 tabs; upload auto-selects on READY; library filters READY. ✓ Task 17.
13. Manual retry on FAILED. ✓ Tasks 12, 13, 15.
14. Bucket policies: originals-private denies anon; hls-public allows GetObject. ✓ Task 8.
15. Worker bootstrap validates env + auto-creates buckets. ✓ Tasks 5, 8, 10.
16. E2E (optional inline): `pnpm scrape:all` is unrelated. The B2 plan ships happy-path Playwright spec only as a reach goal — covered by `webinar-crud.spec.ts` from B1 plus the unit/integration suite.
17. `pnpm -r test` and `pnpm -r typecheck` clean.
18. `docker-compose.yml` includes minio + redis + worker. ✓ Tasks 4, 18.
19. `.env.example` lists all required envs. ✓ Tasks 4, 15.

- [ ] **Step 2: Run the entire suite**

```bash
pnpm -r typecheck
pnpm -r test
```

Expected: all green across web + worker + scraper + jobs + db.

- [ ] **Step 3: Final commit if anything changed during acceptance**

```bash
git status
git add -p
git commit -m "chore: B2 acceptance fixes" || true
```

(`|| true` allows the step to no-op when nothing changed.)

---

## Self-Review (notes for the implementer)

- **Spec coverage:** every numbered DoD item maps to a numbered task. The optional E2E spec is intentionally omitted from the plan — sub-plan B1 already has Playwright wiring; B2's E2E is a reach goal once C lands the public player.
- **`bytes` BigInt serialization:** the implementer must ensure responses serialize `bytes` as string (Task 12 + Task 13 already do `bytes.toString()`). The B2 review note from sub-plan B1 about `BigInt.prototype.toJSON` is satisfied by per-call serialization.
- **Test isolation across actions tests:** webinar / settings / video tests all `prisma.user.deleteMany({})` in `beforeEach`. The `fileParallelism: false` from B1 still applies — keep.
- **Custom thumb URL construction in browser:** the `ThumbEditDialog` uses `process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL` and `NEXT_PUBLIC_S3_BUCKET_HLS`. Make sure `.env.local` defines these in addition to the server-side `S3_*`. Task 15 Step 12 documents this; the implementer must add lines to their local `.env.local`.
- **Worker file ordering in `transcode-video.ts`:** the upload step iterates `tmp.path` and uploads every file except `raw`. The mock test pre-creates `master.m3u8` + `360p.m3u8` + `720p.m3u8` + `thumb.jpg` so the upload path runs without real ffmpeg output.
- **`zod` discriminated union (`step4Schema`):** if a future implementer adds a fourth step-4 mode, both `validations/webinar.ts` and `server/actions/webinar.ts` must update. The discriminated union surfaces missing branches at compile time.
- **`tsx` in worker `dependencies`:** worker runs `tsx src/index.ts` in the Dockerfile. `tsx` is therefore in `dependencies` (not devDependencies) so production install includes it. Task 5's package.json reflects this.
- **MinIO CORS:** if the browser PUT to MinIO is rejected with CORS errors, configure MinIO via `mc admin policy` or the MinIO console at http://localhost:9001 (login `hotwebinar` / `hotwebinar-min-12chars`). The plan doesn't bake this in because `mc` requires a separate install; document for the implementer to apply manually if needed.
- **Worker Docker build context:** the Dockerfile copies `pnpm-lock.yaml` from the repo root. The build must run from the repo root: `docker compose build worker`, never from inside `apps/worker/`.
- **Sub-plan F (Coolify deploy) inherits this docker-compose.yml** as a reference for what services to define in Coolify. F adds a separate Coolify-specific compose / resources mapping.
