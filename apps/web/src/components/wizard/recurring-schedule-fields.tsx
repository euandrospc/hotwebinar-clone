"use client";

import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "@/components/icons";
import { AUTO_TIMEZONE_VALUE, zonedParts, zonedToUtc } from "@/lib/timezones";
import styles from "./wizard.module.css";

interface Schedule {
  startDate: Date;
  endDate: Date;
}

// Native picker stays clickable at the right edge; the visible clock sits on the left like the design.
const timeInput = "[&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

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
    <>
      <div className={styles.field}>
        <Label>Começar a partir de</Label>
        <div className={styles.dateTimeField}>
          <DateTimePicker
            value={firstDate}
            onChange={(date) => date && update(date, startTime, endTime)}
            ariaLabel="Começar a partir de"
            showTime={false}
          />
        </div>
        <p className={styles.hint}>A primeira sessão será em um dos dias selecionados, a partir desta data.</p>
      </div>
      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <Label htmlFor="recurring-start-time">Horário de início</Label>
          <div className={styles.iconInput}>
            <Clock aria-hidden="true" />
            <Input id="recurring-start-time" type="time" className={timeInput} required value={startTime}
            onChange={(e) => update(firstDate, e.target.value, endTime)} />
          </div>
        </div>
        <div className={styles.field}>
          <Label htmlFor="recurring-end-time">Horário de finalização</Label>
          <div className={styles.iconInput}>
            <Clock aria-hidden="true" />
            <Input id="recurring-end-time" type="time" className={timeInput} required value={endTime}
            onChange={(e) => update(firstDate, startTime, e.target.value)} />
          </div>
          {endTime < startTime && <p className={styles.hint}>Termina no dia seguinte.</p>}
        </div>
      </div>
    </>
  );
}
