"use client";
import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (value: Date | undefined) => void;
  ariaLabel?: string;
}

export function DateTimePicker({ value, onChange, ariaLabel }: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const time = value ? format(value, "HH:mm") : "00:00";

  function handleDate(date: Date | undefined) {
    if (!date) return onChange(undefined);
    const [h, m] = time.split(":").map((n) => parseInt(n, 10));
    const next = new Date(date);
    next.setHours(h || 0, m || 0, 0, 0);
    onChange(next);
    setOpen(false);
  }

  function handleTime(t: string) {
    if (!value) return;
    const [h, m] = t.split(":").map((n) => parseInt(n, 10));
    const next = new Date(value);
    next.setHours(h || 0, m || 0, 0, 0);
    onChange(next);
  }

  return (
    <div className="flex gap-2" aria-label={ariaLabel}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-48 justify-start text-left font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : "Selecione data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar mode="single" selected={value} onSelect={handleDate} initialFocus />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        value={time}
        onChange={(e) => handleTime(e.target.value)}
        className="w-28"
      />
    </div>
  );
}
