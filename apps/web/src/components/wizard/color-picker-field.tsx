"use client";
import { ColorPicker } from "@/components/ui/color-picker";

interface ColorPickerFieldProps {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  "aria-label"?: string;
}

export function ColorPickerField({ value, onChange, "aria-label": ariaLabel }: ColorPickerFieldProps) {
  return <ColorPicker value={value} onChange={onChange} aria-label={ariaLabel} />;
}
