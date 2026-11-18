import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRealtimeAttendants } from "@/server/attendance/realtime-attendants-v5";

const state = vi.hoisted(() => ({ presence: vi.fn(), sessions: vi.fn(), conversations: vi.fn() }));
vi.mock("@/server/realtime/staff-presence-v5", () => ({ readStaffPresence: state.presence }));
vi.mock("db", () => ({ prisma: { session: { findMany: state.sessions }, leadChatMessage: { groupBy: state.conversations } } }));
const from = new Date("2026-11-17T03:00:00Z");
const to = new Date("2026-11-17T18:00:00Z");
const args = { webinarId: "webinar-1", from, to };

beforeEach(() => { vi.clearAllMocks(); state.presence.mockResolvedValue(undefined); state.sessions.mockResolvedValue([]); state.conversations.mockResolvedValue([]); });

describe("realtime attendants from authenticated presence", () => {
  it("distinguishes unavailable coverage from an observed empty local team", async () => {
    expect(await getRealtimeAttendants(args)).toBeUndefined();
    expect(state.sessions).not.toHaveBeenCalled();
    state.presence.mockResolvedValue({ presenceSource: "local", leases: [] });
    expect(await getRealtimeAttendants(args)).toEqual({ from: from.toISOString(), to: to.toISOString(), presenceSource: "local", online: [] });
  });

  it("deduplicates multiple tabs/sessions and counts distinct conversations by their real author", async () => {
    state.presence.mockResolvedValue({ presenceSource: "local", leases: [
      { userId: "ana", sessionId: "s1", tabId: "t1" }, { userId: "ana", sessionId: "s1", tabId: "t2" },
      { userId: "ana", sessionId: "s2", tabId: "t3" }, { userId: "leo", sessionId: "s3", tabId: "t4" },
      { userId: "marina", sessionId: "s4", tabId: "t5" },
    ] });
    state.sessions.mockResolvedValue([
      { id: "s1", user: { id: "ana", name: "Ana", image: null } },
      { id: "s2", user: { id: "ana", name: "Ana", image: null } },
      { id: "s3", user: { id: "leo", name: "Leo", image: null } },
      { id: "s4", user: { id: "marina", name: "Marina", image: null } },
    ]);
    // Prisma groups each author/conversation pair once, even after many replies.
    state.conversations.mockResolvedValue([
      { authorUserId: "ana", leadId: "lead-1" }, { authorUserId: "ana", leadId: "lead-2" },
      { authorUserId: "leo", leadId: "lead-1" },
    ]);
    const result = await getRealtimeAttendants(args);
    expect(result?.online.map(user => [user.id, user.handledConversations])).toEqual([["ana", 2], ["leo", 1], ["marina", 0]]);
    expect(state.conversations).toHaveBeenCalledWith({ by: ["authorUserId", "leadId"], where: {
      webinarId: "webinar-1", sender: "team", aiAgentName: null, authorUserId: { in: ["ana", "leo", "marina"] }, createdAt: { gte: from, lte: to },
    } });
    expect(state.sessions.mock.calls[0][0].where).toMatchObject({ expiresAt: { gt: to }, user: { role: { in: ["admin", "attendant"] } } });
  });

  it("ignores revoked sessions and rejects cache identities that do not own the session", async () => {
    state.presence.mockResolvedValue({ presenceSource: "server", leases: [
      { userId: "forged", sessionId: "s1", tabId: "t1" }, { userId: "disabled", sessionId: "revoked", tabId: "t2" },
    ] });
    state.sessions.mockResolvedValue([{ id: "s1", user: { id: "real-user", name: "Real", image: null } }]);
    expect((await getRealtimeAttendants(args))?.online).toEqual([]);
    expect(state.conversations).not.toHaveBeenCalled();
  });
});
