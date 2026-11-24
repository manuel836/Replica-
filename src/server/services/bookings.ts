import "server-only";
import { randomInt } from "node:crypto";
import type { Booking, BookingEvent, Business, Customer, Package, Payment } from "@/lib/types";
import { store } from "@/server/data";
import { CONFLICT_MESSAGE } from "@/server/domain/availability";
import { priceFor } from "@/server/domain/pricing";
import { addDaysLocal, formatDateLong, localTime, todayLocal } from "@/server/domain/time";
import { AppError } from "@/server/errors";
import { notifyCustomer } from "@/server/customer-email";
import { notifyOwner } from "@/server/notify";
import { paymentProvider } from "@/server/payments";
import { manageTokenHash } from "@/server/tokens";
import { checkCapacity } from "./availability";

// Todo lo que le pasa a una taquiza. Las pantallas y las acciones solo llaman a estas funciones.

const HOUR = 3_600_000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I

async function newCode(business: Business): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const tail = Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    const code = `${business.bookingCodePrefix}-${tail}`;
    if (!(await store().codeExists(code))) return code;
  }
  throw new AppError("No se pudo generar el código. Intenta de nuevo.");
}

async function event(b: Booking, type: BookingEvent["type"], actor: BookingEvent["actor"], data: Record<string, unknown> = {}) {
  await store().addEvent({ businessId: b.businessId, bookingId: b.id, type, actor, data });
}

const ACTIVE: Booking["status"][] = ["requested", "awaiting_payment", "confirmed", "proposed"];

function assertStatus(b: Booking, allowed: Booking["status"][], what: string) {
  if (!allowed.includes(b.status)) throw new AppError(`Esta taquiza ya no se puede ${what}.`, "bad_status");
}

async function approvedDeposit(bookingId: string): Promise<Payment | null> {
  const payments = await store().listPayments(bookingId);
  return payments.find((p) => p.kind === "deposit" && p.status === "approved") ?? null;
}

// ---------------------------------------------------------------------------
// Crear
// ---------------------------------------------------------------------------

export interface CreateInput {
  idempotencyKey: string;
  customer: { name: string; whatsappE164: string; email: string | null };
  date: string;
  time: string;
  guests: number;
  packageId: string;
  zoneId: string | null;
  address: string;
  neighborhood: string;
  addressNotes: string;
  eventType: string;
  customerNotes: string;
  payMode: "now" | "later";
  source: "web" | "manual";
  /** Solo panel: guardar aunque el día esté lleno. */
  force?: boolean;
  /** Solo panel: estado con el que nace. */
  manualStatus?: "confirmed" | "requested";
}

export interface CreateResult {
  booking: Booking;
  /** Si hay que pagar el anticipo ahora. */
  checkoutUrl?: string;
}

