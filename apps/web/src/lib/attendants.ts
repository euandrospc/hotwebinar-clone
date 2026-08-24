import { prisma } from "db";
import { auth } from "@/lib/auth";

export async function createAttendant(input: { name: string; email: string; password: string }): Promise<void> {
  await auth.api.signUpEmail({
    body: { email: input.email, password: input.password, name: input.name }
  });
  await prisma.user.update({
    where: { email: input.email },
    data: { role: "attendant", emailVerified: true }
  });
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
