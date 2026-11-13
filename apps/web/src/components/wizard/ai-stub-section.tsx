"use client";
import { Sparkles } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface AiStubSectionProps {
  badge: string;
  title: string;
  description: string;
  cta: string;
  /** Omit to render the action as unavailable with `disabledReason` in a tooltip. */
  onGenerate?: () => void;
  generating?: boolean;
  generatingLabel?: string;
  disabledReason?: string;
}

const buttonClass = "mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-palco px-3.5 text-[13px] font-bold text-palco-ink transition-colors hover:bg-palco/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0E0C] motion-reduce:transition-none";

export function AiStubSection({ badge, title, description, cta, onGenerate, generating, generatingLabel, disabledReason = "Em breve" }: AiStubSectionProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-palco/20 bg-palco/[0.04] p-4 font-palco">
      <span className="w-fit rounded-md bg-palco/[0.12] px-2 py-[3px] text-[11px] font-bold text-palco">
        {badge}
      </span>
      <h3 className="text-[15px] font-semibold text-neutral-100">{title}</h3>
      <p className="text-[13px] leading-relaxed text-neutral-400">{description}</p>
      {onGenerate ? (
        <button type="button" onClick={onGenerate} disabled={generating} aria-busy={generating} className={`${buttonClass} disabled:opacity-70`}>
          <Sparkles className={`h-[15px] w-[15px] ${generating ? "motion-safe:animate-pulse" : ""}`} aria-hidden />
          {generating ? generatingLabel ?? cta : cta}
        </button>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Unavailable: stays focusable so keyboard users get the tooltip, but does nothing. */}
              <button
                type="button"
                aria-disabled="true"
                aria-description={disabledReason}
                onClick={(e) => e.preventDefault()}
                className={`${buttonClass} cursor-not-allowed opacity-50 hover:bg-palco`}
              >
                <Sparkles className="h-[15px] w-[15px]" aria-hidden />
                {cta}
              </button>
            </TooltipTrigger>
            <TooltipContent>{disabledReason}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