export async function createBooking(input: CreateInput, opts: { returnUrlFor: (b: Booking) => string }): Promise<CreateResult> {
  const db = store();
  const business = await db.getBusiness();

  const existing = await db.findBookingByIdempotencyKey(business.id, input.idempotencyKey);
  if (existing) return { booking: existing };

  const pkg = await db.getPackage(business.id, input.packageId);
  if (!pkg || (!pkg.isActive && input.source === "web")) throw new AppError("Ese paquete ya no está disponible.", "package", "packageId");
  if (input.guests < pkg.minGuests) throw new AppError(`Este paquete es desde ${pkg.minGuests} invitados.`, "guests", "guests");
  if (pkg.maxGuests && input.guests > pkg.maxGuests)
    throw new AppError(`Este paquete es para máximo ${pkg.maxGuests} invitados.`, "guests", "guests");

  const zones = await db.listZones(business.id);
  const zone = input.zoneId ? (zones.find((z) => z.id === input.zoneId && (z.isActive || input.source === "manual")) ?? null) : null;
  if (input.zoneId && !zone) throw new AppError("Elige una zona de la lista.", "zone", "zoneId");
  if (!input.zoneId && zones.some((z) => z.isActive) && input.source === "web")
    throw new AppError("Elige la zona del evento.", "zone", "zoneId");

  if (input.source === "web" && input.payMode === "later" && business.depositMode === "required")
    throw new AppError("Para apartar la fecha se necesita el anticipo.", "deposit_required");

  const found = await db.findCustomerByWhatsapp(business.id, input.customer.whatsappE164);
  if (found && input.source === "web") {
    const recent = await db.countBookingsByCustomerSince(business.id, found.id, new Date(Date.now() - HOUR));
    if (recent >= 3) throw new AppError("Ya recibimos varias solicitudes de este número. Escríbenos por WhatsApp.", "rate_limit");
  }

  const price = priceFor(business, pkg, input.guests, zone);

  const booking = await db.withDayLock(business.id, [input.date], async () => {
    const cap = await checkCapacity({ date: input.date, time: input.time, guests: input.guests });
    if (cap.conflict && !(input.source === "manual" && input.force)) {
      throw new AppError(CONFLICT_MESSAGE[cap.conflict], cap.conflict);
    }

    const customer: Customer = found
      ? await db.updateCustomer(business.id, found.id, {
          name: input.customer.name,
          email: input.customer.email ?? found.email,
        })
      : await db.insertCustomer({
          businessId: business.id,
          name: input.customer.name,
          whatsappE164: input.customer.whatsappE164,
          email: input.customer.email,
          notes: "",
          anonymizedAt: null,
        });

    const now = Date.now();
    let status: Booking["status"];
    let holdExpiresAt: Date | null = null;
    if (input.source === "manual") {
      status = input.manualStatus ?? "confirmed";
      if (status === "requested") holdExpiresAt = new Date(now + business.requestHoldHours * HOUR);
    } else if (input.payMode === "now" && price.depositCents > 0) {
      status = "awaiting_payment";
      holdExpiresAt = new Date(now + business.paymentHoldMinutes * 60_000);
    } else if (business.confirmationMode === "auto") {
      status = "confirmed";
    } else {
      status = "requested";
      holdExpiresAt = new Date(now + business.requestHoldHours * HOUR);
    }

    const id = crypto.randomUUID();
    const created = await db.insertBooking({
      id,
      businessId: business.id,
      code: await newCode(business),
      manageTokenHash: manageTokenHash(id, 1),
      manageTokenVersion: 1,
      idempotencyKey: input.idempotencyKey,
      customerId: customer.id,
      packageId: pkg.id,
      zoneId: zone?.id ?? null,
      eventDate: input.date,
      startAt: cap.start,
      endAt: cap.end,
      travelBufferMin: cap.travelBufferMin,
      guests: input.guests,
      address: input.address,
      neighborhood: input.neighborhood,
      addressNotes: input.addressNotes,
      eventType: input.eventType,
      customerNotes: input.customerNotes,
      internalNotes: "",
      ...price,
      depositCents: business.depositMode === "none" ? 0 : price.depositCents,
      status,
      holdExpiresAt,
      proposedStartAt: null,
      proposedEndAt: null,
      proposedEventDate: null,
      proposalExpiresAt: null,
      source: input.source,
      capacityOverride: Boolean(cap.conflict && input.force),
      needsAttention: false,
      confirmedAt: status === "confirmed" ? new Date() : null,
      cancelledAt: null,
      cancelReason: null,
      completedAt: null,
    });
    await event(created, "created", input.source === "web" ? "customer" : "business", {
      source: input.source,
      forced: created.capacityOverride,
    });
    return created;
  });

  let checkoutUrl: string | undefined;
  if (booking.status === "awaiting_payment") {
    checkoutUrl = await createDepositCheckout(booking, opts.returnUrlFor(booking));
  }

  if (input.source === "web") {
    await notifyOwner(
      `Nueva solicitud ${booking.code}`,
      `${input.customer.name} pidió una taquiza para el ${formatDateLong(booking.eventDate)} a las ${localTime(booking.startAt, business.timezone)}, ${booking.guests} invitados.`,
      { label: "Revisar la solicitud", path: `/admin/t/${booking.id}` },
    );
  }
  // Con pago en línea el correo sale cuando se aprueba el pago, no antes.
  if (booking.status === "confirmed") await notifyCustomer(booking.id, "confirmed");
  else if (booking.status === "requested" && input.source === "web") await notifyCustomer(booking.id, "received");
  return { booking, checkoutUrl };
}

