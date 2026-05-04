# MVP Sub-plan B2 — Video Pipeline Design

**Project:** hotwebinar-clone
**Date:** 2026-05-04
**Status:** Approved (pending user review of written spec)
**Phase:** Sub-plan B2 of the MVP slim implementation
**Predecessors:** [Sub-plan A — Foundation](2026-05-03-mvp-slim-design.md), [Sub-plan B1 — Admin Webinar CRUD](2026-05-04-mvp-B1-admin-crud-design.md)

## Goal

Ship the video upload + HLS transcode pipeline. Owners upload raw video files (up to 10 GiB) directly to MinIO via presigned URLs. A separate worker process picks up the job, transcodes the source into an HLS adaptive ladder (360p / 720p / 1080p / 1440p, skipping variants larger than the source), extracts a thumbnail, and uploads everything to a public bucket. The library page polls for status; the wizard step 4 ships its three tabs (URL externa / Enviar novo / Biblioteca).

## Non-goals

- Public player, lead opt-in, watch tracking — sub-plan C
- Real-time WebSocket status updates — polling 3s is fine for MVP
- Storage caps per plan, multi-tenant isolation — post-MVP
- Subtitles / captions / per-variant bitrate tuning — post-MVP
- Cron cleanup of stale uploads — tracked, fora MVP
- Coolify deploy + Dockerfile multi-stage standalone — sub-plan F

## Context

Sub-plan A delivered the foundation; sub-plan B1 delivered admin webinar CRUD with wizard step 4 accepting only EXTERNAL URLs (Upload tab disabled). This sub-plan adds the storage driver (MinIO via S3 SDK), the BullMQ + Redis job system, the dedicated worker process with ffmpeg, and the library + wizard UI for uploads and library selection.

Pre-decided constraints (from earlier MVP design + user clarifications):

- BullMQ + Redis (single Redis instance, two job names: `transcode-video` and `delete-video-assets`)
- HLS ladder up to 1440p (4 variants); ffmpeg never upscales
- Polling 3s for status; UI uses `router.refresh()` to re-render RSC
- MinIO self-hosted, two buckets: `originals-private` (raw, no public access) and `hls-public` (HLS playlist + segments + thumbnails, anonymous GetObject allowed)
- Upload mechanism: presigned PUT URL (browser → MinIO direct, bypasses Next process)
- Max upload: 10 GiB (configurable via `MAX_UPLOAD_BYTES` env)
- Worker concurrency: 1 (configurable via `WORKER_CONCURRENCY` env)
- Worker is a separate process under `apps/worker` with its own Dockerfile (alpine + ffmpeg)
- Wizard step 4 has 3 tabs: External URL / Enviar novo / Biblioteca

## Architecture

