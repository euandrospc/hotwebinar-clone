"use client";
import "react-day-picker/style.css";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from "date-fns";
import { CalendarRange } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

type Preset = { label: string; range: (now: Date) => { from: Date; to: Date } };

// Whole days in the browser's time zone; weeks start on the calendar's first day (ptBR).
export const PRESETS: Preset[] = [
  { label: "Hoje", range: (n) => ({ from: n, to: n }) },
  { label: "Ontem", range: (n) => ({ from: subDays(n, 1), to: subDays(n, 1) }) },
  { label: "Últimos 7 dias", range: (n) => ({ from: subDays(n, 6), to: n }) },
  {
    label: "Semana passada",
    range: (n) => ({
      from: startOfWeek(subWeeks(n, 1), { locale: ptBR }),
      to: endOfWeek(subWeeks(n, 1), { locale: ptBR })
    })
  },
  { label: "Este mês", range: (n) => ({ from: startOfMonth(n), to: n }) },
  { label: "Mês passado", range: (n) => ({ from: startOfMonth(subMonths(n, 1)), to: endOfMonth(subMonths(n, 1)) }) }
];

interface Props {
  initialFrom: string;
  initialTo: string;
  initialFromTime: string;
  initialToTime: string;
}

export function DashboardRangePicker({ initialFrom, initialTo, initialFromTime, initialToTime }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // "YYYY-MM-DD" alone parses as UTC midnight (the day before in Brasília); pin it to local.
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(`${initialFrom}T00:00`),
    to: new Date(`${initialTo}T00:00`)
  });
  const [fromTime, setFromTime] = useState(initialFromTime);
  const [toTime, setToTime] = useState(initialToTime);
  const [open, setOpen] = useState(false);
  // Two months side by side don't fit a phone screen.
  const [months, setMonths] = useState(2);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setMonths(mq.matches ? 2 : 1);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  function go(from: Date, to: Date, fTime: string, tTime: string) {
    const params = new URLSearchParams({ from: `${toIsoDate(from)}T${fTime}:00`, to: `${toIsoDate(to)}T${tTime}:00` });
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function apply() {
    if (!range?.from || !range?.to) return;
    go(range.from, range.to, fromTime, toTime);
  }

  function applyPreset(p: Preset) {
    const r = p.range(new Date());
    setRange(r);
    setFromTime("00:00");
    setToTime("23:59");
    go(r.from, r.to, "00:00", "23:59");
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
      <PopoverContent align="end" className="w-auto max-w-[calc(100vw-1rem)] p-3">
        <div className="mb-3 flex flex-wrap gap-2 border-b pb-3">
          {PRESETS.map((p) => (
            <Button key={p.label} size="sm" variant="outline" className="h-7 text-xs" onClick={() => applyPreset(p)}>
              {p.label}
            </Button>
          ))}
        </div>
        <DayPicker
          mode="range"
          selected={range}
          onSelect={setRange}
          locale={ptBR}
          numberOfMonths={months}
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
