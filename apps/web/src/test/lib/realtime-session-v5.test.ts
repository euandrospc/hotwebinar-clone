import { describe, expect, it } from "vitest";
import { buildRealtimeSession, formatCountdown, type RealtimeSessionMilestoneId } from "@/lib/realtime-session-v5";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

type Schedule = NonNullable<WebinarRealtimeSnapshot["schedule"]>;
const start = Date.parse("2026-11-17T17:30:00.000Z");
const base: Schedule = {
  mode: "UNICO",
  startDate: new Date(start).toISOString(),
  endDate: new Date(start + 90 * 60_000).toISOString(),
  pitchAtSec: 45 * 60,
  offerShowAtSec: 50 * 60,
  offerHideAtSec: 80 * 60,
  offerDisabled: false,
  videoSyncWithStart: true,
};
const stage = (schedule: Schedule, now: number, id: RealtimeSessionMilestoneId) =>
  buildRealtimeSession(schedule, now).milestones.find(item => item.id === id)!;

describe("realtime session model", () => {
  it("keeps all four deadlines and selects the next milestone without hiding later countdowns", () => {
    const model = buildRealtimeSession(base, start - 29_500);
    expect(model).toMatchObject({ phase: "upcoming", nextId: "start", progress: 0 });
    expect(model.milestones.map(item => [item.id, item.label, item.secondsRemaining])).toEqual([
      ["start", "Start", 30], ["pitch", "Pitch", 2730], ["offer", "Offer", 3030], ["end", "End", 5430],
    ]);
    expect(model.milestones.every(item => item.state === "upcoming")).toBe(true);
  });

  it("advances from start to pitch using the server-resolved occurrence and retains seconds", () => {
    const now = start + 30 * 60_000 + 1_000;
    const model = buildRealtimeSession(base, now);
    expect(model.phase).toBe("live");
    expect(model.nextId).toBe("pitch");
    expect(model.progress).toBeCloseTo(1801 / 5400);
    expect(model.milestones[0]).toMatchObject({ state: "reached", detail: "Started", at: start, secondsRemaining: 0 });
    expect(model.milestones[1].secondsRemaining).toBe(899);
    expect(model.milestones[2].secondsRemaining).toBe(1199);
    expect(model.milestones[3].secondsRemaining).toBe(3599);
  });

  it("treats zero pitch and null offer-show as the start instant, not missing configuration", () => {
    const schedule = { ...base, pitchAtSec: 0, offerShowAtSec: null };
    const model = buildRealtimeSession(schedule, start);
    expect(model.nextId).toBe("end");
    expect(model.milestones.slice(0, 3).map(item => item.state)).toEqual(["reached", "reached", "reached"]);
    expect(model.milestones.slice(0, 3).every(item => item.at === start)).toBe(true);
    expect(model.milestones[2].detail).toBe("Open");
  });

  it("chooses the earliest valid future time without reordering the four displayed steps", () => {
    const model = buildRealtimeSession({ ...base, pitchAtSec: 300, offerShowAtSec: 120 }, start + 60_000);
    expect(model.nextId).toBe("offer");
    expect(model.milestones.map(item => item.id)).toEqual(["start", "pitch", "offer", "end"]);
  });

  it("closes the offer exactly at hide time while retaining its configured opening time", () => {
    const hiding = start + base.offerHideAtSec! * 1_000;
    expect(stage(base, hiding - 1, "offer")).toMatchObject({ state: "reached", detail: "Open" });
    expect(stage(base, hiding, "offer")).toMatchObject({
      state: "closed", detail: "Closed", at: start + base.offerShowAtSec! * 1_000, secondsRemaining: null,
    });
  });

  it("closes the session at its exact deadline and does not keep an expired next countdown", () => {
    const model = buildRealtimeSession({ ...base, offerHideAtSec: null }, start + 90 * 60_000);
    expect(model).toMatchObject({ phase: "ended", nextId: null, progress: 1 });
    expect(model.milestones[1]).toMatchObject({ state: "reached", detail: "Reached" });
    expect(model.milestones[2]).toMatchObject({ state: "closed", detail: "Session ended" });
    expect(model.milestones[3]).toMatchObject({ state: "reached", detail: "Ended", secondsRemaining: 0 });
  });

  it.each([5400, 5401])("does not schedule pitch or offer at/after the exclusive session end (%i)", offset => {
    const model = buildRealtimeSession({ ...base, pitchAtSec: offset, offerShowAtSec: offset, offerHideAtSec: null }, start + 1_000);
    expect(model.nextId).toBe("end");
    for (const item of model.milestones.slice(1, 3)) {
      expect(item).toMatchObject({ state: "unavailable", detail: "Outside session", secondsRemaining: null });
    }
  });

  it("distinguishes missing configuration, disabled offers and invalid offer windows", () => {
    expect(stage({ ...base, pitchAtSec: null }, start, "pitch")).toMatchObject({ state: "unavailable", detail: "Not configured" });
    expect(stage({ ...base, offerDisabled: true, offerShowAtSec: -1 }, start, "offer")).toMatchObject({ state: "disabled", detail: "Disabled" });
    expect(stage({ ...base, offerHideAtSec: base.offerShowAtSec }, start, "offer")).toMatchObject({ state: "unavailable", detail: "No offer window" });
    expect(stage({ ...base, offerHideAtSec: 1 }, start, "offer")).toMatchObject({ state: "unavailable", detail: "Invalid offer window" });
    expect(stage({ ...base, offerHideAtSec: -1 }, start, "offer")).toMatchObject({ state: "unavailable", detail: "Invalid offer window" });
  });

  it("does not fabricate a shared playback clock for unsynchronized UNICO sessions", () => {
    const schedule = { ...base, videoSyncWithStart: false };
    const before = buildRealtimeSession(schedule, start - 1_000);
    expect(before).toMatchObject({ phase: "upcoming", nextId: "start", progress: 0 });
    expect(before.milestones[1]).toMatchObject({ state: "per-viewer", at: null, secondsRemaining: null });
    expect(before.milestones[2]).toMatchObject({ state: "per-viewer", at: null, secondsRemaining: null });
    const during = buildRealtimeSession(schedule, start + 1_000);
    expect(during).toMatchObject({ phase: "individual", nextId: "end" });
    expect(during.milestones[0].state).toBe("reached");
  });

  it("keeps JIT start/pitch/offer per viewer and honors only its absolute closing deadline", () => {
    const schedule = { ...base, mode: "JIT" as const, startDate: new Date(start + 3600_000).toISOString() };
    const model = buildRealtimeSession(schedule, start);
    expect(model).toMatchObject({ phase: "individual", nextId: "end", progress: null });
    expect(model.milestones.slice(0, 3).every(item => item.state === "per-viewer" && item.at === null)).toBe(true);
    const ended = buildRealtimeSession(schedule, start + 5400_000);
    expect(ended).toMatchObject({ phase: "ended", nextId: null, progress: null });
    expect(ended.milestones[0].state).toBe("per-viewer");
    expect(ended.milestones[1].state).toBe("closed");
    expect(ended.milestones[2].state).toBe("closed");
    expect(ended.milestones[3].detail).toBe("Ended");
  });

  it("keeps a missing or invalid global start explicit rather than inventing pitch timestamps", () => {
    for (const startDate of [null, "invalid"]) {
      const model = buildRealtimeSession({ ...base, startDate }, start);
      expect(model).toMatchObject({ phase: "unavailable", nextId: "end", progress: null });
      expect(model.milestones.slice(0, 3).every(item => item.at === null && item.state === "unavailable")).toBe(true);
    }
  });

  it("does not end an open-ended session merely because its last configured event passed", () => {
    const model = buildRealtimeSession({ ...base, endDate: null, offerHideAtSec: null }, start + 20 * 3600_000);
    expect(model).toMatchObject({ phase: "live", nextId: null, progress: null });
    expect(model.milestones[2]).toMatchObject({ state: "reached", detail: "Open" });
    expect(model.milestones[3]).toMatchObject({ state: "unavailable", detail: "Not configured" });
  });

  it("rejects invalid offsets and malformed or reversed session windows", () => {
    for (const pitchAtSec of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER]) {
      expect(stage({ ...base, pitchAtSec }, start, "pitch").state).toBe("unavailable");
    }
    expect(stage({ ...base, endDate: "invalid" }, start, "end")).toMatchObject({ state: "unavailable", detail: "Invalid end time" });
    for (const endDate of [base.startDate, new Date(start - 1).toISOString()]) {
      const model = buildRealtimeSession({ ...base, endDate }, start);
      expect(model).toMatchObject({ phase: "unavailable", nextId: null, progress: null });
      expect(model.milestones.every(item => item.detail === "Invalid session window")).toBe(true);
    }
  });

  it("handles absent snapshots and invalid current times without false zeros", () => {
    for (const model of [buildRealtimeSession(undefined, start), buildRealtimeSession(null, start), buildRealtimeSession(base, Number.NaN)]) {
      expect(model).toMatchObject({ phase: "unavailable", nextId: null, progress: null });
      expect(model.milestones).toHaveLength(4);
      expect(model.milestones.every(item => item.secondsRemaining === null && item.at === null)).toBe(true);
    }
  });
});

describe("countdown formatting", () => {
  it("preserves second precision, zero and durations beyond 24 hours", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(-1)).toBe("00:00:00");
    expect(formatCountdown(0.1)).toBe("00:00:01");
    expect(formatCountdown(2729)).toBe("00:45:29");
    expect(formatCountdown(25 * 3600 + 2 * 60 + 3)).toBe("25:02:03");
    expect(formatCountdown(null)).toBe("—");
    expect(formatCountdown(Number.NaN)).toBe("—");
    expect(formatCountdown(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
