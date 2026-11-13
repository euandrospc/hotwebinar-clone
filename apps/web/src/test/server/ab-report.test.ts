import { beforeEach, describe, expect, it, vi } from "vitest";
const queries = vi.hoisted(() => ({ experiment: vi.fn(), webinars: vi.fn(), assignments: vi.fn(), entries: vi.fn(), leads: vi.fn(), outcomes: vi.fn(), sales: vi.fn(), audienceAggregate: vi.fn(), audiencePeak: vi.fn(), audienceSamples: vi.fn() }));
vi.mock("db", () => ({ prisma: {
  abExperiment: { findFirst: queries.experiment }, webinar: { findMany: queries.webinars },
  abAssignment: { findMany: queries.assignments }, event: { groupBy: queries.entries }, lead: { findMany: queries.leads },
  $queryRaw: queries.outcomes, sale: { findMany: queries.sales },
  audienceSample: { aggregate: queries.audienceAggregate, findFirst: queries.audiencePeak, findMany: queries.audienceSamples }
} }));
vi.mock("@/server/ab-tests/experiments", () => ({
  AbTestError: class extends Error { constructor(public code: string, public status: number) { super(code); } },
  experimentInclude: { webinarA: true, webinarB: true }, serializeExperiment: (row: { dto: unknown }) => row.dto
}));
vi.mock("@/server/ab-tests/webinar-fingerprint", () => ({ webinarFingerprint: (row: { fingerprint: string }) => row.fingerprint }));
import { getAbReport } from "@/server/ab-tests/report";

const start = new Date("2026-11-01T03:00:00Z"), end = new Date("2026-11-08T03:00:00Z"), now = new Date("2026-11-10T03:00:00Z");
const webinar = (id: string) => ({ id, title: id, name: id, slug: id, status: "ACTIVE", mode: "JIT", pitchAtSec: 120, fingerprint: id });
function row(mode = "RANDOMIZED") {
  const dto = { id: "experiment", name: "Teste", hypothesis: "", mode, status: "RUNNING", metric: "PURCHASE",
    webinarAId: "a", webinarBId: "b", webinarA: webinar("a"), webinarB: webinar("b"),
    baselineRate: 0.05, minimumDetectableLift: 0.2, sampleSizePerVariant: 8158, durationDays: 7, conversionWindowHours: 24,
    startedAt: start.toISOString(), endsAt: end.toISOString(), completedAt: null, createdAt: start.toISOString(), updatedAt: start.toISOString(), assignmentCount: 1, publicPath: "/ab/experiment" };
  return { ...dto, dto, ownerId: "owner", startedAt: start, endsAt: end, completedAt: null, webinarAFingerprint: "a", webinarBFingerprint: "b" };
}
beforeEach(() => {
  for (const fn of Object.values(queries)) fn.mockReset().mockResolvedValue([]);
  queries.experiment.mockResolvedValue(row());
  queries.webinars.mockResolvedValue([webinar("a"), webinar("b")]);
  queries.audienceAggregate.mockResolvedValue({ _avg: { online: null }, _max: { online: null }, _count: 0 });
  queries.audiencePeak.mockResolvedValue(null);
  queries.assignments.mockResolvedValue([{ id: "unit-a", variant: "A", leadId: "lead-a", createdAt: start,
    utmSource: "meta", utmMedium: null, utmCampaign: null, utmContent: null, device: "mobile", lead: { email: "a@example.com", webinarId: "a" } }]);
});

