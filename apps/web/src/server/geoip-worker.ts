import { randomUUID } from "node:crypto";
import { prisma } from "db";
import { lookupGeoIp } from "../lib/geoip";
import { applyGeoIpResult, backfillGeoIpBatch } from "./geoip-queue";

const PROVIDER_ID = "ipapi";
const LEASE_MS = 30_000;
const CACHE_MS = 24 * 60 * 60_000;
const MAX_ATTEMPTS = 5;
const RETRY_MS = [30_000, 120_000, 600_000, 3_600_000];
const RATE_LIMIT_PAUSE_MS = 3_600_000;

function minimumInterval() {
  const configured = Number(process.env.GEOIP_MIN_INTERVAL_MS);
  return Number.isFinite(configured) ? Math.max(1_000, Math.floor(configured)) : 1_000;
}

function availableLease(now: Date) {
  return { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] };
}

// Reserve the provider before a job. Both claims commit together, so replicas
// cannot race different IPs into the same upstream rate limit.
async function claimNextLookup() {
  const now = new Date();
  const token = randomUUID();
  return prisma.$transaction(async tx => {
    await tx.geoIpProviderState.upsert({
      where: { id: PROVIDER_ID }, create: { id: PROVIDER_ID }, update: {}
    });
    const provider = await tx.geoIpProviderState.updateMany({
      where: { id: PROVIDER_ID, nextRequestAt: { lte: now }, ...availableLease(now) },
      data: { leaseToken: token, leaseUntil: new Date(now.getTime() + LEASE_MS),
        nextRequestAt: new Date(now.getTime() + minimumInterval()) }
    });
    if (!provider.count) return null;

    const job = await tx.geoIpLookup.findFirst({
      where: { status: "PENDING", nextAttemptAt: { lte: now }, ...availableLease(now) },
      orderBy: [{ priority: "desc" }, { nextAttemptAt: "asc" }, { createdAt: "asc" }, { ip: "asc" }]
    });
    // A process can die after claiming its last attempt. Finalize that expired
    // lease instead of leaving an exhausted PENDING row stranded forever.
    if (!job || job.attempts >= MAX_ATTEMPTS) {
      if (job) await tx.geoIpLookup.updateMany({
        where: { ip: job.ip, status: "PENDING", ...availableLease(now) },
        data: { status: "FAILED", lastError: "attempts_exhausted",
          expiresAt: new Date(now.getTime() + CACHE_MS), leaseToken: null, leaseUntil: null }
      });
      await tx.geoIpProviderState.updateMany({
        where: { id: PROVIDER_ID, leaseToken: token }, data: { leaseToken: null, leaseUntil: null, nextRequestAt: now }
      });
      return null;
    }
    const claimed = await tx.geoIpLookup.updateMany({
      where: { ip: job.ip, status: "PENDING", attempts: job.attempts, ...availableLease(now) },
      data: { attempts: { increment: 1 }, leaseToken: token, leaseUntil: new Date(now.getTime() + LEASE_MS) }
    });
    if (!claimed.count) {
      await tx.geoIpProviderState.updateMany({
        where: { id: PROVIDER_ID, leaseToken: token }, data: { leaseToken: null, leaseUntil: null, nextRequestAt: now }
      });
      return null;
    }
    return { ...job, attempts: job.attempts + 1, token };
  });
}

/** Process at most one due IP; all network work happens outside transactions. */
export async function processNextGeoIpLookup(): Promise<void> {
  const job = await claimNextLookup();
  if (!job) return;
  let persisted = false;
  try {
    const result = await lookupGeoIp(job.ip).catch(() => ({
      ok: false as const, error: "lookup_unavailable", retryable: true
    }));
    const now = new Date();
    const rateLimited = !result.ok && result.error === "rate_limited";
    const requestedPause = !result.ok && "retryAfterMs" in result ? result.retryAfterMs : undefined;
    const pauseMs = typeof requestedPause === "number" && Number.isFinite(requestedPause) && requestedPause >= 0
      ? Math.max(minimumInterval(), requestedPause)
      : rateLimited ? Math.max(minimumInterval(), RATE_LIMIT_PAUSE_MS) : minimumInterval();
    const providerNextRequestAt = new Date(now.getTime() + pauseMs);
    const retry = !result.ok && result.retryable && (rateLimited || job.attempts < MAX_ATTEMPTS);
    const nextAttemptAt = new Date(now.getTime() + Math.max(
      rateLimited ? pauseMs : RETRY_MS[Math.min(job.attempts - 1, RETRY_MS.length - 1)],
      pauseMs
    ));

    const saved = await prisma.$transaction(async tx => {
      // Updating this row also locks the singleton until the job result commits.
      // A worker whose lease was replaced must not publish a late result.
      const provider = await tx.geoIpProviderState.updateMany({
        where: { id: PROVIDER_ID, leaseToken: job.token, leaseUntil: { gt: now } },
        data: { nextRequestAt: providerNextRequestAt }
      });
      if (!provider.count) return false;
      const updated = await tx.geoIpLookup.updateMany({
        where: { ip: job.ip, status: "PENDING", leaseToken: job.token, leaseUntil: { gt: now } },
        data: result.ok ? {
          ...result.data, status: "SUCCESS", lastError: null,
          expiresAt: new Date(now.getTime() + CACHE_MS), leaseToken: null, leaseUntil: null
        } : {
          status: retry ? "PENDING" : "FAILED", lastError: result.error,
          attempts: rateLimited ? Math.max(0, job.attempts - 1) : job.attempts,
          nextAttemptAt,
          expiresAt: retry ? null : new Date(now.getTime() + CACHE_MS),
          leaseToken: null, leaseUntil: null
        }
      });
      return updated.count > 0;
    });
    persisted = true;
    if (saved && result.ok) await applyGeoIpResult(job.ip, result.data);
  } finally {
    // If persistence failed, retain the lease for crash recovery. Do not let
    // another replica start while this result has not been durably recorded.
    if (persisted) await prisma.geoIpProviderState.updateMany({
      where: { id: PROVIDER_ID, leaseToken: job.token },
      data: { leaseToken: null, leaseUntil: null }
    });
  }
}

export function startGeoIpWorker(): () => Promise<void> {
  let closed = false;
  let running: Promise<void> | null = null;
  let nextScanAt = 0;
  let cursor: string | undefined;

  async function work() {
    if (Date.now() >= nextScanAt) {
      const provider = await prisma.geoIpProviderState.findUnique({ where: { id: PROVIDER_ID } });
      if (!provider?.leaseUntil || provider.leaseUntil.getTime() <= Date.now()) {
        cursor = await backfillGeoIpBatch(cursor);
        nextScanAt = Date.now() + 10_000;
      }
    }
    if (!closed) await processNextGeoIpLookup();
  }
  function tick() {
    if (closed || running) return;
    running = work().catch(() => {
      console.error("GeoIP background processing failed; retrying next interval.");
    }).finally(() => { running = null; });
  }
  tick();
  const timer = setInterval(tick, 1_000);
  timer.unref();
  return async () => {
    closed = true;
    clearInterval(timer);
    await running;
  };
}
