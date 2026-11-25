import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminUser } from "@/lib/types";
import { store } from "./data";
import { emailConfigured, layout, sendEmail } from "./email";
import { AppError } from "./errors";
import { safeEqual, sha256, sign } from "./tokens";

// Sesión del panel. Entrada con enlace mágico de UN solo uso (se guarda su hash, vence en
// 15 minutos) mandado por correo. La cookie lleva id, versión de sesión y vencimiento,
// firmados; subir la versión cierra todas las sesiones de esa persona.

const COOKIE = "dg_admin";
const SESSION_DAYS = 30;
const LINK_MINUTES = 15;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconocida";
}

export async function currentAdmin(): Promise<AdminUser | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, version, exp, sig] = raw.split(".");
  if (!id || !version || !exp || !sig) return null;
  if (!safeEqual(sig, sign(`session:${id}:${version}:${exp}`)) || Number(exp) < Date.now()) return null;
  const db = store();
  const admin = await db.getAdmin(id);
  if (!admin || admin.sessionVersion !== Number(version)) return null;
  // Solo personas de ESTE negocio: un usuario de otro negocio no entra aunque su firma sea válida.
  const business = await db.getBusiness();
  return admin.businessId === business.id ? admin : null;
}

/** Para páginas: sin sesión manda a /admin/entrar. */
export async function requireAdminPage(role?: "owner"): Promise<AdminUser> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/entrar");
  if (role === "owner" && admin.role !== "owner") redirect("/admin?aviso=sin-permiso");
  return admin;
}

/** Para acciones del servidor: sin sesión o sin permiso, error (las acciones son endpoints públicos). */
export async function requireAdmin(role?: "owner"): Promise<AdminUser> {
  const admin = await currentAdmin();
  if (!admin) throw new AppError("Tu sesión terminó. Vuelve a entrar.", "unauthenticated");
  if (role === "owner" && admin.role !== "owner") throw new AppError("Solo el dueño puede hacer esto.", "forbidden");
  return admin;
}

/**
 * Manda el enlace de entrada. Responde igual exista o no el correo. En desarrollo sin
 * correo configurado devuelve el enlace para mostrarlo en pantalla.
 */
export async function requestLoginLink(email: string, base: string): Promise<{ devLink: string | null }> {
  const db = store();
  const normalized = email.trim().toLowerCase();
  if (!(await db.hitRateLimit(`login-ip:${await clientIp()}`, 3600, 20))) {
    throw new AppError("Demasiados intentos. Espera una hora e intenta de nuevo.", "rate_limit");
  }
  // Por correo: el límite se aplica en silencio (no revela si el correo existe).
  const withinEmailLimit = await db.hitRateLimit(`login-email:${normalized}`, 3600, 5);
  const admin = withinEmailLimit ? await db.findAdminByEmail(normalized) : null;
  const business = await db.getBusiness();
  if (!admin || admin.businessId !== business.id) return { devLink: null };

  const token = randomBytes(32).toString("base64url");
  await db.createLoginToken(admin.id, sha256(token), new Date(Date.now() + LINK_MINUTES * 60_000));
  const link = `${base}/auth/confirmar?t=${token}`;
  const body = layout({
    title: "Tu enlace para entrar al panel",
    paragraphs: [`Toca el botón para entrar al panel de ${business.name}. Funciona una sola vez y vence en ${LINK_MINUTES} minutos.`],
    button: { label: "Entrar al panel", url: link },
    footer: "Si no lo pediste, ignora este correo: nadie puede entrar sin este enlace.",
  });
  await sendEmail(business.id, { to: admin.email, subject: "Entra a tu panel de D' Garden Tacos", ...body });
  const dev = !emailConfigured() && process.env.NODE_ENV !== "production";
  return { devLink: dev ? link : null };
}

/** Cambia un enlace de entrada por una sesión. null si no sirve (usado, vencido o falso). */
export async function consumeLoginLink(token: string): Promise<AdminUser | null> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const db = store();
  const adminId = await db.consumeLoginToken(sha256(token));
  if (!adminId) return null;
  const admin = await db.getAdmin(adminId);
  const business = await db.getBusiness();
  return admin && admin.businessId === business.id ? admin : null;
}

export function sessionCookie(admin: AdminUser) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  return {
    name: COOKIE,
    value: `${admin.id}.${admin.sessionVersion}.${exp}.${sign(`session:${admin.id}:${admin.sessionVersion}:${exp}`)}`,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: SESSION_DAYS * 86_400,
    },
  };
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Cierra todas las sesiones de esta persona (en todos sus dispositivos). */
export async function endAllSessions(admin: AdminUser): Promise<void> {
  await store().bumpSessionVersion(admin.id);
  await endSession();
}
