import { Link2Off } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { addDaysLocal, formatDateLong, localTime, todayLocal } from "@/server/domain/time";
import { customerBooking } from "@/server/services/views";
import { RescheduleForm } from "./RescheduleForm";

export const metadata = { title: "Cambiar tu taquiza", robots: { index: false } };

export default async function ReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { codigo } = await params;
  const { k } = await searchParams;
  const d = await customerBooking(codigo, k);
  const wrap = "mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-8";
  if (!d || !k) {
    return (
      <div className={wrap}>
        <EmptyState icon={Link2Off} title="Este enlace no funciona" action={<ButtonLink href="/">Ir al inicio</ButtonLink>}>
          Pídenos el enlace actualizado por WhatsApp.
        </EmptyState>
      </div>
    );
  }
  const { business, booking, pkg } = d;
  const back = `/t/${booking.code}?k=${encodeURIComponent(k)}`;
  if (!["requested", "confirmed", "awaiting_payment"].includes(booking.status)) {
    return (
      <div className={wrap}>
        <Alert tone="warning" title="Esta taquiza ya no se puede cambiar" action={<ButtonLink variant="secondary" href={back}>Volver</ButtonLink>} />
      </div>
    );
  }
  const today = todayLocal(business.timezone);
  const minGuests = pkg?.minGuests ?? 1;
  const maxGuests = pkg?.maxGuests ?? 2000;

  return (
    <div className={wrap}>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl text-text">Cambiar tu taquiza</h1>
        <p className="text-text-muted first-letter:uppercase">
          Ahora: {formatDateLong(booking.eventDate)} a las {localTime(booking.startAt, business.timezone)}, {booking.guests} invitados.
        </p>
        {business.confirmationMode === "manual" && (
          <p className="text-sm text-text-muted">Al cambiarla, te volvemos a confirmar por WhatsApp.</p>
        )}
      </div>
      <RescheduleForm
        code={booking.code}
        token={k}
        backHref={back}
        currentGuests={booking.guests}
        currentDate={booking.eventDate}
        minGuests={minGuests}
        maxGuests={maxGuests}
        pricePerGuestCents={booking.pricePerGuestCents}
        currentTotalCents={booking.totalCents}
        fixedCents={booking.travelFeeCents + booking.addonsCents}
        firstMonth={addDaysLocal(today, business.minNoticeDays).slice(0, 7)}
        lastMonth={addDaysLocal(today, business.maxAdvanceDays).slice(0, 7)}
      />
    </div>
  );
}
