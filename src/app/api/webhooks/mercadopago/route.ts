import { NextResponse } from "next/server";

// Avisos de pago de Mercado Pago. Se implementa en /replica-backend: validar x-signature,
// guardar en webhook_events (una sola vez), consultar el pago con la API oficial y llamar a
// applyPaymentUpdate() en src/server/services/bookings.ts. Mientras tanto, los pagos se
// simulan en /dev/checkout.
export async function POST() {
  return NextResponse.json({ error: "Webhook de Mercado Pago todavía no configurado" }, { status: 501 });
}
