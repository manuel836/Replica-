"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CreditCard } from "lucide-react";
import type { BookingStatus } from "@/lib/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { TextareaField } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { formatMXN } from "@/lib/format";
import { cancelarTaquiza, pagarAnticipo, responderPropuesta } from "@/server/actions/public";

interface Props {
  code: string;
  token: string;
  status: BookingStatus;
  canPay: boolean;
  depositLabel: string;
  cancelPolicy: string;
  refundNote: string | null;
  changeHref: string;
}

/** Acciones del cliente en S07. */
export function ManageActions({ code, token, status, canPay, depositLabel, cancelPolicy, refundNote, changeHref }: Props) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState<"yes" | "no" | null>(null);
  const active = ["requested", "awaiting_payment", "confirmed", "proposed"].includes(status);

  if (!active) return null;

  return (
    <section aria-label="Opciones" className="flex flex-col gap-3">
      {error && (
        <Alert tone="danger" title="No se pudo completar">
          {error}
        </Alert>
      )}

      {status === "proposed" && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            loading={responding === "yes"}
            disabled={responding !== null}
            onClick={async () => {
              setResponding("yes");
              const r = await responderPropuesta(code, token, true);
              setResponding(null);
              if (!r.ok) return setError(r.error);
              toast.success("¡Listo! Aceptaste la nueva fecha.");
              router.refresh();
            }}
          >
            Aceptar la nueva fecha
          </Button>
          <Button
            variant="secondary"
            size="lg"
            loading={responding === "no"}
            disabled={responding !== null}
            onClick={async () => {
              setResponding("no");
              const r = await responderPropuesta(code, token, false);
              setResponding(null);
              if (!r.ok) return setError(r.error);
              router.refresh();
            }}
          >
            No me funciona
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {canPay && (
          <Button
            size="lg"
            loading={paying}
            onClick={async () => {
              setPaying(true);
              setError(null);
              const r = await pagarAnticipo(code, token);
              if (!r.ok) {
                setPaying(false);
                return setError(r.error);
              }
              window.location.assign(r.data.redirectTo);
            }}
          >
            <CreditCard aria-hidden className="size-5" />
            Pagar anticipo de {depositLabel}
          </Button>
        )}
        {status !== "proposed" && (
          <ButtonLink variant="secondary" href={changeHref}>
            <CalendarClock aria-hidden className="size-5" />
            Cambiar fecha o invitados
          </ButtonLink>
        )}
        <ConfirmDialog
          trigger={<Button variant="ghost" className="text-danger">Cancelar taquiza</Button>}
          title="¿Cancelar tu taquiza?"
          description={refundNote ?? "Si la cancelas, liberamos tu fecha para alguien más."}
          confirmLabel="Sí, cancelar"
          cancelLabel="No, mantenerla"
          onConfirm={async () => {
            const r = await cancelarTaquiza(code, token, reason);
            if (!r.ok) {
              setError(r.error);
              return;
            }
            toast.success(
              r.data.refundedCents > 0 ? `Cancelada. Te devolvemos ${formatMXN(r.data.refundedCents)}.` : "Tu taquiza quedó cancelada.",
            );
            router.refresh();
          }}
        >
          {cancelPolicy && <p className="text-sm text-text-muted">{cancelPolicy}</p>}
          <TextareaField label="¿Nos cuentas por qué?" optional value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </ConfirmDialog>
      </div>
    </section>
  );
}