```
hotwebinar-clone/
├── apps/
│   ├── web/                                      Next.js (existing, extended)
│   │   └── src/
│   │       ├── app/api/
│   │       │   ├── upload/init/route.ts          POST → presigned PUT URL + create Video QUEUED
│   │       │   ├── upload/complete/route.ts      POST → enqueue transcode job
│   │       │   ├── upload/thumb/route.ts         POST → presigned PUT for custom thumb
│   │       │   ├── videos/route.ts               GET (status polling)
│   │       │   └── videos/[id]/retry/route.ts    POST → re-enqueue failed
│   │       ├── server/actions/
│   │       │   └── video.ts                      listVideos / deleteVideo / setCustomThumb / retryTranscode
│   │       ├── lib/
│   │       │   ├── storage/
│   │       │   │   ├── s3.ts                     S3Client (MinIO/R2 compat) + helpers
│   │       │   │   ├── presign.ts                presignPut/presignGet/headObject helpers
│   │       │   │   └── buckets.ts                ORIGINALS_BUCKET / HLS_BUCKET constants
│   │       │   └── hooks/
│   │       │       ├── use-presigned-upload.ts   client state machine
│   │       │       └── use-poll-videos.ts        polling helper
│   │       ├── components/
│   │       │   ├── videos/
│   │       │   │   ├── usage-bar.tsx
│   │       │   │   ├── upload-button.tsx
│   │       │   │   ├── upload-dialog.tsx
│   │       │   │   ├── upload-dropzone.tsx       (used in wizard step 4)
│   │       │   │   ├── upload-progress.tsx
│   │       │   │   ├── library-picker.tsx        (used in wizard step 4)
│   │       │   │   ├── videos-table.tsx
│   │       │   │   ├── video-row-actions.tsx
│   │       │   │   ├── delete-video-dialog.tsx
│   │       │   │   ├── thumb-edit-dialog.tsx
│   │       │   │   └── client-polling.tsx
│   │       │   └── wizard/
│   │       │       └── step-4-form.tsx           EXTEND: 3 tabs
│   │       └── app/dashboard/videos/page.tsx     EXTEND from B1 stub: real library
│
│   └── worker/                                   NEW
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile                            alpine + ffmpeg
│       ├── .dockerignore
│       └── src/
│           ├── index.ts                          bootstrap (Workers + signal handlers)
│           ├── env.ts                            fail-closed env validation
│           ├── jobs/
│           │   ├── transcode-video.ts            full pipeline
│           │   └── delete-video-assets.ts        MinIO cleanup
│           ├── lib/
│           │   ├── s3.ts                         download / upload / delete prefix
│           │   ├── ffmpeg.ts                     spawn + stderr → progress %
│           │   ├── ladder.ts                     ladder presets + skip-upscale
│           │   ├── temp.ts                       mkdtemp + cleanup
│           │   └── ensure-buckets.ts             auto-create buckets + policies on boot
│           └── test/
│               ├── lib/
│               │   ├── ladder.test.ts
│               │   ├── ffmpeg.test.ts
│               │   └── s3.test.ts
│               └── jobs/
│                   └── transcode-video.test.ts
│
├── packages/
│   ├── db/                                       existing
│   └── jobs/                                     NEW
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                          re-exports
│           ├── connection.ts                     singleton IORedis from REDIS_URL
│           ├── queue.ts                          BullMQ Queue("video")
│           └── types.ts                          job names + payload types
│
├── docker-compose.yml                            EXTEND (+ minio, +redis, +worker)
├── docker-compose.test.yml                       NEW (minio-test + redis-test for integration tests)
└── .env.example                                  EXTEND
```

### Stack additions

| Package | Version | Where |
|---|---|---|
| `bullmq` | ^5.x | web, worker, packages/jobs |
| `ioredis` | ^5.x | packages/jobs (peer) |
| `@aws-sdk/client-s3` | ^3.x | web + worker |
| `@aws-sdk/s3-request-presigner` | ^3.x | web |
| `mime` | ^4.x | web (validate upload MIME) |

System: `ffmpeg` (apk on alpine).

### Principles

- web enqueues jobs via `packages/jobs` Queue; worker consumes via BullMQ Worker.
- Both connect to the same Redis (`REDIS_URL`).
- `packages/jobs` is the shared contract: job names, payload types, Redis connection.
- Storage abstraction is the S3 SDK directly — MinIO is 100% S3 API compat.
- Two buckets, hard separation: `originals-private` (worker-only via SDK) + `hls-public` (browser fetch via anonymous GetObject).
- Worker bootstrap auto-creates buckets and applies policies if missing.
- ffmpeg from system binary in worker Dockerfile (`apk add ffmpeg`); no `ffmpeg-static` runtime dep.

## Data model delta

`Video` (existing from B1) gains 2 fields:

