import { randomUUID } from "node:crypto";
import { prisma, Prisma } from "db";
import {
  CHAT_INTELLIGENCE_VERSION, OBJECTION_CATEGORIES, QUESTION_CATEGORIES,
  type ChatInsightCategory, type ChatIntelligenceReport, type ChatIntelligenceBatchResult
} from "@/lib/dashboard-chat-intelligence";
import { ChatIntelligenceError, classifyChatMessages } from "./chat-intelligence-provider";
export { ChatIntelligenceError } from "./chat-intelligence-provider";

export interface ChatIntelligenceScope { webinarId: string; from: Date; to: Date }
const BATCH_SIZE = 25;
const BATCH_CHARACTERS = 16_000;
const LEASE_MS = 90_000;

function assertScope(ownerId: string, scope: ChatIntelligenceScope) {
  if (!ownerId || !scope.webinarId || scope.webinarId.length > 128 ||
      !Number.isFinite(scope.from.getTime()) || !Number.isFinite(scope.to.getTime()) || scope.from > scope.to) {
    throw new ChatIntelligenceError("invalid_input", 400);
  }
}
async function ownedWebinar(ownerId: string, scope: ChatIntelligenceScope) {
  assertScope(ownerId, scope);
  const webinar = await prisma.webinar.findFirst({
    where: { id: scope.webinarId, ownerId },
    select: { id: true, title: true, chatAiModel: true, chatInsightLeaseToken: true, chatInsightLeaseUntil: true }
  });
  if (!webinar) throw new ChatIntelligenceError("not_found", 404);
  return webinar;
}
const messageScope = (ownerId: string, scope: ChatIntelligenceScope) => ({
  webinarId: scope.webinarId, webinar: { ownerId }, sender: "lead", createdAt: { gte: scope.from, lte: scope.to }
});

interface TotalsRow {
  totalMessages: number; analyzedMessages: number; objectionMessages: number; questionMessages: number;
  neutralMessages: number; lastAnalyzedAt: Date | null;
}
interface CategoryRow { kind: string; category: string; messageCount: number; conversationCount: number }
interface ExampleRow { kind: string; category: string; id: string; leadId: string; text: string; createdAt: Date }

