import { NextResponse, type NextRequest } from "next/server";
import { consumeLoginLink, sessionCookie } from "@/server/auth";

// POST desde /auth/confirmar: gasta el enlace (un solo uso) y abre la sesión. Es POST y no
// GET para que los lectores de correo que abren enlaces solos no lo gasten.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = String(form.get("t") ?? "");
  const admin = await consumeLoginLink(token);
  if (!admin) return NextResponse.redirect(new URL("/admin/entrar?error=enlace", req.nextUrl), 303);
  const res = NextResponse.redirect(new URL("/admin", req.nextUrl), 303);
  const c = sessionCookie(admin);
  res.cookies.set(c.name, c.value, c.options);
  return res;
}

// Enlaces viejos o abiertos directo: mandar a la página de confirmación.
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  return NextResponse.redirect(new URL(t ? `/auth/confirmar?t=${encodeURIComponent(t)}` : "/admin/entrar", req.nextUrl));
}