async function createDepositCheckout(booking: Booking, returnUrl: string): Promise<string> {
  const provider = paymentProvider();
  const { url, checkoutRef } = await provider.createCheckout({
    booking,
    amountCents: booking.depositCents,
    description: `Anticipo taquiza ${booking.code}`,
    expiresAt: booking.holdExpiresAt ?? new Date(Date.now() + HOUR),
    returnUrl,
    notificationUrl: `${new URL(returnUrl).origin}/api/webhooks/mercadopago`,
  });
  await store().addPayment({
    businessId: booking.businessId,
    bookingId: booking.id,
    kind: "deposit",
    method: "card",
    provider: provider.id,
    amountCents: booking.depositCents,
    status: "pending",
    checkoutRef,
    providerRef: null,
    refundOf: null,
    paidAt: null,
  });
  return url;
}

/** El cliente paga el anticipo después (desde S07). Vuelve a apartar el lugar mientras paga. */
export async function startDepositPayment(booking: Booking, returnUrl: string): Promise<string> {
  const db = store();
  const business = await db.getBusiness();
  if (booking.depositCents <= 0) throw new AppError("Esta taquiza no lleva anticipo.");
  if (await approvedDeposit(booking.id)) throw new AppError("El anticipo ya está pagado.", "already_paid");
  assertStatus(booking, ["requested", "awaiting_payment", "confirmed"], "pagar");

  const updated = await db.withDayLock(business.id, [booking.eventDate], async () => {
    if (booking.status !== "confirmed") {
      const cap = await checkCapacity({
        date: booking.eventDate,
        time: localTime(booking.startAt, business.timezone),
        guests: booking.guests,
        excludeBookingId: booking.id,
      });
      if (cap.conflict && cap.conflict !== "too_soon") throw new AppError(CONFLICT_MESSAGE[cap.conflict], cap.conflict);
      return db.updateBooking(business.id, booking.id, {
        status: "awaiting_payment",
        holdExpiresAt: new Date(Date.now() + business.paymentHoldMinutes * 60_000),
      });
    }
    return booking;
  });
  return createDepositCheckout(updated, returnUrl);
}

// ---------------------------------------------------------------------------
// Pagos: lo llama el webhook de Mercado Pago (con el pago consultado en su API) o, en
// desarrollo, el pago simulado. Es idempotente: el mismo aviso dos veces no cambia nada.
// ---------------------------------------------------------------------------

export async function applyProviderPayment(p: {
  bookingId: string;
  providerRef: string;
  status: "approved" | "rejected" | "refunded";
  method: Payment["method"];
  amountCents: number;
}): Promise<Booking | null> {
  const db = store();
  const business = await db.getBusiness();
  const booking = await db.getBooking(business.id, p.bookingId);
  if (!booking) return null;

  const known = await db.findPayment("mercadopago", p.providerRef);
  if (known && known.status === p.status) return booking; // repetido
  if (p.status === "refunded") {
    if (known) {
      await db.updatePayment(known.id, { status: "refunded" });
      await event(booking, "refund", "system", { amountCents: known.amountCents, source: "provider" });
    }
    return booking;
  }
  const target = known ?? (await db.findLatestPendingDeposit(booking.id));
  const payment = target
    ? await db.updatePayment(target.id, {
        status: p.status,
        providerRef: p.providerRef,
        method: p.method,
        amountCents: p.amountCents,
        paidAt: p.status === "approved" ? new Date() : null,
      })
    : await db.addPayment({
        businessId: business.id,
        bookingId: booking.id,
        kind: "deposit",
        method: p.method,
        provider: "mercadopago",
        amountCents: p.amountCents,
        status: p.status,
        checkoutRef: null,
        providerRef: p.providerRef,
        refundOf: null,
        paidAt: p.status === "approved" ? new Date() : null,
      });
  await event(booking, "payment", "system", { status: p.status, amountCents: payment.amountCents });
  if (p.status !== "approved") return booking;

  const result = await db.withDayLock(business.id, [booking.eventDate], async () => {
    const fresh = (await db.getBooking(business.id, booking.id))!;
    if (p.amountCents < fresh.depositCents) {
      await notifyOwner(`Pago incompleto en ${fresh.code}`, `Llegó un pago menor al anticipo. Revisa la taquiza.`, { label: "Ver taquiza", path: `/admin/t/${fresh.id}` });
      return db.updateBooking(business.id, fresh.id, { needsAttention: true });
    }
    if (fresh.status === "confirmed") return fresh;
    if (!["awaiting_payment", "requested"].includes(fresh.status)) {
      await notifyOwner(`Pago recibido de ${fresh.code} en estado ${fresh.status}`, "Revisa la taquiza: quizá hay que reembolsar.", { label: "Ver taquiza", path: `/admin/t/${fresh.id}` });
      return db.updateBooking(business.id, fresh.id, { needsAttention: true });
    }
    const cap = await checkCapacity({
      date: fresh.eventDate,
      time: localTime(fresh.startAt, business.timezone),
      guests: fresh.guests,
      excludeBookingId: fresh.id,
    });
    if (cap.conflict && cap.conflict !== "too_soon") {
      await notifyOwner(`Pago de ${fresh.code} sin lugar`, "El apartado venció y el horario se ocupó. Reagenda o reembolsa.", { label: "Ver taquiza", path: `/admin/t/${fresh.id}` });
      return db.updateBooking(business.id, fresh.id, { status: "requested", needsAttention: true, holdExpiresAt: null });
    }
    const confirmed = await db.updateBooking(business.id, fresh.id, {
      status: "confirmed",
      confirmedAt: new Date(),
      holdExpiresAt: null,
    });
    await event(confirmed, "accepted", "system", { reason: "deposit_paid" });
    return confirmed;
  });
  if (result.status === "confirmed" && booking.status !== "confirmed") await notifyCustomer(result.id, "confirmed");
  return result;
}

