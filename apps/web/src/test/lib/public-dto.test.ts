import { describe, it, expect } from "vitest";
import { publicWebinarDto, publicVideoDto, publicLeadDto } from "@/lib/public-dto";

describe("publicWebinarDto", () => {
  it("excludes sensitive fields", () => {
    const w: any = {
      id: "w1", slug: "test", title: "T", name: "N",
      mode: "UNICO", startDate: null, endDate: null, timezone: "America/Sao_Paulo",
      waitingTitle: "Wait", waitingSubtitle: "Sub",
      logoUrl: null, primaryColor: "#000000",
      loginButtonText: "Entrar", loginButtonColor: "#16a34a",
      nameEnabled: true, nameRequired: true, namePlaceholder: "Nome",
      emailEnabled: true, emailRequired: true, emailPlaceholder: "Email",
      phoneEnabled: false, phoneRequired: false, phonePlaceholder: "Tel",
      pitchAtSec: 600,
      ownerId: "secret-owner",
      videoId: "secret-video",
      webhookUrl: "https://secret.example",
      webhookOnOptin: true
    };
    const out = publicWebinarDto(w);
    expect(out.title).toBe("T");
    expect(out.pitchAtSec).toBe(600);
    expect((out as any).ownerId).toBeUndefined();
    expect((out as any).webhookUrl).toBeUndefined();
    expect((out as any).webhookOnOptin).toBeUndefined();
  });
});

describe("publicVideoDto", () => {
  it("returns null for null input", () => {
    expect(publicVideoDto(null)).toBeNull();
  });

  it("excludes originalUrl, ownerId, bytes", () => {
    const v: any = {
      id: "v1",
      hlsUrl: "https://hls.example/master.m3u8",
      durationSec: 3600,
      thumbUrl: "https://thumb.jpg",
      customThumbUrl: null,
      originalUrl: "secret-key/raw.mp4",
      ownerId: "secret",
      bytes: 12345n
    };
    const out = publicVideoDto(v);
    expect(out?.hlsUrl).toBe("https://hls.example/master.m3u8");
    expect((out as any).originalUrl).toBeUndefined();
    expect((out as any).ownerId).toBeUndefined();
    expect((out as any).bytes).toBeUndefined();
  });
});

describe("publicLeadDto", () => {
  it("only exposes id and name", () => {
    const l: any = {
      id: "l1", name: "Joe",
      email: "joe@example.com",
      phone: "+5511999990000",
      ip: "1.2.3.4",
      watchedSec: 120,
      pitchFired: true
    };
    const out = publicLeadDto(l);
    expect(out).toEqual({ id: "l1", name: "Joe" });
  });
});

describe("publicWebinarDto offer fields", () => {
  it("returns all 15 offer fields from Webinar", () => {
    const w: any = {
      id: "w1", slug: "x", title: "T", name: "N", mode: "UNICO",
      startDate: null, endDate: null, timezone: "America/Sao_Paulo",
      waitingTitle: "", waitingSubtitle: "", waitingShowThumb: false,
      logoUrl: null, primaryColor: null,
      loginButtonText: "", loginButtonColor: "#000000",
      nameEnabled: true, nameRequired: true, namePlaceholder: "",
      emailEnabled: true, emailRequired: true, emailPlaceholder: "",
      phoneEnabled: false, phoneRequired: false, phonePlaceholder: "",
      pitchAtSec: 600, waitingTemplate: "DEFAULT", loginLogoAlign: "CENTER",
      progressEnabled: false, progressStartPct: 50, progressBarColor: "#000",
      progressTextColor: "#fff", progressText: "", formFieldOrder: ["name","email","phone"],
      offerName: "X", offerTitle: "Y",
      offerPriceOriginal: "R$10", offerPriceFinal: "R$5",
      offerButtonText: "Q", offerButtonColor: "#dc2626",
      offerImageDesktopUrl: "https://cdn.example.com/d.png",
      offerImageMobileUrl: "https://cdn.example.com/m.png",
      offerShowAtSec: 100, offerHideAtSec: 200,
      offerLink: "https://buy.example.com",
      offerPassUtms: true, offerDisabled: false,
      offerSameWindow: true, offerRaffleEnabled: true
    };
    const dto = publicWebinarDto(w);
    expect(dto.offerName).toBe("X");
    expect(dto.offerButtonColor).toBe("#dc2626");
    expect(dto.offerShowAtSec).toBe(100);
    expect(dto.offerPassUtms).toBe(true);
    expect(dto.offerRaffleEnabled).toBe(true);
    expect(dto.offerImageDesktopUrl).toBe("https://cdn.example.com/d.png");
  });
});
