import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";

const TEST_USER = {
  id: "wb-test-user",
  email: "webinar-test@example.com",
  name: "Webinar Tester"
};

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({
        user: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name },
        session: { id: "s", userId: TEST_USER.id }
      })
    }
  }
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.video.deleteMany({});
  await prisma.accountSettings.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createDraftWebinar", () => {
  it("creates a DRAFT for the authenticated user", async () => {
    const { createDraftWebinar } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    const w = await prisma.webinar.findUnique({ where: { id } });
    expect(w).toMatchObject({ ownerId: TEST_USER.id, status: "DRAFT", language: "pt-BR" });
  });
});

describe("updateWebinarStep1", () => {
  it("updates name/title/slug/language", async () => {
    const { createDraftWebinar, updateWebinarStep1 } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    const r = await updateWebinarStep1(id, { name: "X", title: "Hello", slug: "hello-x", language: "pt-BR", accessFacilitated: false, videoSyncWithStart: true });
    expect(r).toEqual({ ok: true });
    const w = await prisma.webinar.findUnique({ where: { id } });
    expect(w).toMatchObject({ name: "X", title: "Hello", slug: "hello-x" });
  });

  it("rejects when called for another user's webinar", async () => {
    const { createDraftWebinar, updateWebinarStep1 } = await import("@/server/actions/webinar");
    await prisma.user.create({ data: { id: "other", email: "other@x.com", name: "Other" } });
    const stranger = await prisma.webinar.create({ data: { ownerId: "other" } });
    const r = await updateWebinarStep1(stranger.id, { name: "X", title: "Y", slug: "yyy", language: "pt-BR", accessFacilitated: false, videoSyncWithStart: true });
    expect(r).toMatchObject({ error: { message: expect.stringMatching(/não encontrado|not_found/i) } });
  });
});

describe("updateWebinarStep4", () => {
  it("creates an EXTERNAL Video and connects it", async () => {
    const { createDraftWebinar, updateWebinarStep4 } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    const r = await updateWebinarStep4(id, { mode: "external", videoExternalUrl: "https://cdn.example.com/video.mp4", pitchAtSec: 600 });
    expect(r).toEqual({ ok: true });
    const w = await prisma.webinar.findUnique({ where: { id }, include: { video: true } });
    expect(w?.video).toMatchObject({
      source: "EXTERNAL",
      status: "READY",
      originalUrl: "https://cdn.example.com/video.mp4",
      hlsUrl: "https://cdn.example.com/video.mp4"
    });
    expect(w?.pitchAtSec).toBe(600);
  });
});

describe("updateWebinarStep5 (offer)", () => {
  it("persists all 15 offer fields + pitchAtSec", async () => {
    const { createDraftWebinar, updateWebinarStep5 } = await import(
      "@/server/actions/webinar?" + Date.now()
    );
    const { id } = await createDraftWebinar();
    const r = await updateWebinarStep5(id, {
      offerName: "Curso A", offerTitle: "Domine Y",
      offerPriceOriginal: "R$2.997", offerPriceFinal: "12x R$153.44",
      offerButtonText: "QUERO!", offerButtonColor: "#dc2626",
      offerImageDesktopUrl: "https://cdn.example.com/d.png",
      offerImageMobileUrl: null,
      pitchAtSec: 600,
      offerShowAtSec: 700, offerHideAtSec: 1800,
      offerLink: "https://buy.example.com/x",
      offerPassUtms: true, offerDisabled: false,
      offerSameWindow: true, offerRaffleEnabled: false
    });
    expect(r).toEqual({ ok: true });
    const w = await prisma.webinar.findUnique({ where: { id } });
    expect(w).toMatchObject({
      offerName: "Curso A", offerTitle: "Domine Y",
      offerButtonColor: "#dc2626",
      pitchAtSec: 600, offerShowAtSec: 700, offerHideAtSec: 1800,
      offerPassUtms: true, offerSameWindow: true, offerRaffleEnabled: false,
      offerLink: "https://buy.example.com/x"
    });
  });
});

describe("publishWebinar", () => {
  it("rejects with missing-field list when fields incomplete", async () => {
    const { createDraftWebinar, publishWebinar } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    const r = await publishWebinar(id);
    expect(r).toMatchObject({ error: { message: expect.stringMatching(/Faltam campos/) } });
  });

  it("transitions DRAFT to ACTIVE when all fields present", async () => {
    const {
      createDraftWebinar,
      updateWebinarStep1,
      updateWebinarStep2,
      updateWebinarStep4,
      publishWebinar
    } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    await updateWebinarStep1(id, { name: "N", title: "T", slug: "active-test", language: "pt-BR", accessFacilitated: false, videoSyncWithStart: true });
    await updateWebinarStep2(id, {
      mode: "UNICO",
      startDate: new Date("2026-06-01T10:00:00Z"),
      endDate: new Date("2026-06-01T11:00:00Z"),
      timezone: "America/Sao_Paulo",
      waitingTitle: "Sala",
      waitingSubtitle: "",
      waitingShowThumb: false,
      waitingTemplate: "DEFAULT" as const
    });
    await updateWebinarStep4(id, { mode: "external", videoExternalUrl: "https://x.com/v.mp4" });
    const r = await publishWebinar(id);
    expect(r).toEqual({ ok: true });
    const w = await prisma.webinar.findUnique({ where: { id } });
    expect(w?.status).toBe("ACTIVE");
  });
});

