"use client";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface AiStubSectionProps {
  badge: string;
  title: string;
  description: string;
  cta: string;
}

export function AiStubSection({ badge, title, description, cta }: AiStubSectionProps) {
  return (
    <div className="rounded-lg bg-muted/40 p-4">
      <span className="inline-block rounded-full bg-destructive px-3 py-0.5 text-xs font-semibold uppercase text-destructive-foreground">
        {badge}
      </span>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="mt-4 block">
              <Button type="button" disabled className="w-full bg-emerald-700 text-white hover:bg-emerald-700">
                <Sparkles className="mr-2 h-4 w-4" />
                {cta}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Em breve</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
