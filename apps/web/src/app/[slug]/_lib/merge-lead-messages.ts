import type { PlayerLeadMsg } from "./public-types";

export function mergeLeadMessages(prev: PlayerLeadMsg[], incoming: PlayerLeadMsg[]): PlayerLeadMsg[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const msg of incoming) {
    const optimistic = [...byId.values()].find((x) => x.id.startsWith("tmp-") && x.text === msg.text && x.sender === msg.sender);
    if (optimistic) byId.delete(optimistic.id);
    byId.set(msg.id, msg);
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
