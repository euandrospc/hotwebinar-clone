"use client";
import { ColorPicker } from "@/components/ui/color-picker";
import { Pipette } from "@/components/icons";

interface ColorPickerFieldProps {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  "aria-label"?: string;
}

export function ColorPickerField({ id, value, onChange, "aria-label": ariaLabel }: ColorPickerFieldProps) {
  return (
    <ColorPicker value={value} onChange={onChange} aria-label={ariaLabel}>
      <button
        id={id}
        type="button"
        aria-label={ariaLabel ?? "Selecionar cor"}
        className="flex h-[42px] w-full min-w-0 items-center gap-2.5 rounded-[10px] border border-[#1E241F] bg-[#070807] px-3 text-left transition-colors hover:border-[#2E362F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none"
      >
        <span className="h-[18px] w-[18px] shrink-0 rounded-full border border-white/15" style={{ backgroundColor: value }} aria-hidden="true" />
        <span className="flex-1 font-mono text-xs text-[#C9D1CA]">{value}</span>
        <Pipette aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#7C867E]" />
      </button>
    </ColorPicker>
  );
}
