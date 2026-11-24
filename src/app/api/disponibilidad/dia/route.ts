import { NextResponse, type NextRequest } from "next/server";
import { slotsFor } from "@/server/services/availability";

// GET /api/disponibilidad/dia?fecha=2026-12-14&invitados=60 → [{ time: "12:00", free: true }, ...]
export async function GET(req: NextRequest) {
  const fecha = req.nextUrl.searchParams.get("fecha") ?? "";
  const invitados = Number(req.nextUrl.searchParams.get("invitados") ?? "1");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isInteger(invitados) || invitados < 1 || invitados > 2000) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }
  return NextResponse.json(await slotsFor(fecha, invitados), { headers: { "Cache-Control": "no-store" } });
}
