"use client";
import { usePollVideos } from "@/lib/hooks/use-poll-videos";

export function ClientPolling({ enabled, intervalMs }: { enabled: boolean; intervalMs?: number }) {
  usePollVideos(enabled, intervalMs);
  return null;
}