/** Aggregates in PostgreSQL: totals never depend on a display/sample limit. */
export async function getChatIntelligenceReport(ownerId: string, scope: ChatIntelligenceScope): Promise<ChatIntelligenceReport> {
  const webinar = await ownedWebinar(ownerId, scope);
  const currentAnalysis = Prisma.sql`a."version" = ${CHAT_INTELLIGENCE_VERSION} AND a."model" = ${webinar.chatAiModel}`;
  const scopeSql = Prisma.sql`w."ownerId" = ${ownerId} AND m."webinarId" = ${scope.webinarId}
    AND m."sender" = 'lead' AND m."createdAt" >= ${scope.from} AND m."createdAt" <= ${scope.to}`;
  const classified = Prisma.sql`SELECT m."id", m."leadId", m."text", m."createdAt", a."objections", a."questions"
    FROM "lead_chat_message" m JOIN "webinar" w ON w."id" = m."webinarId"
    JOIN "lead_chat_message_analysis" a ON a."messageId" = m."id" AND ${currentAnalysis}
    WHERE ${scopeSql}`;
  const expanded = Prisma.sql`SELECT c.*, 'objection' AS kind, unnest(c."objections") AS category FROM classified c
    UNION ALL SELECT c.*, 'question' AS kind, unnest(c."questions") AS category FROM classified c`;
  const [totalsRows, categories, examples] = await prisma.$transaction([
    prisma.$queryRaw<TotalsRow[]>(Prisma.sql`
      SELECT COUNT(m."id")::int AS "totalMessages", COUNT(a."messageId")::int AS "analyzedMessages",
        COUNT(*) FILTER (WHERE cardinality(a."objections") > 0)::int AS "objectionMessages",
        COUNT(*) FILTER (WHERE cardinality(a."questions") > 0)::int AS "questionMessages",
        COUNT(*) FILTER (WHERE cardinality(a."objections") = 0 AND cardinality(a."questions") = 0)::int AS "neutralMessages",
        MAX(a."analyzedAt") AS "lastAnalyzedAt"
      FROM "lead_chat_message" m JOIN "webinar" w ON w."id" = m."webinarId"
      LEFT JOIN "lead_chat_message_analysis" a ON a."messageId" = m."id" AND ${currentAnalysis}
      WHERE ${scopeSql}`),
    prisma.$queryRaw<CategoryRow[]>(Prisma.sql`
      WITH classified AS (${classified}), expanded AS (${expanded})
      SELECT kind, category, COUNT(DISTINCT "id")::int AS "messageCount", COUNT(DISTINCT "leadId")::int AS "conversationCount"
      FROM expanded GROUP BY kind, category`),
    prisma.$queryRaw<ExampleRow[]>(Prisma.sql`
      WITH classified AS (${classified}), expanded AS (${expanded}), ranked AS (
        SELECT kind, category, "id", "leadId", "text", "createdAt",
          ROW_NUMBER() OVER (PARTITION BY kind, category ORDER BY "createdAt" DESC, "id" DESC) AS rank
        FROM expanded
      ) SELECT kind, category, "id", "leadId", "text", "createdAt" FROM ranked WHERE rank <= 5
        ORDER BY kind, category, "createdAt" DESC, "id" DESC`)
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const totals = totalsRows[0] ?? { totalMessages: 0, analyzedMessages: 0, objectionMessages: 0, questionMessages: 0, neutralMessages: 0, lastAnalyzedAt: null };
  const rows = (kind: string, taxonomy: readonly { id: string; label: string; guidance: string }[], base: number): ChatInsightCategory[] => taxonomy.flatMap((category) => {
    const counts = categories.find((row) => row.kind === kind && row.category === category.id);
    if (!counts?.messageCount) return [];
    return [{ ...category, messageCount: counts.messageCount, conversationCount: counts.conversationCount,
      percentage: base ? Math.round(counts.messageCount / base * 1000) / 10 : 0,
      examples: examples.filter((row) => row.kind === kind && row.category === category.id).slice(0, 5)
        .map((row) => ({ id: row.id, leadId: row.leadId, text: row.text, createdAt: row.createdAt.toISOString() }))
    }];
  }).sort((a, b) => b.messageCount - a.messageCount || a.label.localeCompare(b.label, "pt-BR"));
  return {
    webinarId: scope.webinarId, providerReady: Boolean(process.env.OPENAI_API_KEY),
    isProcessing: Boolean(webinar.chatInsightLeaseToken && webinar.chatInsightLeaseUntil && webinar.chatInsightLeaseUntil > new Date()),
    ...totals, pendingMessages: Math.max(0, totals.totalMessages - totals.analyzedMessages),
    lastAnalyzedAt: totals.lastAnalyzedAt?.toISOString() ?? null,
    objections: rows("objection", OBJECTION_CATEGORIES, totals.objectionMessages),
    questions: rows("question", QUESTION_CATEGORIES, totals.questionMessages)
  };
}

export async function processChatIntelligenceBatch(ownerId: string, scope: ChatIntelligenceScope): Promise<ChatIntelligenceBatchResult> {
  const webinar = await ownedWebinar(ownerId, scope);
  if (!process.env.OPENAI_API_KEY) throw new ChatIntelligenceError("provider_missing", 409);
  const token = randomUUID();
  const now = new Date();
  const claimed = await prisma.webinar.updateMany({
    where: { id: webinar.id, ownerId, OR: [{ chatInsightLeaseUntil: null }, { chatInsightLeaseUntil: { lte: now } }] },
    data: { chatInsightLeaseToken: token, chatInsightLeaseUntil: new Date(now.getTime() + LEASE_MS) }
  });
  if (!claimed.count) return { processedMessages: 0, busy: true, report: await getChatIntelligenceReport(ownerId, scope) };
  let processedMessages = 0;
  try {
    const candidates = await prisma.leadChatMessage.findMany({
      where: { ...messageScope(ownerId, scope), OR: [
        { analysis: { is: null } },
        { analysis: { is: { OR: [{ version: { not: CHAT_INTELLIGENCE_VERSION } }, { model: { not: webinar.chatAiModel } }] } } }
      ] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: BATCH_SIZE,
      select: { id: true, text: true }
    });
    const batch: typeof candidates = [];
    let characters = 0;
    for (const message of candidates) {
      // An unusually long historical message is processed intact on its own.
      if (batch.length && characters + message.text.length > BATCH_CHARACTERS) break;
      batch.push(message);
      characters += message.text.length;
    }
    if (batch.length) {
      const classified = await classifyChatMessages(webinar.chatAiModel, webinar.title, batch);
      processedMessages = await prisma.$transaction(async (tx) => {
        // The guarded write locks the webinar row until all classifications commit.
        const guard = await tx.webinar.updateMany({
          where: { id: webinar.id, ownerId, chatAiModel: webinar.chatAiModel, chatInsightLeaseToken: token, chatInsightLeaseUntil: { gt: new Date() } },
          data: { chatInsightLeaseUntil: new Date(Date.now() + LEASE_MS) }
        });
        if (!guard.count) throw new ChatIntelligenceError("analysis_changed", 409);
        for (const row of classified) {
          const data = { version: CHAT_INTELLIGENCE_VERSION, model: webinar.chatAiModel, objections: row.objections, questions: row.questions, analyzedAt: new Date() };
          await tx.leadChatMessageAnalysis.upsert({ where: { messageId: row.id }, create: { messageId: row.id, ...data }, update: data });
        }
        return classified.length;
      });
    }
  } finally {
    // A stale request can never release a lease acquired by a newer worker.
    await prisma.webinar.updateMany({ where: { id: webinar.id, ownerId, chatInsightLeaseToken: token }, data: { chatInsightLeaseToken: null, chatInsightLeaseUntil: null } });
  }
  return { processedMessages, busy: false, report: await getChatIntelligenceReport(ownerId, scope) };
}
