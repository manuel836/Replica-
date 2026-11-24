"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CalendarClock, CheckCheck, Link2, Save, UserX, X } from "lucide-react";
import type { BookingStatus } from "@/lib/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { SelectField, TextareaField, TextField } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { TimeSlots, type Slot } from "@/components/ui/TimeSlots";
import { toast } from "@/components/ui/Toast";
import {
  aceptarTaquiza,
  cancelarPorNegocio,
  completarTaquiza,
  guardarNotas,
  marcarNoRealizada,
  proponerOtraFecha,
  rechazarTaquiza,
  regenerarEnlace,
  registrarPago,
} from "@/server/actions/admin";
import { NETWORK_ERROR, safe } from "@/lib/safe-action";

type Result = { ok: true; data?: unknown } | { ok: false; error: string; code?: string };

/** Después de una acción: aviso, y si hay mensaje listo, un enlace para mandarlo por WhatsApp. */
function useAfter() {
  const router = useRouter();
  const [wa, setWa] = useState<{ url: string; label: string } | null>(null);
  const [error, setError] = useState<{ text: string; code?: string } | null>(null);
  const handle = (r: Result, success: string, waLabel = "Avisar al cliente por WhatsApp") => {
    if (!r.ok) {
      setError({ text: r.error, code: r.code });
      return false;
    }
    setError(null);
    toast.success(success);
    const url = (r.data as { whatsappUrl?: string | null } | undefined)?.whatsappUrl;
    setWa(url ? { url, label: waLabel } : null);
    router.refresh();
    return true;
  };
  return { wa, error, handle, setError };
}

/** Conflictos de agenda que el dueño puede saltarse (él decide si le da tiempo). */
const OVERRIDABLE = ["day_full", "guests_full", "time_taken", "blocked_date", "closed_day", "outside_hours", "too_far"];

interface ActionsProps {
  id: string;
  status: BookingStatus;
  needsAttention: boolean;
  hasOnlineDeposit: boolean;
  guests: number;
}

export function BookingActions({ id, status, needsAttention, hasOnlineDeposit, guests }: ActionsProps) {
  const { wa, error, handle } = useAfter();
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const pending = status === "requested" || status === "awaiting_payment";

  const act = async (key: string, fn: () => Promise<Result>, success: string) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    return handle(r, success);
  };

  return (
    <section aria-label="Acciones" className="flex flex-col gap-3">
      {error && (
        <Alert tone="danger" title="No se pudo">
          {error.text}
          {OVERRIDABLE.includes(error.code ?? "") && (pending || needsAttention) && (
            <div className="mt-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => act("force", () => safe(aceptarTaquiza)(id, true), "Aceptada (se forzó la capacidad)")}
              >
                Aceptar de todos modos
              </Button>
            </div>
          )}
        </Alert>
      )}
      {wa && (
        <Alert tone="success" title="Listo" action={<ButtonLink variant="whatsapp" size="sm" external href={wa.url}>{wa.label}</ButtonLink>}>
          Abre WhatsApp con el mensaje ya escrito.
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {(pending || needsAttention) && status !== "confirmed" && (
          <Button size="lg" loading={busy === "accept"} onClick={() => act("accept", () => safe(aceptarTaquiza)(id), "Taquiza aceptada")}>
            <Check aria-hidden className="size-5" />
            Aceptar
          </Button>
        )}
        {(pending || status === "proposed") && <ProposeDialog id={id} guests={guests} onDone={handle} />}
        {(pending || status === "proposed") && (
          <ConfirmDialog
            trigger={
              <Button variant="secondary">
                <X aria-hidden className="size-5" />
                Rechazar
              </Button>
            }
            title="¿Rechazar esta solicitud?"
            description={hasOnlineDeposit ? "Se devuelve el anticipo completo al cliente." : "La fecha se libera para otros clientes."}
            confirmLabel="Rechazar"
            onConfirm={async () => {
              handle(await safe(rechazarTaquiza)(id, reason), "Solicitud rechazada");
            }}
          >
            <TextareaField label="Motivo para el cliente" optional rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </ConfirmDialog>
        )}
        {status === "confirmed" && (
          <>
            <Button loading={busy === "done"} onClick={() => act("done", () => safe(completarTaquiza)(id), "Marcada como completada")}>
              <CheckCheck aria-hidden className="size-5" />
              Completada
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="secondary">
                  <UserX aria-hidden className="size-5" />
                  No se realizó
                </Button>
              }
              title="¿Marcar como no realizada?"
              description="Por ejemplo, si al llegar no había nadie."
              confirmLabel="Marcar"
              onConfirm={async () => {
                handle(await safe(marcarNoRealizada)(id, reason), "Marcada como no realizada");
              }}
            >
              <TextareaField label="¿Qué pasó?" optional rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </ConfirmDialog>
          </>
        )}
        {["requested", "awaiting_payment", "confirmed", "proposed"].includes(status) && (
          <ConfirmDialog
            trigger={<Button variant="ghost" className="text-danger">Cancelar taquiza</Button>}
            title="¿Cancelar esta taquiza?"
            description={
              hasOnlineDeposit ? "Se devuelve el anticipo completo al cliente y se libera la fecha." : "Se libera la fecha para otros clientes."
            }
            confirmLabel="Sí, cancelar"
            onConfirm={async () => {
              handle(await safe(cancelarPorNegocio)(id, reason), "Taquiza cancelada");
            }}
          >
            <TextareaField label="Motivo para el cliente" optional rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </ConfirmDialog>
        )}
        <ConfirmDialog
          trigger={
            <Button variant="ghost">
              <Link2 aria-hidden className="size-5" />
              Nuevo enlace
            </Button>
          }
          title="¿Cambiar el enlace del cliente?"
          description="El enlace anterior deja de funcionar. Úsalo si el cliente lo compartió por error."
          confirmLabel="Cambiar enlace"
          tone="primary"
          onConfirm={async () => {
            handle(await safe(regenerarEnlace)(id), "Enlace nuevo listo", "Mandar el enlace nuevo por WhatsApp");
          }}
        />
      </div>
    </section>
  );
}

