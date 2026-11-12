import { describe, expect, it } from "vitest";
import { createAbTestsDemo, getAbTestsDemoReport, isAbTestsDemoEnabled } from "@/lib/ab-tests-demo";

const now = new Date("2026-11-11T18:00:00Z");

describe("local A/B preview isolation", () => {
  it.each(["localhost", "localhost:3011", "127.0.0.1:3011", "[::1]:3011"])("enables development on %s only", host => {
    expect(isAbTestsDemoEnabled(undefined, "development", host)).toBe(true);
    expect(isAbTestsDemoEnabled("1", "development", host)).toBe(true);
    expect(isAbTestsDemoEnabled("0", "development", host)).toBe(false);
    expect(isAbTestsDemoEnabled("1", "production", host)).toBe(false);
    expect(isAbTestsDemoEnabled("1", "test", host)).toBe(false);
    expect(isAbTestsDemoEnabled("1", undefined, host)).toBe(false);
  });
  it.each([null, "", "app.example.com", "localhost.example.com", "localhost@evil.test", "localhost/path", "http://localhost", "localhost:99999", "127.0.0.2", "localhost:0"])("rejects remote or malformed host %s", host => {
    expect(isAbTestsDemoEnabled("1", "development", host)).toBe(false);
  });
  it("keeps fixtures deterministic within a Brasília calendar day and avoids real/public destinations", () => {
    const demo = createAbTestsDemo(now);
    expect(createAbTestsDemo(new Date("2026-11-11T23:30:00Z"))).toEqual(demo);
    expect(createAbTestsDemo(new Date("2026-11-12T02:59:59Z"))).toEqual(demo);
    expect(createAbTestsDemo(new Date("2026-11-12T03:00:00Z"))).not.toEqual(demo);
    expect(demo.experiments).toHaveLength(4);
    for (const experiment of demo.experiments) {
      expect(experiment.id).toMatch(/^demo-ab-/);
      expect(experiment.publicPath).toBeNull();
      expect(experiment.webinarAId).toMatch(/^demo-ab-/);
      expect(experiment.webinarBId).toMatch(/^demo-ab-/);
    }
    expect(demo.webinars.every(webinar => webinar.slug === null)).toBe(true);
  });
});

