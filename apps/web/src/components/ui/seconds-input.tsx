"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SecondsInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function split(value: number | undefined): { h: string; m: string; s: string } {
  if (value === undefined || Number.isNaN(value) || value < 0) {
    return { h: "", m: "", s: "" };
  }
  const total = Math.floor(value);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h: pad(h), m: pad(m), s: pad(s) };
}

function clampSeg(raw: string, max: number): string {
  const digits = raw.replace(/\D/g, "").slice(0, 2);
  if (digits === "") return "";
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return "";
  return pad(Math.min(n, max));
}

export function SecondsInput({ value, onChange, className, disabled, ...rest }: SecondsInputProps) {
  const [parts, setParts] = React.useState(split(value));

  React.useEffect(() => {
    setParts(split(value));
  }, [value]);

  function commit(next: { h: string; m: string; s: string }) {
    const h = parseInt(next.h || "0", 10) || 0;
    const m = parseInt(next.m || "0", 10) || 0;
    const s = parseInt(next.s || "0", 10) || 0;
    onChange(h * 3600 + m * 60 + s);
  }

  const ariaLabel = rest["aria-label"];

  return (
    <div className={cn("inline-flex items-center gap-2", className)} aria-label={ariaLabel}>
      {(["h", "m", "s"] as const).map((key) => {
        const placeholder = key === "h" ? "00h" : key === "m" ? "00m" : "00s";
        const max = key === "h" ? 99 : 59;
        return (
          <input
            key={key}
            type="text"
            inputMode="numeric"
            disabled={disabled}
            placeholder={placeholder}
            aria-label={ariaLabel ? `${ariaLabel} ${key === "h" ? "horas" : key === "m" ? "minutos" : "segundos"}` : undefined}
            value={parts[key]}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 2);
              setParts((p) => ({ ...p, [key]: v }));
            }}
            onBlur={() => {
              setParts((p) => {
                const cleaned = { ...p, [key]: clampSeg(p[key], max) };
                commit(cleaned);
                return cleaned;
              });
            }}
            className="h-10 w-14 rounded-md border border-input bg-background px-2 py-2 text-center text-sm tabular-nums ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        );
      })}
    </div>
  );
}