async function refundOnlineDeposit(booking: Booking, actor: BookingEvent["actor"]): Promise<number> {
  const db = store();
  const deposit = await approvedDeposit(booking.id);
  if (!deposit || deposit.provider === "manual") return 0;
  const { providerRef } = await paymentProvider().refund(deposit, deposit.amountCents);
  await db.updatePayment(deposit.id, { status: "refunded" });
  await db.addPayment({
    businessId: booking.businessId,
    bookingId: booking.id,
    kind: "refund",
    method: deposit.method,
    provider: deposit.provider,
    amountCents: deposit.amountCents,
    status: "approved",
    checkoutRef: null,
    providerRef,
    refundOf: deposit.id,
    paidAt: new Date(),
  });
  await event(booking, "refund", actor, { amountCents: deposit.amountCents });
  return deposit.amountCents;
}

// ---------------------------------------------------------------------------
// Acciones del negocio
// ---------------------------------------------------------------------------

export async function acceptBooking(id: string, opts: { force?: boolean } = {}): Promise<Booking> {
  const db = store();
  const business = await db.getBusiness();
  const booking = await db.getBooking(business.id, id);
  if (!booking) throw new AppError("No encontramos esa taquiza.", "not_found");
  assertStatus(booking, ["requested", "awaiting_payment"], "aceptar");

  const accepted = await db.withDayLock(business.id, [booking.eventDate], async () => {
    const cap = await checkCapacity({
      date: booking.eventDate,
      time: localTime(booking.startAt, business.timezone),
      guests: booking.guests,
      excludeBookingId: booking.id,
    });
    // "Muy pronto" no aplica al aceptar: el negocio decide si le da tiempo.
    if (cap.conflict && cap.conflict !== "too_soon" && !opts.force) {
      throw new AppError(`${CONFLICT_MESSAGE[cap.conflict]} Puedes proponer otra fecha.`, cap.conflict);
    }
    const paid = await approvedDeposit(booking.id);
    const needsDeposit = business.depositMode === "required" && booking.depositCents > 0 && !paid;
    const updated = await db.updateBooking(business.id, booking.id, {
      status: needsDeposit ? "awaiting_payment" : "confirmed",
      holdExpiresAt: needsDeposit ? new Date(Date.now() + business.requestHoldHours * HOUR) : null,
      confirmedAt: needsDeposit ? null : new Date(),
      needsAttention: false,
      capacityOverride: booking.capacityOverride || Boolean(cap.conflict && opts.force),
    });
    await event(updated, "accepted", "business", { needsDeposit });
    return updated;
  });
  await notifyCustomer(accepted.id, accepted.status === "confirmed" ? "confirmed" : "payment_link");
  return accepted;
}

export async function declineBooking(id: string, reason: string): Promise<Booking> {
  const db = store();
  const business = await db.getBusiness();
  const booking = await db.getBooking(business.id, id);
  if (!booking) throw new AppError("No encontramos esa taquiza.", "not_found");
  assertStatus(booking, ["requested", "awaiting_payment", "proposed"], "rechazar");
  const refundedCents = await refundOnlineDeposit(booking, "business");
  const updated = await db.updateBooking(business.id, id, {
    status: "declined",
    cancelReason: reason || null,
    cancelledAt: new Date(),
    holdExpiresAt: null,
    needsAttention: false,
  });
  await event(updated, "declined", "business", { reason });
  await notifyCustomer(updated.id, "declined", { reason, refundedCents });
  return updated;
}

