import type { Metadata } from "next";
import { getAdminBrandName } from "@/server/admin-brand";
import { AdminShell } from "@/components/admin/admin-shell";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getAdminBrandName();
  return { title: { default: brand, template: `%s | ${brand}` } };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
