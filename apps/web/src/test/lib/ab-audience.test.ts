import { describe, expect, it } from "vitest";
import { buildAbAudienceFromSamples, createAbAudiencePlan, type AbAudienceSchedule } from "@/lib/ab-audience";
import type { AbExperimentDto, AbReportFilters } from "@/lib/ab-tests";
import type { AbReportUnit } from "@/lib/ab-report";

const entry = new Date("2026-11-01T18:00:00Z"), now = new Date("2026-11-10T18:00:00Z");
const experiment = { webinarAId: "wa", webinarBId: "wb", mode: "RANDOMIZED", conversionWindowHours: 24,
  startedAt: "2026-11-01T03:00:00Z", endsAt: "2026-11-08T03:00:00Z", completedAt: null } as AbExperimentDto;
const units: AbReportUnit[] = ["A", "B"].map((variant) => ({ id: variant, variant: variant as "A" | "B", webinarId: variant === "A" ? "wa" : "wb",
  leadId: variant, email: `${variant}@example.com`, assignedAt: entry, source: "meta", medium: "cpc", campaign: "campaign", content: null, device: "mobile" }));
const schedule: AbAudienceSchedule = { mode: "UNICO", startDate: new Date("2026-11-01T22:00:00Z"), endDate: new Date("2026-11-01T23:30:00Z"),
  timezone: "America/Sao_Paulo", recurring: false, recurringDays: [], videoSyncWithStart: true, pitchAtSec: 1800 };
function plan(filters: AbReportFilters = {}) { return createAbAudiencePlan({ experiment, units, filters, now, schedules: { A: schedule, B: { ...schedule, mode: "JIT" } } }); }

