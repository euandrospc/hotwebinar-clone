"use client";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
          <Link href={prev}><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        </Button>
      ) : (
        <span />
      )}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Salvando..." : (
          <>
            {submitLabel ?? "Continuar"} <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
