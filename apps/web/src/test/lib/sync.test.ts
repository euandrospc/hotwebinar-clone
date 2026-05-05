import { describe, it, expect } from "vitest";
import { computePhase, computeInitialOffset } from "@/lib/sync";

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
