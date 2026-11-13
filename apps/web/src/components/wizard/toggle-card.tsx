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
        <h3>{title}</h3>
        <Switch aria-label={title} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      </div>
      {description ? <p className="text-xs text-[#9AA39C]">{description}</p> : null}
      {info ? (
        <div className={styles.toggleInfo}>
          <Info aria-hidden="true" />
          <p>{info}</p>
        </div>
      ) : null}
    </div>
  );
}
