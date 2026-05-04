"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SecondsInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

function format(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "";
  const m = Math.floor(value / 60);
  const s = value % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function parse(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  const match = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (match) {
    const m = parseInt(match[1], 10);
    const s = parseInt(match[2], 10);
    if (!Number.isNaN(m) && !Number.isNaN(s) && s < 60) return m * 60 + s;
    return 0;
  }
  const asNumber = parseInt(trimmed, 10);
  if (!Number.isNaN(asNumber) && asNumber >= 0) return asNumber;
  return 0;
}

export const SecondsInput = React.forwardRef<HTMLInputElement, SecondsInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [text, setText] = React.useState(format(value));

    React.useEffect(() => {
      setText(format(value));
    }, [value]);

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        placeholder="00:00"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const parsed = parse(text);
          setText(format(parsed));
          onChange(parsed);
        }}
        className={cn(
          "flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
        {...props}
      />
    );
  }
);
SecondsInput.displayName = "SecondsInput";
