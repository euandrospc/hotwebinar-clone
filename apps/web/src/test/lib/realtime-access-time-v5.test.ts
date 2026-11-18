import { describe, expect, it } from "vitest";
import { buildRealtimeAccessTimeV5 } from "@/lib/realtime-access-time-v5";
import { buildRealtimeKpis } from "@/lib/realtime-kpis-v5";
import { buildRealtimeKpisV5DemoSnapshot } from "@/lib/realtime-kpis-v5-demo";

describe("realtime accesses over session time", () => {
  it("shows the entire session window but only observed readings through the cutoff", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    const data = buildRealtimeAccessTimeV5(snapshot);
    expect(data).toMatchObject({ context: "Session", phase: "live", sessionStart: Date.parse(snapshot.schedule!.startDate!),
      range: { from: Date.parse(snapshot.schedule!.startDate!), to: Date.parse(snapshot.schedule!.endDate!) },
    });
    expect(data.points).toHaveLength(121);
    expect(data.points[0].at).toBe(snapshot.schedule!.startDate);
    expect(data.points.at(-1)).toMatchObject({ at: snapshot.updatedAt, value: 178 });
    expect(data.range!.to).toBeGreaterThan(data.points.at(-1)!.x);
    expect(buildRealtimeKpis(snapshot).audience.points).toHaveLength(241);
  });

  it("uses session history across local midnight without truncating it to daily KPI history", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    snapshot.updatedAt = "2026-11-18T03:00:15.000Z";
    snapshot.schedule = { ...snapshot.schedule!, startDate: "2026-11-18T02:59:45.000Z", endDate: "2026-11-18T04:00:00.000Z" };
    const points = [
      { at: "2026-11-18T02:59:45.000Z", online: 12 },
      { at: "2026-11-18T03:00:00.000Z", online: 10 },
      { at: snapshot.updatedAt, online: 0 },
    ];
    snapshot.audience!.history = { from: "2026-11-18T03:00:00.000Z", to: snapshot.updatedAt, points: points.slice(1) };
    snapshot.audience!.sessionHistory = { from: snapshot.schedule.startDate!, to: snapshot.updatedAt, points };
    expect(buildRealtimeAccessTimeV5(snapshot).points.map(point => point.value)).toEqual([12, 10, 0]);
    expect(buildRealtimeKpis(snapshot).audience.points.map(point => point.value)).toEqual([10, 0]);
  });

  it("preserves missing readings, zero, and the most recent sample per observed slot", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    snapshot.audience!.sessionHistory!.points = [
      { at: "2026-11-17T17:59:30.100Z", online: 12 },
      { at: "2026-11-17T17:59:30.900Z", online: 13 },
      { at: snapshot.updatedAt, online: 0 },
      { at: "2026-11-17T18:00:15.000Z", online: 999 },
    ];
    expect(buildRealtimeAccessTimeV5(snapshot).points.map(point => point.value)).toEqual([13, null, 0]);
  });

  it("keeps a future session empty instead of copying earlier sessions or fabricating zero", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    snapshot.schedule = { ...snapshot.schedule!, startDate: "2026-11-17T20:00:00.000Z", endDate: "2026-11-17T21:30:00.000Z" };
    expect(buildRealtimeAccessTimeV5(snapshot)).toMatchObject({ context: "Session", phase: "upcoming", points: [],
      range: { from: Date.parse(snapshot.schedule.startDate!), to: Date.parse(snapshot.schedule.endDate!) },
    });
  });

  it("clips ended sessions at the end without extending the last reading", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    snapshot.schedule!.endDate = "2026-11-17T17:59:45.000Z";
    const data = buildRealtimeAccessTimeV5(snapshot);
    expect(data.phase).toBe("ended");
    expect(data.points.at(-1)!.x).toBe(Date.parse(snapshot.schedule!.endDate));
    snapshot.audience!.sessionHistory!.points = snapshot.audience!.sessionHistory!.points.slice(0, 2);
    expect(buildRealtimeAccessTimeV5(snapshot).points).toHaveLength(2);
  });

  it.each(["JIT", "unsynchronized"])("does not invent shared watch time for %s", mode => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    if (mode === "JIT") snapshot.schedule!.mode = "JIT";
    else snapshot.schedule!.videoSyncWithStart = false;
    const data = buildRealtimeAccessTimeV5(snapshot);
    expect(data).toMatchObject({ context: "Today", phase: "individual", range: null, sessionStart: null });
    expect(data.points).toEqual(buildRealtimeKpis(snapshot).audience.points);
  });

  it.each(["JIT", "unsynchronized"])("respects the hard end of %s playback without dropping daily history", mode => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    if (mode === "JIT") snapshot.schedule!.mode = "JIT";
    else snapshot.schedule!.videoSyncWithStart = false;
    snapshot.schedule!.endDate = snapshot.updatedAt;
    const result = buildRealtimeAccessTimeV5(snapshot);
    expect(result).toMatchObject({ context: "Today", phase: "ended", sessionStart: null, range: null });
    expect(result.points).toEqual(buildRealtimeKpis(snapshot).audience.points);
  });

  it("keeps unsynchronized playback upcoming until the shared access window opens", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    snapshot.schedule = { ...snapshot.schedule!, videoSyncWithStart: false,
      startDate: "2026-11-17T20:00:00.000Z", endDate: "2026-11-17T21:30:00.000Z" };
    expect(buildRealtimeAccessTimeV5(snapshot)).toMatchObject({ phase: "upcoming", context: "Today", sessionStart: null, range: null });
    snapshot.schedule!.mode = "JIT";
    expect(buildRealtimeAccessTimeV5(snapshot).phase).toBe("individual");
  });

  it("handles unavailable or invalid windows without inventing a session duration", () => {
    expect(buildRealtimeAccessTimeV5(null)).toMatchObject({ points: [], range: null, sessionStart: null, phase: "unavailable" });
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    snapshot.schedule!.endDate = snapshot.schedule!.startDate;
    expect(buildRealtimeAccessTimeV5(snapshot)).toMatchObject({ context: "Today", range: null, sessionStart: null });
    snapshot.updatedAt = "bad-date";
    expect(buildRealtimeAccessTimeV5(snapshot).points).toEqual([]);
  });
});
