import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma, type Prisma } from "db";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: async () => null } } }));

import { createExperiment } from "@/server/ab-tests/experiments";
import { getAbReport } from "@/server/ab-tests/report";

const prefix = "ab-recurring-integration";
const owner = `${prefix}-owner`, other = `${prefix}-other`;
const webinarA = `${prefix}-a`, webinarB = `${prefix}-b`, foreignWebinar = `${prefix}-foreign`;
const repeat = `${prefix}-repeat`, boundary = `${prefix}-boundary`, leadB = `${prefix}-b-lead`, foreignLead = `${prefix}-foreign-lead`;
const finalLead = `${prefix}-final`;
const now = new Date("2026-11-14T03:00:00Z");
let experimentId: string;
let safeDatabase = false;

async function cleanup() {
  await prisma.sale.deleteMany({ where: { externalId: { startsWith: prefix } } });
  await prisma.abExperiment.deleteMany({ where: { ownerId: { in: [owner, other] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
}

beforeAll(async () => {
  // This suite deliberately exercises PostgreSQL aggregation rather than mocking Prisma.
  const database = new URL(process.env.DATABASE_URL!);
  expect(database.hostname).toBe("localhost");
  expect(database.port).toBe("5452");
  expect(database.pathname).toBe("/hotwebinar_test");
  safeDatabase = true;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  await cleanup();
  await prisma.user.createMany({ data: [
    { id: owner, name: "Recurring integration", email: `${owner}@example.test` },
    { id: other, name: "Foreign integration", email: `${other}@example.test` }
  ] });
  const schedule = { ownerId: owner, status: "ACTIVE" as const, mode: "UNICO" as const, recurring: true,
    recurringDays: [0, 1, 2, 3, 4, 5, 6], timezone: "America/Sao_Paulo", pitchAtSec: 120, videoSyncWithStart: true };
  await prisma.webinar.createMany({ data: [
    { ...schedule, id: webinarA, slug: webinarA, title: "15h", startDate: new Date("2026-11-11T18:00:00Z"), endDate: new Date("2026-11-11T20:10:00Z") },
    { ...schedule, id: webinarB, slug: webinarB, title: "20h", startDate: new Date("2026-11-11T23:00:00Z"), endDate: new Date("2026-11-12T01:10:00Z") },
    { ...schedule, ownerId: other, id: foreignWebinar, slug: foreignWebinar, title: "Foreign", startDate: new Date("2026-11-11T18:00:00Z"), endDate: new Date("2026-11-11T20:10:00Z") }
  ] });
  await prisma.lead.createMany({ data: [
    { id: repeat, webinarId: webinarA, name: "Repeated", email: `${repeat}@example.test`, utmSource: "meta", pitchFired: true, reachedPitch: true },
    { id: boundary, webinarId: webinarA, name: "Boundary", email: `${boundary}@example.test`, utmSource: "google" },
    { id: leadB, webinarId: webinarB, name: "B", email: `${leadB}@example.test`, utmSource: "meta" },
    { id: finalLead, webinarId: webinarA, name: "Last day", email: `${finalLead}@example.test`, utmSource: "meta" },
    { id: foreignLead, webinarId: foreignWebinar, name: "Foreign", email: `${foreignLead}@example.test` }
  ] });
  const event = (webinarId: string, leadId: string, kind: Prisma.EventCreateManyInput["kind"], at: string, videoSec?: number): Prisma.EventCreateManyInput =>
    ({ webinarId, leadId, kind, createdAt: new Date(at), videoSec });
  await prisma.event.createMany({ data: [
    event(webinarA, boundary, "OPTIN", "2026-11-11T02:59:59Z"), // before the plan / previous BRT date
    event(webinarA, boundary, "VIDEO_TICK", "2026-11-11T03:00:00Z", 30),
    event(webinarA, boundary, "VIDEO_TICK", "2026-11-12T02:59:59Z", 60), // still November 11
    event(webinarA, boundary, "VIDEO_TICK", "2026-11-12T03:00:00Z", 90), // new daily participation
    event(webinarA, repeat, "OPTIN", "2026-11-11T18:00:00Z"),
    event(webinarA, repeat, "VIDEO_TICK", "2026-11-11T18:02:00Z", 130),
    event(webinarA, repeat, "OFFER_CLICK", "2026-11-12T03:30:00Z"), // outcome only, not a new entry
    event(webinarA, repeat, "VIDEO_TICK", "2026-11-12T17:00:00Z", 140), // return before old 24h closes
    event(webinarA, repeat, "OFFER_CLICK", "2026-11-12T17:00:00Z"),
    event(webinarB, leadB, "OPTIN", "2026-11-11T23:00:00Z"),
    event(webinarB, leadB, "VIDEO_TICK", "2026-11-11T23:02:00Z", 130),
    event(webinarA, finalLead, "OPTIN", "2026-12-10T22:00:00Z"),
    event(foreignWebinar, foreignLead, "VIDEO_TICK", "2026-11-11T18:02:00Z", 130)
  ] });
  const sale = (suffix: string, webinarId: string, leadId: string, at: string, amount: number) =>
    ({ externalId: `${prefix}-${suffix}`, webinarId, leadId, amount, createdAt: new Date(at) });
  await prisma.sale.createMany({ data: [
    sale("midnight", webinarA, repeat, "2026-11-12T03:31:00Z", 1000),
    sale("next-entry", webinarA, repeat, "2026-11-12T17:00:00Z", 2000),
    sale("b", webinarB, leadB, "2026-11-11T23:03:00Z", 4000),
    sale("last-day", webinarA, finalLead, "2026-12-11T21:00:00Z", 3000),
    sale("outside-window", webinarA, finalLead, "2026-12-11T22:00:00.001Z", 9000),
    sale("foreign", foreignWebinar, foreignLead, "2026-11-11T18:03:00Z", 900000)
  ] });
  const audience = (webinarId: string, at: string, online: number) =>
    ({ webinarId, sampledAt: new Date(at), observedAt: new Date(at), online });
  await prisma.audienceSample.createMany({ data: [
    audience(webinarA, "2026-11-11T02:59:59Z", 999),
    audience(webinarA, "2026-11-11T18:00:00Z", 10),
    audience(webinarA, "2026-11-11T18:01:00Z", 10),
    audience(webinarA, "2026-11-11T18:02:00Z", 20),
    audience(webinarA, "2026-11-12T03:00:00Z", 30),
    audience(webinarA, "2026-11-12T18:02:00Z", 50),
    audience(webinarB, "2026-11-11T23:02:00Z", 40),
    audience(foreignWebinar, "2026-11-11T18:02:00Z", 9999)
  ] });
  const experiment = await createExperiment(owner, { name: "15h × 20h · integração recorrente", mode: "OBSERVATIONAL", observationUnit: "DAILY_SESSION",
    webinarAId: webinarA, webinarBId: webinarB, testVariable: "SCHEDULE", from: "2026-11-11T03:00:00Z", durationDays: 30, conversionWindowHours: 24 });
  experimentId = experiment.id;
});

afterAll(async () => {
  vi.useRealTimers();
  if (safeDatabase) await cleanup();
  await prisma.$disconnect();
});

describe("recurring reports against PostgreSQL", () => {
  it("groups real UTC events by BRT day and assigns overlapping outcomes and sales exactly once", async () => {
    const report = await getAbReport(owner, experimentId, {}, now);
    expect(report.variants[0]).toMatchObject({ assigned: 4, uniquePeople: 2, viewers: 4, pitch: 2, clicks: 2, buyers: 2, sales: 2, revenueCents: 3000, rate: .5 });
    expect(report.variants[1]).toMatchObject({ assigned: 1, uniquePeople: 1, sales: 1, revenueCents: 4000 });
    expect(report.integrity.duplicateIdentities).toBe(0);
    const { daily, weekly, total } = report.periods!;
    expect(daily).toHaveLength(30);
    expect(daily[0]).toMatchObject({ key: "2026-11-11", from: "2026-11-11T03:00:00.000Z", to: "2026-11-12T02:59:59.999Z" });
    expect(daily[0].variants[0]).toMatchObject({ assigned: 2, buyers: 1, clicks: 1, revenueCents: 1000 });
    expect(daily[1].variants[0]).toMatchObject({ assigned: 2, buyers: 1, clicks: 1, revenueCents: 2000 });
    expect(weekly[0].variants[0]).toMatchObject({ assigned: 4, uniquePeople: 2, revenueCents: 3000, rate: .5 });
    expect(total.variants[0]).toMatchObject({ assigned: 4, uniquePeople: 2, revenueCents: 3000, rate: .5 });
    expect(daily.reduce((sum, day) => sum + day.variants[0].revenueCents, 0)).toBe(total.variants[0].revenueCents);
    expect(weekly.reduce((sum, week) => sum + week.variants[0].revenueCents, 0)).toBe(total.variants[0].revenueCents);
  });

  it("preserves attribution when selecting days or segments and does not synthesize filtered audience", async () => {
    const dayOne = await getAbReport(owner, experimentId, { from: "2026-11-11T03:00:00Z", to: "2026-11-12T02:59:59.999Z" }, now);
    expect(dayOne.variants[0]).toMatchObject({ assigned: 2, sales: 1, revenueCents: 1000 });
    expect(dayOne.periods!.daily[1].variants[0].revenueCents).toBe(2000);
    expect(dayOne.periods!.total.variants[0].revenueCents).toBe(3000);
    const segmented = await getAbReport(owner, experimentId, { source: "meta" }, now);
    expect(segmented.variants[0]).toMatchObject({ assigned: 2, uniquePeople: 1, buyers: 2, sales: 2, revenueCents: 3000, rate: 1 });
    expect(segmented.periods!.total.audience!.A.average).toBeNull();
    expect(segmented.periods!.total.audience!.A.reason).toContain("não permite aplicar filtros");
  });

  it("aggregates real audience by calendar period and preserves the scheduled pitch samples", async () => {
    const report = await getAbReport(owner, experimentId, {}, now);
    expect(report.diagnostics!.audience!.window).toBe("CALENDAR_PERIOD");
    expect(report.periods!.daily[0].audience!.A).toMatchObject({ peak: 20, sampleCount: 3 });
    expect(report.periods!.daily[0].audience!.A.average).toBeCloseTo(40 / 3);
    expect(report.periods!.daily[1].audience!.A).toMatchObject({ average: 40, peak: 50, sampleCount: 2 });
    expect(report.periods!.total.audience!.A).toMatchObject({ average: 24, peak: 50, sampleCount: 5, pitch: { average: 35, peak: 50, sampleCount: 2 } });
    expect(report.periods!.weekly[0].audience!.A.average).toBe(24);
    expect(report.periods!.total.audience!.B).toMatchObject({ average: 40, peak: 40, sampleCount: 1, pitch: { average: 40, sampleCount: 1 } });
    expect(report.periods!.daily[4].audience!.A.average).toBeNull();
    expect(report.periods!.daily[4].state).toBe("UPCOMING");
  });

  it("does not expose the other owner's comparison or samples", async () => {
    await expect(getAbReport(other, experimentId, {}, now)).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("continues attributing the final day's purchases after collection ends, only for its 24 hours", async () => {
    const completed = await getAbReport(owner, experimentId, {}, new Date("2026-12-12T03:00:00Z"));
    expect(completed.variants[0]).toMatchObject({ assigned: 5, uniquePeople: 3, sales: 3, revenueCents: 6000 });
    expect(completed.periods!.daily[29].variants[0]).toMatchObject({ assigned: 1, sales: 1, revenueCents: 3000 });
    expect(completed.periods!.total.state).toBe("COMPLETE");
    expect(completed.integrity.unattributedSales).toBe(1);
  });
});
