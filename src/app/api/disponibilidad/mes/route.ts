import { NextResponse, type NextRequest } from "next/server";
import { monthStates } from "@/server/services/availability";

// GET /api/disponibilidad/mes?mes=2026-12&invitados=60 → { "2026-12-01": "available", ... }
export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes") ?? "";
  const invitados = Number(req.nextUrl.searchParams.get("invitados") ?? "1");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || !Number.isInteger(invitados) || invitados < 1 || invitados > 2000) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }
  return NextResponse.json(await monthStates(mes, invitados), { headers: { "Cache-Control": "no-store" } });
}