export async function proposeNewTime(id: string, date: string, time: string): Promise<Booking> {
  const db = store();
  const business = await db.getBusiness();
  const booking = await db.getBooking(business.id, id);
  if (!booking) throw new AppError("No encontramos esa taquiza.", "not_found");
  assertStatus(booking, ["requested", "awaiting_payment", "proposed"], "reagendar");
  const proposed = await db.withDayLock(business.id, [date], async () => {
    const cap = await checkCapacity({ date, time, guests: booking.guests, excludeBookingId: booking.id });
    if (cap.conflict && cap.conflict !== "too_soon") throw new AppError(CONFLICT_MESSAGE[cap.conflict], cap.conflict);
    const updated = await db.updateBooking(business.id, id, {
      status: "proposed",
      proposedEventDate: date,
      proposedStartAt: cap.start,
      proposedEndAt: cap.end,
      proposalExpiresAt: new Date(Date.now() + business.proposalHoldHours * HOUR),
      holdExpiresAt: null,
    });
    await event(updated, "proposed", "business", { date, time });
    return updated;
  });
  await notifyCustomer(proposed.id, "proposed");
  return proposed;
}

export async function completeBooking(id: string): Promise<Booking> {
  const db = store();
  const business = await db.getBusiness();
  const booking = await db.getBooking(business.id, id);
  if (!booking) throw new AppError("No encontramos esa taquiza.", "not_found");
  assertStatus(booking, ["confirmed"], "marcar como completada");
  const updated = await db.updateBooking(business.id, id, { status: "completed", completedAt: new Date() });
  await event(updated, "completed", "business");
  await notifyCustomer(updated.id, "review_request");
  return updated;
}

export async function markNoShow(id: string, reason: string): Promise<Booking> {
  const db = store();
  const business = await db.getBusiness();
  const booking = await db.getBooking(business.id, id);
  if (!booking) throw new AppError("No encontramos esa taquiza.", "not_found");
  assertStatus(booking, ["confirmed"], "marcar como no realizada");
  const updated = await db.updateBooking(business.id, id, { status: "no_show", cancelReason: reason || null });
  await event(updated, "no_show", "business", { reason });
  return updated;
}

export async function cancelByBusiness(id: string, reason: string): Promise<{ booking: Booking; refundedCents: number }> {
  const db = store();
  const business = await db.getBusiness();
  const booking = await db.getBooking(business.id, id);
  if (!booking) throw new AppError("No encontramos esa taquiza.", "not_found");
  assertStatus(booking, ACTIVE, "cancelar");
  const refundedCents = await refundOnlineDeposit(booking, "business");
  const updated = await db.updateBooking(business.id, id, {
    status: "cancelled_by_business",
    cancelReason: reason || null,
    cancelledAt: new Date(),
    holdExpiresAt: null,
  });
  await event(updated, "cancelled", "business", { reason, refundedCents });
  await notifyCustomer(updated.id, "cancelled", { by: "business", reason, refundedCents });
  return { booking: updated, refundedCents };
}

export async function saveInternalNotes(id: string, notes: string): Promise<void> {
  const db = store();
  const business = await db.getBusiness();
  await db.updateBooking(business.id, id, { internalNotes: notes });
}

export async function recordManualPayment(
  id: string,
  kind: "deposit" | "balance",
  method: "cash" | "transfer",
  amountCents: number,
  recordedBy: string | null = null,
): Promise<void> {
  const db = store();
  const business = await db.getBusiness();
  const booking = await db.getBooking(business.id, id);
  if (!booking) throw new AppError("No encontramos esa taquiza.", "not_found");
  if (amountCents <= 0) throw new AppError("Escribe un monto mayor a cero.", "amount", "amount");
  await db.addPayment({
    businessId: business.id,
    bookingId: id,
    kind,
    method,
    provider: "manual",
    amountCents,
    status: "approved",
    checkoutRef: null,
    providerRef: null,
    refundOf: null,
    paidAt: new Date(),
    recordedBy,
  });
  await event(booking, "payment", "business", { kind, method, amountCents });
}

