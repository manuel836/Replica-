// Reglas de disponibilidad y capacidad. Es la misma lógica que capacity_conflict() en
// db/migrations/0001_schema.sql: aquí se usa para pintar calendario y horarios (lectura) y en la capa
// de datos falsa también para escribir. Con Postgres, la escritura la decide la función SQL
// dentro de la transacción con candado.

import type { AvailabilityRule, Booking, Business, Conflict, DayState } from "@/lib/types";
import { addDaysLocal, fromMinutes, localToInstant, todayLocal, toMinutes, localDate } from "./time";

/** Lo que ocupa una taquiza: [inicio, fin + traslado). */
export interface Load {
  bookingId: string;
  start: Date;
  end: Date;
  guests: number;
  travelBufferMin: number;
}

const minutes = (n: number) => n * 60_000;

/** Taquizas que ocupan lugar en `date`: confirmadas, apartados vigentes y propuestas vigentes. */
export function loadsForDate(bookings: Booking[], date: string, now: Date, excludeId?: string): Load[] {
  const out: Load[] = [];
  for (const b of bookings) {
    if (b.id === excludeId) continue;
    if (b.status === "confirmed" && b.eventDate === date) {
      out.push({ bookingId: b.id, start: b.startAt, end: b.endAt, guests: b.guests, travelBufferMin: b.travelBufferMin });
    } else if (
      (b.status === "requested" || b.status === "awaiting_payment") &&
      b.eventDate === date &&
      b.holdExpiresAt &&
      b.holdExpiresAt > now
    ) {
      out.push({ bookingId: b.id, start: b.startAt, end: b.endAt, guests: b.guests, travelBufferMin: b.travelBufferMin });
    } else if (
      b.status === "proposed" &&
      b.proposedEventDate === date &&
      b.proposalExpiresAt &&
      b.proposalExpiresAt > now &&
      b.proposedStartAt &&
      b.proposedEndAt
    ) {
      out.push({
        bookingId: b.id,
        start: b.proposedStartAt,
        end: b.proposedEndAt,
        guests: b.guests,
        travelBufferMin: b.travelBufferMin,
      });
    }
  }
  return out;
}

interface CheckInput {
  business: Business;
  rule: AvailabilityRule | undefined;
  blocked: boolean;
  date: string;
  start: Date;
  end: Date;
  guests: number;
  travelBufferMin: number;
  loads: Load[];
  now?: Date;
}

/** null = cabe. Si no, el motivo. Mismo orden de revisión que la función SQL. */
export function capacityConflict(i: CheckInput): Conflict | null {
  const now = i.now ?? new Date();
  const zone = i.business.timezone;
  if (localDate(i.start, zone) !== i.date) return "date_mismatch";

  const today = todayLocal(zone, now);
  if (i.date < addDaysLocal(today, i.business.minNoticeDays)) return "too_soon";
  if (i.date > addDaysLocal(today, i.business.maxAdvanceDays)) return "too_far";
  if (i.blocked) return "blocked_date";
  if (!i.rule || !i.rule.isOpen) return "closed_day";

  const startMin = toMinutes(localTimeOf(i.start, zone));
  if (startMin < toMinutes(i.rule.firstStart) || startMin > toMinutes(i.rule.lastStart)) return "outside_hours";

  if (i.loads.length >= i.rule.maxBookingsPerDay) return "day_full";
  const guestsTaken = i.loads.reduce((s, l) => s + l.guests, 0);
  if (i.rule.maxGuestsPerDay !== null && guestsTaken + i.guests > i.rule.maxGuestsPerDay) return "guests_full";

  // Máximo de taquizas simultáneas dentro del horario nuevo (ocurre en el inicio de alguna).
  const newEnd = i.end.getTime() + minutes(i.travelBufferMin);
  const overlapping = i.loads
    .map((l) => ({ s: l.start.getTime(), e: l.end.getTime() + minutes(l.travelBufferMin) }))
    .filter((l) => l.s < newEnd && i.start.getTime() < l.e);
  const points = [i.start.getTime(), ...overlapping.map((l) => Math.max(l.s, i.start.getTime()))];
  const maxConcurrent = Math.max(0, ...points.map((p) => overlapping.filter((l) => l.s <= p && p < l.e).length));
  if (maxConcurrent >= i.business.teams) return "time_taken";

  return null;
}

function localTimeOf(instant: Date, zone: string): string {
  // Evita importar formateadores pesados aquí.
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    instant,
  );
}

/** Horas de inicio posibles de un día según la regla. */
export function candidateStarts(rule: AvailabilityRule): string[] {
  const out: string[] = [];
  for (let m = toMinutes(rule.firstStart); m <= toMinutes(rule.lastStart); m += rule.slotIntervalMin) out.push(fromMinutes(m));
  return out;
}

export interface Slot {
  time: string;
  free: boolean;
}

interface DayInput {
  business: Business;
  rule: AvailabilityRule | undefined;
  blocked: boolean;
  date: string;
  guests: number;
  loads: Load[];
  now?: Date;
}

/** Horarios de un día con libre/ocupado. Vacío si el día entero no se puede. */
export function daySlots(d: DayInput): Slot[] {
  if (!d.rule || !d.rule.isOpen) return [];
  const rule = d.rule;
  return candidateStarts(rule).flatMap((time) => {
    const start = localToInstant(d.date, time, d.business.timezone);
    const end = new Date(start.getTime() + minutes(rule.eventDurationMin));
    const c = capacityConflict({ ...d, start, end, travelBufferMin: rule.travelBufferMin });
    // Los motivos de día completo vacían la lista; los de horario lo marcan ocupado.
    if (c && c !== "time_taken" && c !== "outside_hours") return [];
    return [{ time, free: c === null }];
  });
}

/** Estado del día para el calendario. */
export function dayState(d: DayInput): DayState {
  const now = d.now ?? new Date();
  const today = todayLocal(d.business.timezone, now);
  if (d.date < addDaysLocal(today, d.business.minNoticeDays) || d.date > addDaysLocal(today, d.business.maxAdvanceDays))
    return "out";
  if (d.blocked) return "blocked";
  if (!d.rule || !d.rule.isOpen) return "closed";
  const slots = daySlots(d);
  const free = slots.filter((s) => s.free).length;
  if (free === 0) return "full";
  const remaining = d.rule.maxBookingsPerDay - d.loads.length;
  return remaining <= 1 || free <= 2 ? "few" : "available";
}

/** Texto para el cliente según el motivo. */
export const CONFLICT_MESSAGE: Record<Conflict, string> = {
  date_mismatch: "La fecha y la hora no coinciden. Vuelve a elegir el horario.",
  too_soon: "Esa fecha está muy cerca; necesitamos más días de anticipación.",
  too_far: "Esa fecha todavía no está abierta para agendar.",
  blocked_date: "Ese día no damos servicio.",
  closed_day: "Ese día no trabajamos.",
  outside_hours: "Esa hora está fuera de nuestro horario.",
  day_full: "Ese día ya está lleno.",
  guests_full: "Ese día ya no tenemos capacidad para tantos invitados.",
  time_taken: "Ese horario se acaba de ocupar.",
};
