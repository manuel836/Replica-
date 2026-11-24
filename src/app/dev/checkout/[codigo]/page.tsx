import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { formatMXN } from "@/lib/format";
import { store } from "@/server/data";
import { paymentProvider } from "@/server/payments";
import { applyPaymentUpdate } from "@/server/services/bookings";

export const metadata = { title: "Pago simulado", robots: { index: false } };

// Página de pago SIMULADO. Solo existe mientras el proveedor de pagos es el simulado; en
// producción el cliente va a Mercado Pago y esto da 404.
export default async function DevCheckout({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ ref?: string; monto?: string; regreso?: string }>;
}) {
  await connection();
  if (!paymentProvider().simulated || process.env.NODE_ENV === "production") notFound();
  const { codigo } = await params;
  const { ref = "", monto = "0", regreso = "/" } = await searchParams;
  const payment = await store().findPaymentByCheckout(ref);
  if (!payment) notFound();

  async function decide(formData: FormData) {
    "use server";
    if (!paymentProvider().simulated || process.env.NODE_ENV === "production") notFound();
    const status = formData.get("status") === "approved" ? "approved" : "rejected";
    await applyPaymentUpdate({ checkoutRef: ref, providerRef: `sim-pay-${crypto.randomUUID()}`, status, method: "card" });
    const back = new URL(regreso, "http://x");
    redirect(`${back.pathname}?status=${status}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-flow flex-col justify-center gap-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <FlaskConical aria-hidden className="size-8 text-accent-text" />
        <h1 className="text-xl text-text">Pago simulado</h1>
      </div>
      <Alert tone="warning" title="Modo de desarrollo">
        Aquí irá la página de Mercado Pago. Por ahora puedes aprobar o rechazar el pago para probar el flujo.
      </Alert>
      <p className="text-lg text-text">
        Anticipo de la taquiza <span className="font-mono">{codigo}</span>:{" "}
        <strong>{formatMXN(Number(monto))}</strong>
      </p>
      <form action={decide} className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" name="status" value="approved" size="lg">
          Aprobar pago
        </Button>
        <Button type="submit" name="status" value="rejected" size="lg" variant="secondary">
          Rechazar pago
        </Button>
      </form>
    </main>
  );
}
