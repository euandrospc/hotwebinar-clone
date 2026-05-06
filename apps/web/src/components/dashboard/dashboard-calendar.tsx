"use client";
import "react-day-picker/style.css";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";

export function DashboardCalendar({ scheduledDates }: { scheduledDates: string[] }) {
  const [month, setMonth] = useState<Date>(new Date());
  const marks = scheduledDates.map((iso) => new Date(iso));

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <CalendarIcon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold">Eventos agendados</h3>
      </header>

      <div className="mt-4 flex justify-center">
        <DayPicker
          mode="multiple"
          selected={marks}
          month={month}
          onMonthChange={setMonth}
          locale={ptBR}
          modifiersClassNames={{
            selected: "bg-destructive text-white rounded-md"
          }}
          className="text-sm [&_.rdp-day]:h-8 [&_.rdp-day]:w-8"
        />
      </div>
    </section>
  );
}
