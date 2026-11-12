import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAT_INTELLIGENCE_VERSION } from "@/lib/dashboard-chat-intelligence";

const queries = vi.hoisted(() => ({ owned: vi.fn(), lease: vi.fn(), messages: vi.fn(), raw: vi.fn(), tx: vi.fn(), upsert: vi.fn(), classify: vi.fn() }));
vi.mock("db", async () => {
  const original = await vi.importActual<typeof import("db")>("db");
  return { Prisma: original.Prisma, prisma: {
    webinar: { findFirst: queries.owned, updateMany: queries.lease }, leadChatMessage: { findMany: queries.messages },
    leadChatMessageAnalysis: { upsert: queries.upsert }, $queryRaw: queries.raw, $transaction: queries.tx
  } };
});
vi.mock("@/server/dashboard/chat-intelligence-provider", async () => {
  const original = await vi.importActual<typeof import("@/server/dashboard/chat-intelligence-provider")>("@/server/dashboard/chat-intelligence-provider");
  return { ...original, classifyChatMessages: queries.classify };
});
import { getChatIntelligenceReport, processChatIntelligenceBatch } from "@/server/dashboard/chat-intelligence";

const now = new Date("2026-11-11T12:00:00Z");
const scope = { webinarId: "selected", from: new Date("2026-11-01T03:00:00Z"), to: new Date("2026-11-11T02:59:59.999Z") };
const webinar = { id: "selected", ownerId: "owner", title: "Aula", chatAiModel: "configured-model", chatInsightLeaseToken: null, chatInsightLeaseUntil: null };
const emptyTotals = { totalMessages: 0, analyzedMessages: 0, objectionMessages: 0, questionMessages: 0, neutralMessages: 0, lastAnalyzedAt: null };

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
  Object.values(queries).forEach((query) => query.mockReset());
  queries.owned.mockResolvedValue(webinar);
  queries.lease.mockResolvedValue({ count: 1 });
  queries.messages.mockResolvedValue([]);
  queries.upsert.mockResolvedValue({});
  queries.raw.mockImplementation(async (query) => query.sql.includes('AS "totalMessages"') ? [emptyTotals] : []);
  queries.tx.mockImplementation(async (fn) => Array.isArray(fn) ? Promise.all(fn) : fn({ webinar: { updateMany: queries.lease }, leadChatMessageAnalysis: { upsert: queries.upsert } }));
  queries.classify.mockImplementation(async (_model, _title, messages) => messages.map((message: { id: string }) => ({ id: message.id, objections: [], questions: ["price"] })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("dashboard chat intelligence", () => {
  it("requires an owned webinar before reading messages, aggregates or leasing", async () => {
    queries.owned.mockResolvedValue(null);
    await expect(getChatIntelligenceReport({ id: "owner" }, scope)).rejects.toMatchObject({ code: "not_found", status: 404 });
    await expect(processChatIntelligenceBatch({ id: "owner" }, scope)).rejects.toMatchObject({ code: "not_found" });
    expect(queries.owned).toHaveBeenCalledWith({ where: { id: "selected", ownerId: "owner" }, select: {
      id: true, ownerId: true, title: true, chatInsightLeaseToken: true, chatInsightLeaseUntil: true
    } });
    expect(queries.raw).not.toHaveBeenCalled(); expect(queries.messages).not.toHaveBeenCalled(); expect(queries.lease).not.toHaveBeenCalled();
  });
  it("rejects invalid ranges/owners before queries", async () => {
    await expect(getChatIntelligenceReport({ id: "" }, scope)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(processChatIntelligenceBatch({ id: "owner" }, { ...scope, from: new Date("invalid") })).rejects.toMatchObject({ code: "invalid_input" });
    await expect(getChatIntelligenceReport({ id: "owner" }, { ...scope, from: scope.to, to: scope.from })).rejects.toMatchObject({ code: "invalid_input" });
    expect(queries.owned).not.toHaveBeenCalled();
  });
  it("scopes every aggregate to owner/webinar/sender/range and current classification version/model", async () => {
    const report = await getChatIntelligenceReport({ id: "owner" }, scope);
    expect(report).toMatchObject({ providerReady: true, isProcessing: false, totalMessages: 0, pendingMessages: 0, objections: [], questions: [] });
    expect(queries.classify).not.toHaveBeenCalled();
    expect(queries.tx).toHaveBeenCalledWith(expect.any(Array), { isolationLevel: "RepeatableRead" });
    for (const [query] of queries.raw.mock.calls) {
      expect(query.values).toEqual(expect.arrayContaining(["owner", "selected", scope.from, scope.to, CHAT_INTELLIGENCE_VERSION, "gpt-5.4-mini"]));
      expect(query.values).not.toContain("configured-model");
      expect(query.sql).toContain('m."sender" = \'lead\'');
      expect(query.sql).toContain('"lead_chat_message_analysis"');
    }
    expect(queries.raw.mock.calls.find(([q]) => q.sql.includes("ROW_NUMBER"))![0].sql).toContain("rank <= 5");
    expect(queries.raw.mock.calls.find(([q]) => q.sql.includes("GROUP BY"))![0].sql).toContain('COUNT(DISTINCT "leadId")');
  });
  it("uses distinct messages of each kind as denominator and preserves literal examples", async () => {
    queries.raw.mockImplementation(async (query) => {
      if (query.sql.includes('AS "totalMessages"')) return [{ totalMessages: 12, analyzedMessages: 10, objectionMessages: 4, questionMessages: 6, neutralMessages: 2, lastAnalyzedAt: now }];
      if (query.sql.includes("GROUP BY")) return [
        { kind: "objection", category: "price", messageCount: 3, conversationCount: 2 },
        { kind: "objection", category: "time", messageCount: 2, conversationCount: 2 },
        { kind: "question", category: "price", messageCount: 3, conversationCount: 2 }
      ];
      return [{ kind: "objection", category: "price", id: "message", leadId: "lead", text: "Tá caro 😕 <script>", createdAt: scope.from }];
    });
    const report = await getChatIntelligenceReport({ id: "owner" }, scope);
    expect(report.pendingMessages).toBe(2);
    expect(report.objections.map((row) => row.percentage)).toEqual([75, 50]);
    expect(report.questions[0].percentage).toBe(50);
    expect(report.objections[0].examples).toEqual([{ id: "message", leadId: "lead", text: "Tá caro 😕 <script>", createdAt: scope.from.toISOString() }]);
    expect(report.lastAnalyzedAt).toBe(now.toISOString());
  });
  it("returns provider readiness without generating or hiding cached reports", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await getChatIntelligenceReport({ id: "owner" }, scope)).providerReady).toBe(false);
    await expect(processChatIntelligenceBatch({ id: "owner" }, scope)).rejects.toMatchObject({ code: "provider_missing" });
    expect(queries.lease).not.toHaveBeenCalled(); expect(queries.classify).not.toHaveBeenCalled();
  });
  it("returns busy without another provider call when a lease already exists", async () => {
    queries.lease.mockResolvedValue({ count: 0 });
    queries.owned.mockResolvedValue({ ...webinar, chatInsightLeaseToken: "other", chatInsightLeaseUntil: new Date(now.getTime() + 50_000) });
    expect(await processChatIntelligenceBatch({ id: "owner" }, scope)).toMatchObject({ busy: true, processedMessages: 0, report: { isProcessing: true } });
    expect(queries.classify).not.toHaveBeenCalled(); expect(queries.messages).not.toHaveBeenCalled();
    expect(queries.lease).toHaveBeenCalledTimes(1);
  });
  it("claims stale leases, processes only current pending messages and releases its token", async () => {
    queries.messages.mockResolvedValue([{ id: "m", text: "Qual o preço?" }]);
    const result = await processChatIntelligenceBatch({ id: "owner" }, scope);
    expect(result).toMatchObject({ processedMessages: 1, busy: false });
    const claim = queries.lease.mock.calls[0][0];
    expect(claim.where).toEqual({ id: "selected", ownerId: "owner", OR: [{ chatInsightLeaseUntil: null }, { chatInsightLeaseUntil: { lte: now } }] });
    expect(claim.data.chatInsightLeaseUntil).toEqual(new Date(now.getTime() + 120_000));
    expect(queries.messages.mock.calls[0][0]).toMatchObject({
      where: { webinarId: "selected", webinar: { ownerId: "owner" }, sender: "lead", createdAt: { gte: scope.from, lte: scope.to }, OR: [
        { analysis: { is: null } }, { analysis: { is: { OR: [{ version: { not: CHAT_INTELLIGENCE_VERSION } }, { model: { not: "gpt-5.4-mini" } }] } } }
      ] }, take: 500, orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    expect(queries.classify).toHaveBeenCalledWith("gpt-5.4-mini", "Aula", [{ id: "m", text: "Qual o preço?" }]);
    const classification = { version: CHAT_INTELLIGENCE_VERSION, model: "gpt-5.4-mini", objections: [], questions: ["price"], analyzedAt: now };
    expect(queries.upsert.mock.calls[0][0]).toEqual({ where: { messageId: "m" }, create: { messageId: "m", ...classification }, update: classification });
    expect(queries.tx).toHaveBeenCalledWith(expect.any(Function), { timeout: 20_000 });
    expect(queries.lease.mock.calls.at(-1)![0]).toEqual({ where: { id: "selected", ownerId: "owner", chatInsightLeaseToken: claim.data.chatInsightLeaseToken }, data: { chatInsightLeaseToken: null, chatInsightLeaseUntil: null } });
  });
  it("advances through all batches without classifying persisted messages twice", async () => {
    const all = Array.from({ length: 1003 }, (_, index) => ({ id: `m${index}`, text: "Qual é o preço?" }));
    const saved = new Set<string>();
    queries.messages.mockImplementation(async ({ take }) => all.filter((message) => !saved.has(message.id)).slice(0, take));
    queries.upsert.mockImplementation(async ({ where }) => { saved.add(where.messageId); });
    const processed = [];
    for (let i = 0; i < 4; i++) processed.push((await processChatIntelligenceBatch({ id: "owner" }, scope)).processedMessages);
    expect(processed).toEqual([500, 500, 3, 0]);
    expect(saved.size).toBe(1003); expect(queries.upsert).toHaveBeenCalledTimes(1003); expect(queries.classify).toHaveBeenCalledTimes(3);
  });
  it("stops at the character budget before taking another complete message", async () => {
    const messages = [{ id: "first", text: "a".repeat(40_000) }, { id: "second", text: "b".repeat(24_000) }, { id: "next", text: "?" }];
    queries.messages.mockResolvedValue(messages);
    expect((await processChatIntelligenceBatch({ id: "owner" }, scope)).processedMessages).toBe(2);
    expect(queries.classify).toHaveBeenCalledWith("gpt-5.4-mini", "Aula", messages.slice(0, 2));
    expect(queries.upsert.mock.calls.map(([call]) => call.where.messageId)).toEqual(["first", "second"]);
  });
  it("reduces batch size by text budget without truncating a long message", async () => {
    const long = "x".repeat(65_000);
    queries.messages.mockResolvedValue([{ id: "long", text: long }, { id: "next", text: "Qual o valor?" }]);
    expect((await processChatIntelligenceBatch({ id: "owner" }, scope)).processedMessages).toBe(1);
    expect(queries.classify).toHaveBeenCalledWith("gpt-5.4-mini", "Aula", [{ id: "long", text: long }]);
  });
  it("releases the lock on failure and retries a whole batch without partial writes", async () => {
    queries.messages.mockResolvedValue([{ id: "m", text: "Oi" }]);
    queries.classify.mockRejectedValueOnce(new Error("provider failure"));
    await expect(processChatIntelligenceBatch({ id: "owner" }, scope)).rejects.toThrow("provider failure");
    expect(queries.upsert).not.toHaveBeenCalled();
    expect(queries.lease.mock.calls.at(-1)![0].data.chatInsightLeaseToken).toBeNull();
    expect((await processChatIntelligenceBatch({ id: "owner" }, scope)).processedMessages).toBe(1);
  });
  it("does not persist output when owner/lease changed while the provider ran", async () => {
    queries.messages.mockResolvedValue([{ id: "m", text: "Oi" }]);
    queries.lease.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });
    await expect(processChatIntelligenceBatch({ id: "owner" }, scope)).rejects.toMatchObject({ code: "analysis_changed" });
    expect(queries.upsert).not.toHaveBeenCalled();
    expect(queries.lease.mock.calls[1][0].where).toEqual({ id: "selected", ownerId: "owner", chatInsightLeaseToken: queries.lease.mock.calls[0][0].data.chatInsightLeaseToken, chatInsightLeaseUntil: { gt: now } });
  });
  it("keeps the analytics model and valid lease when live-chat configuration changes", async () => {
    const changingWebinar = { ...webinar };
    queries.owned.mockResolvedValue(changingWebinar);
    queries.messages.mockResolvedValue([{ id: "m", text: "Qual o preço?" }]);
    queries.classify.mockImplementation(async () => {
      changingWebinar.chatAiModel = "a-different-live-chat-model";
      return [{ id: "m", objections: [], questions: ["price"] }];
    });
    expect((await processChatIntelligenceBatch({ id: "owner" }, scope)).processedMessages).toBe(1);
    expect(queries.classify).toHaveBeenCalledWith("gpt-5.4-mini", "Aula", expect.any(Array));
    expect(queries.upsert.mock.calls[0][0]).toMatchObject({ create: { model: "gpt-5.4-mini" }, update: { model: "gpt-5.4-mini" } });
    for (const [update] of queries.lease.mock.calls) {
      expect(update.where).not.toHaveProperty("chatAiModel");
      expect(update.data).not.toHaveProperty("chatAiModel");
    }
    for (const [query] of queries.raw.mock.calls) expect(query.values).not.toContain("a-different-live-chat-model");
  });

  it("lets an admin analyze a webinar created by someone else, keeping the real owner in every query", async () => {
    const result = await processChatIntelligenceBatch({ id: "admin", role: "admin" }, scope);
    expect(result.busy).toBe(false);
    expect(queries.owned.mock.calls[0][0].where).toEqual({ id: "selected" });
    expect(queries.lease.mock.calls[0][0].where).toMatchObject({ id: "selected", ownerId: "owner" });
    expect(queries.messages.mock.calls[0][0].where).toMatchObject({ webinar: { ownerId: "owner" } });
    queries.owned.mockClear();
    await getChatIntelligenceReport({ id: "attendant", role: "attendant" }, scope);
    expect(queries.owned.mock.calls[0][0].where).toEqual({ id: "selected", ownerId: "attendant" });
  });
});
