import "server-only";
import type { Booking, Business, Customer, Package, TemplateKey, Zone } from "@/lib/types";
import { whatsappLink } from "@/lib/format";
import { store } from "@/server/data";
import { renderTemplate } from "@/server/domain/messages";
import {
  addDaysLocal,
  addMonthsLocal,
  startOfMonthLocal,
  startOfWeekLocal,
  todayLocal,
  weekdayOf,
} from "@/server/domain/time";
import { AppError } from "@/server/errors";
import { verifyManageToken } from "@/server/tokens";
import { manageUrl } from "@/server/context";

export interface BookingRow {
  booking: Booking;
  customer: Customer | null;
  pkg: Package | null;
}

async function joinRows(business: Business, bookings: Booking[]): Promise<BookingRow[]> {
  const db = store();
  const [packages, customers] = await Promise.all([
    db.listPackages(business.id),
    Promise.all([...new Set(bookings.map((b) => b.customerId))].map((id) => db.getCustomer(business.id, id))),
  ]);
  const cmap = new Map(customers.filter(Boolean).map((c) => [c!.id, c!]));
  return bookings.map((b) => ({
    booking: b,
    customer: cmap.get(b.customerId) ?? null,
    pkg: packages.find((p) => p.id === b.packageId) ?? null,
  }));
}

export type AgendaTab = "pendientes" | "proximas" | "pasadas" | "canceladas";

export async function agenda(tab: AgendaTab) {
  const db = store();
  const business = await db.getBusiness();
  const today = todayLocal(business.timezone);
  let bookings: Booking[];
  if (tab === "pendientes") {
    const pending = await db.listBookings(business.id, { statuses: ["requested", "awaiting_payment", "proposed"] });
    const attention = await db.listBookings(business.id, { needsAttention: true });
    const seen = new Set<string>();
    bookings = [...attention, ...pending].filter((b) => !seen.has(b.id) && seen.add(b.id));
  } else if (tab === "proximas") {
    bookings = await db.listBookings(business.id, { statuses: ["confirmed"], from: today });
  } else if (tab === "pasadas") {
    bookings = (
      await db.listBookings(business.id, { statuses: ["completed", "confirmed", "no_show"], to: addDaysLocal(today, -1) })
    ).reverse();
  } else {
    bookings = (
      await db.listBookings(business.id, {
        statuses: ["declined", "cancelled_by_customer", "cancelled_by_business", "expired"],
      })
    ).reverse();
  }
  const [counts, tomorrow] = await Promise.all([
    Promise.all([
      db.listBookings(business.id, { statuses: ["requested", "awaiting_payment", "proposed"] }),
      db.listBookings(business.id, { statuses: ["confirmed"], from: today }),
    ]),
    db.listBookings(business.id, { statuses: ["confirmed"], from: addDaysLocal(today, 1), to: addDaysLocal(today, 1) }),
  ]);
  return {
    business,
    today,
    rows: await joinRows(business, bookings),
    counts: { pendientes: counts[0].length, proximas: counts[1].length },
    tomorrow: await joinRows(business, tomorrow),
    unpublishedReviews: (await db.listReviews(business.id)).filter((r) => !r.reviewedAt),
  };
}

export type CalendarView = "semana" | "mes";

/** Estados que ocupan el día: se ven en el calendario. Las canceladas, rechazadas y vencidas no. */
const ON_CALENDAR: Booking["status"][] = ["requested", "awaiting_payment", "proposed", "confirmed", "completed", "no_show"];

export interface CalendarDay {
  date: string;
  /** false para los días del mes anterior o siguiente que completan la cuadrícula. */
  inRange: boolean;
  isToday: boolean;
  isPast: boolean;
  /** Cerrado por el horario semanal. */
  closed: boolean;
  /** Motivo si el dueño bloqueó el día ("" si no puso motivo); null si no está bloqueado. */
  blocked: string | null;
  maxBookings: number;
  rows: BookingRow[];
}

