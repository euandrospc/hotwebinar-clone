import { getAccountSettings, getSalesWebhookSecret } from "@/server/actions/settings";
import { SettingsForm } from "@/components/settings-form";
import { SalesWebhookCard } from "@/components/sales-webhook-card";

export default async function SettingsPage() {
  const [initial, secret] = await Promise.all([getAccountSettings(), getSalesWebhookSecret()]);
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold">Configurações</h1>
      <p className="mt-2 text-muted-foreground">Defaults aplicados a novos webinars.</p>
      <div className="mt-8 space-y-8">
        <SettingsForm initial={initial} />
        <SalesWebhookCard initialSecret={secret} />
      </div>
    </div>
  );
}
