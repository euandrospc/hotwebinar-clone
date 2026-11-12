import { describe, expect, it } from "vitest";
import { buildAbReport, type AbReportEvent, type AbReportSale, type AbReportUnit, type BuildAbReportInput } from "@/lib/ab-report";
import type { AbExperimentDto, AbVariantKey } from "@/lib/ab-tests";

const start = new Date("2026-11-01T03:00:00Z");
const now = new Date("2026-11-10T03:00:00Z");
function experiment(overrides: Partial<AbExperimentDto> = {}): AbExperimentDto {
  const webinar = (id: string) => ({ id, name: id, title: id, slug: id, status: "ACTIVE" as const, mode: "JIT" as const });
  return {
    id: "test", name: "Hipótese", hypothesis: "Melhorar a conversão", mode: "RANDOMIZED", status: "RUNNING", metric: "PURCHASE",
    webinarAId: "wa", webinarBId: "wb", webinarA: webinar("wa"), webinarB: webinar("wb"), baselineRate: 0.1, minimumDetectableLift: 0.2,
    sampleSizePerVariant: 1000, durationDays: 7, conversionWindowHours: 24,
    startedAt: start.toISOString(), endsAt: "2026-11-08T03:00:00Z", completedAt: null,
    createdAt: start.toISOString(), updatedAt: start.toISOString(), assignmentCount: 0, publicPath: "/ab/test", ...overrides
  };
}
function unit(id: string, variant: AbVariantKey = "A", overrides: Partial<AbReportUnit> = {}): AbReportUnit {
  return { id, variant, webinarId: variant === "A" ? "wa" : "wb", leadId: id, email: `${id}@example.com`, assignedAt: start,
    source: "meta", medium: "paid", campaign: "campaign", content: null, device: "mobile", ...overrides };
}
function sale(id: string, leadId: string | null, overrides: Partial<AbReportSale> = {}): AbReportSale {
  return { id, leadId, webinarId: "wa", amount: 9700, currency: "BRL", createdAt: new Date(start.getTime() + 1000), ...overrides };
}
function event(unitId: string, kind: AbReportEvent["kind"], overrides: Partial<AbReportEvent> = {}): AbReportEvent {
  return { unitId, kind, firstOccurredAt: new Date(start.getTime() + 1000), maxVideoSec: null, ...overrides };
}
function report(overrides: Partial<BuildAbReportInput> = {}) {
  return buildAbReport({ experiment: experiment(), units: [], events: [], sales: [], pitchAtSec: { A: 120, B: 120 }, now, ...overrides });
}
function conclusiveInput(): Partial<BuildAbReportInput> {
  const units: AbReportUnit[] = [], sales: AbReportSale[] = [];
  for (const variant of ["A", "B"] as const) for (let i = 0; i < 1000; i++) {
    const id = `${variant}${i}`;
    units.push(unit(id, variant));
    if (i < (variant === "A" ? 100 : 130)) sales.push(sale(id, id, { webinarId: variant === "A" ? "wa" : "wb" }));
  }
  return { units, sales };
}

