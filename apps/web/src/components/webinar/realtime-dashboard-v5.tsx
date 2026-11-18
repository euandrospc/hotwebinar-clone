"use client";

import { useEffect, useMemo, useState } from "react";
import { buildRealtimeKpis } from "@/lib/realtime-kpis-v5";
import { buildRealtimeMapV5 } from "@/lib/realtime-map-v5";
import { buildRealtimeDevicesV5 } from "@/lib/realtime-devices-v5";
import { buildRealtimeRegionsV5 } from "@/lib/realtime-regions-v5";
import { buildRealtimeAccessTimeV5 } from "@/lib/realtime-access-time-v5";
import { buildRealtimeAttendantsV5 } from "@/lib/realtime-attendants-v5";
import type { RealtimeWebinarOption, WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";
import { RealtimeKpiCardsV5 } from "./realtime-kpi-cards-v5";
import { RealtimeFunnelV5 } from "./realtime-funnel-v5";
import { RealtimeUsersMapV5 } from "./realtime-users-map-v5";
import { RealtimeSessionV5 } from "./realtime-session-v5";
import { RealtimeDevicesV5 } from "./realtime-devices-v5";
import { RealtimeRegionsV5 } from "./realtime-regions-v5";
import { RealtimeAudienceV5 } from "./realtime-audience-v5";
import { RealtimeAttendantsV5 } from "./realtime-attendants-v5";
import { RealtimeMotionV5Provider } from "./realtime-motion-v5";
import { RealtimeBreadcrumbV5 } from "./realtime-breadcrumb-v5";
import styles from "./realtime-dashboard-v5.module.css";

type Props = {
  webinarId: string;
  initialSnapshot: WebinarRealtimeSnapshot;
  webinars?: RealtimeWebinarOption[];
  demo?: boolean;
};

export function RealtimeDashboardV5({ webinarId, initialSnapshot, webinars, demo = false }: Props) {
  const [snapshot, setSnapshot] = useState<WebinarRealtimeSnapshot | null>(initialSnapshot);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    setSnapshot(initialSnapshot);
    setUnavailable(false);
    if (demo) return;

    let disposed = false;
    let pending = false;
    let controller: AbortController | undefined;

    async function refresh() {
      if (disposed || pending || document.visibilityState === "hidden") return;
      pending = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10_000);
      try {
        const response = await fetch(`/api/webinars/${encodeURIComponent(webinarId)}/realtime-v5`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (disposed) return;
        if ([401, 403, 404].includes(response.status)) {
          setSnapshot(null);
          throw new Error("Realtime access unavailable");
        }
        if (!response.ok) throw new Error("Realtime refresh failed");
        const next: WebinarRealtimeSnapshot = await response.json();
        if (disposed) return;
        if (!next || !Number.isFinite(next.online) || next.online < 0 || !Number.isFinite(Date.parse(next.updatedAt))) {
          throw new Error("Invalid realtime snapshot");
        }
        setSnapshot(next);
        setUnavailable(false);
      } catch {
        if (!disposed) setUnavailable(true);
      } finally {
        window.clearTimeout(timeout);
        pending = false;
      }
    }

    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      controller?.abort();
    };
  }, [demo, initialSnapshot, webinarId]);

  const kpis = useMemo(() => snapshot ? buildRealtimeKpis(snapshot) : {
    updatedAt: initialSnapshot.updatedAt,
    timezone: initialSnapshot.sales?.timezone ?? "America/Sao_Paulo",
    live: { value: null, points: [] },
    audience: { value: null, peak: null, peakAt: null, yesterdayPeak: null, peakChangePct: null, points: [] },
    revenue: { value: null, yesterdayValue: null, changePct: null, points: [] },
  }, [snapshot, initialSnapshot]);
  const mapData = useMemo(() => buildRealtimeMapV5(snapshot), [snapshot]);
  const deviceData = useMemo(() => buildRealtimeDevicesV5(snapshot), [snapshot]);
  const regionData = useMemo(() => buildRealtimeRegionsV5(mapData), [mapData]);
  const accessTimeData = useMemo(() => buildRealtimeAccessTimeV5(snapshot), [snapshot]);
  const attendantData = useMemo(() => buildRealtimeAttendantsV5(snapshot), [snapshot]);

  return (
    <RealtimeMotionV5Provider paused={unavailable}>
      <section className={styles.dashboard} data-realtime-version="v5" data-realtime-demo={demo || undefined} aria-label="Realtime dashboard">
        <RealtimeBreadcrumbV5 webinarId={snapshot ? webinarId : undefined} webinarTitle={snapshot?.webinarTitle} webinars={snapshot ? webinars : undefined} />
        <div className={styles.layout}>
          <div className={styles.metrics}>
            <RealtimeKpiCardsV5 kpis={kpis} />
            <RealtimeSessionV5 schedule={snapshot?.schedule} updatedAt={kpis.updatedAt} timezone={kpis.timezone} />
            <RealtimeAudienceV5
              data={accessTimeData}
              timezone={kpis.timezone}
              updatedAt={kpis.updatedAt}
              available={snapshot !== null}
              stale={unavailable}
            />
            <RealtimeFunnelV5 stages={snapshot?.funnel} timezone={kpis.timezone} reconciliation={snapshot?.sales?.reconciliation} />
          </div>
          <RealtimeUsersMapV5 data={mapData} />
        </div>
        <div className={styles.breakdowns}>
          <RealtimeDevicesV5 data={deviceData} />
          <RealtimeRegionsV5 data={regionData} />
          <RealtimeAttendantsV5 data={attendantData} timezone={kpis.timezone} />
        </div>
        {unavailable && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            {snapshot
              ? "Updates unavailable. Showing the last reading."
              : "Metrics unavailable. Check your session and webinar access."}
          </p>
        )}
      </section>
    </RealtimeMotionV5Provider>
  );
}
