"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { TemplateKey } from "@/lib/types";
import { requireAdmin } from "@/server/auth";
import { store } from "@/server/data";
import { DEFAULT_TEMPLATES } from "@/server/domain/messages";
import { AppError, run } from "@/server/errors";
import { dateStr, fieldErrors, toMexicanE164 } from "@/server/validation";
import { deleteImage, uploadImage } from "@/server/storage";

// Configuración del negocio (S14 a S18). Solo el dueño, salvo las notas de clientes.

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");
const int = (min: number, max: number, msg: string) => z.coerce.number().int(msg).min(min, msg).max(max, msg);
const pesosToCents = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v.replace(/[$,\s]/g, "") || "0");
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
        ctx.addIssue({ code: "custom", message: `Revisa ${label}.` });
        return z.NEVER;
      }
      return Math.round(n * 100);
    });

const invalid = (e: z.ZodError) => ({ ok: false as const, error: "Revisa los campos marcados.", fields: fieldErrors(e) });

// ---------------- S14 Disponibilidad ----------------

const availabilityForm = z
  .object({
    days: z
      .array(z.object({ weekday: z.number().int().min(0).max(6), isOpen: z.boolean(), firstStart: hhmm, lastStart: hhmm }))
      .length(7),
    slotIntervalMin: z.coerce.number().refine((n) => [15, 30, 60].includes(n), "Elige 15, 30 o 60 minutos."),
    eventDurationHours: z.coerce.number().min(1, "Mínimo 1 hora.").max(12, "Máximo 12 horas."),
    travelBufferMin: int(0, 480, "Entre 0 y 480 minutos."),
    maxBookingsPerDay: int(0, 20, "Entre 0 y 20."),
    maxGuestsPerDay: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 10000), "Déjalo vacío o escribe un número."),
    minNoticeDays: int(0, 60, "Entre 0 y 60 días."),
    maxAdvanceDays: int(7, 730, "Entre 7 y 730 días."),
    teams: int(1, 10, "Entre 1 y 10."),
  })
  .superRefine((v, ctx) => {
    v.days.forEach((d, i) => {
      if (d.isOpen && d.lastStart < d.firstStart)
        ctx.addIssue({ code: "custom", path: ["days", i], message: "La última hora de inicio va después de la primera." });
    });
    if (v.maxAdvanceDays <= v.minNoticeDays)
      ctx.addIssue({ code: "custom", path: ["maxAdvanceDays"], message: "Debe ser mayor que la anticipación mínima." });
  });

export async function guardarDisponibilidad(raw: unknown) {
  const parsed = availabilityForm.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const f = parsed.data;
  return run(async () => {
    const admin = await requireAdmin("owner");
    const db = store();
    await db.saveRules(
      admin.businessId,
      f.days.map((d) => ({
        weekday: d.weekday,
        isOpen: d.isOpen,
        firstStart: d.firstStart,
        lastStart: d.lastStart,
        slotIntervalMin: f.slotIntervalMin,
        eventDurationMin: Math.round(f.eventDurationHours * 60),
        travelBufferMin: f.travelBufferMin,
        maxBookingsPerDay: f.maxBookingsPerDay,
        maxGuestsPerDay: f.maxGuestsPerDay,
      })),
    );
    await db.updateBusiness(admin.businessId, {
      minNoticeDays: f.minNoticeDays,
      maxAdvanceDays: f.maxAdvanceDays,
      teams: f.teams,
    });
    revalidatePath("/admin/disponibilidad");
  });
}

export async function bloquearFecha(date: string, reason: string) {
  return run(async () => {
    const admin = await requireAdmin("owner");
    const d = dateStr.parse(date);
    const db = store();
    await db.addBlockedDate(admin.businessId, d, reason.trim().slice(0, 120));
    const affected = await db.listBookings(admin.businessId, {
      statuses: ["confirmed", "requested", "awaiting_payment", "proposed"],
      from: d,
      to: d,
    });
    revalidatePath("/admin/disponibilidad");
    return { affected: affected.map((b) => ({ id: b.id, code: b.code })) };
  });
}

export async function desbloquearFecha(date: string) {
  return run(async () => {
    const admin = await requireAdmin("owner");
    await store().removeBlockedDate(admin.businessId, dateStr.parse(date));
    revalidatePath("/admin/disponibilidad");
  });
}

// ---------------- S15 Paquetes ----------------

const packageForm = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Escribe el nombre.").max(60, "Máximo 60 caracteres."),
    description: z.string().trim().max(500, "Máximo 500 caracteres."),
    price: pesosToCents("el precio"),
    minGuests: int(1, 5000, "Escribe un número de 1 en adelante."),
    maxGuests: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Déjalo vacío o escribe un número."),
    includes: z.string().max(2000),
    isActive: z.boolean(),
  })
  .refine((v) => v.maxGuests === null || v.maxGuests >= v.minGuests, {
    path: ["maxGuests"],
    message: "Debe ser mayor o igual al mínimo.",
  })
  .refine((v) => v.price > 0, { path: ["price"], message: "Escribe el precio por persona." });

