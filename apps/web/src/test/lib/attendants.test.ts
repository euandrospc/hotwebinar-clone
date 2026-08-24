import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { createAttendant, listAttendants, setAttendantDisabled } from "@/lib/attendants";

beforeEach(async () => {
  process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-chars-long-okay";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  for (const m of ["leadChatMessage", "session", "account", "user"] as const) {
    // @ts-expect-error dynamic
    await prisma[m].deleteMany({});
  }
});
afterAll(async () => prisma.$disconnect());

describe("attendants", () => {
  it("creates an attendant with role attendant and a credential account", async () => {
    await createAttendant({ name: "Ana", email: "ana@e.com", password: "SenhaForte123@" });
    const u = await prisma.user.findUnique({ where: { email: "ana@e.com" } });
    expect(u?.role).toBe("attendant");
    const acc = await prisma.account.findFirst({ where: { userId: u!.id, providerId: "credential" } });
    expect(acc?.password).toBeTruthy();
  });
  it("lists and disables", async () => {
    await createAttendant({ name: "Bia", email: "bia@e.com", password: "SenhaForte123@" });
    const list = await listAttendants();
    expect(list.some((a) => a.email === "bia@e.com")).toBe(true);
    const u = await prisma.user.findUnique({ where: { email: "bia@e.com" } });
    await setAttendantDisabled(u!.id, true);
    const after = await prisma.user.findUnique({ where: { id: u!.id } });
    expect(after?.role).toBe("disabled");
  });
});
