"use client";
import "react-day-picker/style.css";
import { useState, useTransition, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";

const calendarStyle = {
  "--rdp-accent-color": "#0b5141",
  "--rdp-accent-background-color": "#eef6e5",
  "--rdp-selected-border": "2px solid transparent",
  "--rdp-day-height": "32px",
  "--rdp-day-width": "32px",
  "--rdp-day_button-height": "30px",
  "--rdp-day_button-width": "30px",
  "--rdp-nav-height": "32px",
  "--rdp-nav_button-height": "28px",
  "--rdp-nav_button-width": "28px"
} as CSSProperties;

export function DashboardCalendar({ scheduledDates, selectedDate }: { scheduledDates: string[]; selectedDate?: string }) {
  const [month, setMonth] = useState<Date>(new Date());
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const marks = scheduledDates.map((iso) => new Date(iso)).filter((date) => !Number.isNaN(date.getTime()));

  function selectDay(date: Date) {
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const params = new URLSearchParams({ from: `${day}T00:00:00`, to: `${day}T23:59:00` });
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-none" aria-label="Eventos agendados" aria-busy={pending}>
      <h2 className="text-sm font-semibold">Eventos agendados</h2>

      <div className="mt-4">
        <DayPicker
          mode="single"
          required
          selected={selectedDate ? new Date(`${selectedDate}T00:00`) : undefined}
          onSelect={selectDay}
          modifiers={{ scheduled: marks }}
          month={month}
          onMonthChange={setMonth}
          locale={ptBR}
          style={calendarStyle}
          labels={{
            labelPrevious: () => "Mês anterior",
            labelNext: () => "Próximo mês"
          }}
          modifiersClassNames={{
            scheduled: "v2-scheduled",
            selected: "v2-selected",
            today: "v2-today"
          }}
          className="dashboard-calendar-v2 w-full text-xs"
        />
      </div>
      <p className="mt-auto flex items-center gap-2 pt-4 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#a8dd70]" aria-hidden="true" />
        Datas com webinars agendados
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{pending ? "Atualizando período…" : "Selecione um dia para filtrar o dashboard."}</p>
    </section>
  );
}
