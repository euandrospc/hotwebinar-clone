"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function WizardNav({
  webinarId,
  step,
  submitting,
  submitLabel
}: {
  webinarId: string;
  step: number;
  submitting: boolean;
  submitLabel?: string;
}) {
  const prev = step > 1 ? `/dashboard/webinars/${webinarId}/step-${step - 1}` : null;
  return (
    <div className="mt-8 flex items-center justify-between border-t pt-4">
      {prev ? (
        <Button asChild variant="outline" type="button">
          <Link href={prev}>← Voltar</Link>
        </Button>
      ) : (
        <span />
      )}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Salvando..." : (submitLabel ?? "Continuar →")}
      </Button>
    </div>
  );
}