```prisma
model Video {
  id              String      @id @default(cuid())
  ownerId         String
  name            String
  source          VideoSource
  originalUrl     String?
  hlsUrl          String?
  thumbUrl        String?     // NEW — auto-generated by ffmpeg (public bucket)
  customThumbUrl  String?     // NEW — owner override (public bucket)
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

Migration `add_video_thumbs` adds two nullable columns. No data loss; B1 videos stay valid.

## Storage layout

```
originals-private/
  <videoId>/raw.<ext>            original upload, MIME video/*
hls-public/
  <videoId>/master.m3u8          HLS master playlist
  <videoId>/360p.m3u8            variant playlist
  <videoId>/360p_NNN.ts          segments
  <videoId>/720p.m3u8
  <videoId>/720p_NNN.ts
  <videoId>/1080p.m3u8
  <videoId>/1080p_NNN.ts
  <videoId>/1440p.m3u8           skipped if source < 1440p
  <videoId>/1440p_NNN.ts
  <videoId>/thumb.jpg            auto-generated, frame at duration/2
  <videoId>/thumb-custom.jpg     owner override (optional)
```

### Bucket policies

- `originals-private` — no public access. Worker uses S3 GetObject via SDK (server creds). Web generates presigned PUT for upload (15 min expiry).
- `hls-public` — anonymous GetObject allowed. MinIO bucket policy:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::hls-public/*"]
    }]
  }
  ```

Worker `ensureBuckets()` on bootstrap creates the buckets if missing and applies policies.

## Job payload types

`packages/jobs/src/types.ts`:

```ts
export const QUEUE_NAME = "video";

export const JOB_TRANSCODE = "transcode-video";
export const JOB_DELETE_ASSETS = "delete-video-assets";

export interface TranscodePayload {
  videoId: string;
}

export interface DeleteAssetsPayload {
  videoId: string;
  ownerId: string; // for audit
}

export interface JobProgress {
  pct: number;           // 0-100
  stage: "downloading" | "probing" | "transcoding" | "uploading" | "thumbnail";
}
```

## Critical flows

### Upload (presigned)

```
Client: POST /api/upload/init { name, sizeBytes, mimeType }
  Server:
    - requireSession()
    - validate mimeType startsWith "video/"
    - validate sizeBytes <= MAX_UPLOAD_BYTES (10 GiB)
    - INSERT Video { ownerId, name, source: UPLOAD, status: QUEUED, bytes, progress: 0 }
    - generate presigned PUT URL → originals-private/<videoId>/raw.<ext> (15 min expiry, Content-Length-Range policy)
    - return { videoId, uploadUrl, headers: { "Content-Type": mimeType } }

Browser:
  XHR PUT uploadUrl with file body, header Content-Type matching
  upload.onprogress → UI % bar (state: "uploading")
  on 2xx: POST /api/upload/complete { videoId }

Server /upload/complete:
  - requireSession() + ownership check
  - HEAD originals-private/<videoId>/raw.* → confirm uploaded
  - queue.add(JOB_TRANSCODE, { videoId }, { attempts: 3, backoff: { type: "exponential", delay: 30_000 } })
  - return { ok: true }
```

### Transcode (worker)

```
on TranscodePayload {videoId}:
  // Idempotency: skip if already READY (worker restart re-pickup safety)
  video = SELECT Video WHERE id=videoId
  if !video || video.status === "READY": return

  job.updateProgress({pct: 0, stage: "downloading"})
  UPDATE Video status="PROCESSING", progress=0
  download originals-private/<videoId>/raw.* → /tmp/<videoId>/raw

  job.updateProgress({pct: 5, stage: "probing"})
  ffprobe → durationSec, sourceHeight

  ladder = filter([360, 720, 1080, 1440] where height <= sourceHeight)

  spawn ffmpeg pipeline:
    - 1 input, N outputs (one variant per ladder entry)
    - libx264 (or libx265 future), HLS muxer, 6s segments
    - master.m3u8 references all variants
    - parse stderr "frame= ... time=..." → progress%
    - pct mapped to range [10, 80]
    - update Video.progress every 5%

  job.updateProgress({pct: 80, stage: "thumbnail"})
  ffmpeg -ss durationSec/2 -i raw -frames:v 1 -q:v 5 -vf scale=320:-1 /tmp/<videoId>/thumb.jpg

  job.updateProgress({pct: 85, stage: "uploading"})
  upload all /tmp/<videoId>/{*.m3u8, *.ts, thumb.jpg} → hls-public/<videoId>/

  UPDATE Video {
    status: "READY",
    hlsUrl: <S3_PUBLIC_BASE>/<HLS_BUCKET>/<videoId>/master.m3u8,
    thumbUrl: <S3_PUBLIC_BASE>/<HLS_BUCKET>/<videoId>/thumb.jpg,
    durationSec,
    progress: 100
  }
  rmrf /tmp/<videoId>/

on error:
  BullMQ retries (3 attempts, exponential backoff: 30s, 5min, 15min)
  on final failure → UPDATE Video {status: "FAILED", errorMessage: stderr-tail-1KB}
```

### UI status polling

```
GET /api/videos
  RSC fetch returns [{id, name, status, progress, thumbUrl, customThumbUrl, durationSec, bytes, hasError}]

VideosPage (RSC + client island):
  Server prefetches list. ClientPolling component checks if any row in {QUEUED, PROCESSING};
  if yes, setInterval 3s router.refresh() (RSC re-fetch).
  Stops polling when no row is in transient state.
```

### Custom thumbnail upload

```
POST /api/upload/thumb { videoId }
  Server: requireSession + ownership; presigned PUT → hls-public/<videoId>/thumb-custom.jpg (5 MB cap)
  return { uploadUrl }

Browser: PUT direct
On success: PATCH /api/videos/<id> { customThumbUrl: <S3_PUBLIC_BASE>/<HLS_BUCKET>/<videoId>/thumb-custom.jpg }
```

### Manual retry

```
POST /api/videos/<id>/retry
  Server: requireSession + ownership + status === FAILED
  UPDATE Video {status: QUEUED, errorMessage: null, progress: 0}
  queue.add(JOB_TRANSCODE, {videoId}, {attempts: 3, ...})
  return { ok: true }
```

### Delete with cascade

```
DELETE /api/videos/<id> { force?: boolean }
  Server: requireSession + ownership
  webinarsUsing = prisma.webinar.findMany({ where: { videoId: id }, select: { id, title } })
  if webinarsUsing.length > 0 && !force:
    return { error: "in_use", webinars: webinarsUsing }
  if force OR no webinars using:
    DELETE Video (Prisma cascades Webinar.videoId → null via onDelete: SetNull)
    queue.add(JOB_DELETE_ASSETS, {videoId, ownerId})
    return { ok: true }

Worker delete-video-assets:
  - delete all objects in originals-private/<videoId>/* and hls-public/<videoId>/*
  - log success/failure (no DB update needed — Video already gone)
```

## Wizard step 4 (extends B1)

Three tabs:

1. **URL externa** (B1 behavior preserved)
2. **Enviar novo** — `<UploadDropzone>` with file picker + drag-drop. Uses `usePresignedUpload` hook: state machine `idle → init → uploading → completing → polling → ready/failed`. On READY, auto-selects video for the current webinar via `updateWebinarStep4({ mode: "upload-complete", videoId })`.
3. **Biblioteca** — `<LibraryPicker>` grid of `Video` rows where `ownerId === user.id && status === "READY"`. Card shows thumbnail + name + duration. On click, calls `updateWebinarStep4({ mode: "library", videoId })`.

Server action `updateWebinarStep4` extends from B1 with a discriminated union input:

```ts
type Step4Input =
  | { mode: "external"; videoExternalUrl: string; pitchAtSec?: number }
  | { mode: "library"; videoId: string; pitchAtSec?: number }
  | { mode: "upload-complete"; videoId: string; pitchAtSec?: number };
```

`library` and `upload-complete` validate `Video.ownerId === session.user.id && status === "READY"` before updating `Webinar.videoId`. `external` keeps B1 behavior (creates EXTERNAL Video with `status: READY`, `originalUrl` and `hlsUrl` both set to the pasted URL).

## Library page `/dashboard/videos`

Replaces the B1 stub. Layout:

- `<UsageBar>` — total bytes used by `Video` rows for this owner (formatted "5.96 GB usados"). No hard limit in MVP.
- `<UploadButton>` — opens `<UploadDialog>` (same dropzone as wizard).
- `<VideosTable>`:
  - Columns: Thumb | Nome | Status | Progress | Duration | Bytes | Actions
  - Status badge: READY (green), PROCESSING (yellow + progress bar), FAILED (red), QUEUED (gray)
  - Progress bar visible only on PROCESSING
  - Actions menu: Editar thumb / Ver webinars / Tentar novamente (FAILED only) / Excluir
- `<ClientPolling>` invisible — `setInterval` 3s `router.refresh()` while any row is QUEUED|PROCESSING.

Delete dialog:

- If `webinarsUsing.length > 0`: shows list of affected webinar titles + `<Switch>` "Forçar exclusão (webinars perderão referência ao vídeo)". Excluir button disabled until force toggled.
- Otherwise: confirm → DELETE → cleanup job enqueued.

## Worker Dockerfile

`apps/worker/Dockerfile`:

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

Worker `start` script runs `tsx src/index.ts` — small image, no separate compile step. Sub-plan F may switch to a precompiled distribution.

## Error handling and edge cases

### Upload

- **MIME mismatch:** rejected at `/upload/init`. Server-authoritative; browser `accept="video/*"` is hint.
- **Size > MAX_UPLOAD_BYTES:** 413 from server; UI shows "Arquivo muito grande (X GB > limite Y GB)".
- **Presigned URL expired (15 min):** PUT fails 403; UI shows error + "Tentar novamente" (re-init).
- **Upload aborted (browser closed, network drop):** Video stays QUEUED with no raw file; `/upload/complete` HEAD check fails → never enqueued. Owner can delete manually. Cron cleanup tracked post-MVP.
- **No JS:** upload disabled in UI; URL externa still works.
- **CORS:** MinIO bucket `originals-private` policy must allow `PUT` from configured `BETTER_AUTH_URL` origin. Worker bootstrap applies CORS config if missing.

### Worker / transcode

- **ffmpeg crash:** BullMQ retries 3 with exponential backoff. Final failure → FAILED + stderr tail.
- **OOM ffmpeg:** kernel kills. BullMQ stalled detection re-enqueues. Limit threads via env if needed.
- **/tmp full:** `ENOSPC` fail. Worker boot warns if free space < 30 GB.
- **MinIO connection lost:** S3 SDK retries internally; BullMQ retries on top.
- **Mid-upload S3 failure:** worker retry path deletes prefix `hls-public/<videoId>/` (best-effort) before next attempt.
- **Source > 1440p:** generate only ladder ≤ source.
- **Source < 360p:** generate only one variant matching source.
- **Audio-only file:** `/upload/init` rejects (MIME deeper check on extension list).
- **Corrupted source:** ffprobe fails → FAILED with "Arquivo corrompido — re-upload".
- **Concurrent worker pickup:** BullMQ atomic dequeue.
- **Worker crash mid-job:** BullMQ stalled re-enqueue. Idempotency: worker checks `Video.status === READY` first → skip.
- **Job orphan (Video deleted between enqueue + processing):** worker `findUnique` null → log + skip.

