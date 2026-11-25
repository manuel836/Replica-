"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export interface Slot {
  /** "13:30", hora local del negocio. */
  time: string;
  free: boolean;
}

interface TimeSlotsProps {
  slots: Slot[];
  value?: string;
  onChange: (time: string) => void;
  legend?: string;
  name?: string;
}

/** Radios nativos con forma de botón: flechas del teclado y lectores de pantalla funcionan solos. */
export function TimeSlots({ slots, value, onChange, legend = "Hora de inicio", name }: TimeSlotsProps) {
  const auto = useId();
  const group = name ?? auto;

  if (slots.length === 0) {
    return (
      <p className="rounded-md bg-surface-muted p-4 text-sm text-text-muted">
        Ese día ya no tiene horarios. Elige otra fecha en el calendario.
      </p>
    );
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-text">{legend}</legend>
      <p className="mb-3 text-sm text-text-muted">Hora del centro de México</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((s) => {
          const id = `${group}-${s.time}`;
          return (
            <div key={s.time}>
              <input
                type="radio"
                id={id}
                name={group}
                value={s.time}
                checked={value === s.time}
                disabled={!s.free}
                onChange={() => onChange(s.time)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className={cn(
                  "flex h-11 cursor-pointer items-center justify-center rounded-md border text-base font-semibold tabular-nums",
                  "transition-colors duration-150 ease-brand",
                  "border-border-input bg-surface text-text hover:bg-accent-subtle",
                  "peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                  "peer-disabled:cursor-not-allowed peer-disabled:border-border peer-disabled:bg-surface-muted peer-disabled:font-normal peer-disabled:text-text-muted peer-disabled:line-through",
                )}
              >
                {s.time}
                {!s.free && <span className="sr-only"> (ocupado)</span>}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
