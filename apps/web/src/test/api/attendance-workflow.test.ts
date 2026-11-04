import { beforeAll, beforeEach, afterEach, afterAll, expect, it, vi } from "vitest";
import { prisma } from "db";
import { attendanceRange } from "@/lib/attendance-range";
import { createChatMessage } from "@/server/chat-message";
import { processAiConversation } from "@/server/attendance/ai";
import { getAttendanceReport } from "@/server/attendance/report";

vi.mock("@/lib/attendant-session", () => ({ requireAttendant: async () => ({ user: { id: "workflow-attendant", role: "attendant" } }) }));
vi.mock("@/server/realtime/bus", () => ({ publishChatEvent: vi.fn(), publishConversationEvent: vi.fn() }));
vi.mock("@/lib/online", () => ({ getOnlineSnapshot: async () => ({ leadIds: new Set(), byWebinar: new Map() }) }));

const owner = "workflow-owner";
const webinarId = "workflow-webinar";
const leadId = "workflow-lead";
beforeAll(() => { expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/hotwebinar_test"); });
beforeEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [owner, "workflow-attendant"] } } });
  await prisma.user.createMany({ data: [
    { id: owner, name: "Owner", email: "workflow-owner@example.test", role: "admin" },
    { id: "workflow-attendant", name: "Ana", email: "workflow-attendant@example.test", role: "attendant" }
  ] });
  await prisma.webinar.create({ data: { id: webinarId, ownerId: owner, title: "Curso", chatAiEnabled: true, chatAiInstructions: "O curso oferece aulas gravadas. Dúvidas fora disso devem ir ao humano." } });
  await prisma.lead.create({ data: { id: leadId, webinarId, name: "Lead", email: "workflow-lead@example.test" } });
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [owner, "workflow-attendant"] } } });
  await prisma.$disconnect();
});
function request(body: unknown) { return new Request("http://localhost/api/attendant/control", { method: "POST", body: JSON.stringify(body) }); }
function answer() { return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Sim, há aulas gravadas." }] }] }), { status: 200 }); }

it("defaults to today in Brasília rather than the UTC day", () => {
  const range = attendanceRange(null, null, new Date("2026-11-03T02:30:00Z"));
  expect(range.from).toBe("2026-11-02");
  expect(range.gte.toISOString()).toBe("2026-11-02T03:00:00.000Z");
  expect(range.lt.toISOString()).toBe("2026-11-03T03:00:00.000Z");
  expect(() => attendanceRange("2026-02-30", "2026-03-01")).toThrow();
});
it("filters conversations by message activity, not registration date", async () => {
  await prisma.leadChatMessage.create({ data: { leadId, webinarId, text: "Ontem", createdAt: new Date("2026-11-02T10:00:00Z") } });
  const { GET } = await import("@/app/api/attendant/conversations/route");
  const today = await GET(new Request("http://localhost/api/attendant/conversations?webinarId=workflow-webinar&from=2026-11-03&to=2026-11-03"));
  expect((await today.json()).conversations).toHaveLength(0);
  await prisma.leadChatMessage.create({ data: { leadId, webinarId, text: "Hoje", createdAt: new Date("2026-11-03T03:00:00Z") } });
  const result = await GET(new Request("http://localhost/api/attendant/conversations?webinarId=workflow-webinar&from=2026-11-03&to=2026-11-03"));
  expect((await result.json()).conversations).toEqual([expect.objectContaining({ leadId, pending: true, lastText: "Hoje" })]);
});
it("publishes one AI reply even with concurrent workers", async () => {
  await createChatMessage({ leadId, webinarId, sender: "lead", text: "Tem gravação?" });
  const fetcher = vi.fn(async () => answer());
  vi.stubGlobal("fetch", fetcher);
  await Promise.all([processAiConversation(leadId), processAiConversation(leadId)]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const replies = await prisma.leadChatMessage.findMany({ where: { leadId, sender: "team" } });
  expect(replies).toHaveLength(1);
  expect(replies[0].aiAgentName).toBe("Assistente");
});
it("discards an in-flight AI reply after human takeover", async () => {
  await createChatMessage({ leadId, webinarId, sender: "lead", text: "Tem gravação?" });
  let release!: (value: Response) => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  vi.stubGlobal("fetch", vi.fn(() => { started(); return new Promise<Response>(resolve => { release = resolve; }); }));
  const job = processAiConversation(leadId);
  await ready;
  const { POST } = await import("@/app/api/attendant/control/route");
  expect((await POST(request({ leadId, action: "takeover" }))).status).toBe(200);
  release(answer());
  await job;
  expect(await prisma.leadChatMessage.count({ where: { leadId, sender: "team" } })).toBe(0);
  expect(await prisma.lead.findUnique({ where: { id: leadId } })).toMatchObject({ aiPaused: true, assignedAttendantId: "workflow-attendant" });
});
it("human replies pause AI and are attributed in the report", async () => {
  await createChatMessage({ leadId, webinarId, sender: "lead", text: "Ajuda" });
  await createChatMessage({ leadId, webinarId, sender: "team", text: "Olá", authorUserId: "workflow-attendant" });
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  expect(lead).toMatchObject({ aiPaused: true, aiPendingMessageId: null, assignedAttendantId: "workflow-attendant" });
  const report = await getAttendanceReport(owner, new Date(Date.now() - 60000), new Date(Date.now() + 60000));
  expect(report).toMatchObject({ total: 1, answered: 1, pending: 0, humanReplies: 1, aiReplies: 0 });
  expect(report.ranking).toEqual([expect.objectContaining({ name: "Ana", conversations: 1, replies: 1 })]);
});
it("keeps failed AI replies pending and exposes the failure", async () => {
  await createChatMessage({ leadId, webinarId, sender: "lead", text: "Tem gravação?" });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("error", { status: 500 })));
  await processAiConversation(leadId);
  expect(await prisma.lead.findUnique({ where: { id: leadId } })).toMatchObject({ aiError: "openai_http_500", aiAttempts: 1 });
  expect(await prisma.leadChatMessage.count({ where: { leadId, sender: "team" } })).toBe(0);
});
it("hands off when the spectator asks for a human", async () => {
  await createChatMessage({ leadId, webinarId, sender: "lead", text: "Quero falar com um atendente" });
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await processAiConversation(leadId);
  expect(fetcher).not.toHaveBeenCalled();
  expect(await prisma.lead.findUnique({ where: { id: leadId } })).toMatchObject({ aiPaused: true });
});

