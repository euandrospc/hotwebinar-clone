/** Shared wire types. Keep this module free of server dependencies. */
export type RealtimeScope =
  | { kind: "lead"; clientKey?: string }
  | { kind: "staff" }
  | { kind: "webinar"; webinarId: string }
  | { kind: "dashboard" };

export interface RealtimeChatMessage {
  id: string;
  text: string;
  sender: "lead" | "team";
  teamName: string | null;
  videoSec: number | null;
  createdAt: string;
  clientMessageId?: string | null;
}

export type RealtimeEvent =
  | { type: "chat"; webinarId: string; leadId: string; message: RealtimeChatMessage }
  | { type: "presence"; webinarId: string }
  | { type: "resync" };

export type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "fallback";
