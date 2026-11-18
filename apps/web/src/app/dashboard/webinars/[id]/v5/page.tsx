import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { canAccessWebinar, ownerScope, toAccessUser } from "@/lib/webinar-access";
import type { RealtimeWebinarOption } from "@/lib/webinar-realtime-v5";
import { RealtimeDashboardV5 } from "@/components/webinar/realtime-dashboard-v5";
import { RealtimeBreadcrumbV5 } from "@/components/webinar/realtime-breadcrumb-v5";
import { getRealtimeSourceSnapshot, getRealtimeSourceWebinars, RealtimeSourceNotFoundError } from "@/server/realtime-source-v5";
import { buildRealtimeKpisV5DemoSnapshot, isRealtimeKpiDemoRequest } from "@/lib/realtime-kpis-v5-demo";

export const metadata: Metadata = { title: "Realtime V5" };

export const dynamic = "force-dynamic";

export default async function RealtimeV5Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ demo?: string | string[] }>;
}) {
  const { id } = await params;
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) notFound();

  const { demo: demoParam } = await searchParams;
  const demo = isRealtimeKpiDemoRequest({
    nodeEnv: process.env.NODE_ENV,
    host: requestHeaders.get("host"),
    demo: demoParam,
  });
  let initialSnapshot;
  let webinars: RealtimeWebinarOption[] | undefined;
  if (demo) {
    const webinar = await prisma.webinar.findUnique({ where: { id }, select: { id: true, ownerId: true, title: true, name: true } });
    if (!canAccessWebinar(session, webinar)) notFound();
    initialSnapshot = {
      ...buildRealtimeKpisV5DemoSnapshot(),
      webinarTitle: webinar!.title?.trim() || webinar!.name?.trim() || "Webinar",
    };
    // Demo navigation uses only authorized local metadata, never the operational
    // source or a made-up list of webinar IDs.
    webinars = await prisma.webinar.findMany({
      where: ownerScope(session),
      select: { id: true, title: true, name: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    }).then(rows => rows.map(row => ({ id: row.id, title: row.title?.trim() || row.name?.trim() || "Webinar" })))
      .catch(() => undefined);
  } else {
    const scope = { viewer: toAccessUser(session), host: requestHeaders.get("host") };
    const [snapshotResult, webinarsResult] = await Promise.allSettled([
      getRealtimeSourceSnapshot({ webinarId: id, ...scope }),
      getRealtimeSourceWebinars(scope),
    ]);
    if (webinarsResult.status === "fulfilled") webinars = webinarsResult.value;
    if (snapshotResult.status === "rejected") {
      if (snapshotResult.reason instanceof RealtimeSourceNotFoundError) notFound();
      return (
        <AdminPage className="!pt-5">
          <section data-realtime-version="v5" aria-label="Realtime dashboard">
            <RealtimeBreadcrumbV5 webinarId={id} webinarTitle={webinars?.find(webinar => webinar.id === id)?.title} webinars={webinars} />
            <p role="status" className="text-sm text-muted-foreground">Realtime data unavailable. Please refresh to try again.</p>
          </section>
        </AdminPage>
      );
    }
    initialSnapshot = snapshotResult.value;
  }

  return (
    <AdminPage className="!pt-5">
      <RealtimeDashboardV5 key={id} webinarId={id} initialSnapshot={initialSnapshot} webinars={webinars} demo={demo} />
    </AdminPage>
  );
}
