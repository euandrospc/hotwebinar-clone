import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step7Form } from "@/components/wizard/step-7-form";

export default async function Step7Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({
    where: { id },
    include: { saleNotifications: { orderBy: { showAtSec: "asc" } } }
  });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step7Form
      webinarId={id}
      slug={w.slug}
      initial={{
        notifications: w.saleNotifications.map((n) => ({
          id: n.id,
          showAtSec: n.showAtSec,
          buyerName: n.buyerName,
          productName: n.productName,
          price: n.price
        }))
      }}
    />
  );
}
