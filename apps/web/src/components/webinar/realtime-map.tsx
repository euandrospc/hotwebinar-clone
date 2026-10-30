"use client";

import dynamic from "next/dynamic";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime";

const RealtimeMapCanvas = dynamic(
  () => import("./realtime-map-canvas").then((module) => module.RealtimeMapCanvas),
  {
    ssr: false,
    loading: () => <div className="h-[360px] animate-pulse bg-muted sm:h-[420px]" aria-label="Carregando mapa ao vivo" />
  }
);

export function RealtimeMap({ locations }: { locations: WebinarRealtimeSnapshot["locations"] }) {
  return <RealtimeMapCanvas locations={locations} />;
}
