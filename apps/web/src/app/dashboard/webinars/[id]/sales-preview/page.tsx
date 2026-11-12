import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { ownerScope } from "@/lib/webinar-access";
import { publicSaleNotificationDto } from "@/lib/public-dto";
import { SalesSimulation } from "./sales-simulation";

export const metadata: Metadata = { title: "Simulação de vendas" };

export default async function SalesPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const { id } = await params;
  const webinar = await prisma.webinar.findFirst({
    where: { id, ...ownerScope(session) },
    select: { title: true, saleNotifications: { orderBy: { showAtSec: "asc" } } }
  });
  if (!webinar) notFound();
  return <AdminPage><WebinarTabs webinarId={id} /><SalesSimulation title={webinar.title} notifications={webinar.saleNotifications.map(publicSaleNotificationDto)} /></AdminPage>;
}
