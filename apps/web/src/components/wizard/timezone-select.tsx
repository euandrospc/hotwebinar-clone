"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { TIMEZONES, AUTO_TIMEZONE_VALUE, resolveAutoTimezone } from "@/lib/timezones";

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
      <SelectTrigger>
        <SelectValue placeholder="Escolha um fuso" />
      </SelectTrigger>
      <SelectContent>
        {TIMEZONES.map((t) => (
          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
