import "server-only";
import type { AvailabilityRule, Booking, Business, DayState } from "@/lib/types";
import { store } from "@/server/data";
import { capacityConflict, daySlots, dayState, loadsForDate, type Slot } from "@/server/domain/availability";
import { addDaysLocal, localToInstant, weekdayOf } from "@/server/domain/time";

export interface DayContext {
  business: Business;
  rule: AvailabilityRule | undefined;
  blocked: boolean;
  bookings: Booking[];
}

async function context(from: string, to: string) {
  const db = store();
  const business = await db.getBusiness();
  const [rules, blocked, bookings] = await Promise.all([
    db.listRules(business.id),
    db.listBlockedDates(business.id),
    db.listBookingsTouching(business.id, from, to),
  ]);
  const blockedSet = new Set(blocked.map((b) => b.date));
  const ruleFor = (date: string) => rules.find((r) => r.weekday === weekdayOf(date));
  return { business, ruleFor, blockedSet, bookings };
}

/** Estado de cada día de un mes "yyyy-MM" para `guests` invitados. */
export async function monthStates(month: string, guests: number, excludeBookingId?: string): Promise<Record<string, DayState>> {
  const first = `${month}-01`;
  const last = addDaysLocal(`${addDaysLocal(first, 32).slice(0, 7)}-01`, -1);
  const { business, ruleFor, blockedSet, bookings } = await context(first, last);
  const now = new Date();
  const out: Record<string, DayState> = {};
  for (let d = first; d <= last; d = addDaysLocal(d, 1)) {
    out[d] = dayState({
      business,
      rule: ruleFor(d),
      blocked: blockedSet.has(d),
      date: d,
      guests,
      loads: loadsForDate(bookings, d, now, excludeBookingId),
      now,
    });
  }
  return out;
}

/** Horarios de un día. `excludeBookingId` para cambiar una taquiza sin contarse a sí misma. */
export async function slotsFor(date: string, guests: number, excludeBookingId?: string): Promise<Slot[]> {
  const { business, ruleFor, blockedSet, bookings } = await context(date, date);
  const now = new Date();
  return daySlots({
    business,
    rule: ruleFor(date),
    blocked: blockedSet.has(date),
    date,
    guests,
    loads: loadsForDate(bookings, date, now, excludeBookingId),
    now,
  });
}

/**
 * Revisa si cabe una taquiza. Debe llamarse DENTRO de store().withDayLock(date) para que
 * nadie más tome el lugar entre la revisión y la escritura.
 */
export async function checkCapacity(input: {
  date: string;
  time: string;
  guests: number;
  excludeBookingId?: string;
}) {
  const { business, ruleFor, blockedSet, bookings } = await context(input.date, input.date);
  const rule = ruleFor(input.date);
  const durationMin = rule?.eventDurationMin ?? 240;
  const travelBufferMin = rule?.travelBufferMin ?? 0;
  const start = localToInstant(input.date, input.time, business.timezone);
  const end = new Date(start.getTime() + durationMin * 60_000);
  const conflict = capacityConflict({
    business,
    rule,
    blocked: blockedSet.has(input.date),
    date: input.date,
    start,
    end,
    guests: input.guests,
    travelBufferMin,
    loads: loadsForDate(bookings, input.date, new Date(), input.excludeBookingId),
  });
  return { conflict, start, end, travelBufferMin, business };
}
