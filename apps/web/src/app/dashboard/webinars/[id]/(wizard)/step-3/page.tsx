import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step3Form } from "@/components/wizard/step-3-form";

export default async function Step3Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step3Form
      webinarId={id}
      initial={{
        logoUrl: w.logoUrl ?? "",
        primaryColor: w.primaryColor ?? "",
        loginButtonText: w.loginButtonText,
        loginButtonColor: w.loginButtonColor,
        nameEnabled: w.nameEnabled,
        nameRequired: w.nameRequired,
        emailEnabled: w.emailEnabled,
        emailRequired: w.emailRequired,
        phoneEnabled: w.phoneEnabled,
        phoneRequired: w.phoneRequired,
        namePlaceholder: w.namePlaceholder,
        emailPlaceholder: w.emailPlaceholder,
        phonePlaceholder: w.phonePlaceholder
      }}
    />
  );
}
