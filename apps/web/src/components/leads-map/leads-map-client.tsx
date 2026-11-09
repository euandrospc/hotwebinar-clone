"use client";
import dynamic from "next/dynamic";
import type { LeadPin } from "@/lib/leads-map-aggregate";

const LeadsMapCanvas = dynamic(
  () => import("./leads-map-canvas").then((m) => m.LeadsMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] animate-pulse motion-reduce:animate-none rounded-2xl border bg-muted" aria-label="Carregando mapa" />
    )
  }
);

export function LeadsMapClient({ pins }: { pins: LeadPin[] }) {
  return <LeadsMapCanvas pins={pins} />;
}
