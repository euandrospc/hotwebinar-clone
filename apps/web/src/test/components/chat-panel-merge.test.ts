import { describe, it, expect } from "vitest";
import { mergeLeadMessages } from "@/app/[slug]/_lib/merge-lead-messages";

const m = (id: string, sender: "lead" | "team", createdAt: string) => ({ id, text: id, sender, videoSec: 0, createdAt });

describe("mergeLeadMessages", () => {
  it("appends new ids and dedups existing", () => {
    const prev = [m("a", "lead", "2026-01-01T00:00:00Z")];
    const incoming = [m("a", "lead", "2026-01-01T00:00:00Z"), m("b", "team", "2026-01-01T00:00:01Z")];
    const out = mergeLeadMessages(prev, incoming);
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("replaces an optimistic id by its request id even when the server normalizes the text", () => {
    const prev = [{ ...m("tmp-1", "lead", "2026-01-01T00:00:00Z"), clientMessageId: "request-1" }];
    const incoming = [{ ...m("real-1", "lead", "2026-01-01T00:00:00Z"), clientMessageId: "request-1", text: "Normalized" }];
    const out = mergeLeadMessages(prev, incoming);
    expect(out.some((x) => x.id === "tmp-1")).toBe(false);
    expect(out.some((x) => x.id === "real-1")).toBe(true);
  });
  it("keeps identical consecutive messages with different request ids", () => {
    const previous = [{ ...m("tmp-1", "lead", "2026-01-01T00:00:00Z"), text: "Olá", clientMessageId: "request-1" }];
    const incoming = [{ ...m("real-2", "lead", "2026-01-01T00:00:00Z"), text: "Olá", clientMessageId: "request-2" }];
    expect(mergeLeadMessages(previous, incoming)).toHaveLength(2);
  });
  it("does not reintroduce a provisional retry after its acknowledgement arrived", () => {
    const existing = { ...m("real-1", "lead", "2026-01-01T00:00:00Z"), clientMessageId: "request-1" };
    expect(mergeLeadMessages([existing], [{ ...existing, id: "tmp-1" }]).map((message) => message.id)).toEqual(["real-1"]);
  });
  it("preserves a reply's first displayed video position on resync", () => {
    const existing = { ...m("reply", "team", "2026-01-01T00:00:00Z"), videoSec: 45 };
    expect(mergeLeadMessages([existing], [{ ...existing, videoSec: 90 }])[0].videoSec).toBe(45);
  });
});
