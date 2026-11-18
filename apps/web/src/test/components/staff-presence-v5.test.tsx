import { act, cleanup, render } from "@testing-library/react";
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
afterEach(async () => { cleanup(); await flush(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("open attendance heartbeat", () => {
  it("keeps renewing the same tab in the background and releases it on unmount", async () => {
    const view = render(<Presence />); await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/attendant/presence-v5", expect.objectContaining({ method: "POST", credentials: "same-origin" }));
    expect(bodies()[0]).toMatchObject({ active: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(bodies()[1]).toEqual(bodies()[0]);
    hidden = true; act(() => document.dispatchEvent(new Event("visibilitychange"))); await flush();
    expect(bodies().at(-1)).toEqual(bodies()[0]);
    const count = fetchMock.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(75_000); });
    expect(fetchMock).toHaveBeenCalledTimes(count + 5);
    expect(bodies().every(body => body.active && body.tabId === bodies()[0].tabId)).toBe(true);
    hidden = false; act(() => document.dispatchEvent(new Event("visibilitychange"))); await flush();
    expect(bodies().at(-1).active).toBe(true);
    view.unmount(); await flush();
    expect(bodies().at(-1).active).toBe(false);
    expect(fetchMock.mock.calls.at(-1)?.[1].keepalive).toBe(true);
    const afterUnmount = fetchMock.mock.calls.length;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pageshow"));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(fetchMock).toHaveBeenCalledTimes(afterUnmount);
  });

  it("starts and renews presence when Attendance mounts already hidden", async () => {
    hidden = true;
    render(<Presence />); await flush();
    expect(bodies()).toEqual([expect.objectContaining({ active: true })]);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(bodies()[1]).toEqual(bodies()[0]);
  });

  it("releases on pagehide and restores only on pageshow after BFCache", async () => {
    render(<Presence />); await flush();
    act(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
    await flush();
    expect(bodies().at(-1).active).toBe(false);
    const count = fetchMock.mock.calls.length;
    hidden = false;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(fetchMock).toHaveBeenCalledTimes(count);
    act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await flush();
    expect(bodies().at(-1)).toEqual(bodies()[0]);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(fetchMock).toHaveBeenCalledTimes(count + 2);
  });

  it.each(["pagehide", "unmount"])("serializes %s release after an in-flight heartbeat", async (exit) => {
    let resolve!: (value: { status: number }) => void;
    fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const view = render(<Presence />);
    if (exit === "unmount") view.unmount();
    else act(() => window.dispatchEvent(new Event("pagehide")));
    hidden = true; act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ status: 200 }); });
    expect(bodies().map(body => body.active)).toEqual([true, false]);
    expect(bodies().at(-1).active).toBe(false);
  });

  it("restores after an in-flight release without overlapping requests", async () => {
    render(<Presence />); await flush();
    let resolve!: (value: { status: number }) => void;
    fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    act(() => window.dispatchEvent(new Event("pagehide")));
    act(() => window.dispatchEvent(new Event("pageshow")));
    expect(bodies().map(body => body.active)).toEqual([true, false]);
    await act(async () => { resolve({ status: 200 }); });
    expect(bodies().map(body => body.active)).toEqual([true, false, true]);
    expect(new Set(bodies().map(body => body.tabId)).size).toBe(1);
  });

  it("keeps independent leases when one of multiple Attendance tabs closes", async () => {
    const first = render(<Presence />);
    const second = render(<Presence />);
    await flush();
    const [firstTab, secondTab] = bodies().map(body => body.tabId);
    expect(firstTab).not.toBe(secondTab);
    first.unmount(); await flush();
    expect(bodies().at(-1)).toEqual({ tabId: firstTab, active: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(bodies().at(-1)).toEqual({ tabId: secondTab, active: true });
    second.unmount(); await flush();
    expect(bodies().at(-1)).toEqual({ tabId: secondTab, active: false });
  });

  it.each([401, 403])("stops on revoked access (%s), including background and lifecycle events", async (status) => {
    const view = render(<Presence />); await flush();
    fetchMock.mockResolvedValue({ status });
    hidden = false; act(() => document.dispatchEvent(new Event("visibilitychange"))); await flush();
    const count = fetchMock.mock.calls.length;
    hidden = true; act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(new Event("pageshow"));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    view.unmount(); await flush();
    expect(fetchMock).toHaveBeenCalledTimes(count);
  });

  it("retries an unavailable service while the Attendance tab stays open in the background", async () => {
    hidden = true;
    fetchMock.mockResolvedValueOnce({ status: 503 });
    render(<Presence />); await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodies()[1]).toEqual(bodies()[0]);
  });
});
