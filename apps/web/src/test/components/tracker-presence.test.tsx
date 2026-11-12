import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tracker } from "@/app/[slug]/_components/tracker";

const realtime = vi.hoisted(() => ({ emitPresence: vi.fn(), onResync: () => {} }));
vi.mock("@/lib/hooks/use-realtime-channel", () => ({
  useRealtimeChannel: (_scope: unknown, _event: unknown, onResync: () => void) => {
    realtime.onResync = onResync;
    return { status: "connected", emitPresence: realtime.emitPresence };
  }
}));
let hidden = false;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-30T20:00:00Z"));
  hidden = false; realtime.emitPresence.mockClear();
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("player presence", () => {
  it("signals playback in the first second, renews the lease and clears a paused player", () => {
    const currentTimeRef = { current: 0 };
    render(<Tracker webinarId="w1" currentTimeRef={currentTimeRef} leadId="l1" />);
    act(() => vi.advanceTimersByTime(1000));
    expect(realtime.emitPresence).not.toHaveBeenCalled();
    for (let second = 1; second <= 16; second++) {
      currentTimeRef.current = second;
      act(() => vi.advanceTimersByTime(1000));
    }
    expect(realtime.emitPresence.mock.calls).toEqual([[true], [true]]);
    act(() => vi.advanceTimersByTime(4000));
    expect(realtime.emitPresence).toHaveBeenLastCalledWith(false);
  });

  it("clears hidden playback and resends promptly after reconnecting", () => {
    const currentTimeRef = { current: 0 };
    render(<Tracker webinarId="w1" currentTimeRef={currentTimeRef} leadId="l1" />);
    currentTimeRef.current = 1;
    act(() => vi.advanceTimersByTime(1000));
    act(() => { hidden = true; document.dispatchEvent(new Event("visibilitychange")); });
    expect(realtime.emitPresence).toHaveBeenLastCalledWith(false);
    hidden = false; currentTimeRef.current = 2;
    act(() => vi.advanceTimersByTime(1000));
    act(() => realtime.onResync());
    currentTimeRef.current = 3;
    act(() => vi.advanceTimersByTime(1000));
    expect(realtime.emitPresence.mock.calls).toEqual([[true], [false], [true], [true]]);
  });

  it("keeps each mounted player's tracking and exit beacon attached to its own session", async () => {
    const a = { current: 0 }, b = { current: 0 };
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    render(<><Tracker webinarId="webinar-a" leadId="lead-a" currentTimeRef={a} /><Tracker webinarId="webinar-b" leadId="lead-b" currentTimeRef={b} /></>);
    a.current = 30; b.current = 15;
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      "/api/track?webinarId=webinar-a&leadId=lead-a",
      "/api/track?webinarId=webinar-b&leadId=lead-b"
    ]);
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(sendBeacon.mock.calls.map(([url]) => url)).toEqual([
      "/api/track-leave?webinarId=webinar-a&leadId=lead-a",
      "/api/track-leave?webinarId=webinar-b&leadId=lead-b"
    ]);
  });
});
