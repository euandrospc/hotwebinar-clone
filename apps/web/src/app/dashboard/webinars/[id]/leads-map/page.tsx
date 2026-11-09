import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page";
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
    <AdminPage>
      <WebinarTabs webinarId={id} />
      <AdminPageHeader title="Mapa de leads" description={w.title || w.name} />
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <LeadsMapClient pins={agg.pins} />
        <LeadsSummaryAside agg={agg} />
      </div>
    </AdminPage>
  );
}
