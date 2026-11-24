"use client";

import { useEffect, useRef } from "react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

import type { DayState } from "@/lib/types";

/** Estado de un día, como lo devuelve GET /api/disponibilidad/mes. */
export type { DayState };

const key = (d: Date) => format(d, "yyyy-MM-dd");

interface BookingCalendarProps {
  /** Estado por día, con llave "yyyy-MM-dd". Un día sin estado se trata como "out". */
  days: Record<string, DayState>;
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  month?: Date;
  onMonthChange?: (month: Date) => void;
  startMonth?: Date;
  endMonth?: Date;
  loading?: boolean;
}

function CalendarDayButton({ day, modifiers, className, ...props }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      {...props}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-md text-base tabular-nums",
        "transition-colors duration-150 ease-brand",
        modifiers.selected
          ? "bg-accent font-semibold text-on-accent"
          : modifiers.disabled
            ? "cursor-not-allowed text-text-muted"
            : "font-medium text-text hover:bg-accent-subtle",
        modifiers.full && !modifiers.selected && "line-through",
        modifiers.blocked && !modifiers.selected && "bg-surface-muted",
        modifiers.today && !modifiers.selected && "ring-1 ring-focus ring-inset",
      )}
    >
      {day.date.getDate()}
      {modifiers.few && !modifiers.selected && (
        <span aria-hidden className="absolute bottom-1 size-1.5 rounded-pill bg-warning" />
      )}
    </button>
  );
}

export function BookingCalendar({
  days,
  selected,
  onSelect,
  month,
  onMonthChange,
  startMonth,
  endMonth,
  loading = false,
}: BookingCalendarProps) {
  const stateOf = (d: Date): DayState => days[key(d)] ?? "out";
  const is = (s: DayState) => (d: Date) => stateOf(d) === s;

  return (
    <div className="w-fit" aria-busy={loading || undefined}>
      <DayPicker
        mode="single"
        locale={es}
        selected={selected}
        onSelect={onSelect}
        month={month}
        onMonthChange={onMonthChange}
        startMonth={startMonth}
        endMonth={endMonth}
        showOutsideDays={false}
        disabled={(d) => !["available", "few"].includes(stateOf(d))}
        modifiers={{ few: is("few"), full: is("full"), blocked: is("blocked") }}
        labels={{
          labelDayButton: (date, m) =>
            [
              format(date, "EEEE d 'de' MMMM", { locale: es }),
              m.today && "hoy",
              m.selected && "seleccionado",
              m.few && "pocos lugares",
              m.full && "lleno",
              m.blocked && "sin servicio",
              m.disabled && !m.full && !m.blocked && "no disponible",
            ]
              .filter(Boolean)
              .join(", "),
          labelNext: () => "Mes siguiente",
          labelPrevious: () => "Mes anterior",
        }}
        components={{
          DayButton: CalendarDayButton,
          Chevron: ({ orientation }) =>
            orientation === "left" ? (
              <ChevronLeft aria-hidden className="size-5" />
            ) : (
              <ChevronRight aria-hidden className="size-5" />
            ),
        }}
        classNames={{
          root: cn("relative rounded-lg border border-border bg-surface p-3 shadow-card", loading && "opacity-60"),
          months: "flex flex-col",
          month: "flex flex-col gap-3",
          month_caption: "flex h-11 items-center px-1",
          caption_label: "text-lg font-semibold capitalize text-text",
          nav: "absolute top-3 right-3 flex gap-1",
          button_previous:
            "flex size-11 items-center justify-center rounded-md text-text hover:bg-surface-muted disabled:opacity-40",
          button_next:
            "flex size-11 items-center justify-center rounded-md text-text hover:bg-surface-muted disabled:opacity-40",
          month_grid: "border-collapse",
          weekdays: "flex",
          weekday: "w-11 pb-1 text-center text-xs uppercase text-text-muted",
          week: "flex",
          day: "p-0",
        }}
      />
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-muted" aria-label="Qué significa cada día">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm border border-border-input bg-surface" />
          Disponible
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-1.5 rounded-pill bg-warning" />
          Pocos lugares
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="line-through">
            12
          </span>
          Lleno
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-surface-muted" />
          Sin servicio
        </li>
      </ul>
    </div>
  );
}
