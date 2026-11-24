import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Booking, Payment } from "@/lib/types";

export interface CheckoutRequest {
  booking: Booking;
  amountCents: number;
  description: string;
  expiresAt: Date;
  /** A dónde regresa el cliente al terminar (sin token: lo reconoce una cookie). */
  returnUrl: string;
  /** URL pública del webhook. */
  notificationUrl: string;
}

/** Un pago como lo reporta el proveedor (nunca como lo dice el navegador). */
export interface ProviderPayment {
  providerRef: string;
  bookingId: string;
  status: "approved" | "rejected" | "refunded" | "pending";
  method: Payment["method"];
  amountCents: number;
  currency: string;
}

export interface PaymentProvider {
  readonly id: Payment["provider"];
  readonly simulated: boolean;
  createCheckout(req: CheckoutRequest): Promise<{ url: string; checkoutRef: string }>;
  getPayment(providerRef: string): Promise<ProviderPayment>;
  refund(payment: Payment, amountCents: number): Promise<{ providerRef: string }>;
}

// ---------------------------------------------------------------------------
// Mercado Pago Checkout Pro (API REST oficial con la llave del negocio)
// ---------------------------------------------------------------------------

const mpBase = () => process.env.MP_API_BASE ?? "https://api.mercadopago.com";

async function mp<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const res = await fetch(`${mpBase()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Mercado Pago ${init.method ?? "GET"} ${path} respondió ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

const METHOD: Record<string, Payment["method"]> = {
  credit_card: "card",
  debit_card: "card",
  prepaid_card: "card",
  account_money: "mp_wallet",
  ticket: "oxxo",
  atm: "oxxo",
  bank_transfer: "spei",
};

function mapStatus(s: string): ProviderPayment["status"] {
  if (s === "approved") return "approved";
  if (s === "rejected" || s === "cancelled") return "rejected";
  if (s === "refunded" || s === "charged_back") return "refunded";
  return "pending"; // pending, in_process, authorized, in_mediation
}

const mercadoPago: PaymentProvider = {
  id: "mercadopago",
  simulated: false,
  async createCheckout(req) {
    const back = (r: string) => `${req.returnUrl}?resultado=${r}`;
    const pref = await mp<{ id: string; init_point: string; sandbox_init_point?: string }>("/checkout/preferences", {
      method: "POST",
      idempotencyKey: randomUUID(),
      body: {
        items: [
          {
            id: req.booking.code,
            title: req.description,
            quantity: 1,
            currency_id: "MXN",
            unit_price: req.amountCents / 100,
          },
        ],
        external_reference: req.booking.id,
        notification_url: req.notificationUrl,
        back_urls: { success: back("aprobado"), failure: back("rechazado"), pending: back("pendiente") },
        auto_return: "approved",
        // Aprobado o rechazado al momento: el lugar solo está apartado unos minutos.
        binary_mode: true,
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: req.expiresAt.toISOString(),
        payment_methods: {
          // OXXO, cajero y transferencia tardan más que el apartado: fuera en el MVP.
          excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "bank_transfer" }],
          installments: 1,
        },
        statement_descriptor: "DGARDENTACOS",
      },
    });
    const testMode = process.env.MP_ACCESS_TOKEN?.startsWith("TEST-");
    return { url: (testMode && pref.sandbox_init_point) || pref.init_point, checkoutRef: pref.id };
  },
  async getPayment(providerRef) {
    if (!/^\d{1,30}$/.test(providerRef)) throw new Error("Id de pago inválido");
    const p = await mp<{
      id: number | string;
      status: string;
      external_reference: string | null;
      transaction_amount: number;
      currency_id: string;
      payment_type_id: string;
    }>(`/v1/payments/${providerRef}`);
    return {
      providerRef: String(p.id),
      bookingId: p.external_reference ?? "",
      status: mapStatus(p.status),
      method: METHOD[p.payment_type_id] ?? "card",
      amountCents: Math.round(p.transaction_amount * 100),
      currency: p.currency_id,
    };
  },
  async refund(payment, amountCents) {
    if (!payment.providerRef) throw new Error("El pago no tiene referencia del proveedor");
    const r = await mp<{ id: number | string }>(`/v1/payments/${payment.providerRef}/refunds`, {
      method: "POST",
      // Misma llave por pago: si se reintenta, Mercado Pago no reembolsa dos veces.
      idempotencyKey: `refund-${payment.id}-${amountCents}`,
      body: { amount: amountCents / 100 },
    });
    return { providerRef: String(r.id) };
  },
};

/**
 * Valida la firma de un aviso de Mercado Pago: HMAC-SHA256 (hex) con la clave secreta de
 * "Tus integraciones" sobre "id:{data.id};request-id:{x-request-id};ts:{ts};" (las partes
 * que faltan se omiten), igual que el validador del SDK oficial.
 */
export function verifyMercadoPagoSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  if (!opts.xSignature) return false;
  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of opts.xSignature.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim().toLowerCase();
    const v = part.slice(eq + 1).trim();
    if (k === "ts") ts = v;
    if (k === "v1") v1 = v;
  }
  if (!ts || !/^\d+$/.test(ts) || !v1) return false;
  const parts: string[] = [];
  if (opts.dataId) parts.push(`id:${opts.dataId}`);
  if (opts.xRequestId) parts.push(`request-id:${opts.xRequestId}`);
  parts.push(`ts:${ts}`);
  const expected = createHmac("sha256", opts.secret).update(parts.join(";") + ";").digest("hex");
  return expected.length === v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

// ---------------------------------------------------------------------------
// Simulado: para desarrollar sin cuenta de Mercado Pago
// ---------------------------------------------------------------------------

const simulated: PaymentProvider = {
  id: "mercadopago",
  simulated: true,
  async createCheckout(req) {
    const checkoutRef = `sim-pref-${randomUUID()}`;
    const params = new URLSearchParams({ ref: checkoutRef, monto: String(req.amountCents), regreso: req.returnUrl });
    return { url: `/dev/checkout/${req.booking.code}?${params}`, checkoutRef };
  },
  async getPayment() {
    throw new Error("El proveedor simulado no consulta pagos; /dev/checkout aplica el resultado directo.");
  },
  async refund() {
    return { providerRef: `sim-refund-${randomUUID()}` };
  },
};

/** Mercado Pago si hay MP_ACCESS_TOKEN; si no, el simulado (nunca en producción). */
export function paymentProvider(): PaymentProvider {
  if (process.env.MP_ACCESS_TOKEN) return mercadoPago;
  if (process.env.NODE_ENV === "production") throw new Error("Falta MP_ACCESS_TOKEN: en producción no hay pagos simulados.");
  return simulated;
}
