import { describe, expect, it, vi } from "vitest";
import nextConfig from "../../../next.config.mjs";
import { isReservedSlug } from "@/lib/slug-blacklist";

vi.mock("db", () => ({ prisma: { webinar: { findUnique: vi.fn().mockResolvedValue(null) } } }));

describe("textos públicos usam live", () => {
  it("reserva o endereço /lives", () => {
    expect(isReservedSlug("lives")).toBe(true);
    expect(isReservedSlug("webinars")).toBe(true);
  });

  it("mantém o endereço antigo /webinars funcionando", async () => {
    expect(await nextConfig.redirects?.()).toContainEqual({ source: "/webinars", destination: "/lives", permanent: false });
  });

  it("usa Live como título reserva das páginas públicas", async () => {
    const capture = await import("@/app/[slug]/page");
    const live = await import("@/app/[slug]/live/page");
    for (const slug of ["sem-titulo", "login"]) {
      const params = Promise.resolve({ slug });
      expect((await capture.generateMetadata({ params })).title).toBe("Live");
      expect((await live.generateMetadata({ params })).title).toBe("Live");
    }
  });
});
