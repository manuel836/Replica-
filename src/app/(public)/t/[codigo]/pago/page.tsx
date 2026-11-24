import { cookies } from "next/headers";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { customerBooking } from "@/server/services/views";
import { RetryPayment } from "./RetryPayment";

export const metadata = { title: "Confirmando tu pago", robots: { index: false } };

// Regreso desde el proveedor de pago. El token viene en una cookie (nunca en la URL del proveedor).
// El estado real lo decide el aviso del proveedor, no esta página.
export default async function PaymentReturn({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ status?: string; resultado?: string }>;
}) {
  const { codigo } = await params;
  const { status, resultado } = await searchParams;
  const token = (await cookies()).get(`dg_t_${codigo.toUpperCase()}`)?.value ?? null;
  const d = await customerBooking(codigo, token);
  const wrap = "mx-auto w-full max-w-flow px-4 py-12";

  if (!d || !token) {
    return (
      <div className={wrap}>
        <EmptyState icon={Clock} title="Estamos revisando tu pago">
          Abre el enlace de tu taquiza que te mandamos para ver el estado. Si pagaste, se actualizará en unos minutos.
        </EmptyState>
      </div>
    );
  }
  const manage = `/t/${d.booking.code}?k=${encodeURIComponent(token)}`;

  if (d.booking.status === "confirmed") {
    return (
      <div className={wrap}>
        <EmptyState icon={CheckCircle2} title="¡Pago recibido! Tu taquiza está confirmada" action={<ButtonLink href={`${manage}&nuevo=1`}>Ver mi taquiza</ButtonLink>}>
          Guarda el enlace de tu taquiza para verla o cambiarla.
        </EmptyState>
      </div>
    );
  }
  if (resultado === "rechazado" || status === "rejected") {
    return (
      <div className={wrap}>
        <EmptyState icon={XCircle} title="El pago no pasó" action={<RetryPayment code={d.booking.code} token={token} manageHref={manage} />}>
          No se hizo ningún cargo. Puedes intentar con otra tarjeta; tu fecha sigue apartada un rato.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className={wrap}>
      <EmptyState icon={Clock} title="Estamos confirmando tu pago" action={<ButtonLink href={manage}>Ver mi taquiza</ButtonLink>}>
        En cuanto el banco lo confirme, tu taquiza queda lista. Puede tardar unos minutos.
      </EmptyState>
    </div>
  );
}
