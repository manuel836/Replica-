import { CalendarPlus, Link2Off, MapPin, MessageCircle, PartyPopper, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { Timeline } from "@/components/ui/Misc";
import { PriceSummary } from "@/components/ui/PriceSummary";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMXN, whatsappLink } from "@/lib/format";
import type { BookingEvent } from "@/lib/types";
import { renderTemplate } from "@/server/domain/messages";
import { refundableCents } from "@/server/domain/money";
import { formatDateLong, formatStamp, localTime, refundDeadline } from "@/server/domain/time";
import { daysUntil } from "@/server/services/bookings";
import { customerBooking } from "@/server/services/views";
import { ManageActions } from "./ManageActions";

export const metadata = { title: "Tu taquiza", robots: { index: false } };

const EVENT_LABEL: Partial<Record<BookingEvent["type"], string>> = {
  created: "Solicitud recibida",
  accepted: "Confirmada",
  declined: "No pudimos atenderla",
  proposed: "Te propusimos otra fecha",
  proposal_accepted: "Aceptaste la nueva fecha",
  proposal_rejected: "No aceptaste la nueva fecha",
  rescheduled: "Cambiaste la fecha o los invitados",
  cancelled: "Cancelada",
  payment: "Movimiento de pago",
  refund: "Anticipo devuelto",
  completed: "¡Evento realizado!",
  expired: "Venció sin respuesta",
};

