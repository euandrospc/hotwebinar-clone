import { describe, it, expect } from "vitest";
import { integrationsSchema } from "@/lib/validations/webinar";

describe("integrationsSchema", () => {
  const base = {
    webhookOnOptin: false, webhookOnEnter: false, webhookOnOfferView: false,
    webhookOnOfferClick: false, webhookOnRaffleEntry: false, webhookOnPitchReached: false,
    webhookOnPermanence: false, webhookOnLeave: false, permanenceThresholdSec: 300
  };

  it("accepts empty webhookUrl", () => {
    expect(integrationsSchema.safeParse({ ...base, webhookUrl: "" }).success).toBe(true);
  });

  it("accepts valid URL", () => {
    expect(integrationsSchema.safeParse({ ...base, webhookUrl: "https://x.example/hook" }).success).toBe(true);
  });

  it("rejects malformed URL", () => {
    expect(integrationsSchema.safeParse({ ...base, webhookUrl: "not-a-url" }).success).toBe(false);
  });

  it("rejects threshold < 1", () => {
    expect(integrationsSchema.safeParse({ ...base, permanenceThresholdSec: 0 }).success).toBe(false);
  });
});
