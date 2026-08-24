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
  it("replaces optimistic tmp id when server id arrives with same text", () => {
    const prev = [m("tmp-1", "lead", "2026-01-01T00:00:00Z")];
    const incoming = [{ ...m("real-1", "lead", "2026-01-01T00:00:00Z"), text: "tmp-1" }];
    const out = mergeLeadMessages(prev, incoming);
    expect(out.some((x) => x.id === "tmp-1")).toBe(false);
    expect(out.some((x) => x.id === "real-1")).toBe(true);
  });
});
