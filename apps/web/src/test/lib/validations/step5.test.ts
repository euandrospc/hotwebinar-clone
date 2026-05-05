import { describe, it, expect } from "vitest";
import { step5Schema } from "@/lib/validations/webinar";

const VALID = {
  offerName: "Curso A",
  offerTitle: "Domine Y",
  offerPriceOriginal: "R$2.997",
  offerPriceFinal: "12x de R$153.44",
  offerButtonText: "Quero",
  offerButtonColor: "#dc2626",
  offerImageDesktopUrl: "https://cdn.example.com/d.png",
  offerImageMobileUrl: "https://cdn.example.com/m.png",
  pitchAtSec: 600,
  offerShowAtSec: 700,
  offerHideAtSec: 1800,
  offerLink: "https://buy.example.com/x",
  offerPassUtms: false,
  offerDisabled: false,
  offerSameWindow: false,
  offerRaffleEnabled: false
};

describe("step5Schema", () => {
  it("accepts a fully-populated valid offer", () => {
    expect(step5Schema.safeParse(VALID).success).toBe(true);
  });
  it("rejects empty offerName", () => {
    const r = step5Schema.safeParse({ ...VALID, offerName: "" });
    expect(r.success).toBe(false);
  });
  it("rejects empty offerButtonText", () => {
    expect(step5Schema.safeParse({ ...VALID, offerButtonText: "" }).success).toBe(false);
  });
  it("rejects invalid hex color", () => {
    expect(step5Schema.safeParse({ ...VALID, offerButtonColor: "red" }).success).toBe(false);
    expect(step5Schema.safeParse({ ...VALID, offerButtonColor: "#zzzzzz" }).success).toBe(false);
  });
  it("rejects offerHideAtSec < offerShowAtSec", () => {
    const r = step5Schema.safeParse({ ...VALID, offerShowAtSec: 100, offerHideAtSec: 50 });
    expect(r.success).toBe(false);
  });
  it("accepts when both show/hide are null", () => {
    const r = step5Schema.safeParse({ ...VALID, offerShowAtSec: null, offerHideAtSec: null });
    expect(r.success).toBe(true);
  });
  it("rejects invalid offerLink URL", () => {
    expect(step5Schema.safeParse({ ...VALID, offerLink: "not-a-url" }).success).toBe(false);
  });
});