export async function guardarPaquete(raw: unknown) {
  const parsed = packageForm.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const f = parsed.data;
  return run(async () => {
    const admin = await requireAdmin("owner");
    const db = store();
    const existing = f.id ? await db.getPackage(admin.businessId, f.id) : null;
    if (f.id && !existing) throw new AppError("Ese paquete ya no existe.");
    const all = await db.listPackages(admin.businessId);
    const saved = await db.savePackage(admin.businessId, {
      id: f.id,
      name: f.name,
      description: f.description,
      photoPath: existing?.photoPath ?? null,
      pricePerGuestCents: f.price,
      minGuests: f.minGuests,
      maxGuests: f.maxGuests,
      includes: f.includes
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 20),
      isActive: f.isActive,
      sortOrder: existing?.sortOrder ?? all.length,
    });
    revalidatePath("/admin/paquetes");
    revalidatePath("/");
    return { id: saved.id };
  });
}

export async function activarPaquete(id: string, active: boolean) {
  return run(async () => {
    const admin = await requireAdmin("owner");
    const db = store();
    const p = await db.getPackage(admin.businessId, id);
    if (!p) throw new AppError("Ese paquete ya no existe.");
    await db.savePackage(admin.businessId, { ...p, isActive: active });
    revalidatePath("/admin/paquetes");
    revalidatePath("/");
  });
}

export async function moverPaquete(id: string, direction: -1 | 1) {
  return run(async () => {
    const admin = await requireAdmin("owner");
    const db = store();
    const list = await db.listPackages(admin.businessId);
    const i = list.findIndex((p) => p.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((p, order) => db.savePackage(admin.businessId, { ...p, sortOrder: order })));
    revalidatePath("/admin/paquetes");
    revalidatePath("/");
  });
}

// ---------------- S16 Zonas ----------------

const zoneForm = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Escribe el nombre de la zona.").max(80),
  fee: pesosToCents("el cargo"),
  isActive: z.boolean(),
});

export async function guardarZona(raw: unknown) {
  const parsed = zoneForm.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const f = parsed.data;
  return run(async () => {
    const admin = await requireAdmin("owner");
    const db = store();
    const zones = await db.listZones(admin.businessId);
    if (zones.some((z) => z.name.toLowerCase() === f.name.toLowerCase() && z.id !== f.id))
      throw new AppError("Ya hay una zona con ese nombre.", "duplicate", "name");
    const existing = zones.find((z) => z.id === f.id);
    await db.saveZone(admin.businessId, {
      id: f.id,
      name: f.name,
      travelFeeCents: f.fee,
      isActive: f.isActive,
      sortOrder: existing?.sortOrder ?? zones.length,
    });
    revalidatePath("/admin/zonas");
    revalidatePath("/");
  });
}

// ---------------- S17 Ajustes ----------------

const templateKeys = Object.keys(DEFAULT_TEMPLATES) as TemplateKey[];

const settingsForm = z
  .object({
    name: z.string().trim().min(2, "Escribe el nombre.").max(80),
    description: z.string().trim().max(600, "Máximo 600 caracteres."),
    city: z.string().trim().min(2, "Escribe la ciudad.").max(80),
    whatsapp: z.string().trim(),
    email: z
      .string()
      .trim()
      .transform((v) => v || null)
      .pipe(z.email("Revisa el correo.").nullable()),
    depositMode: z.enum(["none", "optional", "required"]),
    depositType: z.enum(["percent", "fixed"]),
    depositValue: z.coerce.number().min(0, "No puede ser negativo."),
    confirmationMode: z.enum(["auto", "manual"]),
    requestHoldHours: int(1, 168, "Entre 1 y 168 horas."),
    paymentHoldMinutes: int(10, 1440, "Entre 10 y 1440 minutos."),
    proposalHoldHours: int(1, 168, "Entre 1 y 168 horas."),
    cancellationPolicy: z.string().trim().max(1500, "Máximo 1500 caracteres."),
    refundCutoffDays: int(0, 365, "Entre 0 y 365 días."),
    templates: z.record(z.string(), z.string().max(1000, "Máximo 1000 caracteres.")),
  })
  .superRefine((v, ctx) => {
    if (v.whatsapp && !toMexicanE164(v.whatsapp))
      ctx.addIssue({ code: "custom", path: ["whatsapp"], message: "Escribe los 10 dígitos o déjalo vacío." });
    if (v.depositType === "percent" && v.depositValue > 100)
      ctx.addIssue({ code: "custom", path: ["depositValue"], message: "El porcentaje va de 0 a 100." });
  });

