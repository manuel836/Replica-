import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminUser } from "@/lib/types";
import { store } from "./data";
import { AppError } from "./errors";
import { safeEqual, sign } from "./tokens";

// Sesión del panel. Hoy: enlace mágico firmado por la app (en desarrollo se muestra en
// pantalla). /replica-backend lo cambia por Supabase Auth; requireAdmin() no cambia.

const COOKIE = "dg_admin";
const SESSION_DAYS = 30;
const LINK_MINUTES = 15;

export async function currentAdmin(): Promise<AdminUser | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig) return null;
  if (!safeEqual(sig, sign(`session:${id}:${exp}`)) || Number(exp) < Date.now()) return null;
  return store().getAdmin(id);
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

export function loginLink(base: string, admin: AdminUser): string {
  const exp = Date.now() + LINK_MINUTES * 60_000;
  const s = sign(`login:${admin.id}:${exp}`);
  return `${base}/auth/callback?${new URLSearchParams({ u: admin.id, e: String(exp), s })}`;
}

export function verifyLoginLink(u: string, e: string, s: string): boolean {
  return safeEqual(s, sign(`login:${u}:${e}`)) && Number(e) > Date.now();
}

export function sessionCookie(adminId: string) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  return {
    name: COOKIE,
    value: `${adminId}.${exp}.${sign(`session:${adminId}:${exp}`)}`,
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
