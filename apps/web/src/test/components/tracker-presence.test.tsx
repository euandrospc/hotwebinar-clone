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
    render(<Tracker currentTimeRef={currentTimeRef} leadId="l1" />);
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
    render(<Tracker currentTimeRef={currentTimeRef} leadId="l1" />);
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
});