export async function guardarAjustes(raw: unknown) {
  const parsed = settingsForm.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const f = parsed.data;
  return run(async () => {
    const admin = await requireAdmin("owner");
    const templates: Partial<Record<TemplateKey, string>> = {};
    for (const k of templateKeys) {
      const t = f.templates[k]?.trim();
      if (t && t !== DEFAULT_TEMPLATES[k]) templates[k] = t;
    }
    await store().updateBusiness(admin.businessId, {
      name: f.name,
      description: f.description,
      city: f.city,
      whatsappE164: f.whatsapp ? toMexicanE164(f.whatsapp) : null,
      email: f.email,
      depositMode: f.depositMode,
      depositType: f.depositType,
      depositValue: f.depositType === "fixed" ? Math.round(f.depositValue * 100) : Math.round(f.depositValue),
      confirmationMode: f.confirmationMode,
      requestHoldHours: f.requestHoldHours,
      paymentHoldMinutes: f.paymentHoldMinutes,
      proposalHoldHours: f.proposalHoldHours,
      cancellationPolicy: f.cancellationPolicy,
      refundCutoffDays: f.refundCutoffDays,
      whatsappTemplates: templates,
    });
    revalidatePath("/", "layout");
  });
}

// ---------------- S18 Clientes ----------------

export async function guardarNotasCliente(id: string, notes: string) {
  return run(async () => {
    const admin = await requireAdmin();
    await store().updateCustomer(admin.businessId, id, { notes: notes.slice(0, 2000) });
    revalidatePath("/admin/clientes");
  });
}

/** El cliente pidió borrar sus datos: se quitan nombre, contacto y direcciones; quedan los montos. */
export async function anonimizarCliente(id: string) {
  return run(async () => {
    const admin = await requireAdmin("owner");
    const db = store();
    const c = await db.getCustomer(admin.businessId, id);
    if (!c) throw new AppError("Ese cliente ya no existe.");
    const active = await db.listBookings(admin.businessId, {
      customerId: id,
      statuses: ["requested", "awaiting_payment", "confirmed", "proposed"],
    });
    if (active.length) throw new AppError("Tiene taquizas activas. Cancélalas o espera a que pasen.", "active");
    await db.updateCustomer(admin.businessId, id, {
      name: "Cliente eliminado",
      whatsappE164: null,
      email: null,
      notes: "",
      anonymizedAt: new Date(),
    });
    for (const b of await db.listBookings(admin.businessId, { customerId: id })) {
      await db.updateBooking(admin.businessId, b.id, {
        address: "(eliminada)",
        neighborhood: "",
        addressNotes: "",
        customerNotes: "",
      });
    }
    revalidatePath("/admin/clientes");
  });
}

// ---------------- Fotos (S15 y S17) ----------------

export async function subirFotoPaquete(formData: FormData) {
  return run(async () => {
    const admin = await requireAdmin("owner");
    const id = String(formData.get("id") ?? "");
    const db = store();
    const p = await db.getPackage(admin.businessId, id);
    if (!p) throw new AppError("Ese paquete ya no existe.");
    const url = await uploadImage(formData.get("foto") as File, "paquetes");
    await db.savePackage(admin.businessId, { ...p, photoPath: url });
    if (p.photoPath) await deleteImage(p.photoPath);
    revalidatePath("/admin/paquetes");
    revalidatePath("/");
    return { url };
  });
}

export async function quitarFotoPaquete(id: string) {
  return run(async () => {
    const admin = await requireAdmin("owner");
    const db = store();
    const p = await db.getPackage(admin.businessId, id);
    if (!p) throw new AppError("Ese paquete ya no existe.");
    await db.savePackage(admin.businessId, { ...p, photoPath: null });
    if (p.photoPath) await deleteImage(p.photoPath);
    revalidatePath("/admin/paquetes");
    revalidatePath("/");
  });
}

export async function subirFotoNegocio(formData: FormData) {
  return run(async () => {
    const admin = await requireAdmin("owner");
    const db = store();
    const b = await db.getBusiness();
    if (b.photoPaths.length >= 8) throw new AppError("Máximo 8 fotos. Quita una antes de subir otra.");
    const url = await uploadImage(formData.get("foto") as File, "negocio");
    await db.updateBusiness(admin.businessId, { photoPaths: [...b.photoPaths, url] });
    revalidatePath("/", "layout");
    return { url };
  });
}

export async function quitarFotoNegocio(url: string) {
  return run(async () => {
    const admin = await requireAdmin("owner");
    const db = store();
    const b = await db.getBusiness();
    if (!b.photoPaths.includes(url)) return;
    await db.updateBusiness(admin.businessId, { photoPaths: b.photoPaths.filter((p) => p !== url) });
    await deleteImage(url);
    revalidatePath("/", "layout");
  });
}
