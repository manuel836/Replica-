"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarOff, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { SelectField, TextField } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { bloquearFecha, desbloquearFecha, guardarDisponibilidad } from "@/server/actions/settings";

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
// Lunes primero, como se usa en México.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

interface Initial {
  days: { weekday: number; isOpen: boolean; firstStart: string; lastStart: string }[];
  slotIntervalMin: string;
  eventDurationHours: string;
  travelBufferMin: string;
  maxBookingsPerDay: string;
  maxGuestsPerDay: string;
  minNoticeDays: string;
  maxAdvanceDays: string;
  teams: string;
}

export function AvailabilityForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: Exclude<keyof Initial, "days">) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const setDay = (weekday: number, patch: Partial<Initial["days"][number]>) =>
    setV((x) => ({ ...x, days: x.days.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)) }));

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await guardarDisponibilidad(v);
        setBusy(false);
        if (!r.ok) {
          setErrors((r as { fields?: Record<string, string> }).fields ?? {});
          toast.error(r.error);
          return;
        }
        setErrors({});
        toast.success("Disponibilidad guardada");
        router.refresh();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold text-text">Días y horas de inicio</legend>
        <p className="mb-2 text-sm text-text-muted">La primera y la última hora a la que puede empezar una taquiza.</p>
        {ORDER.map((wd) => {
          const d = v.days.find((x) => x.weekday === wd)!;
          return (
            <div key={wd} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-surface p-3">
              <label className="flex min-h-11 w-36 cursor-pointer items-center gap-3 font-semibold text-text">
                <input
                  type="checkbox"
                  checked={d.isOpen}
                  onChange={(e) => setDay(wd, { isOpen: e.target.checked })}
                  className="size-5 accent-accent-text"
                />
                {WEEKDAYS[wd]}
              </label>
              {d.isOpen ? (
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`first-${wd}`}>
                    {WEEKDAYS[wd]}: primera hora
                  </label>
                  <input
                    id={`first-${wd}`}
                    type="time"
                    step={900}
                    value={d.firstStart}
                    onChange={(e) => setDay(wd, { firstStart: e.target.value })}
                    className="h-11 rounded-md border border-border-input bg-surface px-2 text-base text-text"
                  />
                  <span aria-hidden className="text-text-muted">
                    a
                  </span>
                  <label className="sr-only" htmlFor={`last-${wd}`}>
                    {WEEKDAYS[wd]}: última hora
                  </label>
                  <input
                    id={`last-${wd}`}
                    type="time"
                    step={900}
                    value={d.lastStart}
                    onChange={(e) => setDay(wd, { lastStart: e.target.value })}
                    className="h-11 rounded-md border border-border-input bg-surface px-2 text-base text-text"
                  />
                </div>
              ) : (
                <span className="text-sm text-text-muted">No se trabaja</span>
              )}
            </div>
          );
        })}
        {errors.days && <p className="text-sm font-medium text-danger">{errors.days}</p>}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-semibold text-text">Capacidad</legend>
        <TextField label="Taquizas por día (máximo)" type="number" inputMode="numeric" min={0} value={v.maxBookingsPerDay} onChange={set("maxBookingsPerDay")} error={errors.maxBookingsPerDay} />
        <TextField
          label="Invitados por día (máximo)"
          optional
          type="number"
          inputMode="numeric"
          value={v.maxGuestsPerDay}
          onChange={set("maxGuestsPerDay")}
          error={errors.maxGuestsPerDay}
          hint="Vacío = sin límite."
        />
        <TextField label="Equipos al mismo tiempo" type="number" inputMode="numeric" min={1} value={v.teams} onChange={set("teams")} error={errors.teams} hint="Cuántas taquizas pueden coincidir en horario." />
        <TextField label="Duración de una taquiza (horas)" type="number" inputMode="decimal" step={0.5} value={v.eventDurationHours} onChange={set("eventDurationHours")} error={errors.eventDurationHours} />
        <TextField label="Traslado y montaje (minutos)" type="number" inputMode="numeric" value={v.travelBufferMin} onChange={set("travelBufferMin")} error={errors.travelBufferMin} hint="Tiempo libre después de cada taquiza." />
        <SelectField
          label="Horarios cada"
          value={v.slotIntervalMin}
          onChange={set("slotIntervalMin")}
          options={[
            { value: "15", label: "15 minutos" },
            { value: "30", label: "30 minutos" },
            { value: "60", label: "1 hora" },
          ]}
        />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-semibold text-text">Anticipación</legend>
        <TextField label="Mínimo de días antes" type="number" inputMode="numeric" value={v.minNoticeDays} onChange={set("minNoticeDays")} error={errors.minNoticeDays} />
        <TextField label="Máximo de días antes" type="number" inputMode="numeric" value={v.maxAdvanceDays} onChange={set("maxAdvanceDays")} error={errors.maxAdvanceDays} />
      </fieldset>

      <Button type="submit" size="lg" loading={busy} className="w-fit">
        <Save aria-hidden className="size-5" />
        Guardar disponibilidad
      </Button>
    </form>
  );
}

export function BlockedDates({ dates, today }: { dates: { date: string; reason: string }[]; today: string }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [affected, setAffected] = useState<{ id: string; code: string }[]>([]);
  const label = (d: string) => format(new Date(`${d}T12:00:00`), "EEEE d 'de' MMMM yyyy", { locale: es });

  return (
    <section aria-labelledby="bloqueos" className="flex flex-col gap-4">
      <h2 id="bloqueos" className="text-lg text-text">
        Días sin servicio
      </h2>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!date) return;
          setBusy(true);
          const r = await bloquearFecha(date, reason);
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          setAffected(r.data.affected);
          toast.success("Día bloqueado");
          setDate("");
          setReason("");
          router.refresh();
        }}
      >
        <TextField label="Fecha" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField label="Motivo" optional value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacaciones, otro evento…" />
        <Button type="submit" loading={busy} disabled={!date}>
          Bloquear
        </Button>
      </form>
      {affected.length > 0 && (
        <Alert tone="warning" title="Ese día ya tiene taquizas">
          No se cancelaron. Revisa:{" "}
          {affected.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ", "}
              <a className="font-semibold underline" href={`/admin/t/${a.id}`}>
                {a.code}
              </a>
            </span>
          ))}
        </Alert>
      )}
      {dates.length === 0 ? (
        <EmptyState icon={CalendarOff} title="Sin días bloqueados">
          Bloquea vacaciones o días en que ya tienes otro compromiso.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {dates.map((d) => (
            <li key={d.date} className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3">
              <span className="text-text first-letter:uppercase">
                {label(d.date)}
                {d.reason && <span className="block text-sm text-text-muted">{d.reason}</span>}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Desbloquear ${label(d.date)}`}
                onClick={async () => {
                  const r = await desbloquearFecha(d.date);
                  if (!r.ok) return toast.error(r.error);
                  toast.success("Día desbloqueado");
                  router.refresh();
                }}
              >
                <Trash2 aria-hidden className="size-4" />
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
