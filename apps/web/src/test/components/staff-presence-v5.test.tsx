import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStaffPresenceV5 } from "@/lib/hooks/use-staff-presence-v5";

function Presence() { useStaffPresenceV5(); return null; }
let hidden = false;
const fetchMock = vi.fn();
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const bodies = () => fetchMock.mock.calls.map(call => JSON.parse(call[1].body));
beforeEach(() => {
  vi.useFakeTimers(); hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  fetchMock.mockReset().mockResolvedValue({ status: 200 });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("visible attendance heartbeat", () => {
  it("renews the same tab and releases it when hidden or unmounted", async () => {
    const view = render(<Presence />); await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/attendant/presence-v5", expect.objectContaining({ method: "POST", credentials: "same-origin" }));
    expect(bodies()[0]).toMatchObject({ active: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(bodies()[1]).toEqual(bodies()[0]);
    hidden = true; act(() => document.dispatchEvent(new Event("visibilitychange"))); await flush();
    expect(bodies().at(-1).active).toBe(false);
    const count = fetchMock.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(fetchMock).toHaveBeenCalledTimes(count);
    hidden = false; act(() => document.dispatchEvent(new Event("visibilitychange"))); await flush();
    expect(bodies().at(-1).active).toBe(true);
    view.unmount(); await flush();
    expect(bodies().at(-1).active).toBe(false);
  });

  it("serializes release after an in-flight heartbeat and stops on revoked access", async () => {
    let resolve!: (value: { status: number }) => void;
    fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const view = render(<Presence />);
    hidden = true; act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ status: 200 }); });
    expect(bodies().at(-1).active).toBe(false);
    fetchMock.mockResolvedValue({ status: 403 });
    hidden = false; act(() => document.dispatchEvent(new Event("visibilitychange"))); await flush();
    const count = fetchMock.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
    expect(fetchMock).toHaveBeenCalledTimes(count);
    view.unmount();
  });
});
