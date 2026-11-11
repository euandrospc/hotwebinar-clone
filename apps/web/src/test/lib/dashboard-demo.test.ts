import { describe, expect, it } from "vitest";
import { createDashboardDemo, isDashboardDemoEnabled } from "@/lib/dashboard-demo";

const start = new Date("2026-10-30T03:00:00.000Z");
const end = new Date("2026-11-06T02:59:59.999Z");

describe("dashboard demonstration", () => {
  it("keeps revenue, conversion and funnel consistent", () => {
    const { overview, insights } = createDashboardDemo(start, end);
    expect(overview.totals).toMatchObject({ registrations: 2840, viewers: 2430, sales: 86, convertedLeads: 86, revenueCents: 4_274_200 });
    expect(overview.funnel.map((stage) => stage.count)).toEqual([2840, 2430, 1310, 390, 86]);
    expect(overview.totals.conversionRate).toBe(3.03);
    expect(overview.funnel.at(-1)?.pct).toBe(overview.totals.conversionRate);
    expect(insights.comparison.previousRevenueCents).toBe(insights.comparison.previousSales * 49_700);
    expect(insights.comparison.revenueChangePct).toBeCloseTo(19.44, 2);
  });

  it("partitions all accesses among 27 states and explicit unknown/foreign groups", () => {
    const { overview, insights: { geography } } = createDashboardDemo(start, end);
    expect(geography.regions).toHaveLength(27);
    expect(new Set(geography.regions.map((region) => region.code)).size).toBe(27);
    expect(geography.regions.every((region) => region.count > 0)).toBe(true);
    expect(geography.regions[0].code).toBe("SP");
    expect(geography.regions.reduce((sum, region) => sum + region.count, 0) + geography.unlocated + geography.outsideBrazil + geography.brazilUnresolved)
      .toBe(overview.totals.registrations);
    expect(geography.totalAccesses).toBe(overview.funnel[0].count);
  });

  it("makes video reach monotone, with pitch matching people who also have playback records", () => {
    const { overview, insights: { watch } } = createDashboardDemo(start, end);
    expect(watch.retention).toHaveLength(25);
    expect(watch.retention[0]).toMatchObject({ viewers: 2430, percentage: 100 });
    expect(watch.retention.find((point) => point.positionSeconds === watch.pitchAtSeconds)?.viewers).toBe(overview.funnelTransitions[1].overlapCount);
    expect(watch.retention.at(-1)).toMatchObject({ positionSeconds: 5400, viewers: 486, percentage: 20 });
    watch.retention.forEach((point, index) => {
      if (index) expect(point.viewers).toBeLessThanOrEqual(watch.retention[index - 1].viewers);
    });
    expect(watch.totalWatchedSeconds).toBe(watch.averageWatchedSeconds! * watch.viewerCount);
  });

  it("demonstrates real stage overlap separately from differences between totals", () => {
    const { overview } = createDashboardDemo(start, end);
    expect(overview.funnelTransitions.map(({ overlapCount }) => overlapCount)).toEqual([2430, 1260, 365, 72]);
    expect(overview.funnelTransitions[1]).toMatchObject({ fromCount: 2430, toCount: 1310, previousOnlyCount: 1170, currentOnlyCount: 50, overlapRate: 51.85 });
    expect(overview.funnelTransitions[3]).toMatchObject({ fromCount: 390, toCount: 86, previousOnlyCount: 318, currentOnlyCount: 14, overlapRate: 18.46 });
  });

  it.each([1, 60_000, 3_600_000, 86_400_000, 7 * 86_400_000, 31 * 86_400_000])("keeps synthetic intersections feasible for a %i ms period", (duration) => {
    const { overview } = createDashboardDemo(start, new Date(start.getTime() + duration - 1));
    overview.funnelTransitions.forEach((transition, index) => {
      expect(transition.fromCount).toBe(overview.funnel[index].count);
      expect(transition.toCount).toBe(overview.funnel[index + 1].count);
      expect(transition.overlapCount).toBeGreaterThanOrEqual(0);
      expect(transition.overlapCount).toBeLessThanOrEqual(Math.min(transition.fromCount, transition.toCount));
      expect(transition.overlapCount + transition.previousOnlyCount).toBe(transition.fromCount);
      expect(transition.overlapCount + transition.currentOnlyCount).toBe(transition.toCount);
      expect(transition.fromCount + transition.toCount - transition.overlapCount).toBeLessThanOrEqual(overview.totals.registrations);
      if (transition.fromCount === 0) expect(transition.overlapRate).toBeNull();
      else expect(transition.overlapRate).toBeCloseTo(transition.overlapCount / transition.fromCount * 100, 2);
    });
  });

  it("keeps daily sums exact and follows Brasília calendar dates across years", () => {
    const { overview } = createDashboardDemo(new Date("2026-12-31T23:00:00-03:00"), new Date("2027-01-02T01:00:00-03:00"));
    expect(overview.daily.map((point) => point.date)).toEqual(["2026-12-31", "2027-01-01", "2027-01-02"]);
    for (const key of ["registrations", "viewers", "sales", "revenueCents"] as const) {
      expect(overview.daily.reduce((sum, point) => sum + point[key], 0)).toBe(overview.totals[key]);
    }
  });

  it("scales the selected period deterministically without changing the current audience snapshot", () => {
    const week = createDashboardDemo(start, end);
    expect(createDashboardDemo(start, end)).toEqual(week);
    const day = createDashboardDemo(start, new Date(start.getTime() + 86_400_000 - 1));
    expect(day.overview.totals.registrations).toBeLessThan(week.overview.totals.registrations);
    expect(day.overview.totals.revenueCents).toBeLessThan(week.overview.totals.revenueCents);
    expect(day.online).toBe(week.online);
    expect(day.realtime).toEqual(week.realtime);
    expect(week.insights.support.uniqueConversations).toBeGreaterThanOrEqual(week.insights.support.ai.conversations);
    expect(week.insights.support.uniqueConversations).toBeLessThan(week.overview.totals.registrations);
  });

  it("shows four attendants and one AI with first-response samples belonging to their actual responder", () => {
    const { support } = createDashboardDemo(start, end).insights;
    expect(support.agents.filter((agent) => agent.kind === "human")).toHaveLength(4);
    expect(support.agents.filter((agent) => agent.kind === "ai")).toHaveLength(1);
    expect(new Set(support.agents.map((agent) => agent.id)).size).toBe(support.agents.length);
    expect(support).toMatchObject({ uniqueConversations: 431, repliedConversations: 407, awaitingReplyConversations: 41, incomingMessages: 1382 });
    expect(support.human.replies).toBe(624);
    expect(support.ai.replies).toBe(1894);
    expect(support.agents.every((agent) => agent.image === null && agent.firstReplySamples > 0)).toBe(true);
  });

  it.each([1, 60_000, 3_600_000, 86_400_000, 7 * 86_400_000, 31 * 86_400_000])("keeps support totals and samples consistent for a %i ms period", (duration) => {
    const { support } = createDashboardDemo(start, new Date(start.getTime() + duration - 1)).insights;
    expect(support.repliedConversations).toBeLessThanOrEqual(support.uniqueConversations);
    expect(support.repliedConversations).toBeGreaterThanOrEqual(Math.max(support.human.conversations, support.ai.conversations));
    expect(support.repliedConversations).toBeLessThanOrEqual(support.human.conversations + support.ai.conversations);
    expect(support.awaitingReplyConversations).toBeGreaterThanOrEqual(support.uniqueConversations - support.repliedConversations);
    expect(support.awaitingReplyConversations).toBeLessThanOrEqual(support.uniqueConversations);
    expect(support.incomingMessages).toBeGreaterThanOrEqual(support.uniqueConversations);
    expect(support.firstReplySamples).toBeLessThanOrEqual(support.repliedConversations);
    expect(support.agents.reduce((sum, agent) => sum + agent.firstReplySamples, 0)).toBe(support.firstReplySamples);
    const weightedAverage = (agents: typeof support.agents) => {
      const samples = agents.reduce((sum, agent) => sum + agent.firstReplySamples, 0);
      return samples ? Math.round(agents.reduce((sum, agent) => sum + (agent.averageFirstReplySeconds ?? 0) * agent.firstReplySamples, 0) / samples) : null;
    };
    expect(support.averageFirstReplySeconds).toBe(weightedAverage(support.agents));
    for (const kind of ["human", "ai"] as const) {
      const agents = support.agents.filter((agent) => agent.kind === kind);
      expect(agents.reduce((sum, agent) => sum + agent.replies, 0)).toBe(support[kind].replies);
      expect(agents.reduce((sum, agent) => sum + agent.conversations, 0)).toBe(support[kind].conversations);
      expect(support[kind].averageFirstReplySeconds).toBe(weightedAverage(agents));
      expect(support.activity.reduce((sum, day) => sum + day[kind], 0)).toBe(support[kind].replies);
    }
    expect(support.activity.reduce((sum, day) => sum + day.incoming, 0)).toBe(support.incomingMessages);
    support.agents.forEach((agent) => {
      expect(agent.replies).toBeGreaterThanOrEqual(agent.conversations);
      expect(agent.firstReplySamples).toBeLessThanOrEqual(agent.conversations);
      if (!agent.firstReplySamples) expect(agent.averageFirstReplySeconds).toBeNull();
    });
  });

  it("uses Brasília dates for support activity and leaves zero-message averages unknown", () => {
    const { support } = createDashboardDemo(new Date("2026-12-31T23:00:00-03:00"), new Date("2027-01-02T01:00:00-03:00")).insights;
    expect(support.activity.map((day) => day.date)).toEqual(["2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(support.activity.map((day) => day.label)).toEqual(["31/12", "01/01", "02/01"]);
    const empty = createDashboardDemo(start, start).insights.support;
    expect(empty).toMatchObject({
      uniqueConversations: 0, incomingMessages: 0, repliedConversations: 0, awaitingReplyConversations: 0,
      firstReplySamples: 0, averageFirstReplySeconds: null, agents: [],
      human: { conversations: 0, replies: 0, averageFirstReplySeconds: null },
      ai: { conversations: 0, replies: 0, averageFirstReplySeconds: null }
    });
    expect(empty.activity).toEqual([{ date: "2026-10-30", label: "30/10", incoming: 0, human: 0, ai: 0 }]);
  });

  it("derives realtime mean and peak from the same 60-minute series as the current count", () => {
    const { realtime, online } = createDashboardDemo(start, end);
    expect(realtime.points).toHaveLength(31);
    expect(realtime.sampleCount).toBe(realtime.points.length);
    expect(realtime.windowMinutes).toBe(60);
    expect(realtime.average).toBe(realtime.points.reduce((sum, point) => sum + point.online, 0) / realtime.sampleCount);
    expect(realtime.peak).toBe(Math.max(...realtime.points.map((point) => point.online)));
    expect(realtime.peak).toBe(242);
    expect(realtime.points.at(-1)?.online).toBe(online);
    expect(online).toBe(196);
    expect(Date.parse(realtime.points.at(-1)!.at) - Date.parse(realtime.points[0].at)).toBe(60 * 60_000);
    realtime.points.forEach((point, index) => {
      expect(Number.isInteger(point.online) && point.online >= 0).toBe(true);
      if (index) expect(Date.parse(point.at) - Date.parse(realtime.points[index - 1].at)).toBe(2 * 60_000);
    });
  });

  it("rejects invalid periods and leaves zero-viewer averages unknown", () => {
    expect(() => createDashboardDemo(new Date(NaN), end)).toThrow(RangeError);
    expect(() => createDashboardDemo(end, start)).toThrow(RangeError);
    const { overview, insights } = createDashboardDemo(start, start);
    expect(overview.totals.registrations).toBe(0);
    expect(overview.totals.conversionRate).toBeNull();
    expect(insights.watch.averageWatchedSeconds).toBeNull();
    expect(insights.watch.retention).toEqual([]);
  });
});

describe("dashboard demonstration guard", () => {
  it("enables local previews by default, with an explicit real-data switch", () => {
    expect(isDashboardDemoEnabled(undefined, "development")).toBe(true);
    expect(isDashboardDemoEnabled("1", "development")).toBe(true);
    expect(isDashboardDemoEnabled("0", "development")).toBe(false);
  });

  it.each(["production", "test", undefined])("never enables fixtures in %s", (environment) => {
    expect(isDashboardDemoEnabled("1", environment)).toBe(false);
    expect(isDashboardDemoEnabled(undefined, environment)).toBe(false);
  });
});