export async function regenerateLink(id: string): Promise<Booking> {
  const db = store();
  const business = await db.getBusiness();
  const booking = await db.getBooking(business.id, id);
  if (!booking) throw new AppError("No encontramos esa taquiza.", "not_found");
  const version = booking.manageTokenVersion + 1;
  const updated = await db.updateBooking(business.id, id, {
    manageTokenVersion: version,
    manageTokenHash: manageTokenHash(id, version),
  });
  await event(updated, "note", "business", { linkRegenerated: true });
  return updated;
}

// ---------------------------------------------------------------------------
// Acciones del cliente (con su enlace privado)
// ---------------------------------------------------------------------------

export async function cancelByCustomer(booking: Booking, reason: string): Promise<{ booking: Booking; refundedCents: number }> {
  const db = store();
  const business = await db.getBusiness();
  assertStatus(booking, ACTIVE, "cancelar");
  const daysBefore = daysUntil(booking.eventDate, business);
  const refundedCents = daysBefore >= business.refundCutoffDays ? await refundOnlineDeposit(booking, "customer") : 0;
  const updated = await db.updateBooking(business.id, booking.id, {
    status: "cancelled_by_customer",
    cancelReason: reason || null,
    cancelledAt: new Date(),
    holdExpiresAt: null,
  });
  await event(updated, "cancelled", "customer", { reason, refundedCents });
  await notifyOwner(`${booking.code} cancelada por el cliente`, reason || "Sin motivo.");
  await notifyCustomer(updated.id, "cancelled", { by: "customer", refundedCents });
  return { booking: updated, refundedCents };
}

export function daysUntil(date: string, business: Business): number {
  const today = todayLocal(business.timezone);
  let n = 0;
  if (date <= today) return 0;
  for (let d = today; d < date && n < 3650; d = addDaysLocal(d, 1)) n++;
  return n;
}

export async function respondToProposal(booking: Booking, accept: boolean): Promise<Booking> {
  const db = store();
  const business = await db.getBusiness();
  assertStatus(booking, ["proposed"], "responder");
  if (!booking.proposedEventDate || !booking.proposedStartAt || !booking.proposedEndAt)
    throw new AppError("La propuesta está incompleta.");
  if (!accept) {
    const updated = await db.updateBooking(business.id, booking.id, {
      status: "declined",
      cancelReason: "El cliente no aceptó la fecha propuesta.",
      proposalExpiresAt: null,
    });
    await event(updated, "proposal_rejected", "customer");
    await notifyOwner(`${booking.code}: el cliente rechazó la propuesta`, "");
    return updated;
  }
  if (booking.proposalExpiresAt && booking.proposalExpiresAt < new Date())
    throw new AppError("La propuesta ya venció. Escríbenos para buscar otra fecha.", "expired");
  const date = booking.proposedEventDate;
  const accepted = await db.withDayLock(business.id, [date], async () => {
    const cap = await checkCapacity({
      date,
      time: localTime(booking.proposedStartAt!, business.timezone),
      guests: booking.guests,
      excludeBookingId: booking.id,
    });
    if (cap.conflict && cap.conflict !== "too_soon") throw new AppError(CONFLICT_MESSAGE[cap.conflict], cap.conflict);
    const paid = await approvedDeposit(booking.id);
    const needsDeposit = business.depositMode === "required" && booking.depositCents > 0 && !paid;
    const updated = await db.updateBooking(business.id, booking.id, {
      eventDate: date,
      startAt: booking.proposedStartAt!,
      endAt: booking.proposedEndAt!,
      proposedEventDate: null,
      proposedStartAt: null,
      proposedEndAt: null,
      proposalExpiresAt: null,
      status: needsDeposit ? "awaiting_payment" : "confirmed",
      holdExpiresAt: needsDeposit ? new Date(Date.now() + business.requestHoldHours * HOUR) : null,
      confirmedAt: needsDeposit ? null : new Date(),
    });
    await event(updated, "proposal_accepted", "customer");
    await notifyOwner(`${booking.code}: el cliente aceptó la nueva fecha`, formatDateLong(date));
    return updated;
  });
  await notifyCustomer(accepted.id, accepted.status === "confirmed" ? "confirmed" : "payment_link");
  return accepted;
}

