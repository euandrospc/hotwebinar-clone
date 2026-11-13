"use client";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "@/components/icons";
import { WAITING_TEMPLATES, type WaitingTemplateId } from "@/lib/waiting-templates";

export interface WaitingTemplatePickerProps {
  value: WaitingTemplateId;
  onChange: (v: WaitingTemplateId) => void;
}

export function WaitingTemplatePicker({ value, onChange }: WaitingTemplatePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {WAITING_TEMPLATES.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={selected}
            className={cn(
              "relative flex min-h-[84px] flex-col items-start justify-start rounded-xl border p-3.5 pr-9 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none",
              selected ? "border-palco/45 bg-palco/[0.06]" : "border-[#1E241F] hover:border-palco/40"
            )}
          >
            <p className="text-[13px] font-semibold text-[#F2F5F2]">{t.label}</p>
            <p className="mt-1.5 text-xs leading-normal text-[#7C867E]">{t.description}</p>
            {selected ? (
              <CheckCircle2 aria-hidden="true" className="absolute right-3.5 top-3.5 h-[15px] w-[15px] text-palco" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
