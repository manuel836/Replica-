import "server-only";
import type { Booking, Payment } from "@/lib/types";
import { store } from "@/server/data";
import { moneySummary } from "@/server/domain/money";
import { addDaysLocal, addMonthsLocal, localTime } from "@/server/domain/time";

// Reporte de ventas por mes (por fecha del evento) y exportación a CSV. Solo el dueño.

const SOLD: Booking["status"][] = ["confirmed", "completed"];
const PENDING: Booking["status"][] = ["requested", "awaiting_payment", "proposed"];
const CANCELLED: Booking["status"][] = ["declined", "cancelled_by_customer", "cancelled_by_business", "expired"];

export interface MonthTotals {
  sold: number;
  guests: number;
  soldCents: number;
  paidCents: number;
  dueCents: number;
}

async function monthData(month: string) {
  const db = store();
  const business = await db.getBusiness();
  const from = `${month}-01`;
  const to = addDaysLocal(addMonthsLocal(from, 1), -1);
  const bookings = await db.listBookings(business.id, { from, to });
  const payments = new Map<string, Payment[]>(
    await Promise.all(bookings.map(async (b) => [b.id, await db.listPayments(b.id)] as const)),
  );
  return { business, bookings, payments };
}

function totals(bookings: Booking[], payments: Map<string, Payment[]>): MonthTotals {
  const sold = bookings.filter((b) => SOLD.includes(b.status));
  let paidCents = 0;
  let dueCents = 0;
  for (const b of bookings) {
    const m = moneySummary(payments.get(b.id) ?? [], b.totalCents);
    // Lo cobrado cuenta todo el dinero que se quedó (también un anticipo de una cancelada sin reembolso).
    paidCents += m.paidCents;
    if (SOLD.includes(b.status)) dueCents += m.dueCents;
  }
  return {
    sold: sold.length,
    guests: sold.reduce((s, b) => s + b.guests, 0),
    soldCents: sold.reduce((s, b) => s + b.totalCents, 0),
    paidCents,
    dueCents,
  };
}

export async function monthReport(month: string) {
  const [cur, prev] = await Promise.all([monthData(month), monthData(addMonthsLocal(`${month}-01`, -1).slice(0, 7))]);
  const { business, bookings, payments } = cur;
  const packages = await store().listPackages(business.id);
  const sold = bookings.filter((b) => SOLD.includes(b.status));
  const cancelled = bookings.filter((b) => CANCELLED.includes(b.status));

  const byPackage = packages
    .map((p) => {
      const rows = sold.filter((b) => b.packageId === p.id);
      return { name: p.name, count: rows.length, guests: rows.reduce((s, b) => s + b.guests, 0), cents: rows.reduce((s, b) => s + b.totalCents, 0) };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.cents - a.cents);

  const refundedCents = bookings.reduce((s, b) => s + moneySummary(payments.get(b.id) ?? [], b.totalCents).refundedCents, 0);

  return {
    business,
    month,
    totals: totals(bookings, payments),
    previous: totals(prev.bookings, prev.payments),
    completed: bookings.filter((b) => b.status === "completed").length,
    upcoming: bookings.filter((b) => b.status === "confirmed").length,
    pending: bookings.filter((b) => PENDING.includes(b.status)).length,
    noShow: bookings.filter((b) => b.status === "no_show").length,
    cancelled: cancelled.length,
    refundedCents,
    online: sold.filter((b) => b.source === "web").length,
    manual: sold.filter((b) => b.source === "manual").length,
    byPackage,
  };
}

// ---------------- CSV ----------------

const STATUS_ES: Record<Booking["status"], string> = {
  requested: "Solicitada",
  awaiting_payment: "Pendiente de pago",
  confirmed: "Confirmada",
  proposed: "Otra fecha propuesta",
  declined: "Rechazada",
  cancelled_by_customer: "Cancelada por el cliente",
  cancelled_by_business: "Cancelada por el negocio",
  completed: "Completada",
  no_show: "No se realizó",
  expired: "Vencida",
};

/** Una celda de CSV. Lo que empieza con = + - @ se antepone con ' para que Excel no lo ejecute. */
export function csvCell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const pesos = (cents: number) => (cents / 100).toFixed(2);

/** Taquizas del mes ("yyyy-MM") o de todos los meses (null), en CSV con BOM para Excel. */
export async function bookingsCsv(month: string | null): Promise<string> {
  const db = store();
  const business = await db.getBusiness();
  const filter = month ? { from: `${month}-01`, to: addDaysLocal(addMonthsLocal(`${month}-01`, 1), -1) } : {};
  const bookings = await db.listBookings(business.id, filter);
  const [packages, zones] = await Promise.all([db.listPackages(business.id), db.listZones(business.id)]);
  const header = [
    "Código",
    "Fecha",
    "Hora",
    "Estado",
    "Cliente",
    "WhatsApp",
    "Correo",
    "Invitados",
    "Paquete",
    "Zona",
    "Dirección",
    "Colonia",
    "Tipo de evento",
    "Total",
    "Anticipo",
    "Pagado",
    "Por cobrar",
    "Origen",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const b of bookings) {
    const [customer, payments] = await Promise.all([db.getCustomer(business.id, b.customerId), db.listPayments(b.id)]);
    const m = moneySummary(payments, b.totalCents);
    lines.push(
      [
        b.code,
        b.eventDate,
        localTime(b.startAt, business.timezone),
        STATUS_ES[b.status],
        customer?.name ?? "",
        customer?.whatsappE164 ?? "",
        customer?.email ?? "",
        b.guests,
        packages.find((p) => p.id === b.packageId)?.name ?? "",
        zones.find((z) => z.id === b.zoneId)?.name ?? "",
        b.address,
        b.neighborhood,
        b.eventType ?? "",
        pesos(b.totalCents),
        pesos(b.depositCents),
        pesos(m.paidCents),
        pesos(SOLD.includes(b.status) ? m.dueCents : 0),
        b.source === "web" ? "En línea" : "Registrada a mano",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
