import { describe, it, expect } from "vitest";
import { formatDay, formatSpan, formatTime, sessionInfo, type SessionWebinar } from "@/components/webinars/webinar-session";

// Daily 15:00 → 17:10 (São Paulo, UTC-3) recurring session.
const w: SessionWebinar = {
  status: "ACTIVE", mode: "UNICO", recurring: true, recurringDays: [0, 1, 2, 3, 4, 5, 6], timezone: "America/Sao_Paulo",
  startDate: new Date("2026-11-11T18:00:00Z"), endDate: new Date("2026-11-11T20:10:00Z")
};

describe("webinar session", () => {
  it("is live during today's occurrence", () => {
    const now = new Date("2026-11-13T19:18:00Z");
    const s = sessionInfo(w, now);
    expect(s.state).toBe("live");
    expect(formatDay(s.start!, w.timezone, now)).toBe("Hoje");
    expect(`${formatTime(s.start!, w.timezone)} ${formatTime(s.end!, w.timezone)}`).toBe("15:00 17:10");
    expect(formatSpan(now.getTime() - s.start!.getTime())).toBe("1h 18min");
  });
  it("is scheduled before and paused when not active", () => {
    const now = new Date("2026-11-13T21:00:00Z");
    const s = sessionInfo(w, now);
    expect(s.state).toBe("scheduled");
    expect(formatDay(s.start!, w.timezone, now)).toBe("Amanhã");
    expect(sessionInfo({ ...w, status: "DRAFT" }, now).state).toBe("paused");
  });
  it("closes one-off webinars after the end", () => {
    expect(sessionInfo({ ...w, recurring: false }, new Date("2026-11-13T19:00:00Z")).state).toBe("ended");
  });
});