describe("A/B report database boundaries", () => {
  it("scopes all assignment, sales and outcome queries to the authenticated owner", async () => {
    await getAbReport("owner", "experiment", { source: "google" }, now);
    expect(queries.experiment.mock.calls[0][0].where).toEqual({ id: "experiment", ownerId: "owner" });
    expect(queries.webinars.mock.calls[0][0].where).toEqual({ ownerId: "owner", id: { in: ["a", "b"] } });
    expect(queries.assignments.mock.calls[0][0].where).toEqual({ experimentId: "experiment", experiment: { ownerId: "owner" }, createdAt: { gte: start, lte: end } });
    expect(queries.sales.mock.calls[0][0].where).toEqual({ webinar: { ownerId: "owner", id: { in: ["a", "b"] } }, createdAt: { gte: start, lte: new Date("2026-11-09T03:00:00Z") } });
    const [sql, windows, ownerId] = queries.outcomes.mock.calls[0];
    expect(sql.join("")).toContain('w."ownerId" = ');
    expect(ownerId).toBe("owner");
    // Segmentation never narrows allocation queries used by SRM/quality checks.
    expect(JSON.parse(windows)).toHaveLength(1);
  });
  it("joins exact inclusive per-unit UTC boundaries independently of the database timezone", async () => {
    queries.outcomes.mockResolvedValue([{ unitId: "unit-a", kind: "VIDEO_TICK", firstOccurredAt: new Date("2026-11-02T03:00:00Z"), maxVideoSec: 120 }]);
    const report = await getAbReport("owner", "experiment", {}, now);
    const [sql, windows] = queries.outcomes.mock.calls[0];
    expect(sql.join("")).toContain('e."createdAt" >= (u."from" AT TIME ZONE \'UTC\')');
    expect(sql.join("")).toContain('e."createdAt" <= (u."to" AT TIME ZONE \'UTC\')');
    expect(JSON.parse(windows)).toEqual([{ unitId: "unit-a", leadId: "lead-a", webinarId: "a", pitchAtSec: 120, from: "2026-11-01T03:00:00.000Z", to: "2026-11-02T03:00:00.000Z" }]);
    expect(report.variants[0].pitch).toBe(1);
  });
  it("rejects foreign experiments and missing authentication before querying outcomes", async () => {
    await expect(getAbReport("", "experiment")).rejects.toMatchObject({ status: 401 });
    expect(queries.experiment).not.toHaveBeenCalled();
    queries.experiment.mockResolvedValue(null);
    await expect(getAbReport("owner", "foreign")).rejects.toMatchObject({ status: 404 });
    expect(queries.assignments).not.toHaveBeenCalled();
    expect(queries.outcomes).not.toHaveBeenCalled();
  });
  it("keeps unbound and pending browsers in the report without fetching their heartbeats", async () => {
    queries.assignments.mockResolvedValue([{ id: "anonymous", variant: "A", leadId: null, createdAt: start,
      utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, device: null, lead: null }]);
    const report = await getAbReport("owner", "experiment", {}, new Date(start.getTime() + 3600_000));
    expect(report.variants[0]).toMatchObject({ assigned: 1, mature: 0, pending: 1, rate: null });
    expect(queries.outcomes).not.toHaveBeenCalled();
  });
  it("uses first historical events and current profile segments without sessionStart", async () => {
    queries.experiment.mockResolvedValue(row("OBSERVATIONAL"));
    queries.entries.mockResolvedValue([{ webinarId: "a", leadId: "lead-a", _min: { createdAt: start } }]);
    queries.leads.mockResolvedValue([{ id: "lead-a", webinarId: "a", email: "a@example.com", userAgent: "iPhone Mobile", utmSource: "meta", utmMedium: null, utmCampaign: null, utmContent: null }]);
    const report = await getAbReport("owner", "experiment", {}, now);
    expect(queries.assignments).not.toHaveBeenCalled();
    expect(queries.entries.mock.calls[0][0]).toMatchObject({ by: ["webinarId", "leadId"], where: { webinar: { ownerId: "owner", id: { in: ["a", "b"] } }, createdAt: { gte: start, lte: end } }, _min: { createdAt: true } });
    expect(queries.leads.mock.calls[0][0].where.webinar).toEqual({ ownerId: "owner", id: { in: ["a", "b"] } });
    expect(report.filterOptions.device).toEqual(["mobile"]);
    expect(report.inference.state).toBe("OBSERVATIONAL");
    expect(report.integrity.warnings.join(" ")).toContain("cadastro atual");
  });
  it("loads pending observational outcomes and audience only through the current instant", async () => {
    const historical = row("OBSERVATIONAL"), observedNow = new Date(start.getTime() + 8 * 3600_000);
    queries.experiment.mockResolvedValue({ ...historical, conversionWindowHours: 72, dto: { ...historical.dto, conversionWindowHours: 72 } });
    queries.entries.mockResolvedValue([{ webinarId: "a", leadId: "lead-a", _min: { createdAt: start } }]);
    queries.leads.mockResolvedValue([{ id: "lead-a", webinarId: "a", email: "a@example.com", userAgent: "iPhone Mobile", utmSource: "meta", utmMedium: null, utmCampaign: null, utmContent: null }]);
    queries.outcomes.mockResolvedValue([
      { unitId: "observed:lead-a", kind: "VIDEO_TICK", firstOccurredAt: new Date(start.getTime() + 30_000), maxVideoSec: 180 },
      { unitId: "observed:lead-a", kind: "OFFER_CLICK", firstOccurredAt: new Date(start.getTime() + 180_000), maxVideoSec: null }
    ]);
    queries.sales.mockResolvedValue([{ id: "sale-a", webinarId: "a", leadId: "lead-a", amount: 9700, currency: "BRL", createdAt: new Date(start.getTime() + 240_000) }]);
    queries.audienceAggregate.mockResolvedValue({ _avg: { online: 14 }, _max: { online: 30 }, _count: 100 });
    queries.audiencePeak.mockResolvedValue({ observedAt: new Date(start.getTime() + 30_000) });
    const report = await getAbReport("owner", "experiment", {}, observedNow);
    expect(JSON.parse(queries.outcomes.mock.calls[0][1])).toEqual([{ unitId: "observed:lead-a", leadId: "lead-a", webinarId: "a", pitchAtSec: 120, from: start.toISOString(), to: observedNow.toISOString() }]);
    expect(queries.sales.mock.calls[0][0].where.createdAt.lte).toEqual(observedNow);
    expect(queries.audienceAggregate.mock.calls[0][0].where).toEqual({ webinarId: "a", webinar: { ownerId: "owner" }, OR: [{ observedAt: { gte: start, lte: observedNow } }] });
    expect(report.variants[0]).toMatchObject({ assigned: 1, mature: 0, pending: 1, evaluated: 1, viewers: 1, pitch: 1, clicks: 1, buyers: 1, revenueCents: 9700 });
    expect(report.diagnostics!.audience!.window).toBe("OBSERVED_COHORT_WINDOWS");
    expect(report.diagnostics!.audience!.A).toMatchObject({ average: 14, peak: 30, sampleCount: 100 });
  });
  it("blocks causal inference when a variant fingerprint changes", async () => {
    queries.webinars.mockResolvedValue([{ ...webinar("a"), fingerprint: "changed" }, webinar("b")]);
    const report = await getAbReport("owner", "experiment", {}, now);
    expect(report.inference.state).toBe("INTEGRITY");
    expect(report.integrity.warnings.join(" ")).toContain("configuração de uma versão mudou");
  });
  it("does not truncate a historical comparison at its creation/completion timestamp", async () => {
    const historical = row("OBSERVATIONAL");
    queries.experiment.mockResolvedValue({ ...historical, completedAt: new Date("2026-11-01T04:00:00Z"),
      dto: { ...historical.dto, completedAt: "2026-11-01T04:00:00Z" } });
    await getAbReport("owner", "experiment", {}, now);
    expect(queries.entries.mock.calls[0][0].where.createdAt).toEqual({ gte: start, lte: end });
    expect(queries.sales.mock.calls[0][0].where.createdAt.lte).toEqual(new Date("2026-11-09T03:00:00Z"));
  });
  it("aggregates webinar audience inside eligible windows with owner scope on every query", async () => {
    queries.audienceAggregate.mockResolvedValue({ _avg: { online: 10 }, _max: { online: 20 }, _count: 3 });
    queries.audiencePeak.mockResolvedValue({ observedAt: new Date("2026-11-01T12:00:00Z") });
    const report = await getAbReport("owner", "experiment", {}, now);
    const where = { webinarId: "a", webinar: { ownerId: "owner" },
      OR: [{ observedAt: { gte: start, lte: new Date("2026-11-02T03:00:00Z") } }] };
    expect(queries.audienceAggregate).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(queries.audiencePeak).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(report.diagnostics!.audience!.A).toMatchObject({ average: 10, peak: 20, sampleCount: 3 });
    expect(report.diagnostics!.audience!.B.average).toBeNull();
    expect(queries.audienceSamples).not.toHaveBeenCalled();
  });
  it("loads only narrow actual snapshot ranges around synchronized pitch occurrences", async () => {
    queries.webinars.mockResolvedValue([{ ...webinar("a"), mode: "UNICO", startDate: new Date("2026-11-01T12:00:00Z"), endDate: new Date("2026-11-01T13:30:00Z"),
      pitchAtSec: 1800, videoSyncWithStart: true, recurring: false, recurringDays: [], timezone: "America/Sao_Paulo" }, webinar("b")]);
    queries.audienceAggregate.mockResolvedValue({ _avg: { online: 20 }, _max: { online: 30 }, _count: 240 });
    queries.audienceSamples.mockResolvedValue([{ observedAt: new Date("2026-11-01T12:30:01Z"), online: 24 }]);
    const report = await getAbReport("owner", "experiment", {}, now);
    expect(queries.audienceSamples).toHaveBeenCalledWith(expect.objectContaining({ where: {
      webinarId: "a", webinar: { ownerId: "owner" }, OR: [{ observedAt: { gte: new Date("2026-11-01T12:29:45Z"), lte: new Date("2026-11-01T12:30:15Z") } }]
    } }));
    expect(report.diagnostics!.audience!.A.pitch).toMatchObject({ average: 24, sampleCount: 1, occurrenceCount: 1 });
    const [sql] = queries.outcomes.mock.calls[0];
    expect(sql.join("")).toContain('e."videoSec" >= u."pitchAtSec"');
    expect(sql.join("")).toContain('AS "firstPitchAt"');
  });
  it("does not query unsegmentable audience totals after an acquisition filter", async () => {
    const report = await getAbReport("owner", "experiment", { source: "meta" }, now);
    expect(report.variants[0].mature).toBe(1);
    expect(queries.audienceAggregate).not.toHaveBeenCalled();
    expect(queries.audiencePeak).not.toHaveBeenCalled();
    expect(queries.audienceSamples).not.toHaveBeenCalled();
    expect(report.diagnostics!.audience!.A.reason).toContain("não permite aplicar filtros");
  });
  it("uses frozen pitch thresholds and synchronized schedule instead of later webinar settings", async () => {
    const original = row();
    const snapshot = { mode: "UNICO", startAt: "2026-11-01T12:00:00Z", endAt: "2026-11-01T13:30:00Z",
      timezone: "America/Sao_Paulo", recurring: false, recurringDays: [], videoSyncWithStart: true, pitchAtSec: 60 };
    queries.experiment.mockResolvedValue({ ...original, dto: { ...original.dto,
      configuration: { frozen: true, A: snapshot, B: { ...snapshot, mode: "JIT", pitchAtSec: null } } } });
    // The current webinar has mode JIT and pitch at 120 s. The frozen plan is
    // synchronized at noon with a 60 s pitch, independently of today's fields.
    queries.outcomes.mockResolvedValue([{ unitId: "unit-a", kind: "VIDEO_TICK", firstOccurredAt: new Date("2026-11-01T12:00:01Z"), maxVideoSec: 90,
      firstPitchAt: new Date("2026-11-01T12:01:00Z") }]);
    queries.audienceAggregate.mockResolvedValue({ _avg: { online: 20 }, _max: { online: 30 }, _count: 240 });
    queries.audienceSamples.mockResolvedValue([{ observedAt: new Date("2026-11-01T12:01:01Z"), online: 24 }]);
    const report = await getAbReport("owner", "experiment", {}, now);
    expect(report.variants[0].pitch).toBe(1);
    expect(JSON.parse(queries.outcomes.mock.calls[0][1])[0].pitchAtSec).toBe(60);
    expect(report.diagnostics!.audience!.A.pitch.points[0]).toMatchObject({ scheduledAt: "2026-11-01T12:01:00.000Z", online: 24 });
    expect(queries.audienceSamples.mock.calls[0][0].where.OR).toEqual([
      { observedAt: { gte: new Date("2026-11-01T12:00:45Z"), lte: new Date("2026-11-01T12:01:15Z") } }
    ]);
    // Drift detection still compares current configuration against the original
    // fingerprint, even when descriptive calculations use frozen plan values.
    queries.webinars.mockResolvedValue([{ ...webinar("a"), fingerprint: "changed" }, webinar("b")]);
    const drifted = await getAbReport("owner", "experiment", {}, now);
    expect(drifted.inference.state).toBe("INTEGRITY");
  });
  it("preserves a frozen null pitch rather than falling back to today's threshold", async () => {
    const original = row();
    const snapshot = { mode: "JIT", startAt: null, endAt: null, timezone: "America/Sao_Paulo", recurring: false,
      recurringDays: [], videoSyncWithStart: false, pitchAtSec: null };
    queries.experiment.mockResolvedValue({ ...original, dto: { ...original.dto, configuration: { frozen: true, A: snapshot, B: snapshot } } });
    queries.outcomes.mockResolvedValue([{ unitId: "unit-a", kind: "VIDEO_TICK", firstOccurredAt: start, maxVideoSec: 500 }]);
    const report = await getAbReport("owner", "experiment", {}, now);
    expect(report.variants[0].pitch).toBe(0);
    expect(JSON.parse(queries.outcomes.mock.calls[0][1])[0].pitchAtSec).toBeNull();
  });
});

