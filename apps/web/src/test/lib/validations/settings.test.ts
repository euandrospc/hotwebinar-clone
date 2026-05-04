import { describe, it, expect } from "vitest";
import { accountSettingsSchema } from "@/lib/validations/settings";

describe("accountSettingsSchema", () => {
  it("accepts valid input", () => {
    expect(accountSettingsSchema.safeParse({
      defaultLanguage: "pt-BR",
      defaultTimezone: "America/Sao_Paulo",
      brandName: "Acme"
    }).success).toBe(true);
  });

  it("accepts empty brandName", () => {
    expect(accountSettingsSchema.safeParse({
      defaultLanguage: "pt-BR",
      defaultTimezone: "America/Sao_Paulo",
      brandName: ""
    }).success).toBe(true);
  });

  it("rejects empty timezone", () => {
    expect(accountSettingsSchema.safeParse({
      defaultLanguage: "pt-BR",
      defaultTimezone: "",
      brandName: "Acme"
    }).success).toBe(false);
  });
});
