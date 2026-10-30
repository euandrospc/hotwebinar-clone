import { prisma, type Prisma } from "db";
import type { RealtimeChatMessage } from "@/lib/realtime-protocol";
import { publishChatEvent } from "@/server/realtime/bus";

export const chatMessageSelect = {
  id: true,
  text: true,
  sender: true,
  authorUserId: true,
  videoSec: true,
  createdAt: true,
  clientMessageId: true,
  authorUser: { select: { name: true } }
} satisfies Prisma.LeadChatMessageSelect;

type MessageRow = Prisma.LeadChatMessageGetPayload<{ select: typeof chatMessageSelect }>;

export function serializeChatMessage(message: MessageRow): RealtimeChatMessage {
  return {
    id: message.id,
    text: message.text,
    sender: message.sender === "team" ? "team" : "lead",
    teamName: message.authorUser?.name ?? null,
    videoSec: message.videoSec,
    createdAt: message.createdAt.toISOString(),
    clientMessageId: message.clientMessageId
  };
}

export class ChatIdempotencyConflict extends Error {
  constructor() {
    super("client_message_id_conflict");
  }
}

interface CreateChatMessageInput {
  leadId: string;
  webinarId: string;
  text: string;
  sender: "lead" | "team";
  authorUserId?: string;
  videoSec?: number;
  clientMessageId?: string;
}

function checkRetry(message: MessageRow, input: CreateChatMessageInput) {
  if (
    message.sender !== input.sender ||
    message.authorUserId !== (input.authorUserId ?? null) ||
    message.text !== input.text
  ) {
    throw new ChatIdempotencyConflict();
  }
  return { message: serializeChatMessage(message), created: false };
}

// Callers authenticate the author and resolve the lead's webinar before this
// function. A UUID identifies one send intent, including retries after timeout.
export async function createChatMessage(input: CreateChatMessageInput) {
  const existingWhere = input.clientMessageId
    ? { leadId_clientMessageId: { leadId: input.leadId, clientMessageId: input.clientMessageId } }
    : null;

  if (existingWhere) {
    const existing = await prisma.leadChatMessage.findUnique({ where: existingWhere, select: chatMessageSelect });
    if (existing) return checkRetry(existing, input);
  }

  let row: MessageRow;
  try {
    row = await prisma.leadChatMessage.create({ data: input, select: chatMessageSelect });
  } catch (error) {
    // A concurrent request may have inserted the same UUID after our read.
    if (existingWhere && typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const existing = await prisma.leadChatMessage.findUnique({ where: existingWhere, select: chatMessageSelect });
      if (existing) return checkRetry(existing, input);
    }
    throw error;
  }

  const message = serializeChatMessage(row);
  try {
    await publishChatEvent({ leadId: input.leadId, webinarId: input.webinarId, message });
  } catch {
    // Delivery may temporarily fail, but the committed message is recoverable
    // through GET. Returning a write error here would cause needless retries.
  }
  return { message, created: true };
}

export async function getChatMessages(leadId: string, after: string | null) {
  const cursor = after
    ? await prisma.leadChatMessage.findFirst({ where: { id: after, leadId }, select: { createdAt: true } })
    : null;

  const rows = await prisma.leadChatMessage.findMany({
    // Overlap the cursor timestamp. Distinct messages can have identical
    // timestamps; callers deduplicate IDs instead of losing simultaneous sends.
    where: { leadId, ...(cursor ? { createdAt: { gte: cursor.createdAt } } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: chatMessageSelect
  });
  return rows.map(serializeChatMessage);
}
