"use client";
import "react-day-picker/style.css";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { zonedParts } from "@/lib/timezones";
import { CalendarRange, ChevronDown } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fullDateUtc = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const shortDateUtc = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function compactRangeLabel(selection: RangePickerSelection): string {
  const parts = (iso: string) => {
    const values = shortDateUtc.formatToParts(new Date(`${iso}T00:00:00Z`));
    const value = (type: string) => values.find((part) => part.type === type)!.value;
    return { dayMonth: `${value("day")} ${value("month").replace(/\.$/, "")}`, year: value("year") };
  };
  const from = parts(selection.from);
  const to = parts(selection.to);
  const fullDay = selection.fromTime === "00:00" && selection.toTime === "23:59";
  if (selection.from === selection.to) {
    const date = `${from.dayMonth}, ${from.year}`;
    return fullDay ? date : `${date} · ${selection.fromTime} – ${selection.toTime}`;
  }
  if (!fullDay) return `${from.dayMonth}, ${from.year} · ${selection.fromTime} – ${to.dayMonth}, ${to.year} · ${selection.toTime}`;
  return from.year === to.year
    ? `${from.dayMonth} – ${to.dayMonth}, ${to.year}`
    : `${from.dayMonth}, ${from.year} – ${to.dayMonth}, ${to.year}`;
}

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

export interface RangePickerSelection {
  from: string;
  to: string;
  fromTime: string;
  toTime: string;
}

interface Props {
  initialFrom: string;
  initialTo: string;
  initialFromTime: string;
  initialToTime: string;
  allowAll?: boolean;
  queryParams?: Record<string, string>;
  onApply?: (selection: RangePickerSelection) => void;
  timeZone?: string;
  className?: string;
  appearance?: "default" | "v2";
}

