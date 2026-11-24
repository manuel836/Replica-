import { NextResponse, type NextRequest } from "next/server";
import { store } from "@/server/data";
import { paymentProvider, verifyMercadoPagoSignature } from "@/server/payments";
import { applyProviderPayment } from "@/server/services/bookings";

// Avisos de Mercado Pago (tipo "payment").
// 1. Firma x-signature válida o 401.
// 2. Se guarda el aviso una sola vez (webhook_events); repetidos ya procesados → 200 sin hacer nada.
// 3. NO se confía en el cuerpo: se consulta el pago en la API con la llave del negocio.
// 4. Se aplica el resultado (idempotente). Si algo falla → 500 y Mercado Pago reintenta.
export async function POST(req: NextRequest) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  const provider = paymentProvider();
  if (provider.simulated || !secret) {
    return NextResponse.json({ error: "Mercado Pago no está configurado" }, { status: 503 });
  }

  const raw = await req.text();
  let body: { id?: string | number; type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const params = req.nextUrl.searchParams;
  const dataId = params.get("data.id") ?? (body.data?.id != null ? String(body.data.id) : null);
  const ok = verifyMercadoPagoSignature({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId,
    secret,
  });
  if (!ok) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });

  const type = params.get("type") ?? body.type ?? params.get("topic");
  if (type !== "payment" || !dataId) return NextResponse.json({ ok: true, ignored: type ?? "sin tipo" });

  const db = store();
  const eventId = String(body.id ?? `${dataId}:${req.headers.get("x-request-id") ?? ""}`);
  const ev = await db.recordWebhookEvent("mercadopago", eventId, type, body);
  if (!ev.isNew && ev.processed) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const payment = await provider.getPayment(dataId);
    if (payment.status !== "pending" && payment.bookingId) {
      await applyProviderPayment({
        bookingId: payment.bookingId,
        providerRef: payment.providerRef,
        status: payment.status,
        method: payment.method,
        amountCents: payment.amountCents,
      });
    }
    await db.markWebhookProcessed(ev.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.markWebhookProcessed(ev.id, msg.slice(0, 500));
    console.error("[webhook mercadopago]", msg);
    return NextResponse.json({ error: "No se pudo procesar; se reintentará" }, { status: 500 });
  }
}
