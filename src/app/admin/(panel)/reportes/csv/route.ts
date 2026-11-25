import { type NextRequest } from "next/server";
import { currentAdmin } from "@/server/auth";
import { bookingsCsv } from "@/server/services/reports";

// Descarga de taquizas en CSV (abre en Excel o Google Sheets). Solo el dueño.
// ?mes=2026-11 para un mes; ?mes=todas para todo el historial.
export async function GET(req: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) return new Response("Tu sesión terminó. Vuelve a entrar.", { status: 401 });
  if (admin.role !== "owner") return new Response("Solo el dueño puede descargar reportes.", { status: 403 });
  const mes = req.nextUrl.searchParams.get("mes") ?? "";
  if (mes !== "todas" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return new Response("Mes inválido", { status: 400 });
  const csv = await bookingsCsv(mes === "todas" ? null : mes);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="taquizas-${mes}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
