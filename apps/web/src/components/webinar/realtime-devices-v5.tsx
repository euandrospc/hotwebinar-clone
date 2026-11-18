"use client";

import type { RealtimeDevicesV5Data } from "@/lib/realtime-devices-v5";
import { RealtimeBreakdownV5 } from "./realtime-breakdown-v5";

/** Device counts share the same online population as the live KPI and map. */
export function RealtimeDevicesV5({ data }: { data: RealtimeDevicesV5Data }) {
  return (
    <RealtimeBreakdownV5
      data={data}
      kind="devices"
      title="Devices"
      context="Live"
      description="Unique users online now by device. The total matches users live. Percentages include unknown devices, whose device could not be identified."
      totalLabel="users live"
      emptyLabel="No users online"
      unavailableLabel="Device data unavailable"
    />
  );
}
