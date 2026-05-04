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
  await prisma.cta.deleteMany({});
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
    const r = await updateWebinarStep1(id, { name: "X", title: "Hello", slug: "hello-x", language: "pt-BR" });
    expect(r).toEqual({ ok: true });
    const w = await prisma.webinar.findUnique({ where: { id } });
    expect(w).toMatchObject({ name: "X", title: "Hello", slug: "hello-x" });
  });

  it("rejects when called for another user's webinar", async () => {
    const { createDraftWebinar, updateWebinarStep1 } = await import("@/server/actions/webinar");
    await prisma.user.create({ data: { id: "other", email: "other@x.com", name: "Other" } });
    const stranger = await prisma.webinar.create({ data: { ownerId: "other" } });
    const r = await updateWebinarStep1(stranger.id, { name: "X", title: "Y", slug: "yyy", language: "pt-BR" });
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

describe("updateWebinarStep5 (CTA upsert)", () => {
  it("creates new CTAs when payload has no IDs", async () => {
    const { createDraftWebinar, updateWebinarStep5 } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    await updateWebinarStep5(id, {
      ctas: [
        { label: "Comprar", url: "https://x.com", showAtSec: 30 },
        { label: "Saiba mais", url: "https://y.com", showAtSec: 60 }
      ]
    });
    const ctas = await prisma.cta.findMany({ where: { webinarId: id }, orderBy: { showAtSec: "asc" } });
    expect(ctas).toHaveLength(2);
    expect(ctas[0].label).toBe("Comprar");
  });

  it("updates existing CTAs by id and deletes ones omitted", async () => {
    const { createDraftWebinar, updateWebinarStep5 } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    await updateWebinarStep5(id, {
      ctas: [{ label: "A", url: "https://a.com", showAtSec: 10 }]
    });
    const [first] = await prisma.cta.findMany({ where: { webinarId: id } });
    await updateWebinarStep5(id, {
      ctas: [
        { id: first.id, label: "A2", url: "https://a.com", showAtSec: 15 },
        { label: "B", url: "https://b.com", showAtSec: 20 }
      ]
    });
    const after = await prisma.cta.findMany({ where: { webinarId: id }, orderBy: { showAtSec: "asc" } });
    expect(after).toHaveLength(2);
    expect(after.find((c) => c.id === first.id)?.label).toBe("A2");
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
    await updateWebinarStep1(id, { name: "N", title: "T", slug: "active-test", language: "pt-BR" });
    await updateWebinarStep2(id, {
      mode: "UNICO",
      startDate: new Date("2026-06-01T10:00:00Z"),
      endDate: new Date("2026-06-01T11:00:00Z"),
      timezone: "America/Sao_Paulo",
      waitingTitle: "Sala",
      waitingSubtitle: ""
    });
    await updateWebinarStep4(id, { mode: "external", videoExternalUrl: "https://x.com/v.mp4" });
    const r = await publishWebinar(id);
    expect(r).toEqual({ ok: true });
    const w = await prisma.webinar.findUnique({ where: { id } });
    expect(w?.status).toBe("ACTIVE");
  });
});

describe("deleteWebinar", () => {
  it("cascades chat + ctas", async () => {
    const { createDraftWebinar, updateWebinarStep5, updateWebinarStep6, deleteWebinar } = await import(
      "@/server/actions/webinar"
    );
    const { id } = await createDraftWebinar();
    await updateWebinarStep5(id, { ctas: [{ label: "X", url: "https://x.com", showAtSec: 0 }] });
    await updateWebinarStep6(id, { messages: [{ authorName: "A", text: "Olá", showAtSec: 0, isOwner: false }] });
    await deleteWebinar(id);
    expect(await prisma.cta.count({ where: { webinarId: id } })).toBe(0);
    expect(await prisma.chatMessage.count({ where: { webinarId: id } })).toBe(0);
    expect(await prisma.webinar.findUnique({ where: { id } })).toBeNull();
  });
});

describe("duplicateWebinar", () => {
  it("creates a DRAFT copy with cloned CTAs and chat", async () => {
    const {
      createDraftWebinar,
      updateWebinarStep1,
      updateWebinarStep5,
      updateWebinarStep6,
      duplicateWebinar
    } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    await updateWebinarStep1(id, { name: "Orig", title: "Orig", slug: "orig", language: "pt-BR" });
    await updateWebinarStep5(id, { ctas: [{ label: "X", url: "https://x.com", showAtSec: 0 }] });
    await updateWebinarStep6(id, {
      messages: [{ authorName: "A", text: "Olá", showAtSec: 0, isOwner: false }]
    });
    const r = await duplicateWebinar(id);
    expect("newId" in r).toBe(true);
    if (!("newId" in r)) return;
    const dup = await prisma.webinar.findUnique({
      where: { id: r.newId },
      include: { ctas: true, chatMessages: true }
    });
    expect(dup?.status).toBe("DRAFT");
    expect(dup?.slug).toBeNull();
    expect(dup?.title).toBe("Orig (cópia)");
    expect(dup?.ctas).toHaveLength(1);
    expect(dup?.chatMessages).toHaveLength(1);
  });
});