### Library page

- **Stuck PROCESSING:** UI shows "Atualizado há X min". After 30 min no progress change, user can manual retry.
- **0 videos:** empty state.
- **Storage > soft cap:** info only in MVP.
- **Thumb 404:** UI fallback to placeholder icon.
- **Custom thumb during transcode:** allowed (independent of video state).
- **Delete during PROCESSING:** UPDATE Video {status: FAILED, errorMessage: "Cancelled by owner"}. Worker reads DB state on next progress update and early-returns. Cleanup job removes partial files.

### Wizard step 4

- **Library tab empty:** "Biblioteca vazia. Envie via aba 'Enviar novo' ou cole URL externa."
- **Upload during wizard:** dialog completes when status hits READY. Auto-selects video for current webinar.
- **Selected video shows on Biblioteca tab:** check overlay on selected card.

### Security

- Presigned URL key prefix scoped to `<videoId>`.
- `/upload/init` rate-limited 10/min per user via Redis sliding window (Redis already a dep).
- Worker `S3_*` from env (Coolify secrets), never logged.
- MinIO `originals-private` denies anonymous; `hls-public` allows GetObject only.
- Frontend never receives `Video.originalUrl` (S3 key for private bucket); only `hlsUrl` and thumbnails.

### Deploy concerns (sub-plan F)

