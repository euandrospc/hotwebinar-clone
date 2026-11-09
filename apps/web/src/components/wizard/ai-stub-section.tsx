"use client";
import { Sparkles } from "@/components/icons";
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
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
      <span className="inline-block rounded-md bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary">
        {badge}
      </span>
      <h3 className="mt-2 text-[13px] font-semibold">{title}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="mt-3 block">
              <Button type="button" disabled className="h-8 w-full rounded-lg text-xs">
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
