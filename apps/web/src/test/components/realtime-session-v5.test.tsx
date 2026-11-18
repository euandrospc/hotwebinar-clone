import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeSessionV5 } from "@/components/webinar/realtime-session-v5";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

const updatedAt = "2026-11-17T18:00:00.000Z";
const schedule: NonNullable<WebinarRealtimeSnapshot["schedule"]> = {
  mode: "UNICO", startDate: "2026-11-17T17:30:00.000Z", endDate: "2026-11-17T19:00:00.000Z",
  pitchAtSec: 2700, offerShowAtSec: 3000, offerHideAtSec: 4800,
  offerDisabled: false, videoSyncWithStart: true,
};
const props = { schedule, updatedAt, timezone: "America/Sao_Paulo" };
const stage = (label: string) => within(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date", "performance"] });
  // A different client clock must not move a fixed local preview into another session.
  vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("realtime session strip", () => {
  it("anchors all countdowns to the snapshot and ticks without API calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<RealtimeSessionV5 {...props} />);
    expect(stage("Start").getByText("Started")).toBeInTheDocument();
    expect(stage("Pitch").getByText("00:15:00")).toBeInTheDocument();
    expect(stage("Offer").getByText("00:20:00")).toBeInTheDocument();
    expect(stage("End").getByText("01:00:00")).toBeInTheDocument();
    await advance(3_000);
    expect(stage("Pitch").getByText("00:14:57")).toBeInTheDocument();
    expect(stage("End").getByText("00:59:57")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resynchronizes immediately to a newer server reading", async () => {
    const { rerender } = render(<RealtimeSessionV5 {...props} />);
    await advance(3_000);
    rerender(<RealtimeSessionV5 {...props} updatedAt="2026-11-17T18:05:00.000Z" />);
    expect(stage("Pitch").getByText("00:10:00")).toBeInTheDocument();
    await advance(1_000);
    expect(stage("Pitch").getByText("00:09:59")).toBeInTheDocument();
  });

  it("does not jump when the device wall clock changes", async () => {
    render(<RealtimeSessionV5 {...props} />);
    await advance(1_000);
    vi.setSystemTime(new Date("2035-01-01T00:00:00.000Z"));
    fireEvent.focus(window);
    expect(stage("Pitch").getByText("00:14:59")).toBeInTheDocument();
    await advance(1_000);
    expect(stage("Pitch").getByText("00:14:58")).toBeInTheDocument();
  });

  it("catches up from elapsed time when the tab becomes visible", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    render(<RealtimeSessionV5 {...props} />);
    visibility.mockReturnValue("hidden");
    await advance(30_000);
    expect(stage("Pitch").getByText("00:15:00")).toBeInTheDocument();
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(stage("Pitch").getByText("00:14:30")).toBeInTheDocument();
  });

  it("moves the next marker at the exact boundary without negative clocks", async () => {
    render(<RealtimeSessionV5 {...props} updatedAt="2026-11-17T18:14:59.000Z" />);
    expect(document.querySelector('[data-milestone="pitch"]')).toHaveAttribute("data-next", "true");
    expect(stage("Pitch").getByText("00:00:01")).toBeInTheDocument();
    await advance(1_000);
    expect(stage("Pitch").getByText("Reached")).toBeInTheDocument();
    expect(document.querySelector('[data-milestone="offer"]')).toHaveAttribute("data-next", "true");
    expect(stage("Offer").getByText("00:05:00")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-countdown][aria-live="off"]')).toHaveLength(2);
  });

  it("shows absolute dates in the webinar timezone through accessible details", () => {
    render(<RealtimeSessionV5 {...props} />);
    const pitch = screen.getByRole("button", { name: /^Pitch/ });
    expect(pitch).toHaveAttribute("title", expect.stringContaining("15:15:00"));
    fireEvent.click(pitch);
    expect(screen.getByRole("dialog")).toHaveTextContent("15:15:00");
    expect(screen.getByRole("dialog").querySelector("time")).toHaveAttribute("dateTime", "2026-11-17T18:15:00.000Z");
  });

  it("does not invent synchronized countdowns for individual playback", () => {
    render(<RealtimeSessionV5 {...props} schedule={{ ...schedule, mode: "JIT" }} />);
    expect(stage("Start").getByText("Per viewer")).toBeInTheDocument();
    expect(stage("Pitch").getByText("Per viewer")).toBeInTheDocument();
    expect(stage("Offer").getByText("Per viewer")).toBeInTheDocument();
    expect(stage("End").getByText("01:00:00")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-available]')).toHaveLength(0);
  });

  it("advances the time rail from Start to Pitch and begins the next segment at the deadline", async () => {
    render(<RealtimeSessionV5 {...props} updatedAt="2026-11-17T18:14:59.000Z" />);
    const startFill = document.querySelector('[data-milestone="start"] [data-available] > span') as HTMLElement;
    const pitchFill = document.querySelector('[data-milestone="pitch"] [data-available] > span') as HTMLElement;
    expect(startFill.style.transform).not.toBe("scaleX(1)");
    expect(pitchFill.style.transform).toBe("scaleX(0)");
    await advance(1_000);
    expect(startFill.style.transform).toBe("scaleX(1)");
    expect(pitchFill.style.transform).toBe("scaleX(0)");
    await advance(30_000);
    expect(pitchFill.style.transform).toBe("scaleX(0.1)");
  });

  it("does not imply progress through disabled or out-of-order milestone connections", () => {
    render(<RealtimeSessionV5 {...props} schedule={{ ...schedule, pitchAtSec: 3000, offerShowAtSec: 2700 }} />);
    expect(document.querySelector('[data-milestone="pitch"] [data-available]')).toBeNull();
    cleanup();
    render(<RealtimeSessionV5 {...props} schedule={{ ...schedule, offerDisabled: true }} />);
    expect(document.querySelector('[data-milestone="pitch"] [data-available]')).toBeNull();
    expect(document.querySelector('[data-milestone="offer"] [data-available]')).toBeNull();
  });

  it("removes its interval and foreground listeners on unmount", () => {
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<RealtimeSessionV5 {...props} />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(removeWindow).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});
