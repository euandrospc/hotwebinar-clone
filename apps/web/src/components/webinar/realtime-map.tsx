"use client";

import dynamic from "next/dynamic";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime";

const RealtimeMapCanvas = dynamic(
  () => import("./realtime-map-canvas").then((module) => module.RealtimeMapCanvas),
  {
    ssr: false,
    loading: () => <div className="h-full animate-pulse bg-[#121512] motion-reduce:animate-none" aria-label="Carregando mapa ao vivo" />
  }
);

export function RealtimeMap({ locations }: { locations: WebinarRealtimeSnapshot["locations"] }) {
  return <RealtimeMapCanvas locations={locations} />;
}
