import "server-only";
import { z } from "zod";
import type { AdminUser } from "@/lib/types";
import { baseUrl } from "@/server/context";
import { store } from "@/server/data";
import { layout, sendEmail } from "@/server/email";
import { AppError } from "@/server/errors";

// Equipo del panel: el dueño agrega o quita ayudantes. Un ayudante ve la agenda, responde
// solicitudes, registra taquizas y pagos; no entra a Disponibilidad, Paquetes, Zonas ni
// Ajustes, ni cancela, reembolsa o publica reseñas.

const MAX_HELPERS = 10;
const emailSchema = z.string().trim().toLowerCase().max(254).email("Escribe un correo válido.");

export async function listTeam(businessId: string): Promise<AdminUser[]> {
  return store().listAdmins(businessId);
}

export async function addHelper(owner: AdminUser, rawEmail: string): Promise<AdminUser> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) throw new AppError("Escribe un correo válido.", "email", "email");
  const email = parsed.data;
  const db = store();
  if (await db.findAdminByEmail(email)) throw new AppError("Ese correo ya tiene acceso a un panel.", "exists", "email");
  const team = await db.listAdmins(owner.businessId);
  if (team.filter((a) => a.role === "helper").length >= MAX_HELPERS)
    throw new AppError(`Puedes tener hasta ${MAX_HELPERS} ayudantes.`, "limit");
  let added: AdminUser;
  try {
    added = await db.addAdmin(owner.businessId, email, "helper");
  } catch {
    // Dos clics a la vez: el índice único de la base gana.
    throw new AppError("Ese correo ya tiene acceso a un panel.", "exists", "email");
  }
  const business = await db.getBusiness();
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? (await baseUrl());
  await sendEmail(owner.businessId, {
    to: email,
    subject: `Te dieron acceso al panel de ${business.name}`,
    ...layout({
      title: "Ya tienes acceso al panel",
      paragraphs: [
        `${owner.email} te agregó como ayudante de ${business.name}.`,
        "Puedes ver la agenda, responder solicitudes y registrar taquizas y pagos.",
        "Para entrar escribe este correo en la página de entrada; te mandamos un enlace cada vez, sin contraseña.",
      ],
      button: { label: "Entrar al panel", url: `${base}/admin/entrar` },
      footer: "Si no esperabas este correo, ignóralo.",
    }),
  });
  return added;
}

export async function removeHelper(owner: AdminUser, id: string): Promise<void> {
  const db = store();
  const target = await db.getAdmin(id);
  if (!target || target.businessId !== owner.businessId) throw new AppError("Esa persona ya no tiene acceso.", "not_found");
  if (target.role === "owner") throw new AppError("No se puede quitar al dueño.", "forbidden");
  await db.removeAdmin(owner.businessId, id);
}