describe("contextual A/B simultaneous audience", () => {
  it("uses actual readings including zero, preserving gaps and webinar-total scope", () => {
    const result = buildAbAudienceFromSamples(plan(), [
      { variant: "A", observedAt: new Date("2026-11-01T22:00:00Z"), online: 0 },
      { variant: "A", observedAt: new Date("2026-11-01T22:30:00Z"), online: 20 },
      { variant: "A", observedAt: new Date("2026-11-01T23:00:00Z"), online: 10 },
      { variant: "A", observedAt: new Date("2026-11-03T22:00:00Z"), online: 10000 }
    ]);
    expect(result.scope).toBe("WEBINAR_TOTAL");
    expect(result.window).toBe("MATURE_COHORT_WINDOWS");
    expect(result.A).toMatchObject({ average: 10, peak: 20, sampleCount: 3, peakAt: "2026-11-01T22:30:00.000Z", reason: null });
    expect(result.A.pitch).toMatchObject({ average: 20, peak: 20, sampleCount: 1, occurrenceCount: 1, reason: null });
    expect(result.B).toMatchObject({ average: null, peak: null, sampleCount: 0 });
    expect(result.B.reason).toContain("Ausência de leitura não significa audiência zero");
    expect(result.B.pitch.reason).toContain("próprio relógio");
  });
  it("only matches a genuinely observed pitch-time sample within ±15 seconds", () => {
    const result = buildAbAudienceFromSamples(plan(), [
      { variant: "A", observedAt: new Date("2026-11-01T22:29:44Z"), online: 90 },
      { variant: "A", observedAt: new Date("2026-11-01T22:29:50Z"), online: 21 },
      { variant: "A", observedAt: new Date("2026-11-01T22:30:10Z"), online: 31 }
    ]);
    expect(result.A.pitch.points).toEqual([{ scheduledAt: "2026-11-01T22:30:00.000Z", observedAt: "2026-11-01T22:29:50.000Z", online: 21 }]);
    const missing = buildAbAudienceFromSamples(plan(), [{ variant: "A", observedAt: new Date("2026-11-01T22:29:44Z"), online: 90 }]);
    expect(missing.A.average).toBe(90);
    expect(missing.A.pitch.average).toBeNull();
    expect(missing.A.pitch.reason).toContain("15 segundos");
    const zero = buildAbAudienceFromSamples(plan(), [{ variant: "A", observedAt: new Date("2026-11-01T22:30:00Z"), online: 0 }]);
    expect(zero.A.average).toBe(0); expect(zero.A.pitch.average).toBe(0); expect(zero.A.pitch.reason).toBeNull();
  });
  it.each(["source", "medium", "campaign", "content", "device"] as const)("does not pretend webinar totals can be segmented by %s", (key) => {
    const filters = { [key]: key === "device" ? "mobile" : key === "source" ? "meta" : key === "content" ? "__unknown__" : key === "medium" ? "cpc" : "campaign" };
    const result = buildAbAudienceFromSamples(plan(filters), [{ variant: "A", observedAt: new Date("2026-11-01T22:30:00Z"), online: 99 }]);
    expect(result.A.average).toBeNull(); expect(result.A.peak).toBeNull(); expect(result.A.pitch.average).toBeNull();
    expect(result.A.reason).toContain("não permite aplicar filtros");
  });
  it("merges overlapping cohort windows, filters entrance dates, and excludes immature entrants", () => {
    const later = { ...units[0], id: "later", assignedAt: new Date("2026-11-02T06:00:00Z") };
    const pending = { ...units[0], id: "pending", assignedAt: new Date("2026-11-07T23:00:00Z") };
    const full = createAbAudiencePlan({ experiment, units: [units[0], later, pending], now: new Date("2026-11-08T04:00:00Z"), schedules: { A: schedule } });
    expect(full.A.windows).toEqual([{ from: entry, to: new Date("2026-11-03T06:00:00Z") }]);
    const filtered = createAbAudiencePlan({ experiment, units: [units[0], later], now, filters: { to: entry.toISOString() }, schedules: { A: schedule } });
    expect(filtered.A.windows).toEqual([{ from: entry, to: new Date("2026-11-02T18:00:00Z") }]);
  });
  it("includes pending observational audience and pitch snapshots without reading the future", () => {
    const observedNow = new Date("2026-11-01T22:30:05Z");
    const observed = createAbAudiencePlan({ experiment: { ...experiment, mode: "OBSERVATIONAL", conversionWindowHours: 72 },
      units, now: observedNow, schedules: { A: schedule } });
    expect(observed.A.windows).toEqual([{ from: entry, to: observedNow }]);
    const result = buildAbAudienceFromSamples(observed, [
      { variant: "A", observedAt: new Date("2026-11-01T22:00:00Z"), online: 10 },
      { variant: "A", observedAt: observedNow, online: 30 },
      { variant: "A", observedAt: new Date("2026-11-01T22:30:06Z"), online: 999 },
      { variant: "A", observedAt: new Date(entry.getTime() - 1), online: 999 }
    ]);
    expect(result.window).toBe("OBSERVED_COHORT_WINDOWS");
    expect(result.A).toMatchObject({ average: 20, peak: 30, sampleCount: 2 });
    expect(result.A.pitch).toMatchObject({ average: 30, sampleCount: 1, occurrenceCount: 1 });
    const filtered = createAbAudiencePlan({ experiment: { ...experiment, mode: "OBSERVATIONAL" }, units, now: observedNow, filters: { source: "meta" } });
    expect(buildAbAudienceFromSamples(filtered, []).A.reason).toContain("não permite aplicar filtros");
  });
  it("enumerates actual recurring local schedules and reports missing occurrences without zero fill", () => {
    const extended = { ...experiment, conversionWindowHours: 72 };
    const recurring = createAbAudiencePlan({ experiment: extended, units, now, schedules: { A: { ...schedule, recurring: true, recurringDays: [0, 1] } } });
    expect(recurring.A.pitchTargets.map((at) => at.toISOString())).toEqual(["2026-11-01T22:30:00.000Z", "2026-11-02T22:30:00.000Z"]);
    const result = buildAbAudienceFromSamples(recurring, [{ variant: "A", observedAt: new Date("2026-11-01T22:30:05Z"), online: 35 }]);
    expect(result.A.pitch).toMatchObject({ average: 35, sampleCount: 1, occurrenceCount: 2 });
    expect(result.A.pitch.reason).toContain("1 de 2");
  });
  it("withholds a collective pitch after configuration drift or for unsynchronized playback", () => {
    const changed = createAbAudiencePlan({ experiment, units, now, schedules: { A: schedule }, configurationChanged: true });
    expect(changed.A.pitchTargets).toEqual([]); expect(changed.A.pitchReason).toContain("alterada");
    const unsynced = createAbAudiencePlan({ experiment, units, now, schedules: { A: { ...schedule, videoSyncWithStart: false } } });
    expect(unsynced.A.pitchTargets).toEqual([]); expect(unsynced.A.pitchReason).toContain("próprio relógio");
  });
});
