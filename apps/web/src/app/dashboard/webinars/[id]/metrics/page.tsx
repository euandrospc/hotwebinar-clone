import { WebinarTabs } from "@/components/webinar/webinar-tabs";

export default async function MetricsStub({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="container mx-auto py-6">
      <WebinarTabs webinarId={id} />
      <h1 className="mt-6 text-3xl font-semibold">Métricas</h1>
      <p className="mt-2 text-muted-foreground">
        Em breve — sub-plan E entrega funil + heatmap CTA por webinar.
      </p>
    </div>
  );
}