function ProposeDialog({ id, guests, onDone }: { id: string; guests: number; onDone: (r: Result, msg: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [time, setTime] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(d: string) {
    setDate(d);
    setTime(undefined);
    setSlots(null);
    if (!d) return;
    try {
      const res = await fetch(`/api/disponibilidad/dia?fecha=${d}&invitados=${guests}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setSlots(await res.json());
    } catch {
      setSlots([]);
      setError(NETWORK_ERROR);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="secondary">
          <CalendarClock aria-hidden className="size-5" />
          Proponer otra fecha
        </Button>
      }
      title="Proponer otra fecha"
      description="El cliente la acepta o la rechaza desde su enlace. Mientras, esa fecha queda apartada."
      footer={
        <Button
          disabled={!date || !time}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const r = await safe(proponerOtraFecha)(id, date, time!);
            setBusy(false);
            if (!r.ok) return setError(r.error);
            if (onDone(r, "Propuesta guardada")) setOpen(false);
          }}
        >
          Guardar propuesta
        </Button>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <TextField label="Fecha" type="date" value={date} onChange={(e) => pick(e.target.value)} />
      {date && (slots === null ? <p className="text-sm text-text-muted">Buscando horarios…</p> : <TimeSlots slots={slots} value={time} onChange={setTime} />)}
    </Modal>
  );
}

export function NotesForm({ id, initial }: { id: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await safe(guardarNotas)(id, notes);
        setBusy(false);
        if (r.ok) toast.success("Notas guardadas");
        else toast.error(r.error);
      }}
    >
      <TextareaField
        label="Notas internas"
        hint="Solo las ve tu equipo."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button type="submit" variant="secondary" loading={busy} disabled={notes === initial} className="w-fit">
        <Save aria-hidden className="size-4" />
        Guardar notas
      </Button>
    </form>
  );
}

export function PaymentForm({ id, suggestedPesos }: { id: string; suggestedPesos: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("balance");
  const [method, setMethod] = useState("cash");
  const [pesos, setPesos] = useState(String(suggestedPesos || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="secondary" className="w-fit">Registrar pago en efectivo o transferencia</Button>}
      title="Registrar pago"
      footer={
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const r = await safe(registrarPago)(id, { kind, method, pesos });
            setBusy(false);
            if (!r.ok) return setError(r.error);
            toast.success("Pago registrado");
            setOpen(false);
            router.refresh();
          }}
        >
          Guardar pago
        </Button>
      }
    >
      <SelectField
        label="Concepto"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        options={[
          { value: "deposit", label: "Anticipo" },
          { value: "balance", label: "Saldo" },
        ]}
      />
      <SelectField
        label="Forma de pago"
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        options={[
          { value: "cash", label: "Efectivo" },
          { value: "transfer", label: "Transferencia" },
        ]}
      />
      <TextField label="Monto en pesos" inputMode="decimal" value={pesos} onChange={(e) => setPesos(e.target.value)} error={error ?? undefined} />
    </Modal>
  );
}
