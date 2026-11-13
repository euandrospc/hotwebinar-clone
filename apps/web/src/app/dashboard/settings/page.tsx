import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AccountSecurity } from "@/components/account-security";
import { getAccountSettings, listAccountSessions } from "@/server/actions/settings";
import { SettingsForm } from "@/components/settings-form";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const [initial, sessions] = await Promise.all([getAccountSettings(), listAccountSessions()]);
  return (
    <AdminPage>
      <AdminPageHeader title="Configurações" description="Preferências dos webinars e segurança da sua conta." />
      <div className="mt-2 flex flex-col">
        <SettingsForm initial={initial} />
        <AccountSecurity email={session.user.email} sessions={sessions} />
      </div>
    </AdminPage>
  );
}
