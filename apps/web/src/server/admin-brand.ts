import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "db";
import { auth } from "@/lib/auth";

export const getAdminBrandName = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return "Bravy Lives";
  const settings = await prisma.accountSettings.findUnique({
    where: { userId: session.user.id },
    select: { brandName: true }
  });
  return settings?.brandName?.trim() || "Bravy Lives";
});
