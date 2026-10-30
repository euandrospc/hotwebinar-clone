import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import { WebinarSchedule } from "@/components/webinars/webinar-schedule";
import type { RecurringWebinar } from "@/lib/sync";

const webinar: RecurringWebinar = {
  mode: "UNICO", recurring: true, recurringDays: [0, 1, 2, 3, 4, 5, 6], timezone: "America/Sao_Paulo",
  startDate: new Date("2026-10-29T23:00:00Z"), endDate: new Date("2026-10-30T01:10:00Z")
};

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-30T15:00:00Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("WebinarSchedule", () => {
  it("shows today's occurrence instead of the saved date from yesterday", () => {
    render(<WebinarSchedule webinar={webinar} initialNow={Date.now()} />);
    expect(screen.getByText("Próxima sessão:")).toBeInTheDocument();
    expect(screen.getByText("30/10/2026 20:00")).toBeInTheDocument();
    expect(screen.getByText("30/10/2026 22:10")).toBeInTheDocument();
  });

  it("rolls over while the page stays open, skipping unselected days", () => {
    vi.setSystemTime(new Date("2026-10-31T02:59:30Z")); // Friday 23:59:30 BRT
    render(<WebinarSchedule webinar={{ ...webinar, recurringDays: [1, 2, 3, 4, 5],
      startDate: new Date("2026-10-29T23:00:00Z"), endDate: new Date("2026-10-30T03:00:00Z")
    }} initialNow={Date.now()} />);
    expect(screen.getByText("Sessão atual:")).toBeInTheDocument();
    expect(screen.getByText("30/10/2026 20:00")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText("Próxima sessão:")).toBeInTheDocument();
    expect(screen.getByText("02/11/2026 20:00")).toBeInTheDocument();
  });

  it("refreshes when returning to a tab after a day change", () => {
    render(<WebinarSchedule webinar={webinar} initialNow={Date.now()} />);
    vi.setSystemTime(new Date("2026-10-31T15:00:00Z"));
    fireEvent.focus(window);
    expect(screen.getByText("31/10/2026 20:00")).toBeInTheDocument();
  });

  it.each([{ recurring: false }, { mode: "JIT" as const }])("does not move fixed dates for %j", (override) => {
    render(<WebinarSchedule webinar={{ ...webinar, ...override }} initialNow={Date.now()} />);
    expect(screen.getByText("29/10/2026 20:00")).toBeInTheDocument();
    expect(screen.queryByText("Próxima sessão:")).not.toBeInTheDocument();
  });
});
