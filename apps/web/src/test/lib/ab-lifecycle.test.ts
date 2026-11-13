import { describe, expect, it } from "vitest";
import { abCollectionPhase, abRecurringRange } from "@/lib/ab-lifecycle";

describe("recurring comparison calendar and lifecycle", () => {
  const experiment = { startedAt: "2026-11-11T03:00:00.000Z", endsAt: "2026-12-11T02:59:59.999Z", conversionWindowHours: 24 };

  it("includes all 30 local dates from November 11 through December 10", () => {
    const range = abRecurringRange("2026-11-11T18:00:00Z", 30);
    expect(range.startedAt.toISOString()).toBe(experiment.startedAt);
    expect(range.endsAt.toISOString()).toBe(experiment.endsAt);
    expect(range.endsAt.getTime() - range.startedAt.getTime() + 1).toBe(30 * 86_400_000);
  });

  it("uses the Brazilian date rather than the UTC date for after-midnight inputs", () => {
    const range = abRecurringRange("2026-11-12T01:00:00Z", 30);
    expect(range.startedAt.toISOString()).toBe(experiment.startedAt);
    expect(range.endsAt.toISOString()).toBe(experiment.endsAt);
  });

  it("keeps upcoming, collecting, maturing and complete phases distinct at their boundaries", () => {
    expect(abCollectionPhase(experiment, Date.parse(experiment.startedAt) - 1)).toBe("SCHEDULED");
    expect(abCollectionPhase(experiment, Date.parse(experiment.startedAt))).toBe("COLLECTING");
    expect(abCollectionPhase(experiment, Date.parse(experiment.endsAt))).toBe("COLLECTING");
    expect(abCollectionPhase(experiment, Date.parse(experiment.endsAt) + 1)).toBe("MATURING");
    expect(abCollectionPhase(experiment, Date.parse(experiment.endsAt) + 86_400_000 - 1)).toBe("MATURING");
    expect(abCollectionPhase(experiment, Date.parse(experiment.endsAt) + 86_400_000)).toBe("COMPLETE");
  });
});
