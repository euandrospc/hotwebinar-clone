import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "db";

// Used only by trusted server provisioning, while public signup stays disabled.
export async function createCredentialUser(input: { email: string; password: string; name: string; role: "admin" | "attendant" }) {
  if (input.password.length < 8 || input.password.length > 128) throw new Error("invalid_password_length");
  const id = randomUUID();
  return prisma.user.create({ data: {
    id, email: input.email.trim().toLowerCase(), name: input.name.trim(), role: input.role, emailVerified: true,
    accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(input.password) } }
  } });
}
