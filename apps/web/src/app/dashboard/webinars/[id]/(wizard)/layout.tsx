import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessWebinar } from "@/lib/webinar-access";
import { prisma } from "db";
import { WizardShell } from "@/components/wizard/wizard-shell";

export default async function WizardLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!canAccessWebinar(session, w)) notFound();

  return (
    <WizardShell webinarId={id} webinarTitle={w.title || w.name || "Webinar sem título"}>
      {children}
    </WizardShell>
  );
}
