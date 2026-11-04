import { prisma } from "db";
import { createCredentialUser } from "@/lib/credential-user";

export async function createAttendant(input: { name: string; email: string; password: string }): Promise<void> {
  await createCredentialUser({ ...input, role: "attendant" });
}

export async function listAttendants() {
  return prisma.user.findMany({
    where: { role: { in: ["attendant", "disabled"] } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
}

export async function setAttendantDisabled(userId: string, disabled: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { role: disabled ? "disabled" : "attendant" }
  });
}

export async function deleteAttendant(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || !["attendant", "disabled"].includes(user.role)) {
    throw new Error("not_an_attendant");
  }
  // Cascades sessions/accounts/settings; past chat replies keep with authorUserId set null.
  await prisma.user.delete({ where: { id: userId } });
}
