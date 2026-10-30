import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";
import { RealtimeDashboard } from "@/components/webinar/realtime-dashboard";
import { getWebinarRealtimeSnapshot } from "@/server/webinar-realtime";

export const dynamic = "force-dynamic";

export default async function RealtimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  const webinar = await prisma.webinar.findUnique({
    where: { id },
    select: { id: true, ownerId: true, title: true, name: true }
  });
  if (!webinar || webinar.ownerId !== session.user.id) notFound();

  const initialData = await getWebinarRealtimeSnapshot(id);

  return (
    <div className="container mx-auto py-6">
      <WebinarTabs webinarId={id} />
      <RealtimeDashboard
        key={id}
        webinarId={id}
        title={webinar.title || webinar.name || "Webinar"}
        initialData={initialData}
      />
    </div>
  );
}
