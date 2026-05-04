import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "/dashboard";
  return <AdminShell pathname={pathname}>{children}</AdminShell>;
}
