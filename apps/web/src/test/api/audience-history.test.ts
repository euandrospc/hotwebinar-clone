import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { prisma } from "db";
import { recordAudienceSample, getAudienceSummary } from "@/server/audience-history";
const state = vi.hoisted(() => ({ online: 3 }));
vi.mock("@/lib/online", () => ({ getOnlineSnapshot: async () => ({ byWebinar: new Map([["audience-history-webinar", state.online]]), leadIds: new Set() }) }));
vi.mock("@/server/realtime/bus", () => ({ publishPresenceEvent: vi.fn(async () => {}) }));
const owner = "audience-history-owner";
const webinarId = "audience-history-webinar";
const start = new Date("2026-11-04T18:00:00Z");
beforeAll(() => { expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/hotwebinar_test"); });
beforeEach(async () => {
  await prisma.user.deleteMany({ where: { id: owner } });
  await prisma.user.create({ data: { id: owner, email: "audience-history@example.test", name: "Test" } });
  await prisma.webinar.create({ data: {
    id: webinarId, ownerId: owner, status: "ACTIVE", mode: "UNICO", startDate: start,
    endDate: new Date(start.getTime() + 3600000)
  } });
  state.online = 3;
});
afterAll(async () => { await prisma.user.deleteMany({ where: { id: owner } }); await prisma.$disconnect(); });
it("records automatically without a dashboard request and deduplicates concurrent collectors", async () => {
  await Promise.all([recordAudienceSample(start), recordAudienceSample(start)]);
  expect(await prisma.audienceSample.count({ where: { webinarId } })).toBe(1);
});
it("includes zero audience in the mean and persists the peak with its timestamp", async () => {
  await recordAudienceSample(start);
  state.online = 6;
  await recordAudienceSample(new Date(start.getTime() + 15000));
  state.online = 0;
  await recordAudienceSample(new Date(start.getTime() + 30000));
  const result = await getAudienceSummary(webinarId, start, new Date(start.getTime() + 60000));
  expect(result).toEqual({ average: 3, peak: 6, peakAt: new Date(start.getTime() + 15000).toISOString(), sampleCount: 3 });
  const later = await getAudienceSummary(webinarId, new Date(start.getTime() + 30000), new Date(start.getTime() + 60000));
  expect(later).toMatchObject({ average: 0, peak: 0, sampleCount: 1 });
});
it("does not invent historical measurements or sample before/after the webinar window", async () => {
  await recordAudienceSample(new Date(start.getTime() - 15000));
  await recordAudienceSample(new Date(start.getTime() + 3600000));
  expect(await getAudienceSummary(webinarId, new Date("2020-01-01"), new Date("2030-01-01"))).toEqual({
    average: null, peak: null, peakAt: null, sampleCount: 0
  });
});
