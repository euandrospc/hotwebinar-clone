"use client";

import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTO_TIMEZONE_VALUE, zonedParts, zonedToUtc } from "@/lib/timezones";

interface Schedule {
  startDate: Date;
  endDate: Date;
}

export function RecurringScheduleFields({ startDate, endDate, timezone, onChange }: Schedule & {
  timezone: string;
  onChange: (schedule: Schedule) => void;
}) {
  const tz = !timezone || timezone === AUTO_TIMEZONE_VALUE ? "America/Sao_Paulo" : timezone;
  const start = zonedParts(startDate, tz);
  const end = zonedParts(endDate, tz);
  const time = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const startTime = time(start.h, start.mi);
  const endTime = time(end.h, end.mi);
  // Calendar dates are wall-clock dates, independent of the browser's timezone.
  const firstDate = new Date(start.y, start.mo, start.d, 12);

  function update(date: Date, from: string, to: string) {
    if (!from || !to) return;
    const [startHour, startMinute] = from.split(":").map(Number);
    const [endHour, endMinute] = to.split(":").map(Number);
    const y = date.getFullYear(), mo = date.getMonth(), d = date.getDate();
    const endDay = new Date(Date.UTC(y, mo, d + (to < from ? 1 : 0)));
    onChange({
      startDate: zonedToUtc(y, mo, d, startHour, startMinute, 0, tz),
      endDate: zonedToUtc(endDay.getUTCFullYear(), endDay.getUTCMonth(), endDay.getUTCDate(), endHour, endMinute, 0, tz)
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Começar a partir de</Label>
        <DateTimePicker
          value={firstDate}
          onChange={(date) => date && update(date, startTime, endTime)}
          ariaLabel="Começar a partir de"
          showTime={false}
        />
        <p className="text-xs text-muted-foreground">A primeira sessão será em um dos dias selecionados, a partir desta data.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="recurring-start-time">Horário de início</Label>
          <Input id="recurring-start-time" type="time" required value={startTime}
            onChange={(e) => update(firstDate, e.target.value, endTime)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recurring-end-time">Horário de finalização</Label>
          <Input id="recurring-end-time" type="time" required value={endTime}
            onChange={(e) => update(firstDate, startTime, e.target.value)} />
          {endTime < startTime && <p className="text-xs text-muted-foreground">Termina no dia seguinte.</p>}
        </div>
      </div>
    </div>
  );
}
