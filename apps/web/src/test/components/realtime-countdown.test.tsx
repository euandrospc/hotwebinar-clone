import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RealtimeCountdown, formatCountdown } from "@/components/webinar/realtime-countdown";
import { buildWebinarRealtimeSnapshot } from "@/lib/webinar-realtime";

afterEach(cleanup);
const data = {
  ...buildWebinarRealtimeSnapshot([], new Date("2026-10-31T22:00:00Z")),
  schedule: { mode: "UNICO" as const, startDate: "2026-10-31T21:00:00Z", endDate: "2026-10-31T23:00:00Z", pitchAtSec: 3700, offerShowAtSec: 3800, offerDisabled: false, videoSyncWithStart: true }
};
describe("realtime countdown", () => {
  it("uses configured pitch, link and ending times", () => {
    render(<RealtimeCountdown data={data} />);
    expect(screen.getByText("00h 01min 40s")).toBeInTheDocument();
    expect(screen.getByText("00h 03min 20s")).toBeInTheDocument();
    expect(screen.getByText("Live há")).toBeInTheDocument();
  });
  it("shows a countdown before the start", () => {
    render(<RealtimeCountdown data={{ ...data, updatedAt: "2026-10-31T20:00:00Z" }} />);
    expect(screen.getByText("Início em")).toBeInTheDocument();
  });
  it("ends without negative timers", () => {
    render(<RealtimeCountdown data={{ ...data, updatedAt: "2026-11-01T00:00:00Z" }} />);
    expect(screen.getByText("Live encerrada")).toBeInTheDocument();
    expect(screen.getAllByText("Encerrado")).toHaveLength(3);
    expect(formatCountdown(-1000)).toBe("00h 00min 00s");
  });
  it("does not invent a common pitch time for individual sessions", () => {
    render(<RealtimeCountdown data={{ ...data, schedule: { ...data.schedule, videoSyncWithStart: false } }} />);
    expect(screen.getAllByText("Por espectador")).toHaveLength(2);
  });
});
