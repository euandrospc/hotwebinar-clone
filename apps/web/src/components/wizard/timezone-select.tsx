"use client";
import adminStyles from "@/components/admin/admin-page.module.css";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { TIMEZONES, AUTO_TIMEZONE_VALUE, resolveAutoTimezone, timezoneLabel } from "@/lib/timezones";

export interface TimezoneSelectProps {
  value: string;
  onChange: (v: string) => void;
}

export function TimezoneSelect({ value, onChange }: TimezoneSelectProps) {
  function handleChange(next: string) {
    if (next === AUTO_TIMEZONE_VALUE) {
      onChange(resolveAutoTimezone());
    } else {
      onChange(next);
    }
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger aria-label="Fuso horário">
        <SelectValue placeholder="Escolha um fuso" />
      </SelectTrigger>
      <SelectContent className={adminStyles.portal}>
        {TIMEZONES.map((t) => (
          <SelectItem key={t.value} value={t.value}>{timezoneLabel(t.value, t.label)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
