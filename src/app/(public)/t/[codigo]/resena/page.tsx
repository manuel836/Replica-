import { CalendarClock, Heart, Link2Off } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { customerBooking } from "@/server/services/views";
import { ReviewForm } from "./ReviewForm";

export const metadata = { title: "Tu reseña", robots: { index: false } };

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { codigo } = await params;
  const { k } = await searchParams;
  const d = await customerBooking(codigo, k);
  const wrap = "mx-auto flex w-full max-w-flow flex-col gap-6 px-4 py-10";

  if (!d || !k) {
    return (
      <div className={wrap}>
        <EmptyState as="h1" icon={Link2Off} title="Este enlace no funciona" action={<ButtonLink href="/">Ir al inicio</ButtonLink>}>
          Pídenos el enlace actualizado por WhatsApp.
        </EmptyState>
      </div>
    );
  }
  if (d.review) {
    return (
      <div className={wrap}>
        <EmptyState as="h1" icon={Heart} title="¡Gracias! Ya recibimos tu reseña">
          Nos ayuda mucho a mejorar.
        </EmptyState>
      </div>
    );
  }
  if (d.booking.status !== "completed") {
    return (
      <div className={wrap}>
        <EmptyState
          as="h1"
          icon={CalendarClock}
          title="Todavía no es momento"
          action={<ButtonLink variant="secondary" href={`/t/${d.booking.code}?k=${encodeURIComponent(k)}`}>Ver mi taquiza</ButtonLink>}
        >
          Podrás dejar tu reseña después del evento.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className={wrap}>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl text-text">¿Qué tal estuvo tu taquiza?</h1>
        <p className="text-text-muted">Tu opinión le sirve a {d.business.name} y a otras personas que buscan taquiza.</p>
      </div>
      <ReviewForm code={d.booking.code} token={k} />
    </div>
  );
}
