import { describe, it, expect } from "vitest";
import { tagKirvanoLinks, leadIdFromUtm } from "@/lib/kirvano-link";

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