const HEADLINE: Record<string, { title: string; body: string; tone: "success" | "info" | "warning" }> = {
  confirmed: { title: "¡Listo! Tu taquiza está confirmada", body: "Te esperamos con la plancha encendida.", tone: "success" },
  requested: {
    title: "Recibimos tu solicitud",
    body: "Tu fecha está apartada mientras te confirmamos por WhatsApp.",
    tone: "info",
  },
  awaiting_payment: { title: "Falta tu anticipo", body: "Paga el anticipo para confirmar tu fecha.", tone: "warning" },
};

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ k?: string; nuevo?: string }>;
}) {
  const { codigo } = await params;
  const { k, nuevo } = await searchParams;
  const d = await customerBooking(codigo, k);

  if (!d) {
    return (
      <div className="mx-auto w-full max-w-flow px-4 py-12">
        <EmptyState as="h1" icon={Link2Off} title="Este enlace no funciona" action={<ButtonLink href="/">Ir al inicio</ButtonLink>}>
          Puede que esté incompleto o que lo hayamos cambiado. Pídenos el enlace actualizado por WhatsApp.
        </EmptyState>
      </div>
    );
  }

  const { business, booking, customer, pkg, payments, events } = d;
  const tz = business.timezone;
  const paidDeposit = payments.some((p) => p.kind === "deposit" && (p.status === "approved" || p.status === "refunded"));
  const refunded = payments.filter((p) => p.kind === "refund").reduce((s, p) => s + p.amountCents, 0);
  const daysLeft = daysUntil(booking.eventDate, business);
  const refundable = daysLeft >= business.refundCutoffDays;
  // Hasta cuándo se devuelve el anticipo, con fecha y monto (no "faltan N días").
  const deadlineLabel = formatDateLong(refundDeadline(booking.eventDate, business.refundCutoffDays));
  const onlineDeposit = payments.find((p) => p.kind === "deposit" && p.status === "approved" && p.provider !== "manual");
  const backCents = onlineDeposit ? refundableCents(onlineDeposit, payments) : booking.depositCents;
  const active = ["requested", "awaiting_payment", "confirmed", "proposed"].includes(booking.status);
  const refundTerms = refundable
    ? `Si cancelas a más tardar el ${deadlineLabel}, te devolvemos ${formatMXN(backCents)} del anticipo. Después de esa fecha ya no se devuelve.`
    : `El anticipo ya no es reembolsable: el plazo para cancelar con devolución terminó el ${deadlineLabel}.`;
  const head = nuevo ? HEADLINE[booking.status] : undefined;
  const requestText =
    business.whatsappE164 && customer
      ? renderTemplate("request_received", { business, booking, customer, pkg, link: "" })
      : null;
  const manageQuery = `k=${encodeURIComponent(k!)}`;

  return (
    <div className="mx-auto flex w-full max-w-flow flex-col gap-6 px-4 py-8">
      {head && (
        <div className="flex flex-col items-start gap-3">
          <PartyPopper aria-hidden className="size-10 text-accent-text" />
          <h1 className="text-xl text-text md:text-display">{head.title}</h1>
          <p className="text-lg font-normal text-text-muted">{head.body}</p>
        </div>
      )}
      {!head && <h1 className="text-xl text-text">Tu taquiza</h1>}

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={booking.status} />
        <span className="text-sm text-text-muted">
          Código <span className="font-mono font-semibold text-text">{booking.code}</span>
        </span>
      </div>

      {booking.status === "proposed" && booking.proposedEventDate && booking.proposedStartAt && (
        <Alert tone="info" title="Te propusimos otra fecha">
          <span className="first-letter:uppercase">
            {formatDateLong(booking.proposedEventDate)} a las {localTime(booking.proposedStartAt, tz)}.
          </span>{" "}
          {booking.proposalExpiresAt && `Responde antes del ${formatStamp(booking.proposalExpiresAt, tz)}.`}
        </Alert>
      )}
      {booking.status === "declined" && (
        <Alert tone="danger" title="Esta vez no pudimos atender tu taquiza">
          {booking.cancelReason}
        </Alert>
      )}

      <section aria-labelledby="detalles" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="detalles" className="font-display text-lg text-text first-letter:uppercase">
          {formatDateLong(booking.eventDate)} · {localTime(booking.startAt, tz)}
        </h2>
        <p className="flex items-center gap-2 text-text">
          <Users aria-hidden className="size-4 text-text-muted" />
          {booking.guests} invitados · {pkg?.name}
        </p>
        <p className="flex items-start gap-2 text-text">
          <MapPin aria-hidden className="mt-1 size-4 shrink-0 text-text-muted" />
          <span>
            {booking.address}, {booking.neighborhood}
            {booking.addressNotes && <span className="block text-sm text-text-muted">{booking.addressNotes}</span>}
          </span>
        </p>
        {customer && <p className="text-sm text-text-muted">A nombre de {customer.name}</p>}
      </section>

      <PriceSummary
        packageName={pkg?.name ?? "Paquete"}
        guests={booking.guests}
        pricePerGuestCents={booking.pricePerGuestCents}
        travelFeeCents={booking.travelFeeCents}
        addonsCents={booking.addonsCents}
        depositCents={booking.depositCents}
      />
      {paidDeposit && (
        <Alert tone="success" title={`Anticipo pagado: ${formatMXN(booking.depositCents)}`}>
          {active && refundTerms}
        </Alert>
      )}
      {!paidDeposit && active && booking.depositCents > 0 && refundable && (
        <p className="text-sm text-text-muted">
          Si pagas el anticipo y luego cancelas a más tardar el {deadlineLabel}, te lo devolvemos completo.
        </p>
      )}
      {refunded > 0 && <Alert tone="info" title={`Te devolvimos ${formatMXN(refunded)}`}>Puede tardar unos días en verse en tu tarjeta.</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {requestText && nuevo && (
          <ButtonLink variant="whatsapp" external href={whatsappLink(business.whatsappE164!, requestText)}>
            <MessageCircle aria-hidden className="size-5" />
            Avisar por WhatsApp
          </ButtonLink>
        )}
        {["requested", "awaiting_payment", "confirmed"].includes(booking.status) && (
          <ButtonLink variant="secondary" href={`/t/${booking.code}/evento.ics?${manageQuery}`}>
            <CalendarPlus aria-hidden className="size-5" />
            Agregar a mi calendario
          </ButtonLink>
        )}
      </div>

      <ManageActions
        code={booking.code}
        token={k!}
        status={booking.status}
        canPay={booking.depositCents > 0 && !paidDeposit && ["requested", "awaiting_payment", "confirmed"].includes(booking.status)}
        depositLabel={formatMXN(booking.depositCents)}
        cancelPolicy={business.cancellationPolicy}
        refundNote={paidDeposit ? refundTerms : null}
        changeHref={`/t/${booking.code}/cambiar?${manageQuery}`}
      />

      <p className="text-sm text-text-muted">
        Guarda este enlace: con él puedes ver, cambiar o cancelar tu taquiza. No lo compartas.
      </p>

      <section aria-labelledby="historial" className="flex flex-col gap-3">
        <h2 id="historial" className="text-lg text-text">
          Historial
        </h2>
        <Timeline
          items={events
            .filter((e) => EVENT_LABEL[e.type])
            .map((e) => ({ id: e.id, title: EVENT_LABEL[e.type]!, at: formatStamp(e.createdAt, tz) }))}
        />
      </section>
    </div>
  );
}
