import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/roles";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { AbTestsManager } from "@/components/ab-tests/ab-tests-manager";
import { isAbTestsDemoEnabled } from "@/lib/ab-tests-demo";

export const metadata: Metadata = { title: "Teste A/B" };
export const dynamic = "force-dynamic";

export default async function AbTestsPage({ searchParams }: {
  searchParams: Promise<{ demo?: string | string[] }>;
}) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) redirect(`${ADMIN_LOGIN_PATH}?from=/dashboard/ab-tests`);
  if (!hasRole((session.user as { role?: string }).role, ADMIN_ROLES)) redirect("/dashboard");
  const params = await searchParams;
  const demo = isAbTestsDemoEnabled(typeof params.demo === "string" ? params.demo : undefined, process.env.NODE_ENV, requestHeaders.get("host"));
  return <AbTestsManager key={demo ? "demo" : "real"} demo={demo} />;
}
