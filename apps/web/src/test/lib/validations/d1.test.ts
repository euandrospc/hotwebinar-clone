import { describe, it, expect } from "vitest";
import { step1Schema, step2Schema, step3Schema } from "@/lib/validations/webinar";

const step1Base = {
  name: "n", title: "t", slug: "abc", language: "pt-BR",
  accessFacilitated: false, videoSyncWithStart: true
};

const step2Base = {
  mode: "UNICO" as const,
  startDate: new Date("2026-06-01T10:00:00Z"),
  endDate: new Date("2026-06-01T11:00:00Z"),
  timezone: "America/Sao_Paulo",
  waitingTitle: "Sala", waitingSubtitle: "",
  waitingShowThumb: false, waitingTemplate: "DEFAULT" as const
};

const step3Base = {
  logoUrl: "", primaryColor: "",
  loginButtonText: "Entrar", loginButtonColor: "#16a34a",
  nameEnabled: true, nameRequired: true, namePlaceholder: "Nome",
  emailEnabled: true, emailRequired: true, emailPlaceholder: "Email",
  phoneEnabled: true, phoneRequired: false, phonePlaceholder: "Tel",
  loginLogoAlign: "CENTER" as const,
  progressEnabled: false, progressStartPct: 50,
  progressBarColor: "#dc2626", progressTextColor: "#ffffff",
  progressText: "{pct}% das vagas preenchidas...",
  formFieldOrder: ["name", "email", "phone"]
};

describe("step1Schema D1 extensions", () => {
  it("accepts both new toggles", () => {
    expect(step1Schema.safeParse(step1Base).success).toBe(true);
  });
  it("rejects missing accessFacilitated", () => {
    const { accessFacilitated, ...rest } = step1Base;
    expect(step1Schema.safeParse(rest).success).toBe(false);
  });
});

describe("step2Schema D1 extensions", () => {
  it("accepts WaitingTemplate enum DEFAULT", () => {
    expect(step2Schema.safeParse(step2Base).success).toBe(true);
  });
  it("accepts WITH_THUMB", () => {
    expect(step2Schema.safeParse({ ...step2Base, waitingTemplate: "WITH_THUMB" }).success).toBe(true);
  });
  it("rejects unknown template id", () => {
    expect(step2Schema.safeParse({ ...step2Base, waitingTemplate: "FOO" }).success).toBe(false);
  });
});

describe("step3Schema D1 extensions", () => {
  it("accepts the full base", () => {
    expect(step3Schema.safeParse(step3Base).success).toBe(true);
  });
  it("rejects formFieldOrder duplicates", () => {
    const r = step3Schema.safeParse({ ...step3Base, formFieldOrder: ["name", "name", "email"] });
    expect(r.success).toBe(false);
  });
  it("rejects formFieldOrder with unknown value", () => {
    const r = step3Schema.safeParse({ ...step3Base, formFieldOrder: ["name", "address"] });
    expect(r.success).toBe(false);
  });
  it("rejects bad progressStartPct", () => {
    const r = step3Schema.safeParse({ ...step3Base, progressStartPct: 150 });
    expect(r.success).toBe(false);
  });
  it("rejects bad bar color", () => {
    const r = step3Schema.safeParse({ ...step3Base, progressBarColor: "red" });
    expect(r.success).toBe(false);
  });
});
