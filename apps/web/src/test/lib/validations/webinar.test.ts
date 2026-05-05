import { describe, it, expect } from "vitest";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema
} from "@/lib/validations/webinar";

describe("step1Schema", () => {
  it("accepts valid input", () => {
    const r = step1Schema.safeParse({
      name: "Webinar Teste",
      title: "Título Público",
      slug: "webinar-teste",
      language: "pt-BR",
      accessFacilitated: false,
      videoSyncWithStart: true
    });
    expect(r.success).toBe(true);
  });

  it("rejects slug with uppercase or spaces", () => {
    expect(step1Schema.safeParse({ name: "X", title: "Y", slug: "Bad Slug", language: "pt-BR", accessFacilitated: false, videoSyncWithStart: true }).success).toBe(false);
    expect(step1Schema.safeParse({ name: "X", title: "Y", slug: "bad_slug", language: "pt-BR", accessFacilitated: false, videoSyncWithStart: true }).success).toBe(false);
  });

  it("rejects short slug", () => {
    expect(step1Schema.safeParse({ name: "Foo Bar", title: "Foo Bar", slug: "ab", language: "pt-BR", accessFacilitated: false, videoSyncWithStart: true }).success).toBe(false);
  });
});

describe("step2Schema", () => {
  it("rejects when endDate is not after startDate", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    const end = new Date("2026-06-01T10:00:00Z");
    const r = step2Schema.safeParse({
      mode: "UNICO",
      startDate: start,
      endDate: end,
      timezone: "America/Sao_Paulo",
      waitingTitle: "Sala",
      waitingSubtitle: ""
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("endDate"))).toBe(true);
    }
  });

  it("accepts JIT mode", () => {
    const r = step2Schema.safeParse({
      mode: "JIT",
      startDate: new Date("2026-06-01T10:00:00Z"),
      endDate: new Date("2026-06-01T11:00:00Z"),
      timezone: "America/Sao_Paulo",
      waitingTitle: "X",
      waitingSubtitle: ""
    });
    expect(r.success).toBe(true);
  });
});

describe("step3Schema", () => {
  it("rejects invalid hex color", () => {
    expect(step3Schema.safeParse({
      logoUrl: "",
      primaryColor: "",
      loginButtonText: "Entrar",
      loginButtonColor: "not-a-color",
      nameEnabled: true, nameRequired: true,
      emailEnabled: true, emailRequired: true,
      phoneEnabled: true, phoneRequired: false,
      namePlaceholder: "", emailPlaceholder: "", phonePlaceholder: "",
      loginLogoAlign: "CENTER",
      progressEnabled: false, progressStartPct: 50,
      progressBarColor: "#dc2626", progressTextColor: "#ffffff",
      progressText: "test", formFieldOrder: ["name", "email"]
    }).success).toBe(false);
  });

  it("accepts valid hex", () => {
    expect(step3Schema.safeParse({
      logoUrl: "",
      primaryColor: "",
      loginButtonText: "Entrar",
      loginButtonColor: "#16a34a",
      nameEnabled: true, nameRequired: true,
      emailEnabled: true, emailRequired: true,
      phoneEnabled: true, phoneRequired: false,
      namePlaceholder: "", emailPlaceholder: "", phonePlaceholder: "",
      loginLogoAlign: "CENTER",
      progressEnabled: false, progressStartPct: 50,
      progressBarColor: "#dc2626", progressTextColor: "#ffffff",
      progressText: "test", formFieldOrder: ["name", "email"]
    }).success).toBe(true);
  });
});

describe("step4Schema", () => {
  it("requires URL in external mode", () => {
    expect(step4Schema.safeParse({ mode: "external", videoExternalUrl: "not-a-url" }).success).toBe(false);
    expect(step4Schema.safeParse({ mode: "external", videoExternalUrl: "https://example.com/video.mp4" }).success).toBe(true);
  });
  it("library mode requires videoId", () => {
    expect(step4Schema.safeParse({ mode: "library", videoId: "" }).success).toBe(false);
    expect(step4Schema.safeParse({ mode: "library", videoId: "abc" }).success).toBe(true);
  });
});

describe("step5Schema (CTAs array)", () => {
  it("accepts empty array", () => {
    expect(step5Schema.safeParse({ ctas: [] }).success).toBe(true);
  });

  it("rejects CTA with invalid URL", () => {
    expect(step5Schema.safeParse({
      ctas: [{ label: "Comprar", url: "nope", showAtSec: 30 }]
    }).success).toBe(false);
  });

  it("preserves optional id field", () => {
    const r = step5Schema.safeParse({
      ctas: [{ id: "c1", label: "Comprar", url: "https://x.com", showAtSec: 30 }]
    });
    expect(r.success).toBe(true);
  });
});

describe("step6Schema (Chat array)", () => {
  it("accepts empty array", () => {
    expect(step6Schema.safeParse({ messages: [] }).success).toBe(true);
  });

  it("rejects empty author or text", () => {
    expect(step6Schema.safeParse({
      messages: [{ authorName: "", text: "Olá", showAtSec: 0 }]
    }).success).toBe(false);
  });
});
