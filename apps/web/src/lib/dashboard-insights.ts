export interface DashboardSupportChannel {
  /** Distinct conversations with a team reply from this channel in the period. */
  conversations: number;
  replies: number;
  /** First observed incoming message to first subsequent team reply, both in the period. */
  averageFirstReplySeconds: number | null;
}

export interface DashboardInsights {
  watch: {
    /** Lifetime accumulated watchedSec for the viewers active in the selected period. */
    averageWatchedSeconds: number | null;
    totalWatchedSeconds: number;
    viewerCount: number;
    /** Greatest player position observed in the period; not continuous viewing time. */
    retention: Array<{ positionSeconds: number; label: string; viewers: number; percentage: number }>;
    pitchAtSeconds: number | null;
  };
  geography: {
    regions: Array<{ code: string; name: string; count: number }>;
    unlocated: number;
    outsideBrazil: number;
    brazilUnresolved: number;
    totalAccesses: number;
  };
  support: {
    human: DashboardSupportChannel;
    ai: DashboardSupportChannel;
    /** Distinct conversations with a lead or team message in the period, including unanswered ones. */
    uniqueConversations: number;
  };
  comparison: {
    previousRevenueCents: number;
    previousSales: number;
    /** Percentage change; null when the previous period has no revenue. */
    revenueChangePct: number | null;
  };
}

export interface DashboardInsightsWebinar {
  id: string;
  pitchAtSec: number | null;
  videoDurationSec: number | null;
}

/** Leads with at least one supported in-platform event in the selected period. */
export interface DashboardInsightsLead {
  id: string;
  webinarId: string;
  watchedSec: number;
  country: string | null;
  region: string | null;
}

export interface DashboardInsightsViewer {
  webinarId: string;
  leadId: string | null;
  maxVideoSec: number | null;
}

export interface DashboardInsightsMessage {
  id: string;
  webinarId: string;
  leadId: string;
  sender: string;
  aiAgentName: string | null;
  createdAt: Date;
}

export interface DashboardInsightsSale {
  id: string;
  webinarId: string | null;
  amount: number;
  currency: string;
  createdAt: Date;
}

export interface BuildDashboardInsightsInput {
  webinars: readonly DashboardInsightsWebinar[];
  leads: readonly DashboardInsightsLead[];
  viewers: readonly DashboardInsightsViewer[];
  messages: readonly DashboardInsightsMessage[];
  sales: readonly DashboardInsightsSale[];
  rangeStart: Date;
  rangeEnd: Date;
}

export const BRAZIL_REGIONS = [
  { code: "AC", name: "Acre" }, { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" }, { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" }, { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" }, { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" }, { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" }, { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" }, { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" }, { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" }, { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" }, { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" }, { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" }, { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" }, { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" }
] as const;

function normalizeRegionKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase()
    .replace(/^BR[-_\s]+/, "").replace(/^ESTADO (?:DE|DO|DA) /, "").replace(/\s+/g, " ");
}

const regionsByKey = new Map(BRAZIL_REGIONS.flatMap((region) => [
  [region.code, region], [normalizeRegionKey(region.name), region]
] as const));

/** Normalizes UF codes and Portuguese state names. Caller must separately require country=BR. */
export function normalizeBrazilRegion(value: string | null | undefined): { code: string; name: string } | null {
  return value ? regionsByKey.get(normalizeRegionKey(value)) ?? null : null;
}

/** Inclusive millisecond ranges: immediately adjacent, with exactly the same duration. */
export function dashboardComparisonRange(rangeStart: Date, rangeEnd: Date): { start: Date; end: Date } {
  const start = rangeStart.getTime();
  const end = rangeEnd.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new RangeError("Invalid dashboard date range");
  const previousStart = new Date(start - (end - start + 1));
  if (!Number.isFinite(previousStart.getTime())) throw new RangeError("Invalid dashboard comparison range");
  return { start: previousStart, end: new Date(start - 1) };
}

