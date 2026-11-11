import { DASHBOARD_TIME_ZONE } from "@/lib/dashboard-overview";

export interface DashboardSupportChannel {
  /** Distinct conversations with a team reply from this channel in the period. */
  conversations: number;
  replies: number;
  /** First observed incoming message to first subsequent team reply, both in the period. */
  averageFirstReplySeconds: number | null;
}

export interface DashboardSupportAgent extends DashboardSupportChannel {
  /** Namespaced identity; human attribution always comes from the message author. */
  id: string;
  name: string;
  kind: "human" | "ai" | "unattributed";
  image: string | null;
  firstReplySamples: number;
}

export interface DashboardSupportActivity {
  /** Calendar date in Brasília, including the year. */
  date: string;
  label: string;
  incoming: number;
  human: number;
  ai: number;
}

export interface DashboardSupport {
  human: DashboardSupportChannel;
  ai: DashboardSupportChannel;
  /** Distinct conversations with a lead or team message in the period. */
  uniqueConversations: number;
  incomingMessages: number;
  /** Distinct conversations with any team reply in the period, including outbound-only chats. */
  repliedConversations: number;
  /** Last observed message inside this period is incoming; this is not the current queue. */
  awaitingReplyConversations: number;
  averageFirstReplySeconds: number | null;
  firstReplySamples: number;
  agents: DashboardSupportAgent[];
  activity: DashboardSupportActivity[];
}

export interface DashboardSupportMessage {
  id: string;
  webinarId: string;
  leadId: string;
  sender: string;
  aiAgentName: string | null;
  authorUserId?: string | null;
  authorUser?: { name: string; image?: string | null } | null;
  createdAt: Date;
}

interface BuildDashboardSupportInput {
  webinarIds: readonly string[];
  messages: readonly DashboardSupportMessage[];
  rangeStart: Date;
  rangeEnd: Date;
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: DASHBOARD_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
});

function dateKey(date: Date): string {
  const parts = dayFormatter.formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function createActivity(start: Date, end: Date): Map<string, DashboardSupportActivity> {
  const cursor = new Date(`${dateKey(start)}T00:00:00Z`);
  const last = dateKey(end);
  const points = new Map<string, DashboardSupportActivity>();
  // Advance calendar dates after extracting Brasília's day, independently of host timezone or DST.
  while (cursor.toISOString().slice(0, 10) <= last) {
    const date = cursor.toISOString().slice(0, 10);
    points.set(date, { date, label: `${date.slice(8, 10)}/${date.slice(5, 7)}`, incoming: 0, human: 0, ai: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

const aggregate = () => ({ conversations: new Set<string>(), replies: 0, firstReplies: [] as number[] });
const average = (values: readonly number[]): number | null => values.length
  ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : null;

function summarize(value: ReturnType<typeof aggregate>): DashboardSupportChannel {
  return {
    conversations: value.conversations.size,
    replies: value.replies,
    averageFirstReplySeconds: average(value.firstReplies)
  };
}

function author(message: DashboardSupportMessage): Pick<DashboardSupportAgent, "id" | "name" | "kind" | "image"> {
  if (message.aiAgentName) return {
    id: `ai:${message.aiAgentName}`, name: message.aiAgentName, kind: "ai", image: null
  };
  if (message.authorUserId) return {
    id: `human:${message.authorUserId}`, name: message.authorUser?.name.trim() || "Atendente sem nome",
    kind: "human", image: message.authorUser?.image ?? null
  };
  return { id: "unattributed", name: "Equipe sem identificação", kind: "unattributed", image: null };
}

/**
 * Uses message history only. Mutable assignments and closure state never rewrite an author's metrics.
 * The first reply belongs only to the first responding actor after an observed incoming message.
 */
export function buildDashboardSupport(input: BuildDashboardSupportInput): DashboardSupport {
  const start = input.rangeStart.getTime();
  const end = input.rangeEnd.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new RangeError("Invalid dashboard date range");
  const webinars = new Set(input.webinarIds);
  const activity = createActivity(input.rangeStart, input.rangeEnd);
  const channels = { human: aggregate(), ai: aggregate() };
  const agents = new Map<string, ReturnType<typeof author> & ReturnType<typeof aggregate>>();
  const conversations = new Set<string>();
  const replied = new Set<string>();
  const awaiting = new Set<string>();
  const waitingSince = new Map<string, number>();
  const firstReplies = new Map<string, number>();
  const seenMessages = new Set<string>();
  let incomingMessages = 0;
  const messages = input.messages.filter((message) => webinars.has(message.webinarId) &&
    message.createdAt.getTime() >= start && message.createdAt.getTime() <= end &&
    (message.sender === "lead" || message.sender === "team"))
    .slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));

  for (const message of messages) {
    if (seenMessages.has(message.id)) continue;
    seenMessages.add(message.id);
    const key = JSON.stringify([message.webinarId, message.leadId]);
    const point = activity.get(dateKey(message.createdAt))!;
    conversations.add(key);
    if (message.sender === "lead") {
      incomingMessages++;
      point.incoming++;
      awaiting.add(key);
      if (!waitingSince.has(key)) waitingSince.set(key, message.createdAt.getTime());
      continue;
    }

    replied.add(key);
    awaiting.delete(key);
    const channelKey = message.aiAgentName ? "ai" : "human";
    const channel = channels[channelKey];
    const identity = author(message);
    const agent = agents.get(identity.id) ?? { ...identity, ...aggregate() };
    agents.set(identity.id, agent);
    point[channelKey]++;
    for (const row of [channel, agent]) {
      row.replies++;
      row.conversations.add(key);
    }
    const waiting = waitingSince.get(key);
    if (waiting !== undefined && !firstReplies.has(key)) {
      const seconds = (message.createdAt.getTime() - waiting) / 1000;
      firstReplies.set(key, seconds);
      channel.firstReplies.push(seconds);
      agent.firstReplies.push(seconds);
    }
  }

  return {
    human: summarize(channels.human),
    ai: summarize(channels.ai),
    uniqueConversations: conversations.size,
    incomingMessages,
    repliedConversations: replied.size,
    awaitingReplyConversations: awaiting.size,
    averageFirstReplySeconds: average([...firstReplies.values()]),
    firstReplySamples: firstReplies.size,
    agents: [...agents.values()].map((agent) => ({
      id: agent.id, name: agent.name, kind: agent.kind, image: agent.image,
      ...summarize(agent), firstReplySamples: agent.firstReplies.length
    })).sort((a, b) => b.conversations - a.conversations || b.replies - a.replies || a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id)),
    activity: [...activity.values()]
  };
}
