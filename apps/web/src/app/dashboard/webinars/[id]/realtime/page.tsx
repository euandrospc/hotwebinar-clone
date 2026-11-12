import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { canAccessWebinar } from "@/lib/webinar-access";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";
import { RealtimeDashboard } from "@/components/webinar/realtime-dashboard";
import { getWebinarRealtimeSnapshot } from "@/server/webinar-realtime";

export const metadata: Metadata = { title: "Tempo real do webinar" };

export const dynamic = "force-dynamic";

export default async function RealtimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  const webinar = await prisma.webinar.findUnique({
    where: { id },
    select: { id: true, ownerId: true, title: true, name: true }
  });
  if (!canAccessWebinar(session, webinar)) notFound();

  const initialData = await getWebinarRealtimeSnapshot(id);

  return (
    <AdminPage>
      <WebinarTabs webinarId={id} />
      <RealtimeDashboard
        key={id}
        webinarId={id}
        title={webinar.title || webinar.name || "Webinar"}
        initialData={initialData}
      />
    </AdminPage>
  );
}
