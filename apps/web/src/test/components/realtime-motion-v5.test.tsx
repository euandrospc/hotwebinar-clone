import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeMotionV5Provider, RealtimeMotionValueV5, useRealtimeMotionV5 } from "@/components/webinar/realtime-motion-v5";

const listeners = new Set<() => void>();
const preference = {
  matches: false,
  addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
  removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
  addListener: vi.fn(), removeListener: vi.fn(),
};

function Probe() {
  return <output data-testid="motion">{String(useRealtimeMotionV5())}</output>;
}

beforeEach(() => {
  preference.matches = false;
  listeners.clear();
  vi.stubGlobal("matchMedia", vi.fn(() => preference));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("realtime motion safety", () => {
  it("responds immediately to hidden tabs, changed reduced-motion preference and unavailable updates", () => {
    const { rerender, unmount } = render(<RealtimeMotionV5Provider><Probe /></RealtimeMotionV5Provider>);
    expect(screen.getByTestId("motion")).toHaveTextContent("true");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("motion")).toHaveTextContent("false");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("motion")).toHaveTextContent("true");
    act(() => { preference.matches = true; listeners.forEach(listener => listener()); });
    expect(screen.getByTestId("motion")).toHaveTextContent("false");
    act(() => { preference.matches = false; listeners.forEach(listener => listener()); });
    expect(screen.getByTestId("motion")).toHaveTextContent("true");
    rerender(<RealtimeMotionV5Provider paused><Probe /></RealtimeMotionV5Provider>);
    expect(screen.getByTestId("motion")).toHaveTextContent("false");
    unmount();
    expect(listeners.size).toBe(0);
  });

  it("renders exact new values including zero, without fabricated count-up totals", () => {
    const view = (value: number | null) => <RealtimeMotionV5Provider>
      <RealtimeMotionValueV5 value={value}>{value ?? "—"}</RealtimeMotionValueV5>
    </RealtimeMotionV5Provider>;
    const { rerender } = render(view(178));
    expect(screen.getByText("178")).toBeInTheDocument();
    rerender(view(193));
    expect(screen.getByText("193")).toBeInTheDocument();
    expect(screen.queryByText("178")).not.toBeInTheDocument();
    rerender(view(0));
    expect(screen.getByText("0")).toBeInTheDocument();
    rerender(view(null));
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
