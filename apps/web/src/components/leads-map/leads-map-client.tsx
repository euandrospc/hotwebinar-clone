"use client";
import dynamic from "next/dynamic";
import type { LeadPin } from "@/lib/leads-map-aggregate";

const LeadsMapCanvas = dynamic(
  () => import("./leads-map-canvas").then((m) => m.LeadsMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] animate-pulse rounded-lg border bg-muted" aria-label="Carregando mapa" />
    )
  }
);

export function LeadsMapClient({ pins }: { pins: LeadPin[] }) {
  return <LeadsMapCanvas pins={pins} />;
}