const nonnegative = (value: number | null | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
const pairKey = (webinarId: string, leadId: string) => JSON.stringify([webinarId, leadId]);
const percentage = (value: number, total: number) => Math.round(value / total * 10_000) / 100;

function positionLabel(seconds: number): string {
  const wholeSeconds = Math.round(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor(wholeSeconds % 3600 / 60);
  const rest = String(wholeSeconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/**
 * The caller provides only owned webinars; every collection is checked against that allowlist.
 * Geographic data is the latest location on Lead, not historical location at each event.
 * Support counts observed messages, not mutable assignment/closed state. A mixed conversation
 * can count for both channels, but its first-reply duration belongs only to the first responder.
 */
export function buildDashboardInsights(input: BuildDashboardInsightsInput): DashboardInsights {
  const previous = dashboardComparisonRange(input.rangeStart, input.rangeEnd);
  const start = input.rangeStart.getTime();
  const end = input.rangeEnd.getTime();
  const webinars = new Map(input.webinars.map((webinar) => [webinar.id, webinar]));
  const leads = new Map(input.leads.filter((lead) => webinars.has(lead.webinarId))
    .map((lead) => [pairKey(lead.webinarId, lead.id), lead]));
  const viewers = new Map<string, number>();
  for (const viewer of input.viewers) {
    if (!viewer.leadId) continue;
    const key = pairKey(viewer.webinarId, viewer.leadId);
    if (!leads.has(key)) continue;
    viewers.set(key, Math.max(viewers.get(key) ?? 0, nonnegative(viewer.maxVideoSec)));
  }

  const totalWatchedSeconds = [...viewers.keys()].reduce((total, key) => total + nonnegative(leads.get(key)!.watchedSec), 0);
  const singleWebinar = webinars.size === 1 ? [...webinars.values()][0] : undefined;
  const pitchAtSeconds = singleWebinar && typeof singleWebinar.pitchAtSec === "number" && Number.isFinite(singleWebinar.pitchAtSec) && singleWebinar.pitchAtSec >= 0
    ? singleWebinar.pitchAtSec : null;
  let duration = 0;
  for (const webinar of webinars.values()) duration = Math.max(duration, nonnegative(webinar.videoDurationSec));
  if (!duration) for (const position of viewers.values()) duration = Math.max(duration, position);
  duration = Math.max(duration, pitchAtSeconds ?? 0);
  const positions = new Set<number>();
  if (viewers.size) {
    // 25 evenly spaced marks plus the exact pitch (at most 26 positions).
    for (let index = 0; index <= 24; index++) positions.add(Math.round(duration * index / 24));
    if (pitchAtSeconds !== null) positions.add(pitchAtSeconds);
  }
  const retention = [...positions].sort((a, b) => a - b).map((positionSeconds) => {
    let count = 0;
    for (const position of viewers.values()) if (position >= positionSeconds) count++;
    return { positionSeconds, label: positionLabel(positionSeconds), viewers: count, percentage: percentage(count, viewers.size) };
  });

  const geography: DashboardInsights["geography"] = {
    regions: [], unlocated: 0, outsideBrazil: 0, brazilUnresolved: 0, totalAccesses: leads.size
  };
  const regionCounts = new Map<string, { code: string; name: string; count: number }>();
  for (const lead of leads.values()) {
    const country = lead.country?.trim().toUpperCase();
    if (!country || !/^[A-Z]{2}$/.test(country) || country === "ZZ" || country === "XX") geography.unlocated++;
    else if (country !== "BR") geography.outsideBrazil++;
    else {
      const region = normalizeBrazilRegion(lead.region);
      if (!region) geography.brazilUnresolved++;
      else {
        const row = regionCounts.get(region.code) ?? { ...region, count: 0 };
        row.count++;
        regionCounts.set(region.code, row);
      }
    }
  }
  geography.regions = [...regionCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));

  const channel = () => ({ leads: new Set<string>(), replies: 0, firstReplies: [] as number[] });
  const channels = { human: channel(), ai: channel() };
  const conversations = new Set<string>();
  const waitingSince = new Map<string, number>();
  const answered = new Set<string>();
  const seenMessages = new Set<string>();
  const messages = input.messages.filter((message) => webinars.has(message.webinarId) &&
    message.createdAt.getTime() >= start && message.createdAt.getTime() <= end &&
    (message.sender === "lead" || message.sender === "team"))
    .slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  for (const message of messages) {
    if (seenMessages.has(message.id)) continue;
    seenMessages.add(message.id);
    const key = pairKey(message.webinarId, message.leadId);
    conversations.add(key);
    if (message.sender === "lead") {
      if (!waitingSince.has(key)) waitingSince.set(key, message.createdAt.getTime());
      continue;
    }
    const currentChannel = message.aiAgentName ? channels.ai : channels.human;
    currentChannel.replies++;
    currentChannel.leads.add(key);
    const waiting = waitingSince.get(key);
    if (waiting !== undefined && !answered.has(key)) {
      currentChannel.firstReplies.push((message.createdAt.getTime() - waiting) / 1000);
      answered.add(key);
    }
  }
  const summarizeChannel = (value: ReturnType<typeof channel>): DashboardSupportChannel => ({
    conversations: value.leads.size,
    replies: value.replies,
    averageFirstReplySeconds: value.firstReplies.length
      ? Math.round(value.firstReplies.reduce((total, seconds) => total + seconds, 0) / value.firstReplies.length) : null
  });

  let previousRevenueCents = 0;
  let previousSales = 0;
  let currentRevenueCents = 0;
  const seenSales = new Set<string>();
  for (const sale of input.sales) {
    if (!sale.webinarId || !webinars.has(sale.webinarId) || seenSales.has(sale.id) || sale.currency.trim().toUpperCase() !== "BRL") continue;
    const time = sale.createdAt.getTime();
    if (!Number.isFinite(time) || time < previous.start.getTime() || time > end) continue;
    seenSales.add(sale.id);
    if (time < start) {
      previousRevenueCents += sale.amount;
      previousSales++;
    } else currentRevenueCents += sale.amount;
  }

  return {
    watch: {
      averageWatchedSeconds: viewers.size ? Math.round(totalWatchedSeconds / viewers.size) : null,
      totalWatchedSeconds, viewerCount: viewers.size, retention, pitchAtSeconds
    },
    geography,
    support: { human: summarizeChannel(channels.human), ai: summarizeChannel(channels.ai), uniqueConversations: conversations.size },
    comparison: {
      previousRevenueCents, previousSales,
      revenueChangePct: previousRevenueCents ? percentage(currentRevenueCents - previousRevenueCents, previousRevenueCents) : null
    }
  };
}