export function DashboardRangePicker({ initialFrom, initialTo, initialFromTime, initialToTime, allowAll = false, queryParams = {}, onApply, timeZone, className, appearance = "default" }: Props) {
  const reducedMotion = useReducedMotion();
  const v2 = appearance === "v2";
  const router = useRouter();
  const pathname = usePathname();
  // "YYYY-MM-DD" alone parses as UTC midnight (the day before in Brasília); pin it to local.
  const [range, setRange] = useState<DateRange | undefined>(initialFrom && initialTo ? {
    from: new Date(`${initialFrom}T00:00`),
    to: new Date(`${initialTo}T00:00`)
  } : undefined);
  const [fromTime, setFromTime] = useState(initialFromTime);
  const [toTime, setToTime] = useState(initialToTime);
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState({ from: initialFrom, to: initialTo, fromTime: initialFromTime, toTime: initialToTime });
  useEffect(() => {
    setApplied({ from: initialFrom, to: initialTo, fromTime: initialFromTime, toTime: initialToTime });
  }, [initialFrom, initialTo, initialFromTime, initialToTime]);

  function changeOpen(next: boolean) {
    if (next) {
      setRange(applied.from && applied.to ? { from: new Date(`${applied.from}T00:00`), to: new Date(`${applied.to}T00:00`) } : undefined);
      setFromTime(applied.fromTime);
      setToTime(applied.toTime);
    }
    setOpen(next);
  }
  function calendarToday() {
    if (!timeZone) return new Date();
    const { y, mo, d } = zonedParts(new Date(), timeZone);
    return new Date(y, mo, d);
  }

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
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(fTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(tTime)) return;
    if (`${toIsoDate(from)}T${fTime}` > `${toIsoDate(to)}T${tTime}`) return;
    const selection = { from: toIsoDate(from), to: toIsoDate(to), fromTime: fTime, toTime: tTime };
    setApplied(selection);
    if (onApply) {
      onApply(selection);
      setOpen(false);
      return;
    }
    const params = new URLSearchParams({ ...queryParams, from: `${toIsoDate(from)}T${fTime}:00`, to: `${toIsoDate(to)}T${tTime}:00` });
    if (allowAll) {
      const start = new Date(`${toIsoDate(from)}T${fTime}:00`);
      const end = new Date(`${toIsoDate(to)}T${tTime}:59.999`);
      if (start > end) return;
      const offset = -start.getTimezoneOffset();
      const zone = `${offset >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`;
      params.set("from", `${toIsoDate(from)}T${fTime}:00${zone}`);
      const endOffset = -end.getTimezoneOffset();
      const endZone = `${endOffset >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(endOffset) / 60)).padStart(2, "0")}:${String(Math.abs(endOffset) % 60).padStart(2, "0")}`;
      params.set("to", `${toIsoDate(to)}T${tTime}:59.999${endZone}`);
    }
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function apply() {
    if (!range?.from || !range?.to) return;
    go(range.from, range.to, fromTime, toTime);
  }

  function applyPreset(p: Preset) {
    const r = p.range(calendarToday());
    setRange(r);
    setFromTime("00:00");
    setToTime("23:59");
    go(r.from, r.to, "00:00", "23:59");
  }

  const formatDate = (iso: string) => v2 ? fullDateUtc.format(new Date(`${iso}T00:00:00Z`)) : fmt.format(new Date(`${iso}T00:00`));
  const label = applied.from && applied.to
    ? `${formatDate(applied.from)} ${applied.fromTime} ~ ${formatDate(applied.to)} ${applied.toTime}`
    : allowAll ? "Todo o período" : "Selecione o período";
  const triggerLabel = v2 && applied.from && applied.to ? compactRangeLabel(applied) : label;
  const invalidRange = !range?.from || !range?.to || !fromTime || !toTime ||
    `${toIsoDate(range.from)}T${fromTime}` > `${toIsoDate(range.to)}T${toTime}`;

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 max-w-full gap-2", v2 && "h-10 rounded-xl border-border/70 bg-card px-3 font-medium shadow-none hover:bg-muted/40", className)} title={label} aria-label={v2 ? `Selecionar período: ${label}` : undefined}>
          <CalendarRange aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("truncate text-xs", !v2 && "font-mono")}>{triggerLabel}</span>
          {v2 && <ChevronDown aria-hidden="true" className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={v2 ? 8 : 4} aria-label="Selecionar período" className={cn("w-auto max-w-[calc(100vw-1rem)] p-3", v2 && "dashboard-range-v2 max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-xl border-border/70 p-0 shadow-[0_12px_40px_-12px_rgba(16,40,30,0.2)]")}>
        <motion.div initial={v2 && !reducedMotion ? { opacity: 0, y: -4 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
        <div className={cn("mb-3 flex flex-wrap gap-2 border-b pb-3", v2 && "mb-0 grid grid-cols-3 gap-1 border-border/60 px-3 py-2 sm:flex sm:justify-between sm:gap-0.5")}>
          {allowAll && <Button size="sm" variant={!range ? "default" : "outline"} className="h-7 text-xs" onClick={() => {
            setRange(undefined);
            router.push(`${pathname}?${new URLSearchParams({ ...queryParams, period: "all" }).toString()}`);
            setOpen(false);
          }}>Todo o período</Button>}
          {PRESETS.map((p) => {
            const presetRange = p.range(calendarToday());
            const active = Boolean(range?.from && range?.to && toIsoDate(range.from) === toIsoDate(presetRange.from) && toIsoDate(range.to) === toIsoDate(presetRange.to) && fromTime === "00:00" && toTime === "23:59");
            return <Button key={p.label} size="sm" variant={v2 ? "ghost" : active ? "default" : "outline"} aria-pressed={active} className={cn("h-7 text-xs", v2 && "px-2 text-[11px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground", v2 && active && "bg-[#eaf2ed] text-[#0b5141] hover:bg-[#eaf2ed] hover:text-[#0b5141]")} onClick={() => applyPreset(p)}>
              {p.label}
            </Button>;
          })}
        </div>
        <div className={v2 ? "px-4 pb-3 pt-2" : undefined}>
        <DayPicker
          mode="range"
          selected={range}
          defaultMonth={range?.from}
          onSelect={setRange}
          locale={ptBR}
          numberOfMonths={months}
          labels={{ labelPrevious: () => "Mês anterior", labelNext: () => "Próximo mês" }}
          modifiersClassNames={v2 ? undefined : {
            selected: "!bg-destructive !text-white !rounded-none",
            range_start: "!rounded-l-md",
            range_end: "!rounded-r-md",
            today: "!font-bold"
          }}
          className={v2 ? "dashboard-range-calendar" : "text-sm [&_.rdp-day]:h-9 [&_.rdp-day]:w-9"}
        />
        </div>
        <div className={v2 ? "flex flex-col gap-3 border-t border-border/60 bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between" : undefined}>
        <div className={cn("mt-3 grid grid-cols-2 gap-3 border-t pt-3", v2 && "mt-0 gap-2 border-0 pt-0")}>
          <label className={cn("text-xs", v2 && "flex items-center gap-2 rounded-md border border-border/70 bg-background pl-2.5 text-[11px] text-muted-foreground focus-within:border-[#0b5141]/50 focus-within:ring-2 focus-within:ring-[#0b5141]/10")}>
            Início
            <input
              type="time"
              value={fromTime}
              onChange={(e) => setFromTime(e.target.value)}
              className={cn("mt-1 block h-8 w-full rounded-md border bg-background px-2 text-sm", v2 && "mt-0 h-8 min-w-0 flex-1 border-0 bg-transparent pl-0 pr-2 text-xs font-medium tabular-nums text-foreground outline-none sm:w-[86px]")}
            />
          </label>
          <label className={cn("text-xs", v2 && "flex items-center gap-2 rounded-md border border-border/70 bg-background pl-2.5 text-[11px] text-muted-foreground focus-within:border-[#0b5141]/50 focus-within:ring-2 focus-within:ring-[#0b5141]/10")}>
            Fim
            <input
              type="time"
              value={toTime}
              onChange={(e) => setToTime(e.target.value)}
              className={cn("mt-1 block h-8 w-full rounded-md border bg-background px-2 text-sm", v2 && "mt-0 h-8 min-w-0 flex-1 border-0 bg-transparent pl-0 pr-2 text-xs font-medium tabular-nums text-foreground outline-none sm:w-[86px]")}
            />
          </label>
        </div>
        <div className={cn("mt-3 flex justify-end gap-2", v2 && "mt-0 gap-1.5")}>
          <Button size="sm" variant="ghost" className={v2 ? "h-8 px-2.5 text-xs text-muted-foreground" : undefined} onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" className={v2 ? "h-8 px-3.5 text-xs" : undefined} onClick={apply} disabled={invalidRange}>Aplicar</Button>
        </div>
        </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
