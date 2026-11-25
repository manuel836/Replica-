"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { baseUrl, managePath } from "@/server/context";
import { store } from "@/server/data";
import { AppError, run } from "@/server/errors";
import * as bookings from "@/server/services/bookings";
import { monthStates, slotsFor } from "@/server/services/availability";
import { clientIp } from "@/server/auth";
import { verifyTurnstile } from "@/server/turnstile";
import { verifyManageToken } from "@/server/tokens";
import { sendLinksToCustomer } from "@/server/customer-email";
import { bookingForm, dateStr, fieldErrors, timeStr, toMexicanE164 } from "@/server/validation";

// Acciones del cliente. Cada una valida su entrada y, si toca una taquiza, el token del enlace.

/** Cookie para reconocer al cliente cuando regresa del pago sin poner el token en la URL del proveedor. */
async function rememberToken(code: string, token: string) {
  (await cookies()).set(`dg_t_${code}`, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/t/${code}`,
    maxAge: 2 * 3600,
  });
}

async function bookingFromLink(code: string, token: string) {
  const booking = await store().getBookingByCode(code.toUpperCase());
  if (!booking || !verifyManageToken(booking, token)) throw new AppError("Este enlace no es válido.", "bad_link");
  return booking;
}

export async function crearTaquiza(raw: unknown) {
  const parsed = bookingForm.safeParse(raw);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return { ok: false as const, error: "Revisa los campos marcados.", code: "invalid", fields };
  }
  const f = parsed.data;
  const result = await run(async () => {
    const ip = await clientIp();
    if (!(await verifyTurnstile(f.turnstileToken, ip))) {
      throw new AppError("No pudimos verificar que no eres un robot. Recarga la página e intenta de nuevo.", "turnstile");
    }
    if (!(await store().hitRateLimit(`booking-ip:${ip}`, 3600, 20))) {
      throw new AppError("Recibimos muchas solicitudes desde tu conexión. Escríbenos por WhatsApp.", "rate_limit");
    }
    const base = await baseUrl();
    return bookings.createBooking(
      {
        idempotencyKey: f.idempotencyKey,
        customer: { name: f.name, whatsappE164: f.whatsapp, email: f.email },
        date: f.date,
        time: f.time,
        guests: f.guests,
        packageId: f.packageId,
        zoneId: f.zoneId,
        address: f.address,
        neighborhood: f.neighborhood,
        addressNotes: f.addressNotes,
        eventType: f.eventType,
        customerNotes: f.customerNotes,
        payMode: f.payMode,
        source: "web",
      },
      { returnUrlFor: (b) => `${base}/t/${b.code}/pago` },
    );
  });
  if (!result.ok) return { ...result, fields: result.field ? { [result.field]: result.error } : {} };
  const { booking, checkoutUrl } = result.data;
  const path = managePath(booking);
  if (checkoutUrl) await rememberToken(booking.code, new URL(path, "http://x").searchParams.get("k")!);
  return { ok: true as const, redirectTo: checkoutUrl ?? `${path}&nuevo=1` };
}

export async function horariosDelDia(date: string, guests: number, code?: string, token?: string) {
  const d = dateStr.safeParse(date);
  const g = z.coerce.number().int().min(1).max(2000).safeParse(guests);
  if (!d.success || !g.success) return [];
  let exclude: string | undefined;
  if (code && token) exclude = (await bookingFromLink(code, token)).id;
  return slotsFor(d.data, g.data, exclude);
}

/** Calendario para cambiar una taquiza: no cuenta la propia taquiza como ocupada. */
export async function diasDelMes(month: string, guests: number, code: string, token: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return {};
  const g = z.coerce.number().int().min(1).max(2000).safeParse(guests);
  if (!g.success) return {};
  const booking = await bookingFromLink(code, token);
  return monthStates(month, g.data, booking.id);
}

export async function pagarAnticipo(code: string, token: string) {
  return run(async () => {
    const booking = await bookingFromLink(code, token);
    const base = await baseUrl();
    const url = await bookings.startDepositPayment(booking, `${base}/t/${booking.code}/pago`);
    await rememberToken(booking.code, token);
    return { redirectTo: url };
  });
}

export async function cancelarTaquiza(code: string, token: string, reason: string) {
  return run(async () => {
    const booking = await bookingFromLink(code, token);
    const { refundedCents } = await bookings.cancelByCustomer(booking, reason.trim().slice(0, 300));
    return { refundedCents };
  });
}

export async function responderPropuesta(code: string, token: string, accept: boolean) {
  return run(async () => {
    const booking = await bookingFromLink(code, token);
    const updated = await bookings.respondToProposal(booking, accept);
    return { status: updated.status };
  });
}

export async function cambiarTaquiza(code: string, token: string, raw: { date: string; time: string; guests: number }) {
  const parsed = z
    .object({ date: dateStr, time: timeStr, guests: z.coerce.number().int().min(1).max(2000) })
    .safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Revisa la fecha, la hora y los invitados." };
  return run(async () => {
    const booking = await bookingFromLink(code, token);
    const r = await bookings.rescheduleByCustomer(booking, parsed.data);
    return { differenceCents: r.differenceCents, status: r.booking.status };
  });
}

export async function enviarResena(code: string, token: string, rating: number, comment: string) {
  return run(async () => {
    const booking = await bookingFromLink(code, token);
    await bookings.submitReview(booking, Math.round(rating), comment.trim().slice(0, 1000));
  });
}

/** "¿Perdiste el enlace de tu taquiza?" Siempre la misma respuesta (replica/fixes.md, FX5). */
export async function recuperarEnlace(raw: { whatsapp: string; turnstileToken?: string | null }) {
  const e164 = toMexicanE164(String(raw?.whatsapp ?? ""));
  if (!e164) {
    return { ok: false as const, error: "Revisa tu número.", code: "invalid", fields: { whatsapp: "Escribe los 10 dígitos de tu WhatsApp." } };
  }
  return run(async () => {
    const ip = await clientIp();
    if (!(await verifyTurnstile(raw.turnstileToken, ip))) {
      throw new AppError("No pudimos verificar que no eres un robot. Recarga la página e intenta de nuevo.", "turnstile");
    }
    const db = store();
    if (!(await db.hitRateLimit(`recover-ip:${ip}`, 3600, 10)) || !(await db.hitRateLimit(`recover-wa:${e164}`, 3600, 3))) {
      throw new AppError("Ya lo intentaste varias veces. Espera una hora o escríbenos por WhatsApp.", "rate_limit");
    }
    await sendLinksToCustomer(e164);
  });
}