describe("deleteWebinar", () => {
  it("cascades chat messages", async () => {
    const { createDraftWebinar, updateWebinarStep6, deleteWebinar } = await import(
      "@/server/actions/webinar"
    );
    const { id } = await createDraftWebinar();
    await updateWebinarStep6(id, { messages: [{ authorName: "A", text: "Olá", showAtSec: 0, isOwner: false }] });
    await deleteWebinar(id);
    expect(await prisma.chatMessage.count({ where: { webinarId: id } })).toBe(0);
    expect(await prisma.webinar.findUnique({ where: { id } })).toBeNull();
  });
});

describe("duplicateWebinar", () => {
  it("creates a DRAFT copy with cloned offer + chat (no CTAs)", async () => {
    const {
      createDraftWebinar,
      updateWebinarStep1,
      updateWebinarStep5,
      updateWebinarStep6,
      duplicateWebinar
    } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    await updateWebinarStep1(id, { name: "Orig", title: "Orig", slug: "orig", language: "pt-BR", accessFacilitated: false, videoSyncWithStart: true });
    await updateWebinarStep5(id, {
      offerName: "OF", offerTitle: "OT",
      offerPriceOriginal: null, offerPriceFinal: null,
      offerButtonText: "QUERO!", offerButtonColor: "#dc2626",
      offerImageDesktopUrl: null, offerImageMobileUrl: null,
      pitchAtSec: null, offerShowAtSec: null, offerHideAtSec: null,
      offerLink: "https://x.example.com",
      offerPassUtms: false, offerDisabled: false,
      offerSameWindow: false, offerRaffleEnabled: false
    });
    await updateWebinarStep6(id, {
      messages: [{ authorName: "A", text: "Olá", showAtSec: 0, isOwner: false }]
    });
    const r = await duplicateWebinar(id);
    expect("newId" in r).toBe(true);
    if (!("newId" in r)) return;
    const dup = await prisma.webinar.findUnique({
      where: { id: r.newId },
      include: { chatMessages: true }
    });
    expect(dup?.status).toBe("DRAFT");
    expect(dup?.slug).toBeNull();
    expect(dup?.title).toBe("Orig (cópia)");
    expect(dup?.offerName).toBe("OF");
    expect(dup?.offerLink).toBe("https://x.example.com");
    expect(dup?.chatMessages).toHaveLength(1);
  });
});

describe("updateWebinarStep1 D1 fields", () => {
  it("persists accessFacilitated + videoSyncWithStart", async () => {
    const { createDraftWebinar, updateWebinarStep1 } = await import("@/server/actions/webinar?" + Date.now());
    const { id } = await createDraftWebinar();
    const r = await updateWebinarStep1(id, {
      name: "X", title: "X", slug: "d1-test-1", language: "pt-BR",
      accessFacilitated: true,
      videoSyncWithStart: false
    });
    expect(r).toEqual({ ok: true });
    const after = await prisma.webinar.findUnique({ where: { id } });
    expect(after?.accessFacilitated).toBe(true);
    expect(after?.videoSyncWithStart).toBe(false);
  });
});

describe("updateWebinarStep2 waitingTemplate", () => {
  it("setting WITH_THUMB also sets waitingShowThumb=true", async () => {
    const { createDraftWebinar, updateWebinarStep1, updateWebinarStep2 } = await import("@/server/actions/webinar?" + (Date.now() + 1));
    const { id } = await createDraftWebinar();
    await updateWebinarStep1(id, { name: "X", title: "X", slug: "d1-test-2", language: "pt-BR", accessFacilitated: false, videoSyncWithStart: true });
    await updateWebinarStep2(id, {
      mode: "UNICO",
      startDate: new Date("2026-06-01T10:00:00Z"),
      endDate: new Date("2026-06-01T11:00:00Z"),
      timezone: "America/Sao_Paulo",
      waitingTitle: "Sala", waitingSubtitle: "",
      waitingShowThumb: false,
      waitingTemplate: "WITH_THUMB"
    });
    const after = await prisma.webinar.findUnique({ where: { id } });
    expect(after?.waitingTemplate).toBe("WITH_THUMB");
    expect(after?.waitingShowThumb).toBe(true);
  });
});
