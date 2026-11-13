import { BRAZIL_REGIONS, type DashboardInsights } from "@/lib/dashboard-insights";
import { DASHBOARD_TIME_ZONE, type DashboardOverview, type DashboardOverviewDailyPoint } from "@/lib/dashboard-overview";
import type { DashboardSupportQueue } from "@/server/dashboard/support-queue";

const DAY_MS = 86_400_000;
const TICKET_CENTS = 49_700;
const PITCH_SECONDS = 3_600;
const DURATION_SECONDS = 5_400;

/** Local preview only. Never substitute fixtures for production results. */
export function isDashboardDemoEnabled(mode: string | undefined, environment: string | undefined): boolean {
  return environment === "development" && mode !== "0";
}

/** Largest-remainder allocation keeps every displayed partition equal to its total. */
function distribute(total: number, weights: readonly number[]): number[] {
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const exact = weights.map((weight) => total * weight / weightTotal);
  const result = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, remainder: value - result[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const remaining = total - result.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < remaining; index++) result[order[index].index]++;
  return result;
}

const percentage = (count: number, total: number) => total > 0 ? Math.round(count / total * 10_000) / 100 : 0;
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: DASHBOARD_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
});

function calendarKey(date: Date): string {
  const parts = dateFormatter.formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dailyPoints(rangeStart: Date, rangeEnd: Date, accesses: number, viewers: number, sales: number): DashboardOverviewDailyPoint[] {
  const dates: string[] = [];
  const cursor = new Date(`${calendarKey(rangeStart)}T00:00:00Z`);
  const lastDay = calendarKey(rangeEnd);
  while (cursor.toISOString().slice(0, 10) <= lastDay) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const weeklyWeights = [0.82, 1.06, 1.12, 0.96, 1.18, 1.04, 0.82];
  const weights = dates.map((date) => weeklyWeights[new Date(`${date}T12:00:00Z`).getUTCDay()]);
  const dailyAccesses = distribute(accesses, weights);
  const dailyViewers = distribute(viewers, weights);
  const dailySales = distribute(sales, weights);
  return dates.map((date, index) => ({
    date, label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
    registrations: dailyAccesses[index], viewers: dailyViewers[index],
    sales: dailySales[index], revenueCents: dailySales[index] * TICKET_CENTS
  }));
}

function positionLabel(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

export interface DashboardDemo {
  overview: DashboardOverview;
  insights: DashboardInsights;
  webinar: { id: string; title: string; status: "ACTIVE" };
  online: number;
  realtime: {
    average: number | null;
    peak: number | null;
    sampleCount: number;
    points: Array<{ at: string; online: number }>;
    windowMinutes: 60;
  };
}

function realtimePreview(): DashboardDemo["realtime"] {
  const counts = [142, 148, 155, 163, 171, 168, 160, 174, 187, 194, 202, 211, 207, 198, 214, 226, 238, 242, 235, 221, 208, 217, 228, 223, 212, 204, 189, 181, 188, 201, 196];
  // Synthetic clock anchor: this relative 60-minute preview is independent of
  // the historical dashboard filter and remains deterministic across renders.
  const endAt = Date.UTC(2026, 0, 1, 12);
  const points = counts.map((online, index) => ({
    at: new Date(endAt - (counts.length - 1 - index) * 2 * 60_000).toISOString(), online
  }));
  return {
    average: counts.reduce((sum, count) => sum + count, 0) / counts.length,
    peak: Math.max(...counts), sampleCount: points.length, points, windowMinutes: 60
  };
}

function supportPreview(factor: number, days: readonly { date: string; label: string }[]): DashboardInsights["support"] {
  const scale = (value: number) => Math.round(value * factor);
  const uniqueConversations = scale(431);
  const humanConversations = scale(146);
  const aiConversations = scale(327);
  const humanReplies = Math.round(humanConversations * 624 / 146);
  const aiReplies = Math.round(aiConversations * 1894 / 327);
  // Channels overlap; unanswered conversations remain outside the reply union.
  const repliedConversations = Math.max(humanConversations, aiConversations,
    Math.min(uniqueConversations, humanConversations + aiConversations, scale(407)));
  const incomingMessages = Math.max(uniqueConversations, scale(1382));
  const weights = [54, 43, 31, 18];
  const conversations = distribute(humanConversations, weights);
  const extraReplies = distribute(humanReplies - humanConversations, weights);
  const names = ["Ana Oliveira", "Bruno Costa", "Camila Santos", "Diego Almeida"];
  const replySeconds = [56, 84, 112, 139];
  const agents: DashboardInsights["support"]["agents"] = names.map((name, index) => {
    const firstReplySamples = Math.floor(conversations[index] * 0.7);
    return {
      id: `demo-attendant-${index + 1}`, name, kind: "human" as const, image: null,
      conversations: conversations[index], replies: conversations[index] + extraReplies[index],
      firstReplySamples, averageFirstReplySeconds: firstReplySamples ? replySeconds[index] : null
    };
  }).filter((agent) => agent.replies > 0);
  const aiFirstReplySamples = Math.floor(aiConversations * 0.8);
  if (aiReplies) agents.push({
    id: "demo-ai-assistant", name: "Assistente Bravy", kind: "ai", image: null,
    conversations: aiConversations, replies: aiReplies, firstReplySamples: aiFirstReplySamples,
    averageFirstReplySeconds: aiFirstReplySamples ? 4 : null
  });
  const summarizeFirstReplies = (rows: typeof agents) => {
    const firstReplySamples = rows.reduce((sum, row) => sum + row.firstReplySamples, 0);
    return {
      firstReplySamples,
      averageFirstReplySeconds: firstReplySamples
        ? Math.round(rows.reduce((sum, row) => sum + (row.averageFirstReplySeconds ?? 0) * row.firstReplySamples, 0) / firstReplySamples)
        : null
    };
  };
  const humanFirstReplies = summarizeFirstReplies(agents.filter((agent) => agent.kind === "human"));
  const weekdayWeights = [0.72, 1.08, 1.23, 1.12, 1.31, 0.96, 0.58];
  const dailyWeights = days.map(({ date }) => weekdayWeights[new Date(`${date}T12:00:00Z`).getUTCDay()]);
  const incoming = distribute(incomingMessages, dailyWeights);
  const human = distribute(humanReplies, dailyWeights);
  const ai = distribute(aiReplies, dailyWeights);
  return {
    human: { conversations: humanConversations, replies: humanReplies, averageFirstReplySeconds: humanFirstReplies.averageFirstReplySeconds },
    ai: { conversations: aiConversations, replies: aiReplies, averageFirstReplySeconds: aiFirstReplySamples ? 4 : null },
    uniqueConversations, incomingMessages, repliedConversations,
    // Includes a small set that received a reply and then asked another question.
    awaitingReplyConversations: uniqueConversations - repliedConversations + Math.min(repliedConversations, scale(17)),
    ...summarizeFirstReplies(agents),
    agents,
    activity: days.map(({ date, label }, index) => ({ date, label, incoming: incoming[index], human: human[index], ai: ai[index] }))
  };
}

/**
 * Synthetic aggregates for reviewing the UI, without records, people or writes.
 * A seven-day selection is the reference scenario; other durations scale it.
 * All percentages, money and geographic partitions derive from the same counts.
 */
export function createDashboardDemo(rangeStart: Date, rangeEnd: Date): DashboardDemo {
  const start = rangeStart.getTime();
  const end = rangeEnd.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new RangeError("Invalid dashboard demo date range");
  }
  // Bound generated daily fixtures to a practical preview window.
  if (end - start > DAY_MS * 3660) throw new RangeError("Dashboard demo range exceeds ten years");
  const factor = (end - start + 1) / (7 * DAY_MS);
  const scale = (value: number) => Math.round(value * factor);
  const accesses = scale(2840);
  const viewers = scale(2430);
  const pitch = scale(1310);
  const clicks = scale(390);
  const sales = scale(86);
  const revenueCents = sales * TICKET_CENTS;
  const previousSales = Math.round(sales / 1.2);
  const previousRevenueCents = previousSales * TICKET_CENTS;
  const webinar = { id: "demo-webinar", title: "Dominando Claude Code", status: "ACTIVE" as const };
  const totals: DashboardOverview["totals"] = {
    revenueCents, sales, registrations: accesses, viewers, attendees: viewers,
    attendanceRate: accesses ? percentage(viewers, accesses) : null,
    convertedLeads: sales, conversionRate: accesses ? percentage(sales, accesses) : null
  };
  const funnel = [
    { label: "Acessos", count: accesses },
    { label: "Assistiram", count: viewers },
    { label: "Chegaram ao pitch", count: pitch },
    { label: "Clicaram na oferta", count: clicks },
    { label: "Compraram", count: sales }
  ].map((stage) => ({ ...stage, pct: percentage(stage.count, accesses) }));
  // Synthetic intersections are deliberately non-nested: some pitch events
  // lack playback ticks, and some purchases have no recorded offer click.
  // Clamp rounding to feasible set intersections inside the access population.
  const referenceOverlaps = [2430, 1260, 365, 72];
  const funnelTransitions = funnel.slice(1).map((stage, index) => {
    const previous = funnel[index];
    const overlapCount = Math.max(
      0,
      previous.count + stage.count - accesses,
      Math.min(previous.count, stage.count, scale(referenceOverlaps[index]))
    );
    return {
      fromLabel: previous.label, toLabel: stage.label,
      fromCount: previous.count, toCount: stage.count, overlapCount,
      previousOnlyCount: previous.count - overlapCount,
      currentOnlyCount: stage.count - overlapCount,
      overlapRate: previous.count ? percentage(overlapCount, previous.count) : null
    };
  });

  // The curve describes playback records, so its pitch anchor excludes the
  // synthetic pitch-only people who have no VIDEO_TICK in this period.
  const pitchWithPlayback = funnelTransitions[1].overlapCount;
  // Small changes in slope keep it natural while maximum-position reach stays monotone.
  const beforePitch = [1, 0.96, 0.89, 0.85, 0.82, 0.76, 0.72, 0.68, 0.62, 0.58, 0.53, 0.47, 0.43, 0.34, 0.23, 0.12, 0];
  const afterPitch = [1, 0.83, 0.69, 0.58, 0.43, 0.28, 0.17, 0.07, 0];
  const endViewers = Math.round(viewers * 0.2);
  const retention = Array.from({ length: 25 }, (_, index) => {
    const positionSeconds = DURATION_SECONDS * index / 24;
    const count = index <= 16
      ? Math.round(pitchWithPlayback + (viewers - pitchWithPlayback) * beforePitch[index])
      : Math.round(endViewers + (pitchWithPlayback - endViewers) * afterPitch[index - 16]);
    return { positionSeconds, label: positionLabel(positionSeconds), viewers: count, percentage: percentage(count, viewers) };
  });

  const [located, unlocated, outsideBrazil, brazilUnresolved] = distribute(accesses, [92, 5, 2, 1]);
  const stateWeights: Record<(typeof BRAZIL_REGIONS)[number]["code"], number> = {
    AC: 2, AL: 9, AP: 2, AM: 12, BA: 60, CE: 32, DF: 31, ES: 27, GO: 31,
    MA: 12, MT: 18, MS: 14, MG: 108, PA: 24, PB: 10, PR: 92, PE: 32, PI: 6,
    RJ: 118, RN: 9, RS: 76, RO: 6, RR: 2, SC: 79, SP: 415, SE: 6, TO: 3
  };
  const stateCounts = distribute(located, BRAZIL_REGIONS.map((region) => stateWeights[region.code]));
  const averageWatchedSeconds = 42 * 60 + 18;
  const realtime = realtimePreview();
  const daily = dailyPoints(rangeStart, rangeEnd, accesses, viewers, sales);

  return {
    webinar,
    // This is a snapshot simulation, deliberately independent of the date filter.
    online: realtime.points.at(-1)!.online,
    realtime,
    overview: {
      totals, funnel, funnelTransitions, daily,
      webinars: [{ ...totals, ...webinar, mode: "JIT" }], excludedCurrencySales: 0
    },
    insights: {
      watch: {
        averageWatchedSeconds: viewers ? averageWatchedSeconds : null,
        totalWatchedSeconds: viewers * averageWatchedSeconds,
        viewerCount: viewers, retention: viewers ? retention : [], pitchAtSeconds: PITCH_SECONDS
      },
      geography: {
        regions: BRAZIL_REGIONS.map((region, index) => ({ ...region, count: stateCounts[index] }))
          .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
        unlocated, outsideBrazil, brazilUnresolved, totalAccesses: accesses
      },
      support: supportPreview(factor, daily),
      comparison: {
        previousSales, previousRevenueCents,
        revenueChangePct: previousRevenueCents ? Math.round((revenueCents / previousRevenueCents - 1) * 10_000) / 100 : null
      }
    }
  };
}

const DEMO_QUEUE = [
  { name: "Juliana Prado", text: "O bônus da mentoria vale pra quem parcelar em 12x?", minutes: 6 },
  { name: "Marcos Lima", text: "Não recebi o acesso depois do Pix, pode verificar?", minutes: 14 },
  { name: "Ana Ribeiro", text: "Tem certificado no final do curso?", minutes: 32 }
];

/** Fictional current queue for the local preview; times are relative to `now`, never persisted. */
export function createSupportQueueDemo(support: DashboardInsights["support"], now: Date): DashboardSupportQueue {
  const waitingTotal = Math.min(support.awaitingReplyConversations, 14);
  return {
    waitingTotal,
    waiting: DEMO_QUEUE.slice(0, waitingTotal).map((item, index) => ({
      leadId: `demo-lead-${index + 1}`, leadName: item.name, text: item.text,
      createdAt: new Date(now.getTime() - item.minutes * 60_000).toISOString()
    })),
    previousConversations: Math.round(support.uniqueConversations / 1.18)
  };
}
