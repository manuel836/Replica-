"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { PhoneField, SelectField, TextareaField, TextField } from "@/components/ui/Field";
import { GuestStepper } from "@/components/ui/GuestStepper";
import type { Slot } from "@/components/ui/TimeSlots";
import { toast } from "@/components/ui/Toast";
import { crearTaquizaManual } from "@/server/actions/admin";
import { NETWORK_ERROR, safe } from "@/lib/safe-action";

interface Props {
  packages: { id: string; name: string; isActive: boolean; minGuests: number }[];
  zones: { id: string; name: string }[];
}

export function ManualBookingForm({ packages, zones }: Props) {
  const router = useRouter();
  const key = useRef("");
  if (!key.current && typeof crypto !== "undefined") key.current = crypto.randomUUID();
  const [f, setF] = useState({
    name: "",
    whatsapp: "",
    date: "",
    time: "",
    packageId: packages.find((p) => p.isActive)?.id ?? "",
    zoneId: zones[0]?.id ?? "",
    address: "",
    neighborhood: "",
    eventType: "",
    customerNotes: "",
    status: "confirmed" as "confirmed" | "requested",
  });
  const [guests, setGuests] = useState(50);
  const [force, setForce] = useState(false);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ text: string; capacity: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (!f.date) return setSlots(null);
    let alive = true;
    fetch(`/api/disponibilidad/dia?fecha=${f.date}&invitados=${guests}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((s: Slot[]) => alive && setSlots(s))
      .catch(() => {
        if (!alive) return;
        setSlots([]);
        setBanner({ text: NETWORK_ERROR, capacity: false });
      });
    return () => {
      alive = false;
    };
  }, [f.date, guests]);

  const chosen = slots?.find((s) => s.time === f.time);

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setBanner(null);
        const r = await safe(crearTaquizaManual)({ ...f, guests, force, idempotencyKey: key.current });
        setBusy(false);
        if (r.ok) {
          toast.success("Taquiza registrada");
          router.push(`/admin/t/${r.data.id}`);
          return;
        }
        setErrors(r.fields ?? {});
        const capacity = ["time_taken", "day_full", "guests_full", "blocked_date", "closed_day", "too_soon", "too_far", "outside_hours"].includes(
          (r as { code?: string }).code ?? "",
        );
        setBanner({ text: r.error, capacity });
      }}
    >
      {banner && (
        <Alert tone="danger" title="No se guardó">
          {banner.text}
          {banner.capacity && !force && " Si sabes que sí les da tiempo, marca «Guardar aunque esté lleno»."}
        </Alert>
      )}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-text">Cliente</legend>
        <TextField label="Nombre" required value={f.name} onChange={set("name")} error={errors.name} />
        <PhoneField label="WhatsApp" required value={f.whatsapp} onChange={set("whatsapp")} error={errors.whatsapp} />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-text">Cuándo y cuántos</legend>
        <TextField label="Fecha" type="date" required value={f.date} onChange={set("date")} error={errors.date} />
        <SelectField
          label="Hora de inicio"
          required
          value={f.time}
          onChange={set("time")}
          error={errors.time}
          disabled={!slots || slots.length === 0}
          placeholder={!f.date ? "Elige la fecha primero" : slots && slots.length === 0 ? "Ese día no se trabaja" : "Elige la hora"}
          options={(slots ?? []).map((s) => ({ value: s.time, label: s.free ? s.time : `${s.time} (ocupado)` }))}
        />
        <GuestStepper value={guests} onChange={setGuests} min={1} max={2000} step={10} error={errors.guests} />
        <SelectField
          label="Paquete"
          required
          value={f.packageId}
          onChange={set("packageId")}
          error={errors.packageId}
          options={packages.map((p) => ({ value: p.id, label: p.isActive ? p.name : `${p.name} (inactivo)` }))}
        />
      </fieldset>
      {chosen && !chosen.free && (
        <Alert tone="warning" title="Ese horario se cruza con otra taquiza" />
      )}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-text">Dónde</legend>
        {zones.length > 0 && (
          <SelectField label="Zona" value={f.zoneId} onChange={set("zoneId")} options={zones.map((z) => ({ value: z.id, label: z.name }))} />
        )}
        <TextField label="Dirección" required value={f.address} onChange={set("address")} error={errors.address} />
        <TextField label="Colonia" optional value={f.neighborhood} onChange={set("neighborhood")} />
        <TextField label="Tipo de evento" optional value={f.eventType} onChange={set("eventType")} />
      </fieldset>

      <TextareaField label="Notas" optional value={f.customerNotes} onChange={set("customerNotes")} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-text">Estado</legend>
        {[
          { v: "confirmed", label: "Confirmada", hint: "Ya quedó con el cliente." },
          { v: "requested", label: "Por confirmar", hint: "Aparta la fecha mientras lo confirmas." },
        ].map((o) => (
          <label key={o.v} className="flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="radio"
              name="status"
              value={o.v}
              checked={f.status === o.v}
              onChange={() => setF((x) => ({ ...x, status: o.v as "confirmed" | "requested" }))}
              className="mt-1 size-5 accent-accent-text"
            />
            <span>
              <span className="font-semibold text-text">{o.label}</span>
              <span className="block text-sm text-text-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="mt-1 size-5 accent-accent-text" />
        <span>
          <span className="font-semibold text-text">Guardar aunque esté lleno</span>
          <span className="block text-sm text-text-muted">Queda anotado en el historial.</span>
        </span>
      </label>

      <Button type="submit" size="lg" loading={busy} className="w-fit">
        <Save aria-hidden className="size-5" />
        Guardar taquiza
      </Button>
    </form>
  );
}
