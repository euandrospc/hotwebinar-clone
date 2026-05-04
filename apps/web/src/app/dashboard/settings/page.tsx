import { getAccountSettings } from "@/server/actions/settings";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const initial = await getAccountSettings();
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold">Configurações</h1>
      <p className="mt-2 text-muted-foreground">Defaults aplicados a novos webinars.</p>
      <div className="mt-8">
        <SettingsForm initial={initial} />
      </div>
    </div>
  );
}
