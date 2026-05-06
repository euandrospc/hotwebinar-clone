import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { aggregateLeadsForMap } from "@/lib/leads-map-aggregate";
import { LeadsMapClient } from "@/components/leads-map/leads-map-client";
import { LeadsSummaryAside } from "@/components/leads-map/leads-summary-aside";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";

export default async function LeadsMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  const leads = await prisma.lead.findMany({
    where: { webinarId: id },
    select: {
      id: true,
      name: true,
      email: true,
      city: true,
      region: true,
      country: true,
      lat: true,
      lng: true,
      sessionStart: true
    }
  });

  const agg = aggregateLeadsForMap(
    leads.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      city: l.city,
      region: l.region,
      country: l.country,
      lat: l.lat,
      lng: l.lng,
      createdAt: l.sessionStart
    }))
  );

  return (
    <div className="container mx-auto py-6">
      <WebinarTabs webinarId={id} />
      <h1 className="mt-6 text-3xl font-semibold">Mapa de leads</h1>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <LeadsMapClient pins={agg.pins} />
        <LeadsSummaryAside agg={agg} />
      </div>
    </div>
  );
}
