import type { PlayerLeadMsg } from "./public-types";

export function mergeLeadMessages(prev: PlayerLeadMsg[], incoming: PlayerLeadMsg[]): PlayerLeadMsg[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const msg of incoming) {
    if (msg.id.startsWith("tmp-") && msg.clientMessageId && [...byId.values()].some((message) =>
      message.clientMessageId === msg.clientMessageId && !message.id.startsWith("tmp-")
    )) continue;
    const existing = byId.get(msg.id);
    const optimistic = msg.clientMessageId
      ? [...byId.values()].find((x) => x.id.startsWith("tmp-") && x.clientMessageId === msg.clientMessageId)
      : undefined;
    if (optimistic && !msg.id.startsWith("tmp-")) byId.delete(optimistic.id);
    // Resynchronizing a team reply must keep the position where it first appeared.
    byId.set(msg.id, { ...msg, videoSec: existing?.videoSec ?? optimistic?.videoSec ?? msg.videoSec });
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
