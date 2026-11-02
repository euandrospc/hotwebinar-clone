import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { publicSaleNotificationDto } from "@/lib/public-dto";
import { SalesSimulation } from "./sales-simulation";

export default async function SalesPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const { id } = await params;
  const webinar = await prisma.webinar.findFirst({
    where: { id, ownerId: session.user.id },
    select: { title: true, saleNotifications: { orderBy: { showAtSec: "asc" } } }
  });
  if (!webinar) notFound();
  return <SalesSimulation title={webinar.title} notifications={webinar.saleNotifications.map(publicSaleNotificationDto)} />;
}
