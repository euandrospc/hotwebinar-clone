import { describe, it, expect } from "vitest";
import { step6Schema } from "@/lib/validations/webinar";

describe("step6Schema teamChatName", () => {
  it("accepts a team chat name", () => {
    const r = step6Schema.safeParse({ messages: [], teamChatName: "Equipe" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.teamChatName).toBe("Equipe");
  });
  it("defaults/permits empty via fallback", () => {
    const r = step6Schema.safeParse({ messages: [], teamChatName: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.teamChatName).toBe("");
  });
  it("defaults when omitted", () => {
    const r = step6Schema.safeParse({ messages: [] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.teamChatName).toBe("Suporte");
  });
});