- Redis service in Coolify
- MinIO service (or external S3-compat) in Coolify
- Worker container env: `S3_*`, `REDIS_URL`, `DATABASE_URL`
- No worker health-check port; Coolify uses container running as health signal
- Worker autoscale 1 → N replicas via Coolify replica count

## Testing

| Module | Tests |
|---|---|
| `worker/lib/ladder.ts` | source 1080p → [360, 720, 1080]; source 480p → [360]; source 4K → all 4 incl 1440p |
| `worker/lib/ffmpeg.ts` | parse "frame= 100 ... time=00:00:10.00" → returns elapsed seconds; total duration param → pct; partial line buffering |
| `worker/lib/s3.ts` | upload key normalization; presigned PUT generates URL with `Content-Length-Range` policy |
| `web/api/upload/init` | rejects non-video MIME; rejects > MAX_UPLOAD_BYTES; creates Video QUEUED + presigned URL; rate-limit 10/min |
| `web/api/upload/complete` | rejects if HEAD fails (raw not in MinIO); enqueues job; idempotent |
| `web/server/actions/video.ts` | listVideos owner-scoped; deleteVideo blocks unless force; setCustomThumb updates URL; retryTranscode only when FAILED |
| `worker/jobs/transcode-video` | mocked S3 + ffmpeg → progress reports → READY status; ffmpeg failure → FAILED; idempotent skip if already READY |
| `worker/jobs/delete-video-assets` | iterates prefix delete; handles partial keys |
| E2E `video-pipeline.spec.ts` (slow) | full upload → transcode → wizard selection → publish |

