"use client";

interface ColorPickerFieldProps {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  "aria-label"?: string;
}

export function ColorPickerField({ id, value, onChange, "aria-label": ariaLabel }: ColorPickerFieldProps) {
  return (
    <label className="inline-flex items-center gap-2">
      <span
        className="inline-block h-6 w-6 rounded-full border shadow"
        style={{ backgroundColor: value }}
        aria-hidden
      />
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="sr-only"
      />
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </label>
  );
}
