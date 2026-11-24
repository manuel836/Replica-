import "server-only";
import { randomUUID } from "node:crypto";
import type { Booking, Payment } from "@/lib/types";

export interface CheckoutRequest {
  booking: Booking;
  amountCents: number;
  description: string;
  expiresAt: Date;
  /** A dónde regresa el cliente al terminar (sin token: lo reconoce una cookie). */
  returnUrl: string;
}

export interface PaymentProvider {
  readonly id: Payment["provider"];
  readonly simulated: boolean;
  createCheckout(req: CheckoutRequest): Promise<{ url: string; checkoutRef: string }>;
  refund(payment: Payment, amountCents: number): Promise<{ providerRef: string }>;
}

/**
 * Proveedor simulado para desarrollar sin cuenta de Mercado Pago: manda al cliente a
 * /dev/checkout, donde se aprueba o rechaza a mano. /replica-backend lo cambia por
 * Mercado Pago Checkout Pro con las llaves del negocio.
 */
const simulated: PaymentProvider = {
  id: "mercadopago",
  simulated: true,
  async createCheckout(req) {
    const checkoutRef = `sim-pref-${randomUUID()}`;
    const params = new URLSearchParams({ ref: checkoutRef, monto: String(req.amountCents), regreso: req.returnUrl });
    return { url: `/dev/checkout/${req.booking.code}?${params}`, checkoutRef };
  },
  async refund() {
    return { providerRef: `sim-refund-${randomUUID()}` };
  },
};

export function paymentProvider(): PaymentProvider {
  return simulated;
}
