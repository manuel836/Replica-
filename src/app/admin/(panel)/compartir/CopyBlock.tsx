"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

export function CopyBlock({ label, text, mono }: { label: string; text: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-text">{label}</p>
      <p className={cn("whitespace-pre-line wrap-anywhere text-sm text-text", mono && "font-mono")}>{text}</p>
      <Button
        size="sm"
        variant="secondary"
        className="w-fit"
        aria-label={`Copiar: ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            toast.success("Copiado");
          } catch {
            toast.error("No se pudo copiar. Mantén presionado el texto para copiarlo.");
          }
        }}
      >
        <Copy aria-hidden className="size-4" />
        Copiar
      </Button>
    </div>
  );
}
