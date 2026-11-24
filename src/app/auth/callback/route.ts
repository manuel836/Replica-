import { NextResponse, type NextRequest } from "next/server";
import { sessionCookie, verifyLoginLink } from "@/server/auth";
import { store } from "@/server/data";

// Enlace mágico del panel: verifica la firma y la vigencia, y abre la sesión.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const u = p.get("u") ?? "";
  const e = p.get("e") ?? "";
  const s = p.get("s") ?? "";
  const target = new URL("/admin/entrar?error=enlace", req.nextUrl);
  if (!verifyLoginLink(u, e, s) || !(await store().getAdmin(u))) return NextResponse.redirect(target);
  const res = NextResponse.redirect(new URL("/admin", req.nextUrl));
  const c = sessionCookie(u);
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
