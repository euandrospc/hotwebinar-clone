import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";

const TEST_USER = {
  id: "test-user-1",
  email: "settings-test@example.com",
  name: "Settings Tester"
};

vi.mock("next/headers", () => ({
  headers: async () => new Headers()
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({
        user: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name },
        session: { id: "s1", userId: TEST_USER.id }
      })
    }
  }
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

beforeEach(async () => {
  await prisma.accountSettings.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({
    data: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("settings actions", () => {
  it("getAccountSettings returns defaults if no row exists", async () => {
    const { getAccountSettings } = await import("@/server/actions/settings");
    const result = await getAccountSettings();
    expect(result).toMatchObject({
      defaultLanguage: "pt-BR",
      defaultTimezone: "America/Sao_Paulo",
      brandName: ""
    });
  });

  it("upsertAccountSettings creates a row when none exists", async () => {
    const { upsertAccountSettings } = await import("@/server/actions/settings");
    const result = await upsertAccountSettings({
      defaultLanguage: "en-US",
      defaultTimezone: "Europe/London",
      brandName: "Test Brand"
    });
    expect(result).toEqual({ ok: true });
    const row = await prisma.accountSettings.findUnique({ where: { userId: TEST_USER.id } });
    expect(row).toMatchObject({
      defaultLanguage: "en-US",
      defaultTimezone: "Europe/London",
      brandName: "Test Brand"
    });
  });

  it("upsertAccountSettings updates an existing row", async () => {
    const { upsertAccountSettings } = await import("@/server/actions/settings");
    await prisma.accountSettings.create({
      data: {
        userId: TEST_USER.id,
        defaultLanguage: "pt-BR",
        defaultTimezone: "America/Sao_Paulo",
        brandName: "Old"
      }
    });
    await upsertAccountSettings({
      defaultLanguage: "es-ES",
      defaultTimezone: "Europe/Madrid",
      brandName: "New"
    });
    const rows = await prisma.accountSettings.findMany({ where: { userId: TEST_USER.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ defaultLanguage: "es-ES", brandName: "New" });
  });

  it("upsertAccountSettings rejects invalid input via Zod", async () => {
    const { upsertAccountSettings } = await import("@/server/actions/settings");
    const r = await upsertAccountSettings({
      defaultLanguage: "pt-BR",
      defaultTimezone: "",
      brandName: ""
    } as never);
    expect(r).toMatchObject({ error: expect.any(Object) });
  });
});
