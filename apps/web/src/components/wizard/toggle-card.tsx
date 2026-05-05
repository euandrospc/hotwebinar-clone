"use client";
import { Switch } from "@/components/ui/switch";
import { Info } from "lucide-react";

export interface ToggleCardProps {
  title: string;
  description?: string;
  info?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}

export function ToggleCard({ title, description, info, checked, onCheckedChange, disabled }: ToggleCardProps) {
  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      </div>
      {info ? (
        <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{info}</p>
        </div>
      ) : null}
    </div>
  );
}
