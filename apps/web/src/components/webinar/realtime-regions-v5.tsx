"use client";

import type { RealtimeRegionsV5Data } from "@/lib/realtime-regions-v5";
import { RealtimeBreakdownV5 } from "./realtime-breakdown-v5";

const countFormatter = new Intl.NumberFormat("en-US");

/** Regional shares include only live users identified by a Brazilian state. */
export function RealtimeRegionsV5({ data }: { data: RealtimeRegionsV5Data }) {
  return (
    <RealtimeBreakdownV5
      data={data}
      kind="regions"
      title="Regions"
      context="Brazil"
      description="Unique users online now by region of Brazil. Percentages use only users identified by a Brazilian state. Users outside Brazil and users without an identified location are excluded from the chart and listed below."
      totalLabel="in Brazil"
      emptyLabel="No users mapped in Brazil"
      unavailableLabel="Region data unavailable"
      percentageScope="of identified users in Brazil"
      footer={(
        <>
          {data.outsideBrazil === null ? "—" : countFormatter.format(data.outsideBrazil)} outside Brazil
          {" · "}
          {data.unmapped === null ? "—" : countFormatter.format(data.unmapped)} unmapped
        </>
      )}
    />
  );
}
