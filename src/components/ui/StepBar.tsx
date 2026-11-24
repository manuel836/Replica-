import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface StepBarProps {
  steps: string[];
  /** Índice desde 0 del paso actual. */
  current: number;
  /** Nombre del bloque para lectores de pantalla. */
  label?: string;
}

export function StepBar({ steps, current, label = "Pasos para agendar" }: StepBarProps) {
  return (
    <nav aria-label={label}>
      <ol className="flex items-center gap-2">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-pill text-sm font-semibold",
                  done && "bg-ink text-on-ink",
                  active && "bg-accent text-on-accent",
                  !done && !active && "border border-border-input bg-surface text-text-muted",
                )}
              >
                {done ? <Check aria-hidden className="size-4" /> : i + 1}
              </span>
              <span className={cn("text-sm", active ? "font-semibold text-text" : "text-text-muted", !active && "max-sm:sr-only")}>
                {step}
                {done && <span className="sr-only"> (completado)</span>}
              </span>
              {i < steps.length - 1 && <span aria-hidden className="h-px flex-1 bg-border" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
