"use client";
import "react-day-picker/style.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { CalendarRange } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

interface Props {
  initialFrom: string;
  initialTo: string;
  initialFromTime: string;
  initialToTime: string;
}

export function DashboardRangePicker({ initialFrom, initialTo, initialFromTime, initialToTime }: Props) {
  const router = useRouter();
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(initialFrom),
    to: new Date(initialTo)
  });
  const [fromTime, setFromTime] = useState(initialFromTime);
  const [toTime, setToTime] = useState(initialToTime);
  const [open, setOpen] = useState(false);

  function apply() {
    if (!range?.from || !range?.to) return;
    const fromIso = `${toIsoDate(range.from)}T${fromTime}:00`;
    const toIso = `${toIsoDate(range.to)}T${toTime}:00`;
    const params = new URLSearchParams({ from: fromIso, to: toIso });
    router.push(`/dashboard?${params.toString()}`);
    setOpen(false);
  }

  const label =
    range?.from && range?.to
      ? `${fmt.format(range.from)} ${fromTime} ~ ${fmt.format(range.to)} ${toTime}`
      : "Selecione o período";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-xs">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <DayPicker
          mode="range"
          selected={range}
          onSelect={setRange}
          locale={ptBR}
          numberOfMonths={2}
          modifiersClassNames={{
            selected: "!bg-destructive !text-white !rounded-none",
            range_start: "!rounded-l-md",
            range_end: "!rounded-r-md",
            today: "!font-bold"
          }}
          className="text-sm [&_.rdp-day]:h-9 [&_.rdp-day]:w-9"
        />
        <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
          <label className="text-xs">
            Início
            <input
              type="time"
              value={fromTime}
              onChange={(e) => setFromTime(e.target.value)}
              className="mt-1 block h-8 w-full rounded-md border bg-background px-2 text-sm"
            />
          </label>
          <label className="text-xs">
            Fim
            <input
              type="time"
              value={toTime}
              onChange={(e) => setToTime(e.target.value)}
              className="mt-1 block h-8 w-full rounded-md border bg-background px-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" onClick={apply} disabled={!range?.from || !range?.to}>Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
