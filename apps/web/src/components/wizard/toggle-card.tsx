"use client";
import styles from "./wizard.module.css";
import { Switch } from "@/components/ui/switch";
import { Info } from "@/components/icons";

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
    <div className={styles.toggle}>
      <div className={styles.toggleHeading}>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <Switch aria-label={title} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      </div>
      {info ? (
        <div className={styles.toggleInfo}>
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{info}</p>
        </div>
      ) : null}
    </div>
  );
}
