"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function usePollVideos(enabled: boolean, intervalMs: number = 3000) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const handle = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(handle);
  }, [enabled, intervalMs, router]);
}
