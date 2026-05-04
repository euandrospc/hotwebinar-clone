import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";
import { runSeed } from "../../../scripts/seed";

beforeEach(async () => {
  vi.resetModules();
  process.env.DATABASE_URL ??= "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public";
  process.env.BETTER_AUTH_SECRET ??= "test-secret-at-least-32-chars-long-okay";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("seed", () => {
  it("creates the super-admin from env", async () => {
    process.env.SEED_ADMIN_EMAIL = "admin@example.com";
    process.env.SEED_ADMIN_PASSWORD = "test-password-min-12";
    process.env.SEED_ADMIN_NAME = "Test Admin";

    await runSeed();

    const user = await prisma.user.findUnique({ where: { email: "admin@example.com" } });
    expect(user).not.toBeNull();
    expect(user!.name).toBe("Test Admin");
    expect(user!.role).toBe("admin");

    const account = await prisma.account.findFirst({
      where: { userId: user!.id, providerId: "credential" }
    });
    expect(account).not.toBeNull();
    expect(account!.password).toBeTruthy();
  });

  it("is idempotent (running twice does not create duplicates)", async () => {
    process.env.SEED_ADMIN_EMAIL = "admin@example.com";
    process.env.SEED_ADMIN_PASSWORD = "test-password-min-12";
    process.env.SEED_ADMIN_NAME = "Test Admin";

    await runSeed();
    await runSeed();

    const users = await prisma.user.findMany({ where: { email: "admin@example.com" } });
    expect(users).toHaveLength(1);
  });

  it("throws when SEED_ADMIN_EMAIL is missing", async () => {
    delete process.env.SEED_ADMIN_EMAIL;
    process.env.SEED_ADMIN_PASSWORD = "test-password-min-12";
    await expect(runSeed()).rejects.toThrow(/SEED_ADMIN_EMAIL/);
  });
});
