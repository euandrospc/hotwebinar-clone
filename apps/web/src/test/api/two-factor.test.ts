import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, createHmac } from "node:crypto";
import { prisma } from "db";
import { hashPassword } from "better-auth/crypto";
import { auth } from "@/lib/auth";

const id = `two-factor-${randomUUID()}`;
const email = `${id}@example.test`;
const password = "Test-only-strong-password-235!";
const origin = "http://localhost:3000";
function cookies(response: Response) { return response.headers.getSetCookie().map(value => value.split(";")[0]).join("; "); }
function request(path: string, body?: object, cookie = "") {
  return auth.handler(new Request(`${origin}/api/auth/${path}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", origin, cookie }, ...(body ? { body: JSON.stringify(body) } : {}) }));
}
function totp(uri: string) {
  const secret = new URL(uri).searchParams.get("secret")!;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=/g, "").toUpperCase()].map(char => alphabet.indexOf(char).toString(2).padStart(5, "0")).join("");
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac("sha1", bytes).update(counter).digest();
  return String((hash.readUInt32BE(hash[hash.length - 1] & 15) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
beforeAll(async () => {
  expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/hotwebinar_test");
  await prisma.user.create({ data: { id, email, name: "2FA test", role: "admin", emailVerified: true, accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(password) } } } });
});
afterAll(async () => { await prisma.user.deleteMany({ where: { id } }); await prisma.$disconnect(); });

describe("two-factor authentication", () => {
  it("requires password and TOTP, blocks password-only access, and consumes recovery codes once", async () => {
    const login = await request("sign-in/email", { email, password });
    expect(login.status).toBe(200);
    let cookie = cookies(login);
    const noSession = await request("two-factor/enable", { password });
    expect(noSession.status).toBe(401);
    const wrongPassword = await request("two-factor/enable", { password: "wrong-password" }, cookie);
    expect(wrongPassword.status).not.toBe(200);
    const enable = await request("two-factor/enable", { password }, cookie);
    expect(enable.status).toBe(200);
    const setup = await enable.json();
    expect(setup.totpURI).toMatch(/^otpauth:\/\/totp\//);
    expect(setup.backupCodes.length).toBeGreaterThan(0);
    expect((await prisma.user.findUnique({ where: { id } }))!.twoFactorEnabled).toBe(false);
    const wrongCode = totp(setup.totpURI) === "000000" ? "999999" : "000000";
    const invalid = await request("two-factor/verify-totp", { code: wrongCode }, cookie);
    expect(invalid.status).not.toBe(200);
    const verified = await request("two-factor/verify-totp", { code: totp(setup.totpURI) }, cookie);
    expect(verified.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id } }))!.twoFactorEnabled).toBe(true);
    await prisma.session.deleteMany({ where: { userId: id } });
    const challenged = await request("sign-in/email", { email, password });
    expect(await challenged.json()).toMatchObject({ twoFactorRedirect: true });
    cookie = cookies(challenged);
    const incomplete = await request("get-session", undefined, cookie);
    expect(await incomplete.json()).toBeNull();
    const second = await request("two-factor/verify-totp", { code: totp(setup.totpURI) }, cookie);
    expect(second.status).toBe(200);
    expect(await (await request("get-session", undefined, cookies(second))).json()).toMatchObject({ user: { id } });
    const recoveryLogin = await request("sign-in/email", { email, password });
    const recovery = await request("two-factor/verify-backup-code", { code: setup.backupCodes[0] }, cookies(recoveryLogin));
    expect(recovery.status).toBe(200);
    const reuseLogin = await request("sign-in/email", { email, password });
    const reused = await request("two-factor/verify-backup-code", { code: setup.backupCodes[0] }, cookies(reuseLogin));
    expect(reused.status).not.toBe(200);
    const encrypted = await prisma.twoFactor.findUniqueOrThrow({ where: { userId: id } });
    expect(encrypted.secret).not.toContain(new URL(setup.totpURI).searchParams.get("secret"));
    expect(encrypted.backupCodes).not.toContain(setup.backupCodes[1]);
    const changed = await request("change-password", { currentPassword: password, newPassword: password + "new", revokeOtherSessions: true }, cookies(second));
    expect(changed.status).toBe(200);
    expect(await (await request("get-session", undefined, cookies(recovery))).json()).toBeNull();
    expect((await request("sign-in/email", { email, password })).status).toBe(401);
    const newPasswordLogin = await request("sign-in/email", { email, password: password + "new" });
    expect(await newPasswordLogin.json()).toMatchObject({ twoFactorRedirect: true });
  });
});
