import Link from "next/link";
import { cn } from "@/lib/utils";

const STEPS = [
  { num: 1, label: "Início" },
  { num: 2, label: "Webinar" },
  { num: 3, label: "Login" },
  { num: 4, label: "Vídeo" },
  { num: 5, label: "Oferta" },
  { num: 6, label: "Chat" }
];

export function WizardShell({
  webinarId,
  currentStep,
  children
}: {
  webinarId: string;
  currentStep: number;
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto py-8">
      <ol className="flex flex-wrap gap-3">
        {STEPS.map((s) => {
          const active = s.num === currentStep;
          const done = s.num < currentStep;
          return (
            <li key={s.num}>
              <Link
                href={`/dashboard/webinars/${webinarId}/step-${s.num}`}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                  active && "border-destructive bg-destructive/10 font-semibold text-destructive",
                  done && !active && "text-foreground",
                  !active && !done && "text-muted-foreground"
                )}
              >
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  active ? "bg-destructive text-destructive-foreground" : "bg-accent"
                )}>
                  {s.num}
                </span>
                {s.label}
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="mt-8">{children}</div>
    </div>
  );
}
