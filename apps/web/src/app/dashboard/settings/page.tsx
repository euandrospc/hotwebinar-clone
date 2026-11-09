import { AccountSecurity } from "@/components/account-security";
import { getAccountSettings } from "@/server/actions/settings";
import { SettingsForm } from "@/components/settings-form";

import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page";
import styles from "@/components/management-v2.module.css";

export default async function SettingsPage() {
  const initial = await getAccountSettings();
  return (
    <AdminPage>
      <AdminPageHeader title="Configurações" description="Preferências dos webinars e segurança da sua conta." />
      <div className={styles.settingsGrid}>
        <SettingsForm initial={initial} />
        <AccountSecurity />
      </div>
    </AdminPage>
  );
}
