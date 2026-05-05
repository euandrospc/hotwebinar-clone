import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
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
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <WizardShell webinarId={id}>
      {children}
    </WizardShell>
  );
}