it("filters the complete final minute of a selected time range", async () => {
  const range = attendanceRange("2026-11-04", "2026-11-04", new Date(), { fromTime: "14:00", toTime: "16:00" });
  expect(range.gte.toISOString()).toBe("2026-11-04T17:00:00.000Z");
  expect(range.lt.toISOString()).toBe("2026-11-04T19:01:00.000Z");
  expect(() => attendanceRange("2026-11-04", "2026-11-04", new Date(), { fromTime: "17:00", toTime: "16:00" })).toThrow();
  expect(() => attendanceRange("2026-11-04", "2026-11-04", new Date(), { fromTime: "25:00" })).toThrow();
});

it("opens a shared conversation outside the date filter without changing the daily list", async () => {
  await prisma.leadChatMessage.create({ data: { leadId, webinarId, text: "Conversa antiga", createdAt: new Date("2026-10-01T10:00:00Z") } });
  const { GET } = await import("@/app/api/attendant/conversations/route");
  const range = `webinarId=${webinarId}&from=2026-11-04&to=2026-11-04`;
  const daily = await GET(new Request(`http://localhost/api/attendant/conversations?${range}`));
  expect((await daily.json()).conversations).toHaveLength(0);
  const linked = await GET(new Request(`http://localhost/api/attendant/conversations?${range}&leadId=${leadId}`));
  expect((await linked.json()).conversations).toEqual([expect.objectContaining({ leadId, leadName: "Lead", lastText: "Conversa antiga" })]);
  const missing = await GET(new Request("http://localhost/api/attendant/conversations?leadId=missing"));
  expect((await missing.json()).conversations).toHaveLength(0);
});
