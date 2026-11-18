import { describe, expect, it } from "vitest";
import { buildRealtimeAttendantsV5 } from "@/lib/realtime-attendants-v5";
import { buildRealtimeKpisV5DemoSnapshot } from "@/lib/realtime-kpis-v5-demo";

describe("realtime online attendants", () => {
  it("keeps unavailable presence distinct from an empty online team, without inferring from viewer or sales data", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    delete snapshot.attendants;
    expect(buildRealtimeAttendantsV5(snapshot)).toEqual({ available: false, from: null, to: null, presenceSource: null, items: [] });
    expect(buildRealtimeAttendantsV5(null).available).toBe(false);
    snapshot.attendants = { from: "2026-11-17T03:00:00.000Z", to: snapshot.updatedAt, online: [] };
    expect(buildRealtimeAttendantsV5(snapshot)).toMatchObject({ available: true, items: [] });
  });

  it("preserves an online attendant with zero handled conversations and isolates the deterministic preview", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    const data = buildRealtimeAttendantsV5(snapshot);
    expect(data.items.map(item => item.handledConversations)).toEqual([47, 36, 28, 0]);
    expect(data.items.at(-1)).toMatchObject({ name: "Rafael Lima", handledConversations: 0 });
    data.items[0].handledConversations = 999;
    expect(snapshot.attendants!.online[0].handledConversations).toBe(47);
    expect(buildRealtimeKpisV5DemoSnapshot().attendants).toEqual(snapshot.attendants);
  });

  it("preserves explicit collection scope without changing legacy mock snapshots", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    expect(buildRealtimeAttendantsV5(snapshot).presenceSource).toBeNull();
    for (const source of ["local", "server"] as const) {
      snapshot.attendants!.presenceSource = source;
      expect(buildRealtimeAttendantsV5(snapshot).presenceSource).toBe(source);
    }
  });

  it("does not present duplicate attendants, invalid counts or future metrics as an online team", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    const attendants = snapshot.attendants!;
    for (const invalid of [
      { ...attendants, online: [...attendants.online, attendants.online[0]] },
      { ...attendants, online: [{ ...attendants.online[0], handledConversations: -1 }] },
      { ...attendants, to: "2026-11-18T18:00:00.000Z" },
      { ...attendants, from: "invalid" },
    ]) expect(buildRealtimeAttendantsV5({ ...snapshot, attendants: invalid }).available).toBe(false);
  });
});
