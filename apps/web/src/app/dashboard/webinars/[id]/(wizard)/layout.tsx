import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { WizardShell } from "@/components/wizard/wizard-shell";

const STEP_RE = /\/step-(\d)$/;

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

  const h = await headers();
  const path = h.get("x-pathname") ?? "";
  const m = path.match(STEP_RE);
  const step = m ? parseInt(m[1], 10) : 1;

  return (
    <WizardShell webinarId={id} currentStep={step}>
      {children}
    </WizardShell>
  );
}
