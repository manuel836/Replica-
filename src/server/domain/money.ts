import type { Payment } from "@/lib/types";

const sum = (ps: Payment[]) => ps.reduce((s, p) => s + p.amountCents, 0);

/**
 * Dinero de una taquiza. Un pago que después se reembolsó sigue contando como dinero que
 * entró, y el reembolso como dinero que salió; así no se resta dos veces (BUG-008).
 */
export function moneySummary(payments: Payment[], totalCents: number) {
  const receivedCents = sum(payments.filter((p) => p.kind !== "refund" && (p.status === "approved" || p.status === "refunded")));
  const refundedCents = sum(payments.filter((p) => p.kind === "refund" && p.status === "approved"));
  const paidCents = receivedCents - refundedCents;
  return { receivedCents, refundedCents, paidCents, dueCents: Math.max(0, totalCents - paidCents) };
}

/** Cuánto queda por reembolsar de un pago (lo pagado menos sus reembolsos). */
export function refundableCents(payment: Payment, payments: Payment[]): number {
  const done = sum(payments.filter((p) => p.kind === "refund" && p.refundOf === payment.id && p.status === "approved"));
  return Math.max(0, payment.amountCents - done);
}
