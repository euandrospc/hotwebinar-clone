"use client";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { WAITING_TEMPLATES, type WaitingTemplateId } from "@/lib/waiting-templates";

export interface WaitingTemplatePickerProps {
  value: WaitingTemplateId;
  onChange: (v: WaitingTemplateId) => void;
}

export function WaitingTemplatePicker({ value, onChange }: WaitingTemplatePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {WAITING_TEMPLATES.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={selected}
            className={cn(
              "relative rounded-md border bg-card p-4 text-left transition",
              selected ? "ring-2 ring-primary" : "hover:border-primary/50"
            )}
          >
            <p className="text-sm font-semibold">{t.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
            {selected ? (
              <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
