import { describe, expect, it } from "vitest";
import { buildDashboardSupport, type DashboardSupportMessage } from "@/lib/dashboard-support";

const rangeStart = new Date("2026-11-01T03:00:00.000Z");
const rangeEnd = new Date("2026-11-03T02:59:59.999Z");
const message = (id: string, leadId: string, sender: string, seconds: number, extra: Partial<DashboardSupportMessage> = {}): DashboardSupportMessage => ({
  id, webinarId: "owned", leadId, sender, aiAgentName: null,
  createdAt: new Date(rangeStart.getTime() + seconds * 1000), ...extra
});
const human = (id: string, name: string) => ({ authorUserId: id, authorUser: { name, image: `/avatars/${id}.png` } });
const build = (messages: DashboardSupportMessage[]) => buildDashboardSupport({ webinarIds: ["owned"], messages, rangeStart, rangeEnd });

describe("dashboard support metrics", () => {
  it("returns unknown response times and observed zero-message days for an empty period", () => {
    expect(build([])).toEqual({
      human: { conversations: 0, replies: 0, averageFirstReplySeconds: null },
      ai: { conversations: 0, replies: 0, averageFirstReplySeconds: null },
      uniqueConversations: 0, incomingMessages: 0, repliedConversations: 0, awaitingReplyConversations: 0,
      averageFirstReplySeconds: null, firstReplySamples: 0, agents: [],
      activity: [
        { date: "2026-11-01", label: "01/11", incoming: 0, human: 0, ai: 0 },
        { date: "2026-11-02", label: "02/11", incoming: 0, human: 0, ai: 0 }
      ]
    });
  });

  it("counts overlapping authors separately, deduplicates messages and credits first response once", () => {
    const messages = [
      message("a", "shared", "lead", 0),
      message("b", "shared", "lead", 4),
      message("c", "shared", "team", 10, human("ana", "Ana")),
      message("d", "shared", "team", 12, human("bruno", "Bruno")),
      message("e", "shared", "lead", 20),
      message("f", "shared", "team", 50, human("bruno", "Bruno")),
      message("g", "shared", "lead", 60)
    ];
    const result = build([...messages.slice().reverse(), messages[0], messages[2]]);
    expect(result).toMatchObject({
      uniqueConversations: 1, incomingMessages: 4, repliedConversations: 1, awaitingReplyConversations: 1,
      averageFirstReplySeconds: 10, firstReplySamples: 1,
      human: { conversations: 1, replies: 3, averageFirstReplySeconds: 10 },
      agents: [
        { id: "human:bruno", name: "Bruno", kind: "human", image: "/avatars/bruno.png", conversations: 1, replies: 2, averageFirstReplySeconds: null, firstReplySamples: 0 },
        { id: "human:ana", name: "Ana", kind: "human", image: "/avatars/ana.png", conversations: 1, replies: 1, averageFirstReplySeconds: 10, firstReplySamples: 1 }
      ]
    });
    expect(result.activity[0]).toMatchObject({ incoming: 4, human: 3, ai: 0 });
  });

  it("separates AI from human authors even with matching names and uses a weighted overall response time", () => {
    const result = build([
      message("a", "mixed", "lead", 0),
      message("b", "mixed", "team", 4, { aiAgentName: "Ana", ...human("ana", "Ana") }),
      message("c", "mixed", "team", 14, human("ana", "Ana")),
      message("d", "human-a", "lead", 0),
      message("e", "human-a", "team", 30, human("ana", "Ana")),
      message("f", "human-b", "lead", 10),
      message("g", "human-b", "team", 60, human("ana", "Ana"))
    ]);
    expect(result).toMatchObject({
      uniqueConversations: 3, repliedConversations: 3, awaitingReplyConversations: 0,
      averageFirstReplySeconds: 28, firstReplySamples: 3,
      human: { conversations: 3, replies: 3, averageFirstReplySeconds: 40 },
      ai: { conversations: 1, replies: 1, averageFirstReplySeconds: 4 },
      agents: [
        { id: "human:ana", conversations: 3, replies: 3, firstReplySamples: 2, averageFirstReplySeconds: 40 },
        { id: "ai:Ana", kind: "ai", image: null, conversations: 1, replies: 1, firstReplySamples: 1, averageFirstReplySeconds: 4 }
      ]
    });
  });

  it("keeps missing and deleted authors in an explicit unattributed human bucket", () => {
    const result = build([
      message("a", "legacy", "lead", 0),
      message("b", "legacy", "team", 15),
      message("c", "deleted", "team", 20, { authorUserId: null, authorUser: null }),
      message("d", "named", "team", 30, human("one", "Mesmo nome")),
      message("e", "named", "team", 40, human("two", "Mesmo nome"))
    ]);
    expect(result.human).toEqual({ conversations: 3, replies: 4, averageFirstReplySeconds: 15 });
    expect(result.agents).toHaveLength(3);
    expect(result.agents[0]).toEqual({
      id: "unattributed", name: "Equipe sem identificação", kind: "unattributed", image: null,
      conversations: 2, replies: 2, averageFirstReplySeconds: 15, firstReplySamples: 1
    });
    expect(result.agents.map(agent => agent.id)).toEqual(["unattributed", "human:one", "human:two"]);
  });

  it("counts outbound conversations without inventing response samples and ignores messages beyond the range", () => {
    const result = build([
      message("before", "cross-start", "lead", -1),
      message("in", "cross-start", "team", 10, human("ana", "Ana")),
      message("outbound", "outbound", "team", 20, human("ana", "Ana")),
      message("unanswered", "cross-end", "lead", 30),
      message("after", "cross-end", "team", 0, { createdAt: new Date(rangeEnd.getTime() + 1), ...human("ana", "Ana") }),
      message("invalid", "invalid", "lead", 0, { createdAt: new Date("invalid") }),
      message("system", "system", "system", 1)
    ]);
    expect(result).toMatchObject({
      uniqueConversations: 3, incomingMessages: 1, repliedConversations: 2, awaitingReplyConversations: 1,
      averageFirstReplySeconds: null, firstReplySamples: 0,
      human: { conversations: 2, replies: 2, averageFirstReplySeconds: null }
    });
    expect(result.agents[0].firstReplySamples).toBe(0);
  });

  it("isolates webinar scope and treats the same lead ID in two owned webinars as separate conversations", () => {
    const result = buildDashboardSupport({
      webinarIds: ["owned", "second"], rangeStart, rangeEnd,
      messages: [
        message("owned-in", "same", "lead", 0),
        message("owned-out", "same", "team", 20, human("ana", "Ana")),
        message("other-in", "same", "lead", 5, { webinarId: "second" }),
        message("foreign-in", "same", "lead", 0, { webinarId: "foreign" }),
        message("foreign-out", "same", "team", 30, { webinarId: "foreign", ...human("foreign", "Foreign") })
      ]
    });
    expect(result).toMatchObject({ uniqueConversations: 2, incomingMessages: 2, repliedConversations: 1, awaitingReplyConversations: 1 });
    expect(result.agents.map(agent => agent.id)).toEqual(["human:ana"]);
  });

  it("resolves equal timestamps deterministically without turning unknown times into zero", () => {
    const result = build([
      message("b", "zero", "team", 0, human("ana", "Ana")),
      message("a", "zero", "lead", 0),
      message("d", "pending", "lead", 1),
      message("c", "pending", "team", 1, human("bruno", "Bruno"))
    ]);
    expect(result).toMatchObject({ awaitingReplyConversations: 1, averageFirstReplySeconds: 0, firstReplySamples: 1 });
    expect(result.agents.find(agent => agent.id === "human:bruno")?.averageFirstReplySeconds).toBeNull();
    expect(result.agents.find(agent => agent.id === "human:ana")?.averageFirstReplySeconds).toBe(0);
  });

  it("buckets inclusive boundaries by Brasília calendar day and retains zero days across year rollover", () => {
    const result = buildDashboardSupport({
      webinarIds: ["owned"],
      rangeStart: new Date("2026-12-31T02:59:59.000Z"),
      rangeEnd: new Date("2027-01-02T03:00:00.000Z"),
      messages: [
        message("start", "a", "lead", 0, { createdAt: new Date("2026-12-31T02:59:59.000Z") }),
        message("midnight", "a", "team", 0, { createdAt: new Date("2026-12-31T03:00:00.000Z"), ...human("ana", "Ana") }),
        message("end", "b", "team", 0, { createdAt: new Date("2027-01-02T03:00:00.000Z"), aiAgentName: "Bot" })
      ]
    });
    expect(result.activity).toEqual([
      { date: "2026-12-30", label: "30/12", incoming: 1, human: 0, ai: 0 },
      { date: "2026-12-31", label: "31/12", incoming: 0, human: 1, ai: 0 },
      { date: "2027-01-01", label: "01/01", incoming: 0, human: 0, ai: 0 },
      { date: "2027-01-02", label: "02/01", incoming: 0, human: 0, ai: 1 }
    ]);
    expect(result.averageFirstReplySeconds).toBe(1);
  });

  it("rejects invalid ranges before creating daily buckets", () => {
    expect(() => buildDashboardSupport({ webinarIds: [], messages: [], rangeStart: rangeEnd, rangeEnd: rangeStart })).toThrow(RangeError);
    expect(() => buildDashboardSupport({ webinarIds: [], messages: [], rangeStart: new Date("invalid"), rangeEnd })).toThrow(RangeError);
  });
});
