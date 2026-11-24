import { type NextRequest } from "next/server";
import { store } from "@/server/data";
import { verifyManageToken } from "@/server/tokens";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");

// Archivo de calendario para que el cliente agregue su taquiza (Google, Apple, Outlook).
export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const booking = await store().getBookingByCode(codigo.toUpperCase());
  if (!booking || !verifyManageToken(booking, req.nextUrl.searchParams.get("k"))) {
    return new Response("No encontrado", { status: 404 });
  }
  const business = await store().getBusiness();
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//D Garden Tacos//Taquizas//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@dgarden`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(booking.startAt)}`,
    `DTEND:${stamp(booking.endAt)}`,
    `SUMMARY:${esc(`Taquiza con ${business.name}`)}`,
    `LOCATION:${esc([booking.address, booking.neighborhood].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc(`${booking.guests} invitados · ${booking.code}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="taquiza-${booking.code}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
