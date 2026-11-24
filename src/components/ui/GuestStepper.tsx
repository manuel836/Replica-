"use client";

import { useId } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

interface GuestStepperProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Cuánto suben o bajan los botones. Se puede escribir cualquier número. */
  step?: number;
  hint?: string;
  error?: string;
}

export function GuestStepper({
  label = "Invitados",
  value,
  onChange,
  min = 1,
  max = 500,
  step = 5,
  hint,
  error,
}: GuestStepperProps) {
  const id = useId();
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const btn = cn(
    "flex size-11 items-center justify-center border border-border-input bg-surface text-text",
    "transition-colors duration-150 ease-brand hover:bg-surface-muted",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {label}
      </label>
      <div className="flex w-fit">
        <button
          type="button"
          className={cn(btn, "rounded-l-md")}
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          aria-label={`Quitar ${step} invitados`}
          aria-controls={id}
        >
          <Minus aria-hidden className="size-5" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onChange(n);
          }}
          onBlur={() => onChange(clamp(value))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(
            "h-11 w-20 border-y bg-surface text-center text-base font-semibold text-text tabular-nums",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
            error ? "border-danger" : "border-border-input",
          )}
        />
        <button
          type="button"
          className={cn(btn, "rounded-r-md")}
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          aria-label={`Agregar ${step} invitados`}
          aria-controls={id}
        >
          <Plus aria-hidden className="size-5" />
        </button>
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
