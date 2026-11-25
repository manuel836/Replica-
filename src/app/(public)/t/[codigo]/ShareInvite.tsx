"use client";

import { Copy, Share2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { whatsappShareLink } from "@/lib/format";

/**
 * Para que el anfitrión avise a sus invitados: fecha, hora, dirección y mapa.
 * Nunca lleva el enlace privado de la taquiza (con él se puede cambiar o cancelar).
 */
export function ShareInvite({ text }: { text: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Texto copiado: pégalo donde quieras");
    } catch {
      toast.error("No se pudo copiar. Mantén presionado el texto para copiarlo.");
    }
  }
  return (
    <section aria-labelledby="invitados" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="invitados" className="flex items-center gap-2 text-lg text-text">
        <Share2 aria-hidden className="size-5 text-text-muted" />
        Avisa a tus invitados
      </h2>
      <p className="text-sm text-text-muted">Les llega la fecha, la hora y cómo llegar. No incluye tu enlace privado.</p>
      <blockquote className="whitespace-pre-line wrap-anywhere rounded-md bg-surface-muted p-3 text-sm text-text">{text}</blockquote>
      <div className="flex flex-col gap-2 sm:flex-row">
        <ButtonLink variant="whatsapp" external href={whatsappShareLink(text)}>
          Mandar por WhatsApp
        </ButtonLink>
        <Button variant="secondary" onClick={copy}>
          <Copy aria-hidden className="size-4" />
          Copiar texto
        </Button>
      </div>
    </section>
  );
}