describe("recurring reporting SQL", () => {
  it("groups identified activity by Brasilia day, excludes click-only entries and bounds successive windows", async () => {
    const base = row("OBSERVATIONAL");
    queries.experiment.mockResolvedValue({ ...base, observationUnit: "DAILY_SESSION", dto: { ...base.dto, observationUnit: "DAILY_SESSION" } });
    queries.leads.mockResolvedValue([{ id: "lead-a", webinarId: "a", email: "a@example.com", userAgent: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null }]);
    queries.outcomes.mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = strings.join("");
      if (sql.includes('GROUP BY e."webinarId"')) return [
        { webinarId: "a", leadId: "lead-a", entryDate: "2026-11-01", assignedAt: start },
        { webinarId: "a", leadId: "lead-a", entryDate: "2026-11-02", assignedAt: new Date("2026-11-02T03:00:00Z") }
      ];
      return [];
    });
    await getAbReport("owner", "experiment", {}, now);
    expect(queries.entries).not.toHaveBeenCalled();
    const [entrySql, owner, a, b] = queries.outcomes.mock.calls[0];
    expect(entrySql.join("")).toContain(`(e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo'`);
    expect(entrySql.join("")).toContain("IN ('OPTIN', 'VIDEO_TICK', 'PITCH_REACHED')");
    expect(entrySql.join("")).not.toContain("OFFER_CLICK");
    expect([owner, a, b]).toEqual(["owner", "a", "b"]);
    const [eventSql, json] = queries.outcomes.mock.calls[1];
    expect(JSON.parse(json)).toEqual([
      { unitId: "observed:lead-a:2026-11-01", webinarId: "a", leadId: "lead-a", pitchAtSec: 120,
        from: "2026-11-01T03:00:00.000Z", to: "2026-11-02T03:00:00.000Z", nextEntry: "2026-11-02T03:00:00.000Z" },
      { unitId: "observed:lead-a:2026-11-02", webinarId: "a", leadId: "lead-a", pitchAtSec: 120,
        from: "2026-11-02T03:00:00.000Z", to: "2026-11-03T03:00:00.000Z", nextEntry: null }
    ]);
    expect(eventSql.join("")).toContain(`e."createdAt" < (u."nextEntry" AT TIME ZONE 'UTC')`);
  });
  it("batches daily/weekly/total audience with owner isolation and calendar snapshot boundaries", async () => {
    const base = row("OBSERVATIONAL");
    queries.experiment.mockResolvedValue({ ...base, observationUnit: "DAILY_SESSION", dto: { ...base.dto, observationUnit: "DAILY_SESSION" } });
    queries.outcomes.mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = strings.join("");
      if (sql.includes("FROM windows u")) return [
        { key: "total", variant: "A", average: 12.5, peak: 20, peakAt: start, sampleCount: 4 },
        { key: "selected", variant: "A", average: 10, peak: 10, peakAt: start, sampleCount: 3 },
        { key: "2026-11-01", variant: "A", average: 10, peak: 10, peakAt: start, sampleCount: 3 },
        { key: "2026-11-02", variant: "A", average: 20, peak: 20, peakAt: new Date("2026-11-02T03:00:00Z"), sampleCount: 1 }
      ];
      return [];
    });
    const report = await getAbReport("owner", "experiment", { from: start.toISOString(), to: "2026-11-02T02:59:59.999Z" }, now);
    expect(queries.audienceAggregate).not.toHaveBeenCalled();
    expect(queries.audiencePeak).not.toHaveBeenCalled();
    const batch = queries.outcomes.mock.calls.find(([sql]) => sql.join("").includes("FROM windows u"))!;
    expect(batch[0].join("")).toContain('w."ownerId" = ');
    expect(batch[2]).toBe("owner");
    const windows = JSON.parse(batch[1]);
    expect(windows.find((window: { key: string; variant: string }) => window.key === "2026-11-02" && window.variant === "A")).toMatchObject({
      from: "2026-11-02T03:00:00.000Z", to: "2026-11-03T02:59:59.999Z"
    });
    expect(report.diagnostics!.audience!.A.average).toBe(10);
    expect(report.periods!.total.audience!.A).toMatchObject({ average: 12.5, peak: 20, sampleCount: 4 });
    expect(report.periods!.total.audience!.window).toBe("CALENDAR_PERIOD");
    expect(report.periods!.daily[1].audience!.A.average).toBe(20);
  });
});
