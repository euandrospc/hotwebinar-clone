"use client";
import { cn } from "@/lib/utils";
import { Check } from "@/components/icons";
import { WAITING_TEMPLATES, type WaitingTemplateId } from "@/lib/waiting-templates";

export interface WaitingTemplatePickerProps {
  value: WaitingTemplateId;
  onChange: (v: WaitingTemplateId) => void;
}

export function WaitingTemplatePicker({ value, onChange }: WaitingTemplatePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {WAITING_TEMPLATES.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={selected}
            className={cn(
              "relative rounded-lg border bg-card px-3 py-3 pr-7 text-left transition-colors motion-reduce:transition-none",
              selected ? "border-primary/30 bg-primary/5" : "hover:border-primary/50"
            )}
          >
            <p className="text-xs font-medium">{t.label}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t.description}</p>
            {selected ? (
              <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
