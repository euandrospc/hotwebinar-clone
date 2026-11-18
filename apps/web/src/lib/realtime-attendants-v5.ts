import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

export interface RealtimeAttendantsV5Data {
  available: boolean;
  from: string | null;
  to: string | null;
  presenceSource: "local" | "server" | null;
  items: Array<{ id: string; name: string; image: string | null; handledConversations: number }>;
}

/** Missing presence is not an empty online team, and chat replies do not prove presence. */
export function buildRealtimeAttendantsV5(snapshot: WebinarRealtimeSnapshot | null): RealtimeAttendantsV5Data {
  const unavailable: RealtimeAttendantsV5Data = { available: false, from: null, to: null, presenceSource: null, items: [] };
  const attendants = snapshot?.attendants;
  if (!attendants || !Array.isArray(attendants.online)) return unavailable;
  const start = Date.parse(attendants.from);
  const end = Date.parse(attendants.to);
  const cutoff = Date.parse(snapshot!.updatedAt);
  if (![start, end, cutoff].every(Number.isFinite) || start > end || end > cutoff) return unavailable;
  const ids = new Set<string>();
  for (const person of attendants.online) {
    if (!person || typeof person.id !== "string" || !person.id.trim() || ids.has(person.id)
      || typeof person.name !== "string" || !person.name.trim()
      || !Number.isSafeInteger(person.handledConversations) || person.handledConversations < 0) return unavailable;
    ids.add(person.id);
  }
  return {
    available: true,
    from: attendants.from,
    to: attendants.to,
    presenceSource: attendants.presenceSource === "local" || attendants.presenceSource === "server" ? attendants.presenceSource : null,
    items: attendants.online.map(person => ({ ...person, name: person.name.trim() }))
      .sort((a, b) => b.handledConversations - a.handledConversations || a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id)),
  };
}
