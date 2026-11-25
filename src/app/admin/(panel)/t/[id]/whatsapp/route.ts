import { NextResponse, type NextRequest } from "next/server";
import type { TemplateKey } from "@/lib/types";
import { currentAdmin } from "@/server/auth";
import { baseUrl } from "@/server/context";
import { AppError } from "@/server/errors";
import { DEFAULT_TEMPLATES } from "@/server/domain/messages";
import { whatsappToCustomer } from "@/server/services/views";

// /admin/t/{id}/whatsapp?plantilla=confirmed → registra el mensaje y abre WhatsApp con el
// texto listo. Es un enlace normal (no window.open), así ningún bloqueador lo detiene.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentAdmin())) return NextResponse.redirect(new URL("/admin/entrar", req.nextUrl));
  const { id } = await params;
  const plantilla = req.nextUrl.searchParams.get("plantilla") ?? "";
  if (!(plantilla in DEFAULT_TEMPLATES)) return new Response("Plantilla desconocida", { status: 400 });
  try {
    const url = await whatsappToCustomer(await baseUrl(), id, plantilla as TemplateKey, req.nextUrl.searchParams.get("motivo") ?? undefined);
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof AppError ? e.message : "No se pudo preparar el mensaje.";
    return NextResponse.redirect(new URL(`/admin/t/${id}?aviso=${encodeURIComponent(msg)}`, req.nextUrl));
  }
}
