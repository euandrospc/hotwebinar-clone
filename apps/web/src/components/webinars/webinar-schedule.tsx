"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "@/components/icons";
import { computePhase, withOccurrence, type RecurringWebinar } from "@/lib/sync";
import { formatWebinarDateTime } from "@/lib/timezones";

export function WebinarSchedule({ webinar, initialNow }: {
  webinar: RecurringWebinar;
  initialNow: number;
}) {
  const [now, setNow] = useState(initialNow);
  const recurring = webinar.mode === "UNICO" && webinar.recurring;
  const occurrence = withOccurrence(webinar, new Date(now));

  useEffect(() => {
    if (!recurring) return;
    const refresh = () => setNow(Date.now());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [recurring]);

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      {recurring && <span>{computePhase(occurrence, new Date(now)) === "open" ? "Sessão atual:" : "Próxima sessão:"}</span>}
      <span>{occurrence.startDate ? formatWebinarDateTime(occurrence.startDate, webinar.timezone) : "—"}</span>
      <ArrowRight className="h-3 w-3 shrink-0" />
      <span>{occurrence.endDate ? formatWebinarDateTime(occurrence.endDate, webinar.timezone) : "—"}</span>
    </div>
  );
}
