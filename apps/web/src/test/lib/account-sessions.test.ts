import { describe, expect, it } from "vitest";
import { describeUserAgent, formatLastActive } from "@/lib/account-sessions";

describe("describeUserAgent", () => {
  it("names browser and platform", () => {
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"))
      .toEqual({ label: "Chrome no Windows", mobile: false });
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0"))
      .toEqual({ label: "Edge no Windows", mobile: false });
    expect(describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"))
      .toEqual({ label: "Safari no iPhone", mobile: true });
    expect(describeUserAgent(null)).toEqual({ label: "Dispositivo desconhecido", mobile: false });
  });
});

describe("formatLastActive", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  it("uses relative pt-BR wording", () => {
    expect(formatLastActive(new Date("2026-11-13T11:59:30Z"), now)).toBe("agora");
    expect(formatLastActive(new Date("2026-11-13T11:55:00Z"), now)).toBe("há 5 minutos");
    expect(formatLastActive(new Date("2026-11-11T11:00:00Z"), now)).toBe("há 2 dias");
  });
});