describe("A/B cohorts and interpretation", () => {
  it("keeps all assigned browsers in the denominator, including unidentified visitors", () => {
    const data = report({ units: [unit("identified"), unit("anonymous", "A", { leadId: null, email: null })], sales: [sale("s1", "identified"), sale("s2", "identified")] });
    expect(data.variants[0]).toMatchObject({ assigned: 2, mature: 2, pending: 0, identified: 1, buyers: 1, sales: 2, revenueCents: 19400, conversions: 1, rate: 0.5 });
    expect(data.variants[1].rate).toBeNull();
  });
  it("withholds all outcomes for immature units rather than counting them as failures", () => {
    const data = report({ now: new Date(start.getTime() + 3600_000), units: [unit("person")], sales: [sale("s1", "person")] });
    expect(data.variants[0]).toMatchObject({ assigned: 1, mature: 0, pending: 1, buyers: 0, sales: 0, identified: 0, rate: null });
    expect(data.daily[0].A).toBeNull();
  });
  it("requires exact webinar attribution and excludes purchases before/after the unit window", () => {
    const data = report({ units: [unit("person")], sales: [sale("before", "person", { createdAt: new Date(start.getTime() - 1) }),
      sale("late", "person", { createdAt: new Date(start.getTime() + 86400_001) }), sale("foreign-arm", "person", { webinarId: "wb" }),
      sale("foreign-owner", "person", { webinarId: "foreign" }), sale("unknown", null), sale("usd", "person", { currency: "USD" }),
      sale("real", "person"), sale("real", "person")] });
    expect(data.variants[0]).toMatchObject({ buyers: 1, sales: 1, revenueCents: 9700 });
    expect(data.integrity).toMatchObject({ unattributedSales: 3, excludedCurrencySales: 1 });
  });
  it("counts the exact inclusive conversion-window endpoint", () => {
    expect(report({ units: [unit("p")], sales: [sale("s", "p", { createdAt: new Date(start.getTime() + 86400_000) })] }).variants[0].buyers).toBe(1);
  });
  it("deduplicates outcomes for a lead while preserving all browser units and blocking inference", () => {
    const data = report({ units: [unit("first", "A", { leadId: "p" }), unit("second", "A", { leadId: "p", assignedAt: new Date(start.getTime() + 100) })],
      events: [event("first", "OFFER_CLICK"), event("second", "OFFER_CLICK")], sales: [sale("s", "p")] });
    expect(data.variants[0]).toMatchObject({ assigned: 2, mature: 2, clicks: 1, buyers: 1, sales: 1, rate: 0.5 });
    expect(data.integrity.duplicateIdentities).toBe(1);
    expect(data.inference.state).toBe("INTEGRITY");
  });
  it("detects real case-insensitive cross-arm emails without treating anonymous placeholders as people", () => {
    const data = report({ units: [unit("a", "A", { email: " Pessoa@Example.com " }), unit("b", "B", { email: "pessoa@example.com" }),
      unit("anonA", "A", { email: "anon@no-email.invalid" }), unit("anonB", "B", { email: "anon@no-email.invalid" })] });
    expect(data.integrity.overlapPeople).toBe(1);
    expect(data.variants.map((v) => v.mature)).toEqual([2, 2]);
    expect(data.inference.state).toBe("INTEGRITY");
  });
  it("flags distinct lead rows for the same normalized email in one arm without reattributing revenue", () => {
    const data = report({ units: [unit("one", "A", { email: "Pessoa@example.com" }), unit("two", "A", { email: " pessoa@example.com " }),
      unit("three", "A", { email: "Pessoa@example.com", leadId: "one" })], sales: [sale("s1", "one"), sale("s2", "two")] });
    expect(data.integrity.duplicateIdentities).toBe(1);
    expect(data.integrity.overlapPeople).toBe(0);
    expect(data.variants[0]).toMatchObject({ assigned: 3, mature: 3, buyers: 2, sales: 2, revenueCents: 19400 });
    expect(data.inference.state).toBe("INTEGRITY");
  });
  it("derives playback/pitch/click from recorded events within each unit window", () => {
    const data = report({ experiment: experiment({ metric: "PITCH_REACHED" }), units: [unit("a"), unit("b", "B")], events: [
      event("a", "VIDEO_TICK", { maxVideoSec: 120 }), event("a", "OFFER_CLICK"), event("b", "PITCH_REACHED"),
      event("b", "VIDEO_TICK", { firstOccurredAt: new Date(start.getTime() - 1), maxVideoSec: 500 }),
      event("b", "OFFER_CLICK", { firstOccurredAt: new Date(start.getTime() + 86400_001) })
    ] });
    expect(data.variants[0]).toMatchObject({ viewers: 1, pitch: 1, clicks: 1, conversions: 1, rate: 1 });
    expect(data.variants[1]).toMatchObject({ viewers: 0, pitch: 1, clicks: 0, conversions: 1 });
  });
  it("applies filters to denominator and outcomes but keeps options and SRM on the entire population", () => {
    const units = Array.from({ length: 20 }, (_, i) => unit(`u${i}`, i < 10 ? "A" : "B", { source: i % 2 ? "google" : "meta" }));
    const full = report({ units });
    const filtered = report({ units, filters: { source: "meta" } });
    expect(filtered.variants.map((v) => v.assigned)).toEqual([5, 5]);
    expect(filtered.filterOptions.source).toEqual(["google", "meta"]);
    expect(filtered.integrity.srmPValue).toBe(full.integrity.srmPValue);
    expect(filtered.inference.state).toBe("EXPLORATORY");
    expect(report({ units, filters: { content: "__unknown__" } }).variants[0].assigned).toBe(10);
  });
  it("filters entrants by inclusive exact instants and reports Brasilia day cohorts with null gaps", () => {
    const entries = [unit("nov1", "A", { assignedAt: new Date("2026-11-02T02:00:00Z") }), unit("nov3", "B", { assignedAt: new Date("2026-11-03T03:00:00Z") })];
    const full = report({ units: entries });
    expect(full.daily.find((d) => d.date === "2026-11-01")).toEqual({ date: "2026-11-01", A: 0, B: null });
    expect(full.daily.find((d) => d.date === "2026-11-02")).toEqual({ date: "2026-11-02", A: null, B: null });
    const filtered = report({ units: entries, filters: { from: "2026-11-02T02:00:00Z", to: "2026-11-02T02:00:00Z" } });
    expect(filtered.variants.map((v) => v.assigned)).toEqual([1, 0]);
  });
  it("allows the planned final decision after automatic horizon without manually completing", () => {
    const data = report(conclusiveInput());
    expect(data.inference.state).toBe("WINNER_B");
    expect(data.inference.delta).toBeCloseTo(0.03);
  });
  it("names the winning metric without implying a commercial win from more clicks", () => {
    const input = conclusiveInput();
    const events = input.sales!.map((sale) => event(sale.leadId!, "OFFER_CLICK"));
    const data = report({ ...input, experiment: experiment({ metric: "OFFER_CLICK" }), events,
      sales: input.sales!.filter((sale) => sale.webinarId === "wa") });
    expect(data.inference.state).toBe("WINNER_B");
    expect(data.inference.title).toBe("B teve maior taxa de clique na oferta");
    expect(data.inference.detail).toContain("não comprova aumento de compras ou receita");
    expect(data.variants[1].buyers).toBeLessThan(data.variants[0].buyers);
  });
  it("keeps observing the saved historical range after the comparison was created", () => {
    const data = report({ experiment: experiment({ mode: "OBSERVATIONAL", status: "COMPLETED", completedAt: "2026-11-01T04:00:00Z" }),
      units: [unit("later", "A", { assignedAt: new Date("2026-11-02T03:00:00Z") })] });
    expect(data.variants[0].assigned).toBe(1);
    expect(data.variants[0].mature).toBe(1);
    expect(data.inference.state).toBe("OBSERVATIONAL");
  });
  it.each(["PAUSED", "RUNNING", "COMPLETED"] as const)("never unlocks a winner after an early pause, even with status %s past the horizon", (status) => {
    const data = report({ ...conclusiveInput(), experiment: experiment({ status,
      interruptedAt: "2026-11-05T03:00:00Z", completedAt: status === "COMPLETED" ? "2026-11-09T03:00:00Z" : null }) });
    expect(data.inference.state).toBe("EARLY_STOP");
    expect(data.inference.title).toBe("Coleta interrompida");
  });
  it.each([
    ["OBSERVATIONAL", { experiment: experiment({ mode: "OBSERVATIONAL" }) }],
    ["EXPLORATORY", { filters: { source: "meta" } }],
    ["COLLECTING", { now: new Date("2026-11-07T03:00:00Z") }],
    ["MATURING", { now: new Date("2026-11-08T04:00:00Z") }],
    ["INSUFFICIENT", { experiment: experiment({ sampleSizePerVariant: 8158 }) }],
    ["EARLY_STOP", { experiment: experiment({ status: "COMPLETED", completedAt: "2026-11-07T03:00:00Z" }) }],
    ["INTEGRITY", { configurationChanged: true }],
    ["DRAFT", { experiment: experiment({ status: "DRAFT", startedAt: null, endsAt: null }) }]
  ] as const)("suppresses a winner in %s", (state, overrides) => {
    expect(report({ ...conclusiveInput(), ...overrides }).inference.state).toBe(state);
  });
  it("flags SRM before filters and never authorizes a winner", () => {
    const units = Array.from({ length: 1000 }, (_, i) => unit(`u${i}`, i < 600 ? "A" : "B"));
    const data = report({ units });
    expect(data.integrity.srmPValue).toBeLessThan(0.0005);
    expect(data.inference.state).toBe("INTEGRITY");
  });
  it("does not call equal observed rates proof of equivalence", () => {
    const input = conclusiveInput();
    input.sales = input.sales!.filter((s) => s.webinarId === "wa" || Number(s.id.slice(1)) < 100);
    const data = report(input);
    expect(data.inference.state).toBe("INCONCLUSIVE");
    expect(data.inference.detail).toContain("não demonstra equivalência");
  });
});

