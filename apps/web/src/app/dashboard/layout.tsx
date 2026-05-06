import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { AdminShell } from "@/components/admin/admin-shell";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { title: "HotWebinar" };
  const settings = await prisma.accountSettings.findUnique({
    where: { userId: session.user.id },
    select: { brandName: true }
  });
  const brand = settings?.brandName?.trim() || "HotWebinar";
  return { title: { default: brand, template: `%s | ${brand}` } };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
