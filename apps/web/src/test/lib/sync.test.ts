import { describe, it, expect } from "vitest";
import { computePhase, computeInitialOffset, withOccurrence } from "@/lib/sync";

const baseUnico = {
  mode: "UNICO" as const,
  startDate: new Date("2026-05-04T14:00:00Z"),
  endDate: new Date("2026-05-04T15:00:00Z")
};

const baseJit = {
  mode: "JIT" as const,
  startDate: null,
  endDate: null
};

describe("computePhase", () => {
  it("UNICO returns 'before' before startDate", () => {
    expect(computePhase(baseUnico, new Date("2026-05-04T13:30:00Z"))).toBe("before");
  });

  it("UNICO returns 'open' between start and end", () => {
    expect(computePhase(baseUnico, new Date("2026-05-04T14:30:00Z"))).toBe("open");
  });

  it("UNICO returns 'closed' after endDate", () => {
    expect(computePhase(baseUnico, new Date("2026-05-04T15:30:00Z"))).toBe("closed");
  });

  it("UNICO without startDate is always 'open'", () => {
    expect(computePhase({ ...baseUnico, startDate: null, endDate: null }, new Date())).toBe("open");
  });

  it("JIT is always 'open'", () => {
    expect(computePhase(baseJit, new Date())).toBe("open");
  });
});

describe("computeInitialOffset", () => {
  const lead = { sessionStart: new Date("2026-05-04T14:10:00Z") };
  const videoDuration = 3600;

  it("UNICO computes now - startDate", () => {
    const offset = computeInitialOffset(
      baseUnico,
      lead,
      new Date("2026-05-04T14:30:00Z"),
      videoDuration
    );
    expect(offset).toBe(30 * 60);
  });

  it("JIT computes now - lead.sessionStart", () => {
    const offset = computeInitialOffset(
      baseJit,
      lead,
      new Date("2026-05-04T14:25:00Z"),
      videoDuration
    );
    expect(offset).toBe(15 * 60);
  });

  it("returns 0 if offset is negative", () => {
    const offset = computeInitialOffset(
      baseUnico,
      lead,
      new Date("2026-05-04T13:30:00Z"),
      videoDuration
    );
    expect(offset).toBe(0);
  });

  it("caps at video duration", () => {
    const offset = computeInitialOffset(
      baseUnico,
      lead,
      new Date("2026-05-04T18:00:00Z"),
      videoDuration
    );
    expect(offset).toBe(videoDuration);
  });

  it("returns 0 when video duration is null", () => {
    const offset = computeInitialOffset(baseJit, lead, new Date(), null);
    expect(offset).toBe(0);
  });
});

describe("withOccurrence", () => {
  // Wed 2026-10-28 20:00-22:10 São Paulo (UTC-3) = 23:00-01:10 UTC.
  const rec = {
    mode: "UNICO" as const,
    startDate: new Date("2026-10-28T23:00:00Z"),
    endDate: new Date("2026-10-29T01:10:00Z"),
    recurring: true,
    recurringDays: [0, 1, 2, 3, 4, 5, 6],
    timezone: "America/Sao_Paulo"
  };

  it("leaves non-recurring webinars untouched", () => {
    const w = { ...rec, recurring: false };
    expect(withOccurrence(w, new Date("2026-11-05T12:00:00Z"))).toBe(w);
  });

  it("moves to today's occurrence at the same local time", () => {
    const o = withOccurrence(rec, new Date("2026-11-02T12:00:00Z"));
    expect(o.startDate?.toISOString()).toBe("2026-11-02T23:00:00.000Z");
    expect(o.endDate?.toISOString()).toBe("2026-11-03T01:10:00.000Z");
  });

  it("keeps the occurrence that is still running past midnight", () => {
    const o = withOccurrence(rec, new Date("2026-11-03T00:30:00Z")); // 21:30 local on the 2nd
    expect(o.startDate?.toISOString()).toBe("2026-11-02T23:00:00.000Z");
    expect(computePhase(o, new Date("2026-11-03T00:30:00Z"))).toBe("open");
  });

  it("skips weekdays that are not selected", () => {
    const monFri = { ...rec, recurringDays: [1, 2, 3, 4, 5] };
    // Sat 2026-10-31 noon local -> next is Mon 2026-11-02
    const o = withOccurrence(monFri, new Date("2026-10-31T15:00:00Z"));
    expect(o.startDate?.toISOString()).toBe("2026-11-02T23:00:00.000Z");
    expect(computePhase(o, new Date("2026-10-31T15:00:00Z"))).toBe("before");
  });

  it("never schedules before the first startDate", () => {
    const o = withOccurrence(rec, new Date("2026-10-27T12:00:00Z"));
    expect(o.startDate?.toISOString()).toBe("2026-10-28T23:00:00.000Z");
  });

  it("closes when no weekday is selected", () => {
    const none = { ...rec, recurringDays: [] };
    expect(computePhase(withOccurrence(none, new Date("2026-11-05T12:00:00Z")), new Date("2026-11-05T12:00:00Z"))).toBe("closed");
  });

  it("finds the first selected weekday even when the anchor is months ahead", () => {
    const o = withOccurrence({ ...rec, recurringDays: [1] }, new Date("2026-08-01T12:00:00Z"));
    expect(o.startDate?.toISOString()).toBe("2026-11-02T23:00:00.000Z");
  });

  it("keeps yesterday's session while it is still running after local midnight", () => {
    const o = withOccurrence({ ...rec, endDate: new Date("2026-10-29T04:00:00Z") }, new Date("2026-10-30T03:30:00Z"));
    expect(o.startDate?.toISOString()).toBe("2026-10-29T23:00:00.000Z");
    expect(o.endDate?.toISOString()).toBe("2026-10-30T04:00:00.000Z");
  });

  it("preserves the local start time after a daylight saving offset change", () => {
    const o = withOccurrence({ ...rec, timezone: "America/New_York",
      startDate: new Date("2026-10-29T00:00:00Z"), endDate: new Date("2026-10-29T02:10:00Z")
    }, new Date("2026-11-02T12:00:00Z"));
    expect(o.startDate?.toISOString()).toBe("2026-11-03T01:00:00.000Z");
  });
});