describe("A/B descriptive diagnostics share the report cohort", () => {
  it("measures first-event delays without mistaking the first heartbeat for the pitch crossing", () => {
    const data = report({ units: [unit("a"), unit("b", "B")], events: [
      event("a", "VIDEO_TICK", { firstOccurredAt: new Date(start.getTime() + 60_000), maxVideoSec: 3600, firstPitchAt: new Date(start.getTime() + 200_000) }),
      event("a", "OFFER_CLICK", { firstOccurredAt: new Date(start.getTime() + 900_000) }),
      event("a", "OFFER_CLICK", { firstOccurredAt: new Date(start.getTime() + 500_000) }),
      event("b", "VIDEO_TICK", { maxVideoSec: 3600 })
    ], sales: [sale("second", "a", { createdAt: new Date(start.getTime() + 1000_000) }), sale("first", "a", { createdAt: new Date(start.getTime() + 700_000) })] });
    const timing = data.diagnostics!.timing!;
    expect(timing.A.firstPlayback).toEqual({ samples: 1, medianSeconds: 60, averageSeconds: 60 });
    expect(timing.A.firstPitch).toEqual({ samples: 1, medianSeconds: 200, averageSeconds: 200 });
    expect(timing.A.firstClick.medianSeconds).toBe(500);
    expect(timing.A.firstPurchase.medianSeconds).toBe(700);
    expect(data.variants[1].pitch).toBe(1);
    expect(timing.B.firstPitch).toEqual({ samples: 0, medianSeconds: null, averageSeconds: null });
    expect(timing.B.firstPurchase.samples).toBe(0);
  });
  it("groups entrance hour and weekday in Brasília and keeps those totals reconciled", () => {
    const entries = [unit("sunday21", "A", { assignedAt: new Date("2026-11-02T00:30:00Z") }),
      unit("sunday23", "B", { assignedAt: new Date("2026-11-02T02:50:00Z") })];
    const timing = report({ units: entries }).diagnostics!.timing!;
    expect(timing.timeZone).toBe("America/Sao_Paulo");
    expect(timing.hours.map((row) => row.value)).toEqual(["21", "23"]);
    expect(timing.weekdays.map((row) => row.value)).toEqual(["0"]);
    expect(timing.weekdays[0]).toMatchObject({ A: { mature: 1 }, B: { mature: 1 } });
  });
  it("uses only selected mature outcomes and recorded positions inside each window", () => {
    const data = report({ filters: { source: "meta" }, now: new Date("2026-11-08T04:00:00Z"),
      units: [unit("a"), unit("filtered-out", "A", { source: "google" }), unit("b", "B", { campaign: null, device: "desktop" }),
        unit("pending", "A", { assignedAt: new Date("2026-11-08T02:00:00Z") })],
      events: [event("a", "VIDEO_TICK", { maxVideoSec: 60 }), event("a", "VIDEO_TICK", { maxVideoSec: 120 }),
        event("a", "VIDEO_TICK", { maxVideoSec: 9000, firstOccurredAt: new Date(start.getTime() + 86400_001) }),
        event("filtered-out", "VIDEO_TICK", { maxVideoSec: 9999 }), event("b", "PITCH_REACHED", { maxVideoSec: 3600 }),
        event("pending", "VIDEO_TICK", { maxVideoSec: 12000, firstOccurredAt: new Date("2026-11-08T02:30:00Z") })],
      sales: [sale("s1", "a"), sale("s2", "a"), sale("not-selected", "filtered-out")]
    });
    const diagnostics = data.diagnostics!;
    expect(data.variants[0]).toMatchObject({ assigned: 2, mature: 1, pending: 1 });
    expect(diagnostics.position).toMatchObject({ basis: "MATURE_ENTRIES", mature: { A: 1, B: 1 }, measured: { A: 1, B: 0 } });
    expect(diagnostics.position.points).toEqual([
      { seconds: 0, A: { count: 1, rate: 1 }, B: { count: 0, rate: null } },
      { seconds: 60, A: { count: 1, rate: 1 }, B: { count: 0, rate: null } },
      { seconds: 120, A: { count: 1, rate: 1 }, B: { count: 0, rate: null } }
    ]);
    const source = diagnostics.segments.find((segment) => segment.dimension === "source")!;
    expect(source.rows.map((row) => row.value)).toEqual(["meta"]);
    expect(source.rows[0].A).toEqual({ mature: 1, conversions: 1, buyers: 1, revenueCents: 19400, conversionRate: 1, purchaseRate: 1, revenuePerEntryCents: 19400 });
    expect(source.rows[0].B).toMatchObject({ mature: 1, conversions: 0, buyers: 0, revenueCents: 0, conversionRate: 0 });
    const unknown = diagnostics.segments.find((segment) => segment.dimension === "campaign")!.rows.find((row) => row.value === "__unknown__")!;
    expect(unknown.A).toEqual({ mature: 0, conversions: 0, buyers: 0, revenueCents: 0, conversionRate: null, purchaseRate: null, revenuePerEntryCents: null });
    expect(unknown.B.mature).toBe(1);
    for (const segment of diagnostics.segments) for (const [index, arm] of ["A", "B"].entries()) {
      const key = arm as AbVariantKey;
      expect(segment.rows.reduce((sum, row) => sum + row[key].mature, 0)).toBe(data.variants[index].mature);
      expect(segment.rows.reduce((sum, row) => sum + row[key].conversions, 0)).toBe(data.variants[index].conversions);
      expect(segment.rows.reduce((sum, row) => sum + row[key].buyers, 0)).toBe(data.variants[index].buyers);
      expect(segment.rows.reduce((sum, row) => sum + row[key].revenueCents, 0)).toBe(data.variants[index].revenueCents);
    }
  });
  it("retains duplicate browser denominators but never duplicates position or purchase outcomes", () => {
    const data = report({ units: [unit("first", "A", { leadId: "p" }), unit("second", "A", { leadId: "p", source: "google", assignedAt: new Date(start.getTime() + 100) })],
      events: [event("first", "VIDEO_TICK", { maxVideoSec: 120 }), event("second", "VIDEO_TICK", { maxVideoSec: 9000 })], sales: [sale("s", "p")] });
    expect(data.diagnostics!.position).toMatchObject({ mature: { A: 2, B: 0 }, measured: { A: 1, B: 0 } });
    expect(data.diagnostics!.position.points.at(-1)).toEqual({ seconds: 120, A: { count: 1, rate: .5 }, B: { count: 0, rate: null } });
    const google = data.diagnostics!.segments[0].rows.find((row) => row.value === "google")!;
    expect(google.A).toMatchObject({ mature: 1, conversions: 0, buyers: 0, revenueCents: 0 });
  });
  it("preserves observed zero positions, missing observations, and empty filtered cohorts distinctly", () => {
    const input: Partial<BuildAbReportInput> = { units: [unit("zero"), unit("missing", "B")],
      events: [event("zero", "VIDEO_TICK", { maxVideoSec: 0 }), event("missing", "VIDEO_TICK", { maxVideoSec: NaN })] };
    const data = report(input);
    expect(data.diagnostics!.position.points).toEqual([{ seconds: 0, A: { count: 1, rate: 1 }, B: { count: 0, rate: null } }]);
    const empty = report({ ...input, filters: { source: "not-present" } }).diagnostics!;
    expect(empty.position).toEqual({ basis: "MATURE_ENTRIES", mature: { A: 0, B: 0 }, measured: { A: 0, B: 0 }, points: [] });
    expect(empty.segments.every((segment) => segment.rows.length === 0)).toBe(true);
  });
  it("applies entry-date filters before creating segment and curve populations", () => {
    const data = report({ filters: { from: start.toISOString(), to: start.toISOString() },
      units: [unit("inside"), unit("later", "B", { assignedAt: new Date(start.getTime() + 1000), source: "google" })],
      events: [event("inside", "VIDEO_TICK", { maxVideoSec: 60 }), event("later", "VIDEO_TICK", { maxVideoSec: 9000 })] });
    expect(data.diagnostics!.position).toMatchObject({ mature: { A: 1, B: 0 }, measured: { A: 1, B: 0 } });
    expect(data.diagnostics!.segments[0].rows.map((row) => row.value)).toEqual(["meta"]);
    expect(data.diagnostics!.position.points.at(-1)?.seconds).toBe(60);
  });
});
