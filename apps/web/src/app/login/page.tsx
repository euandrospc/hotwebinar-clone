import { prisma } from "db";
import { LoginClient } from "./login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const setting = await prisma.accountSettings.findFirst({
    where: { brandName: { not: null } },
    select: { brandName: true }
  });
  const brandName = setting?.brandName?.trim() || "HotWebinar";
  return <LoginClient brandName={brandName} />;
}
