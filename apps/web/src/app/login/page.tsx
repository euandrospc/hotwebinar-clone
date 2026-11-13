import type { Metadata } from "next";
import { cache } from "react";
import { prisma } from "db";
import { LoginClient } from "./login-client";

export const dynamic = "force-dynamic";

const getLoginBrandName = cache(async () => {
  const setting = await prisma.accountSettings.findFirst({
    where: { brandName: { not: null } },
    select: { brandName: true }
  });
  return setting?.brandName?.trim() || "Bravy Lives";
});

export async function generateMetadata(): Promise<Metadata> {
  return { title: `Entrar | ${await getLoginBrandName()}` };
}

export default function LoginPage() {
  return <LoginClient />;
}
