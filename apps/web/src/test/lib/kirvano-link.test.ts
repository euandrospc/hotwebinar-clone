import { describe, it, expect } from "vitest";
import { tagKirvanoLinks, leadIdFromUtm, tagAbKirvanoCheckout } from "@/lib/kirvano-link";

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