export async function rescheduleByCustomer(
  booking: Booking,
  change: { date: string; time: string; guests: number },
): Promise<{ booking: Booking; differenceCents: number }> {
  const db = store();
  const business = await db.getBusiness();
  assertStatus(booking, ["requested", "confirmed", "awaiting_payment"], "cambiar");
  const pkg: Package | null = await db.getPackage(business.id, booking.packageId);
  if (pkg && change.guests < pkg.minGuests) throw new AppError(`Tu paquete es desde ${pkg.minGuests} invitados.`, "guests", "guests");
  if (pkg?.maxGuests && change.guests > pkg.maxGuests)
    throw new AppError(`Tu paquete es para máximo ${pkg.maxGuests} invitados.`, "guests", "guests");

  const result = await db.withDayLock(business.id, [booking.eventDate, change.date], async () => {
    const cap = await checkCapacity({ ...change, excludeBookingId: booking.id });
    if (cap.conflict) throw new AppError(CONFLICT_MESSAGE[cap.conflict], cap.conflict);
    const subtotal = booking.pricePerGuestCents * change.guests;
    const total = subtotal + booking.travelFeeCents + booking.addonsCents;
    const manual = business.confirmationMode === "manual";
    const updated = await db.updateBooking(business.id, booking.id, {
      eventDate: change.date,
      startAt: cap.start,
      endAt: cap.end,
      guests: change.guests,
      subtotalCents: subtotal,
      totalCents: total,
      depositCents: Math.min(booking.depositCents, total),
      status: manual ? "requested" : booking.status,
      holdExpiresAt: manual ? new Date(Date.now() + business.requestHoldHours * HOUR) : booking.holdExpiresAt,
      confirmedAt: manual ? null : booking.confirmedAt,
    });
    await event(updated, "rescheduled", "customer", { from: booking.eventDate, to: change.date, guests: change.guests });
    await notifyOwner(`${booking.code} cambió de fecha`, `${formatDateLong(change.date)} ${change.time}, ${change.guests} invitados`);
    return { booking: updated, differenceCents: total - booking.totalCents };
  });
  await notifyCustomer(result.booking.id, "changed");
  return result;
}

export async function submitReview(booking: Booking, rating: number, comment: string): Promise<void> {
  const db = store();
  if (booking.status !== "completed") throw new AppError("Podrás dejar tu reseña después del evento.", "bad_status");
  if (await db.getReviewByBooking(booking.id)) throw new AppError("Ya nos dejaste tu reseña. ¡Gracias!", "duplicate");
  if (rating < 1 || rating > 5) throw new AppError("Elige de 1 a 5 estrellas.", "rating", "rating");
  await db.addReview({ businessId: booking.businessId, bookingId: booking.id, rating, comment, isPublished: false, reviewedAt: null });
}

// ---------------------------------------------------------------------------
// Job diario
// ---------------------------------------------------------------------------

export async function dailyHousekeeping(): Promise<{ expired: number; tomorrow: number; pending: number }> {
  const db = store();
  const business = await db.getBusiness();
  const now = new Date();
  const today = todayLocal(business.timezone, now);
  const all = await db.listBookings(business.id, { statuses: ["requested", "awaiting_payment", "proposed"] });
  let expired = 0;
  for (const b of all) {
    if (b.status === "awaiting_payment" && b.holdExpiresAt && b.holdExpiresAt < now) {
      const next = business.depositMode === "required" ? "expired" : "requested";
      await db.updateBooking(business.id, b.id, { status: next, holdExpiresAt: null });
      if (next === "expired") {
        expired++;
        await event(b, "expired", "system");
      }
    } else if (b.status === "requested" && b.eventDate < today) {
      await db.updateBooking(business.id, b.id, { status: "expired" });
      await event(b, "expired", "system");
      expired++;
    } else if (b.status === "proposed" && b.proposalExpiresAt && b.proposalExpiresAt < now) {
      await db.updateBooking(business.id, b.id, { status: "expired" });
      await event(b, "expired", "system", { proposal: true });
      expired++;
    }
  }
  const due = await db.listBookings(business.id, { statuses: ["confirmed"], from: addDaysLocal(today, 1), to: addDaysLocal(today, 1) });
  // Recordatorio por correo a quien dejó su correo (una sola vez aunque el job corra dos veces).
  for (const b of due) await notifyCustomer(b.id, "reminder");
  const tomorrow = due.length;
  const pending = (await db.listBookings(business.id, { statuses: ["requested"] })).length;
  await notifyOwner(`Resumen del día`, `Mañana: ${tomorrow} taquizas. Solicitudes sin responder: ${pending}.`);
  return { expired, tomorrow, pending };
}
