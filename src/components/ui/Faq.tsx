import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Una pregunta que se abre y se cierra (details/summary: funciona sin JavaScript y con teclado). */
export function FaqItem({ q, children, open = false }: { q: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-lg border border-border bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 font-semibold text-text [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown aria-hidden className="size-5 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-4 text-text-muted">{children}</div>
    </details>
  );
}