/** Días de la semana (lunes a domingo) o del mes (semanas completas) con sus taquizas. */
export async function agendaCalendar(view: CalendarView, anchor: string) {
  const db = store();
  const business = await db.getBusiness();
  const today = todayLocal(business.timezone);
  const first = view === "semana" ? startOfWeekLocal(anchor) : startOfMonthLocal(anchor);
  const last = view === "semana" ? addDaysLocal(first, 6) : addDaysLocal(addMonthsLocal(first, 1), -1);
  const gridFrom = startOfWeekLocal(first);
  const gridTo = addDaysLocal(startOfWeekLocal(last), 6);

  const [bookings, rules, blocked] = await Promise.all([
    db.listBookings(business.id, { statuses: ON_CALENDAR, from: gridFrom, to: gridTo }),
    db.listRules(business.id),
    db.listBlockedDates(business.id),
  ]);
  const rows = await joinRows(
    business,
    [...bookings].sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
  );
  const blockedMap = new Map(blocked.map((b) => [b.date, b.reason]));

  const days: CalendarDay[] = [];
  for (let d = gridFrom; d <= gridTo; d = addDaysLocal(d, 1)) {
    const rule = rules.find((r) => r.weekday === weekdayOf(d));
    days.push({
      date: d,
      inRange: d >= first && d <= last,
      isToday: d === today,
      isPast: d < today,
      closed: !rule || !rule.isOpen,
      blocked: blockedMap.has(d) ? blockedMap.get(d)! : null,
      maxBookings: rule?.maxBookingsPerDay ?? 0,
      rows: rows.filter((r) => r.booking.eventDate === d),
    });
  }
  return {
    business,
    today,
    first,
    last,
    days,
    total: rows.filter((r) => r.booking.eventDate >= first && r.booking.eventDate <= last).length,
    prev: view === "semana" ? addDaysLocal(first, -7) : addMonthsLocal(first, -1),
    next: view === "semana" ? addDaysLocal(first, 7) : addMonthsLocal(first, 1),
    current: view === "semana" ? startOfWeekLocal(today) : startOfMonthLocal(today),
  };
}

export async function bookingDetail(id: string) {
  const db = store();
  const business = await db.getBusiness();
  const booking = await db.getBooking(business.id, id);
  if (!booking) return null;
  const [customer, pkg, zone, payments, events, messages, review] = await Promise.all([
    db.getCustomer(business.id, booking.customerId),
    db.getPackage(business.id, booking.packageId),
    booking.zoneId ? db.getZone(business.id, booking.zoneId) : Promise.resolve(null as Zone | null),
    db.listPayments(booking.id),
    db.listEvents(booking.id),
    db.listMessages(booking.id),
    db.getReviewByBooking(booking.id),
  ]);
  return { business, booking, customer, pkg, zone, payments, events, messages, review };
}

/** Taquiza vista por el cliente con su enlace privado. null si el código o el token no sirven. */
export async function customerBooking(code: string, token: string | null | undefined) {
  const db = store();
  const booking = await db.getBookingByCode(code.toUpperCase());
  if (!booking || !verifyManageToken(booking, token)) return null;
  return bookingDetail(booking.id);
}

/** Arma el mensaje de WhatsApp para el cliente, lo registra y devuelve el enlace wa.me. */
export async function whatsappToCustomer(base: string, bookingId: string, template: TemplateKey, reason?: string) {
  const d = await bookingDetail(bookingId);
  if (!d || !d.customer) throw new AppError("No encontramos esa taquiza.", "not_found");
  if (!d.customer.whatsappE164) throw new AppError("Este cliente no tiene WhatsApp registrado.", "no_whatsapp");
  let link = manageUrl(base, d.booking);
  if (template === "review_request") link = link.replace(`/t/${d.booking.code}?`, `/t/${d.booking.code}/resena?`);
  const text = renderTemplate(template, { ...d, customer: d.customer, link, reason });
  await store().addMessage({
    businessId: d.business.id,
    bookingId: d.booking.id,
    channel: "whatsapp",
    template,
    mode: "link",
    status: "prepared",
    recipient: d.customer.whatsappE164,
  });
  await store().addEvent({
    businessId: d.business.id,
    bookingId: d.booking.id,
    type: "message",
    actor: "business",
    data: { template },
  });
  return whatsappLink(d.customer.whatsappE164, text);
}

/** Qué mensaje conviene mandar según el estado. */
export function suggestedTemplate(b: Booking): TemplateKey | null {
  switch (b.status) {
    case "confirmed":
      return "confirmed";
    case "awaiting_payment":
      return "payment_link";
    case "proposed":
      return "proposal";
    case "declined":
      return "declined";
    case "cancelled_by_business":
    case "cancelled_by_customer":
      return "cancelled";
    case "completed":
      return "review_request";
    default:
      return null;
  }
}