describe("coherent synthetic A/B reports", () => {
  const demo = createAbTestsDemo(now);
  it("populates a statistically complete test through the actual analysis engine", () => {
    const report = getAbTestsDemoReport(demo.experiments[0], {}, now);
    expect(report).toEqual(getAbTestsDemoReport(demo.experiments[0], {}, now));
    expect(report.inference.state).toBe("WINNER_B");
    expect(report.inference.pValue).toBeLessThan(.05);
    expect(report.inference.relativeLift).toBeGreaterThan(.2);
    expect(report.variants.reduce((sum, variant) => sum + variant.assigned, 0)).toBe(demo.experiments[0].assignmentCount);
    expect(report.integrity.overlapPeople).toBe(0);
    expect(report.integrity.duplicateIdentities).toBe(0);
    for (const variant of report.variants) {
      expect(variant.mature).toBeGreaterThanOrEqual(report.experiment.sampleSizePerVariant);
      expect(variant.pending).toBe(0);
      expect(variant.rate).toBe(variant.conversions / variant.mature);
      expect(variant.identified).toBeLessThan(variant.mature);
      expect(variant.viewers).toBeLessThanOrEqual(variant.identified);
      expect(variant.pitch).toBeLessThanOrEqual(variant.viewers);
      expect(variant.clicks).toBeLessThanOrEqual(variant.pitch);
      expect(variant.buyers).toBeLessThanOrEqual(variant.clicks);
      expect(variant.sales).toBeGreaterThan(variant.buyers);
      expect(variant.revenueCents).toBe(variant.buyers * 49_700 + (variant.sales - variant.buyers) * 9_700);
    }
    expect(report.daily.filter(day => day.A !== null && day.B !== null)).toHaveLength(14);
    expect(new Set(report.daily.map(day => day.B)).size).toBeGreaterThan(8);
  });
  it("provides variable position curves and exhaustive descriptive segments through the real cohort engine", () => {
    const report = getAbTestsDemoReport(demo.experiments[0], {}, now);
    const diagnostics = report.diagnostics!;
    expect(diagnostics.position.points.length).toBeGreaterThan(8);
    expect(diagnostics.position.points.length).toBeLessThanOrEqual(13);
    expect(diagnostics.position.points.at(-1)?.seconds).toBe(3600);
    for (const [index, arm] of ["A", "B"].entries()) {
      const key = arm as "A" | "B";
      expect(diagnostics.position.mature[key]).toBe(report.variants[index].mature);
      expect(diagnostics.position.measured[key]).toBe(report.variants[index].viewers);
      const counts = diagnostics.position.points.map((point) => point[key].count);
      expect(new Set(counts).size).toBeGreaterThan(8);
      expect(counts.every((value, index) => index === 0 || value <= counts[index - 1])).toBe(true);
      for (const segment of diagnostics.segments) {
        expect(segment.rows.reduce((sum, row) => sum + row[key].mature, 0)).toBe(report.variants[index].mature);
        expect(segment.rows.reduce((sum, row) => sum + row[key].buyers, 0)).toBe(report.variants[index].buyers);
        expect(segment.rows.reduce((sum, row) => sum + row[key].revenueCents, 0)).toBe(report.variants[index].revenueCents);
      }
    }
    const filtered = getAbTestsDemoReport(demo.experiments[0], { source: "meta", device: "mobile" }, now).diagnostics!;
    expect(filtered.segments.find((segment) => segment.dimension === "source")!.rows.map((row) => row.value)).toEqual(["meta"]);
    expect(filtered.segments.find((segment) => segment.dimension === "device")!.rows.map((row) => row.value)).toEqual(["mobile"]);
  });
  it("applies segment and date filters to the cohort and outcomes together", () => {
    const full = getAbTestsDemoReport(demo.experiments[0], {}, now);
    const filtered = getAbTestsDemoReport(demo.experiments[0], { source: "meta", device: "mobile" }, now);
    expect(filtered.inference.state).toBe("EXPLORATORY");
    expect(filtered.filterOptions).toEqual(full.filterOptions);
    expect(filtered.integrity.srmPValue).toBe(full.integrity.srmPValue);
    for (const arm of [0, 1]) {
      expect(filtered.variants[arm].assigned).toBeLessThan(full.variants[arm].assigned);
      expect(filtered.variants[arm].assigned).toBeGreaterThan(0);
      expect(filtered.variants[arm].buyers).toBeLessThan(full.variants[arm].buyers);
      expect(filtered.variants[arm].rate).toBe(filtered.variants[arm].buyers / filtered.variants[arm].mature);
    }
    const from = new Date(new Date(demo.experiments[0].startedAt!).getTime() + 7 * 86_400_000).toISOString();
    const lastWeek = getAbTestsDemoReport(demo.experiments[0], { from }, now);
    expect(lastWeek.variants[0].assigned).toBeLessThan(full.variants[0].assigned);
    expect(lastWeek.daily.filter(day => day.A !== null)).toHaveLength(7);
    const absent = getAbTestsDemoReport(demo.experiments[0], { source: "unobserved-source" }, now);
    expect(absent.variants.map(variant => variant.rate)).toEqual([null, null]);
  });
  it("shows ongoing collection with complete and incomplete windows", () => {
    const report = getAbTestsDemoReport(demo.experiments[1], {}, now);
    expect(report.inference.state).toBe("COLLECTING");
    expect(report.experiment.metric).toBe("OFFER_CLICK");
    for (const variant of report.variants) {
      expect(variant.assigned).toBe(variant.mature + variant.pending);
      expect(variant.pending).toBeGreaterThan(0);
      expect(variant.mature).toBeGreaterThan(0);
      expect(variant.conversions).toBe(variant.clicks);
    }
    expect(report.daily.some(day => day.A === null && day.B === null)).toBe(true);
  });
  it("keeps historical comparisons descriptive and demonstrates known audience overlap", () => {
    const report = getAbTestsDemoReport(demo.experiments[2], {}, now);
    expect(report.inference.state).toBe("OBSERVATIONAL");
    expect(report.integrity.overlapPeople).toBe(8);
    expect(report.integrity.srmPValue).toBeNull();
    expect(report.variants.every(variant => variant.identified === variant.mature)).toBe(true);
  });
  it("provides a fourth schedule scenario with frozen 19h/21h configurations and real-shaped snapshot context", () => {
    const experiment = demo.experiments[3];
    expect(experiment.testVariable).toBe("SCHEDULE");
    expect(experiment.configuration?.frozen).toBe(true);
    expect(experiment.configuration?.A.mode).toBe("UNICO");
    expect(experiment.configuration?.B.mode).toBe("UNICO");
    const formatHour = (date: string) => new Date(date).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    expect(formatHour(experiment.configuration!.A.startAt!)).toBe("19:00");
    expect(formatHour(experiment.configuration!.B.startAt!)).toBe("21:00");
    expect(experiment.configuration!.A.videoName).toBe(experiment.configuration!.B.videoName);
    expect(experiment.configuration!.A.offerPriceFinal).toBe(experiment.configuration!.B.offerPriceFinal);
    const report = getAbTestsDemoReport(experiment, {}, now);
    expect(report.diagnostics!.audience!.scope).toBe("WEBINAR_TOTAL");
    for (const arm of ["A", "B"] as const) {
      expect(report.diagnostics!.audience![arm].average).toBeGreaterThan(0);
      expect(report.diagnostics!.audience![arm].pitch.average).toBeGreaterThan(0);
      expect(report.diagnostics!.audience![arm].pitch.sampleCount).toBeGreaterThan(1);
      expect(report.diagnostics!.timing![arm].firstPitch.samples).toBeGreaterThan(0);
    }
    const filtered = getAbTestsDemoReport(experiment, { source: "meta" }, now);
    expect(filtered.diagnostics!.audience!.A.average).toBeNull();
    expect(filtered.diagnostics!.audience!.A.reason).toContain("não permite aplicar filtros");
    expect(getAbTestsDemoReport(demo.experiments[0], {}, now).diagnostics!.audience!.A.pitch.average).toBeNull();
  });
  it("respects simulated interruptions and leaves new drafts empty", () => {
    const interrupted = { ...demo.experiments[0], interruptedAt: demo.experiments[0].startedAt };
    expect(getAbTestsDemoReport(interrupted, {}, now).inference.state).toBe("EARLY_STOP");
    const draft = { ...demo.experiments[0], id: "demo-ab-new-test", status: "DRAFT" as const, startedAt: null, endsAt: null, completedAt: null, assignmentCount: 0 };
    const report = getAbTestsDemoReport(draft, {}, now);
    expect(report.inference.state).toBe("DRAFT");
    expect(report.variants.map(variant => variant.assigned)).toEqual([0, 0]);
  });
});
