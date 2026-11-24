import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/server/tokens";
import { dailyHousekeeping } from "@/server/services/bookings";

// Job diario (Vercel Cron, 14:00 UTC = 08:00 en Lázaro Cárdenas). Protegido con CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.NODE_ENV === "production" && (!secret || !safeEqual(auth, `Bearer ${secret}`))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, resumen: await dailyHousekeeping() });
}
