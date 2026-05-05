import { describe, it, expect } from "vitest";
import { isReservedSlug, RESERVED_SLUGS } from "@/lib/slug-blacklist";

describe("slug-blacklist", () => {
  it("rejects reserved slugs", () => {
    expect(isReservedSlug("login")).toBe(true);
    expect(isReservedSlug("dashboard")).toBe(true);
    expect(isReservedSlug("api")).toBe(true);
    expect(isReservedSlug("_next")).toBe(true);
  });

  it("accepts normal slugs", () => {
    expect(isReservedSlug("meu-webinar")).toBe(false);
    expect(isReservedSlug("evento-2026")).toBe(false);
    expect(isReservedSlug("treinamento")).toBe(false);
  });

  it("treats casing as reserved match-insensitive", () => {
    expect(isReservedSlug("LOGIN")).toBe(true);
    expect(isReservedSlug("Dashboard")).toBe(true);
  });

  it("RESERVED_SLUGS contains expected baseline", () => {
    expect(RESERVED_SLUGS.has("login")).toBe(true);
    expect(RESERVED_SLUGS.has("dashboard")).toBe(true);
    expect(RESERVED_SLUGS.has("api")).toBe(true);
    expect(RESERVED_SLUGS.has("admin")).toBe(true);
    expect(RESERVED_SLUGS.has("_next")).toBe(true);
  });
});