Integration tests use `docker-compose.test.yml` to start MinIO + Redis test instances. Vitest `globalSetup` boots them and creates buckets; teardown stops containers.

## Definition of Done

1. Migration `add_video_thumbs` applies cleanly; existing rows survive.
2. `apps/worker` package + Dockerfile builds; `pnpm --filter worker typecheck` clean.
3. `packages/jobs` exports `connection`, `Queue`, types — consumed by web (enqueue) and worker (consume).
4. `/api/upload/init` validates MIME + size, creates Video QUEUED, returns presigned PUT URL.
5. Browser PUT direct to MinIO with XHR onprogress %; `/api/upload/complete` enqueues job.
6. Worker `transcode-video`: download → probe → ladder → ffmpeg HLS → thumb → upload → READY with hlsUrl + thumbUrl + durationSec + progress 100.
7. Worker reports progress via `job.updateProgress({pct, stage})`; web polling 3s updates UI.
8. ffmpeg failure → BullMQ 3x retry. Final fail → Video FAILED + stderr-tail.
9. `/dashboard/videos`: usage bar + table with thumb/name/status/progress/duration/bytes/actions.
10. Custom thumb upload via separate presigned PUT; library shows `customThumbUrl ?? thumbUrl`.
11. Delete: blocks if `webinarsUsing > 0`; force toggle cascades `Webinar.videoId → null` and enqueues cleanup.
12. Wizard step 4: 3 tabs (URL externa / Enviar novo / Biblioteca); upload auto-selects on READY; library picker filters status: READY.
13. Manual retry on FAILED video re-enqueues job and resets status.
14. Bucket policies: `originals-private` denies anon; `hls-public` allows GetObject anon.
15. Worker bootstrap validates env (REDIS_URL, S3_*, DATABASE_URL) fail-closed; auto-creates buckets + policies.
16. E2E golden path: upload → READY → wizard select → publish; HLS URL is fetchable.
17. `pnpm -r test` and `pnpm -r typecheck` clean across web + worker + scraper.
18. `docker-compose.yml` includes `minio`, `redis`, `worker` services for local dev.
19. `.env.example` documents `REDIS_URL`, `S3_*` (endpoint/region/access/secret/bucket originals/bucket hls/public base URL), `MAX_UPLOAD_BYTES`, `WORKER_CONCURRENCY`.

## Out of scope (sequenced)

- C — Lead opt-in + public player + watch tracking + cookie hw_lead. Player consumes `hlsUrl` via hls.js.
- E — Real analytics dashboard + leads list real + per-webinar metrics.
- F — Coolify deploy. Multi-stage standalone Dockerfile for web. docker-compose prod. Coolify resources (Redis, MinIO, Postgres, web, worker) + health probes + env management.

## Post-MVP (tracked)

- Cron daily `cleanup-stale-uploads`: DELETE Video where status=QUEUED && createdAt < now() - 24h && raw absent in MinIO.
- Worker autoscale via Coolify replicas based on queue depth.
- WebSocket realtime status (replace polling).
- Sentry alerts on FAILED jobs.
- Multi-tenant Plan limits (storage cap per Company).
- Subtitles / captions extraction.
- Per-variant bitrate tuning configurable.
- Switch worker run from `tsx` to compiled JS (smaller image, faster boot).
