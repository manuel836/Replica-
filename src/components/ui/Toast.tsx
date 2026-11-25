"use client";

import { Toaster as Sonner } from "sonner";

export { toast } from "sonner";

/** Avisos cortos. Sonner los anuncia en una región aria-live; los errores no se cierran solos tan rápido. */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-start gap-3 rounded-md border border-border bg-surface p-4 text-sm text-text shadow-pop",
          title: "font-semibold",
          description: "text-text-muted",
          success: "border-l-4 border-l-success",
          error: "border-l-4 border-l-danger",
          warning: "border-l-4 border-l-warning",
          info: "border-l-4 border-l-accent",
          closeButton: "text-text-muted",
          icon: "mt-0.5",
        },
      }}
    />
  );
}
