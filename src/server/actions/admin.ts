"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { TemplateKey } from "@/lib/types";
import { endAllSessions, endSession, requestLoginLink, requireAdmin } from "@/server/auth";
import { baseUrl } from "@/server/context";
import { store } from "@/server/data";
import { AppError, run } from "@/server/errors";
import * as bookings from "@/server/services/bookings";
import { whatsappToCustomer } from "@/server/services/views";
import { dateStr, fieldErrors, phone, timeStr } from "@/server/validation";

// Acciones del panel. TODAS empiezan con requireAdmin(): una acción es un endpoint público.

const refresh = (id?: string) => {
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/t/${id}`);
};

export async function pedirEnlaceAcceso(email: string) {
  const parsed = z.email().safeParse(email.trim());
  if (!parsed.success) return { ok: false as const, error: "Escribe un correo válido." };
  const r = await run(async () => requestLoginLink(parsed.data, await baseUrl()));
  if (!r.ok) return { ok: false as const, error: r.error };
  return { ok: true as const, devLink: r.data.devLink };
}

export async function cerrarSesion() {
  await endSession();
  redirect("/admin/entrar");
}

export async function cerrarSesionEnTodos() {
  const admin = await requireAdmin().catch(() => null);
  if (admin) await endAllSessions(admin);
  else await endSession();
  redirect("/admin/entrar?aviso=todas");
}

async function withWhatsApp(id: string, template: TemplateKey | null, reason?: string) {
  if (!template) return null;
  try {
    return await whatsappToCustomer(await baseUrl(), id, template, reason);
  } catch {
    return null;
  }
}

export async function aceptarTaquiza(id: string, force = false) {
  return run(async () => {
    await requireAdmin();
    const b = await bookings.acceptBooking(id, { force });
    refresh(id);
    return { status: b.status, whatsappUrl: await withWhatsApp(id, b.status === "confirmed" ? "confirmed" : "payment_link") };
  });
}

export async function rechazarTaquiza(id: string, reason: string) {
  return run(async () => {
    await requireAdmin();
    await bookings.declineBooking(id, reason.trim().slice(0, 300));
    refresh(id);
    return { whatsappUrl: await withWhatsApp(id, "declined", reason.trim()) };
  });
}

export async function proponerOtraFecha(id: string, date: string, time: string) {
  return run(async () => {
    await requireAdmin();
    const d = dateStr.parse(date);
    const t = timeStr.parse(time);
    await bookings.proposeNewTime(id, d, t);
    refresh(id);
    return { whatsappUrl: await withWhatsApp(id, "proposal") };
  });
}

export async function completarTaquiza(id: string) {
  return run(async () => {
    await requireAdmin();
    await bookings.completeBooking(id);
    refresh(id);
    return { whatsappUrl: await withWhatsApp(id, "review_request") };
  });
}

export async function marcarNoRealizada(id: string, reason: string) {
  return run(async () => {
    await requireAdmin();
    await bookings.markNoShow(id, reason.trim().slice(0, 300));
    refresh(id);
  });
}

export async function cancelarPorNegocio(id: string, reason: string) {
  return run(async () => {
    await requireAdmin("owner");
    const r = await bookings.cancelByBusiness(id, reason.trim().slice(0, 300));
    refresh(id);
    return { refundedCents: r.refundedCents, whatsappUrl: await withWhatsApp(id, "cancelled", reason.trim()) };
  });
}

export async function guardarNotas(id: string, notes: string) {
  return run(async () => {
    await requireAdmin();
    await bookings.saveInternalNotes(id, notes.slice(0, 2000));
    refresh(id);
  });
}

export async function registrarPago(id: string, raw: { kind: string; method: string; pesos: string }) {
  return run(async () => {
    const admin = await requireAdmin();
    const kind = z.enum(["deposit", "balance"]).parse(raw.kind);
    const method = z.enum(["cash", "transfer"]).parse(raw.method);
    const pesos = Number(raw.pesos.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(pesos) || pesos <= 0) throw new AppError("Escribe un monto mayor a cero.", "amount", "amount");
    await bookings.recordManualPayment(id, kind, method, Math.round(pesos * 100), admin.id);
    refresh(id);
  });
}

export async function regenerarEnlace(id: string) {
  return run(async () => {
    await requireAdmin();
    await bookings.regenerateLink(id);
    refresh(id);
    return { whatsappUrl: await withWhatsApp(id, "confirmed") };
  });
}

const manualForm = z.object({
  idempotencyKey: z.uuid(),
  name: z.string().trim().min(2, "Escribe el nombre.").max(80),
  whatsapp: phone,
  date: dateStr,
  time: timeStr,
  guests: z.coerce.number().int().min(1, "Mínimo 1 invitado.").max(2000),
  packageId: z.string().min(1, "Elige un paquete."),
  zoneId: z
    .string()
    .optional()
    .transform((v) => v || null),
  address: z.string().trim().min(3, "Escribe la dirección.").max(200),
  neighborhood: z.string().trim().max(100),
  eventType: z.string().trim().max(60),
  customerNotes: z.string().trim().max(1000),
  status: z.enum(["confirmed", "requested"]),
  force: z.boolean(),
});

export async function crearTaquizaManual(raw: unknown) {
  const parsed = manualForm.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Revisa los campos marcados.", fields: fieldErrors(parsed.error) };
  const f = parsed.data;
  const r = await run(async () => {
    await requireAdmin();
    const base = await baseUrl();
    const { booking } = await bookings.createBooking(
      {
        idempotencyKey: f.idempotencyKey,
        customer: { name: f.name, whatsappE164: f.whatsapp, email: null },
        date: f.date,
        time: f.time,
        guests: f.guests,
        packageId: f.packageId,
        zoneId: f.zoneId,
        address: f.address,
        neighborhood: f.neighborhood,
        addressNotes: "",
        eventType: f.eventType,
        customerNotes: f.customerNotes,
        payMode: "later",
        source: "manual",
        force: f.force,
        manualStatus: f.status,
      },
      { returnUrlFor: (b) => `${base}/t/${b.code}/pago` },
    );
    refresh(booking.id);
    return { id: booking.id };
  });
  if (!r.ok) return { ...r, fields: r.field ? { [r.field]: r.error } : {} };
  return r;
}

export async function publicarResena(id: string, publish: boolean) {
  return run(async () => {
    const admin = await requireAdmin("owner");
    await store().setReviewPublished(admin.businessId, id, publish);
    revalidatePath("/admin");
    revalidatePath("/");
  });
}
