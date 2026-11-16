import { describe, it, expect } from "vitest";
import { tagKirvanoLinks, leadIdFromUtm, tagAbKirvanoCheckout, tagLiveOrigin, liveDayTag } from "@/lib/kirvano-link";

describe("tagKirvanoLinks", () => {
  it("adds the lead tag and keeps existing UTMs", () => {
    const out = tagKirvanoLinks(
      "Segue o link: https://pay.kirvano.com/abc?utm_source=comercial&utm_medium=86a53kd75.",
      "L1"
    );
    expect(out).toBe(
      "Segue o link: https://pay.kirvano.com/abc?utm_source=comercial&utm_medium=86a53kd75&utm_content=lead_L1."
    );
  });

  it("does not overwrite an existing utm_content", () => {
    const t = "https://pay.kirvano.com/abc?utm_content=ad42";
    expect(tagKirvanoLinks(t, "L1")).toBe(t);
  });

  it("leaves other links and plain text alone", () => {
    const t = "veja https://youtube.com/x e responda";
    expect(tagKirvanoLinks(t, "L1")).toBe(t);
  });

  it("reads the lead back from utm_content", () => {
    expect(leadIdFromUtm("lead_L1")).toBe("L1");
    expect(leadIdFromUtm("120252")).toBeNull();
    expect(leadIdFromUtm("")).toBeNull();
  });
});

describe("experiment checkout attribution", () => {
  it("keeps campaign content and lets the webhook recover the precise lead", () => {
    const url = new URL(tagAbKirvanoCheckout("https://pay.kirvano.com/checkout?utm_content=creative-a&utm_source=meta", "lead-123"));
    expect(url.searchParams.get("utm_source")).toBe("meta");
    expect(url.searchParams.get("utm_content")).toBe("creative-a|hw_ab_lead=lead-123");
    expect(leadIdFromUtm(url.searchParams.get("utm_content"))).toBe("lead-123");
  });
  it("replaces only the old experiment suffix on a repeated render", () => {
    const tagged = tagAbKirvanoCheckout("https://pay.kirvano.com/x?utm_content=ad", "L1");
    const next = new URL(tagAbKirvanoCheckout(tagged, "L2"));
    expect(next.searchParams.get("utm_content")).toBe("ad|hw_ab_lead=L2");
    expect(leadIdFromUtm(next.searchParams.get("utm_content"))).toBe("L2");
  });
  it.each(["https://kirvano.com.evil.test/x", "https://fakekirvano.com/x", "https://checkout.example/x", "javascript:alert(1)", "invalid"])("does not tag an unrelated destination: %s", (link) => {
    expect(tagAbKirvanoCheckout(link, "L1")).toBe(link);
  });
});

describe("live origin UTMs", () => {
  const now = new Date("2026-11-17T01:30:00Z"); // 16/11 22:30 em São Paulo

  it("uses the São Paulo day", () => {
    expect(liveDayTag(now)).toBe("1611");
  });

  it("tags an untagged checkout with the room and the day", () => {
    const url = new URL(tagLiveOrigin("https://pay.kirvano.com/x", { slug: "aula-10h", leadId: "L1", now }));
    expect(url.searchParams.get("utm_source")).toBe("lives");
    expect(url.searchParams.get("utm_medium")).toBe("aula-10h");
    expect(url.searchParams.get("utm_campaign")).toBe("aula-10h-1611");
    expect(url.searchParams.get("utm_term")).toBe("aula-10h-1611");
    expect(leadIdFromUtm(url.searchParams.get("utm_content"))).toBe("L1");
  });

  it("keeps UTMs already in the link and still records the day in utm_term", () => {
    const url = new URL(tagLiveOrigin(
      "https://pay.kirvano.com/x?utm_source=comercial&utm_medium=tiago&utm_campaign=aula-claude-code&utm_content=oferta-497",
      { slug: "aula-15h", leadId: "L1", now }
    ));
    expect(url.searchParams.get("utm_source")).toBe("comercial");
    expect(url.searchParams.get("utm_campaign")).toBe("aula-claude-code");
    expect(url.searchParams.get("utm_content")).toBe("oferta-497");
    expect(url.searchParams.get("utm_term")).toBe("aula-15h-1611");
  });

  it("tags Kirvano links sent in the chat when the room is known", () => {
    const out = tagKirvanoLinks("Link: https://pay.kirvano.com/abc.", "L1", "ao-vivo");
    const url = new URL(out.slice("Link: ".length, -1));
    expect(out.endsWith(".")).toBe(true);
    expect(url.searchParams.get("utm_content")).toBe("lead_L1");
    expect(url.searchParams.get("utm_term")).toMatch(/^ao-vivo-\d{4}$/);
  });

  it.each(["javascript:alert(1)", "invalid"])("leaves an invalid destination alone: %s", (link) => {
    expect(tagLiveOrigin(link, { slug: "aula-10h", leadId: "L1", now })).toBe(link);
  });
});
