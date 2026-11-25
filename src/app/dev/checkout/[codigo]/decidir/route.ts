import { NextResponse, type NextRequest } from "next/server";
import { paymentProvider } from "@/server/payments";
import { store } from "@/server/data";
import { applyProviderPayment } from "@/server/services/bookings";

// Pago SIMULADO: aplica la decisión y regresa al cliente con una redirección completa (303),
// igual que lo hará Mercado Pago. Así el navegador manda la cookie del regreso.
export async function POST(req: NextRequest) {
  if (!paymentProvider().simulated || process.env.NODE_ENV === "production") {
    return new Response("No encontrado", { status: 404 });
  }
  const form = await req.formData();
  const ref = String(form.get("ref") ?? "");
  const regreso = String(form.get("regreso") ?? "/");
  const status = form.get("status") === "approved" ? "approved" : "rejected";
  const pending = await store().findPaymentByCheckout(ref);
  if (pending) {
    await applyProviderPayment({
      bookingId: pending.bookingId,
      providerRef: `sim-pay-${crypto.randomUUID()}`,
      status,
      method: "card",
      amountCents: pending.amountCents,
    });
  }
  const back = new URL(regreso, req.nextUrl);
  // Solo se regresa a la propia app.
  const target = new URL(`${back.pathname}?resultado=${status === "approved" ? "aprobado" : "rechazado"}`, req.nextUrl);
  return NextResponse.redirect(target, 303);
}
