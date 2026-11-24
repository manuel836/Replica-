"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DayState } from "@/lib/types";
import { BookingCalendar } from "@/components/ui/BookingCalendar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { GuestStepper } from "@/components/ui/GuestStepper";
import { TimeSlots, type Slot } from "@/components/ui/TimeSlots";
import { formatMXN } from "@/lib/format";
import { cambiarTaquiza, diasDelMes, horariosDelDia } from "@/server/actions/public";
import { NETWORK_ERROR, safe } from "@/lib/safe-action";

interface Props {
  code: string;
  token: string;
  backHref: string;
  currentGuests: number;
  currentDate: string;
  minGuests: number;
  maxGuests: number;
  pricePerGuestCents: number;
  currentTotalCents: number;
  fixedCents: number;
  firstMonth: string;
  lastMonth: string;
}

const toDate = (ymd: string) => new Date(`${ymd}T12:00:00`);

export function RescheduleForm(p: Props) {
  const [guests, setGuests] = useState(p.currentGuests);
  const [month, setMonth] = useState(toDate(`${p.currentDate.slice(0, 7) >= p.firstMonth ? p.currentDate.slice(0, 7) : p.firstMonth}-01`));
  const [days, setDays] = useState<Record<string, DayState>>({});
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [time, setTime] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await diasDelMes(format(month, "yyyy-MM"), guests, p.code, p.token);
        if (alive) setDays(r);
      } catch {
        if (alive) setError(NETWORK_ERROR);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [month, guests, p.code, p.token]);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    setSlots(null);
    horariosDelDia(date, guests, p.code, p.token)
      .then((s) => alive && setSlots(s))
      .catch(() => {
        if (!alive) return;
        setSlots([]);
        setError(NETWORK_ERROR);
      });
    return () => {
      alive = false;
    };
  }, [date, guests, p.code, p.token]);

  const newTotal = p.pricePerGuestCents * guests + p.fixedCents;
  const diff = newTotal - p.currentTotalCents;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert tone="danger" title="No se pudo cambiar">
          {error}
        </Alert>
      )}
      <GuestStepper
        value={guests}
        onChange={setGuests}
        min={p.minGuests}
        max={p.maxGuests}
        step={5}
        hint={`Tu paquete es de ${p.minGuests}${p.maxGuests < 2000 ? ` a ${p.maxGuests}` : " o más"} invitados.`}
      />
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <BookingCalendar
          days={days}
          loading={loading}
          month={month}
          onMonthChange={setMonth}
          startMonth={toDate(`${p.firstMonth}-01`)}
          endMonth={toDate(`${p.lastMonth}-01`)}
          selected={date ? toDate(date) : undefined}
          onSelect={(d) => {
            setTime(undefined);
            setDate(d ? format(d, "yyyy-MM-dd") : null);
          }}
        />
        <div className="min-w-0 flex-1" aria-live="polite">
          {!date ? (
            <p className="rounded-md bg-surface-muted p-4 text-sm text-text-muted">Elige la nueva fecha.</p>
          ) : slots === null ? (
            <p className="p-4 text-sm text-text-muted">Buscando horarios…</p>
          ) : (
            <TimeSlots slots={slots} value={time} onChange={setTime} />
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 text-sm">
        <p className="text-text">
          Nuevo total: <strong>{formatMXN(newTotal)}</strong>
        </p>
        {diff !== 0 && (
          <p className="text-text-muted">
            {diff > 0 ? `Son ${formatMXN(diff)} más que antes.` : `Son ${formatMXN(-diff)} menos que antes.`}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <ButtonLink variant="ghost" href={p.backHref}>
          No cambiar nada
        </ButtonLink>
        <Button
          size="lg"
          disabled={!date || !time}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const r = await safe(cambiarTaquiza)(p.code, p.token, { date: date!, time: time!, guests });
            if (!r.ok) {
              setBusy(false);
              setError(r.error);
              return;
            }
            window.location.assign(p.backHref);
          }}
        >
          Guardar cambio
          {date && time && <span className="sr-only"> al {format(toDate(date), "d 'de' MMMM", { locale: es })} a las {time}</span>}
        </Button>
      </div>
    </div>
  );
}
