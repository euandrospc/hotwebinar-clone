import type { AbDiagnosticDimension, AbLatencyMetric, AbReportDiagnostics, AbSegmentMetrics, AbSegmentRow, AbVariantKey } from "@/lib/ab-tests";

const entryTimeFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" });

/** Already selected/mature units with the report's deduplicated outcome state. */
export interface AbDiagnosticUnit {
  variant: AbVariantKey; source: string | null; device: string | null; campaign: string | null;
  converted: boolean; buyer: boolean; revenueCents: number; maxVideoSec: number | null;
  assignedAt: Date;
  firstPlaybackAt: Date | null; firstPitchAt: Date | null; firstClickAt: Date | null; firstPurchaseAt: Date | null;
}

function emptyMetrics(): AbSegmentMetrics {
  return { mature: 0, conversions: 0, buyers: 0, revenueCents: 0,
    conversionRate: null, purchaseRate: null, revenuePerEntryCents: null };
}

/** No additional population, outcome attribution, or statistical test is introduced. */
export function buildAbDiagnostics(units: readonly AbDiagnosticUnit[]): AbReportDiagnostics {
  const dimensions: AbDiagnosticDimension[] = ["source", "device", "campaign"];
  const grouped = dimensions.map((dimension) => ({ dimension, rows: new Map<string, AbSegmentRow>() }));
  const mature = { A: 0, B: 0 };
  const positions: { A: number[]; B: number[] } = { A: [], B: [] };
  const hours = new Map<string, AbSegmentRow>(), weekdays = new Map<string, AbSegmentRow>();
  const delays = { A: { firstPlayback: [] as number[], firstPitch: [] as number[], firstClick: [] as number[], firstPurchase: [] as number[] },
    B: { firstPlayback: [] as number[], firstPitch: [] as number[], firstClick: [] as number[], firstPurchase: [] as number[] } };
  const addSegment = (rows: Map<string, AbSegmentRow>, value: string, unit: AbDiagnosticUnit) => {
    const row = rows.get(value) ?? { value, A: emptyMetrics(), B: emptyMetrics() };
    const metrics = row[unit.variant];
    metrics.mature++; metrics.conversions += Number(unit.converted); metrics.buyers += Number(unit.buyer); metrics.revenueCents += unit.revenueCents;
    rows.set(value, row);
  };
  for (const unit of units) {
    mature[unit.variant]++;
    if (unit.maxVideoSec !== null && Number.isFinite(unit.maxVideoSec) && unit.maxVideoSec >= 0) positions[unit.variant].push(unit.maxVideoSec);
    for (const group of grouped) {
      const value = unit[group.dimension]?.trim() || "__unknown__";
      addSegment(group.rows, value, unit);
    }
    const entered = Object.fromEntries(entryTimeFormatter.formatToParts(unit.assignedAt).map((part) => [part.type, Number(part.value)]));
    addSegment(hours, String(entered.hour).padStart(2, "0"), unit);
    addSegment(weekdays, String(new Date(Date.UTC(entered.year, entered.month - 1, entered.day)).getUTCDay()), unit);
    for (const key of ["firstPlayback", "firstPitch", "firstClick", "firstPurchase"] as const) {
      const occurredAt = unit[`${key}At`];
      if (occurredAt) delays[unit.variant][key].push((occurredAt.getTime() - unit.assignedAt.getTime()) / 1000);
    }
  }
  const measured = { A: positions.A.length, B: positions.B.length };
  let maximum = 0;
  for (const value of [...positions.A, ...positions.B]) maximum = Math.max(maximum, value);
  const checkpoints: number[] = [];
  if (measured.A + measured.B > 0) {
    // Shared absolute positions avoid suggesting that two different video
    // durations or pitch times have the same percentage of content completed.
    const step = Math.max(60, Math.ceil(maximum / 12 / 60) * 60);
    for (let seconds = 0; seconds < maximum; seconds += step) checkpoints.push(seconds);
    checkpoints.push(maximum); // Exact observed endpoint; never invent a zero beyond it.
  }
  const point = (variant: AbVariantKey, seconds: number) => {
    const count = positions[variant].filter((position) => position >= seconds).length;
    return { count, rate: mature[variant] > 0 && measured[variant] > 0 ? count / mature[variant] : null };
  };
  const summarize = (values: number[]): AbLatencyMetric => {
    const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return { samples: sorted.length, medianSeconds: sorted.length ? (sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) : null,
      averageSeconds: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null };
  };
  const finishRows = (rows: Map<string, AbSegmentRow>) => [...rows.values()].map((row) => {
    for (const variant of ["A", "B"] as const) {
      const metrics = row[variant];
      if (!metrics.mature) continue;
      metrics.conversionRate = metrics.conversions / metrics.mature; metrics.purchaseRate = metrics.buyers / metrics.mature;
      metrics.revenuePerEntryCents = metrics.revenueCents / metrics.mature;
    }
    return row;
  });
  const timing = (variant: AbVariantKey) => {
    const position = summarize(positions[variant]);
    return { positionSamples: position.samples, meanMaxVideoSec: position.averageSeconds, medianMaxVideoSec: position.medianSeconds,
      firstPlayback: summarize(delays[variant].firstPlayback), firstPitch: summarize(delays[variant].firstPitch),
      firstClick: summarize(delays[variant].firstClick), firstPurchase: summarize(delays[variant].firstPurchase) };
  };
  return {
    position: { basis: "MATURE_ENTRIES", mature, measured,
      points: checkpoints.map((seconds) => ({ seconds, A: point("A", seconds), B: point("B", seconds) })) },
    segments: grouped.map(({ dimension, rows }) => ({ dimension,
      rows: finishRows(rows).sort((a, b) => (b.A.mature + b.B.mature) - (a.A.mature + a.B.mature) || a.value.localeCompare(b.value, "pt-BR")) })),
    timing: { timeZone: "America/Sao_Paulo", hours: finishRows(hours).sort((a, b) => a.value.localeCompare(b.value)),
      weekdays: finishRows(weekdays).sort((a, b) => a.value.localeCompare(b.value)), A: timing("A"), B: timing("B") }
  };
}
