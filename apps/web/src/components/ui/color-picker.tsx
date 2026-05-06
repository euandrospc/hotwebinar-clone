"use client";
import { useCallback, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Pipette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (next: string) => void;
  "aria-label"?: string;
  children?: React.ReactNode;
}

function normalizeHex(input: string): string | null {
  const v = input.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) return null;
  return v.toLowerCase();
}

export function ColorPicker({ value, onChange, "aria-label": ariaLabel, children }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);

  const handlePicker = useCallback(
    (next: string) => {
      setHex(next);
      onChange(next);
    },
    [onChange]
  );

  function handleHexInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setHex(raw.startsWith("#") ? raw : `#${raw}`);
    const normalized = normalizeHex(raw.startsWith("#") ? raw : `#${raw}`);
    if (normalized) onChange(normalized);
  }

  const trigger = children ?? (
    <button
      type="button"
      aria-label={ariaLabel ?? "Selecionar cor"}
      className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
    >
      <span
        className="inline-block h-5 w-5 rounded-full border shadow-inner"
        style={{ backgroundColor: value }}
        aria-hidden
      />
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
      <Pipette className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setHex(value); }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className={cn("w-64 space-y-3 p-3")}>
        <HexColorPicker color={value} onChange={handlePicker} style={{ width: "100%" }} />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">HEX</span>
          <Input
            value={hex}
            onChange={handleHexInput}
            spellCheck={false}
            className="h-8 font-mono text-xs"
            aria-label="Hex"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
