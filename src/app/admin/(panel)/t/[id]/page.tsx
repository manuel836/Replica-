import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Mail, MessageCircle, Phone, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { MapLink, Timeline } from "@/components/ui/Misc";
import { PriceSummary } from "@/components/ui/PriceSummary";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMXN } from "@/lib/format";
import type { BookingEvent, Payment } from "@/lib/types";
import { requireAdminPage } from "@/server/auth";
import { EMAIL_LABELS } from "@/server/customer-email";
import { moneySummary, refundableCents } from "@/server/domain/money";
import { TEMPLATE_LABELS } from "@/server/domain/messages";
import { formatDateLong, formatStamp, localTime } from "@/server/domain/time";
import { bookingDetail, suggestedTemplate } from "@/server/services/views";
import { BookingActions, NotesForm, PaymentForm, RefundForm } from "./DetailClient";

export const metadata = { title: "Taquiza" };

const EVENT: Record<BookingEvent["type"], string> = {
  created: "Creada",
  accepted: "Aceptada",
  declined: "Rechazada",
  proposed: "Se propuso otra fecha",
  proposal_accepted: "El cliente aceptó la propuesta",
  proposal_rejected: "El cliente rechazó la propuesta",
  rescheduled: "Cambió fecha o invitados",
  cancelled: "Cancelada",
  payment: "Pago",
  refund: "Reembolso",
  message: "Mensaje de WhatsApp preparado",
  completed: "Completada",
  no_show: "No se realizó",
  expired: "Venció",
  note: "Nota",
};
const ACTOR = { customer: "cliente", business: "negocio", system: "sistema" } as const;
const PAY_KIND: Record<Payment["kind"], string> = { deposit: "Anticipo", balance: "Saldo", refund: "Reembolso" };
const PAY_METHOD: Record<Payment["method"], string> = {
  card: "tarjeta",
  mp_wallet: "Mercado Pago",
  oxxo: "OXXO",
  spei: "SPEI",
  cash: "efectivo",
  transfer: "transferencia",
};
const PAY_STATUS: Record<Payment["status"], string> = {
  pending: "pendiente",
  approved: "aprobado",
  rejected: "rechazado",
  cancelled: "cancelado",
  refunded: "reembolsado",
};

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { id } = await params;
  const { aviso } = await searchParams;
  const d = await bookingDetail(id);
  if (!d) notFound();
  const { business, booking, customer, pkg, zone, payments, events } = d;
  const tz = business.timezone;
  const money = moneySummary(payments, booking.totalCents);
  const admin = await requireAdminPage();
  const onlineDeposit = payments.find((p) => p.kind === "deposit" && p.status === "approved" && p.provider !== "manual");
  const refundable = onlineDeposit ? refundableCents(onlineDeposit, payments) : 0;
  const suggested = suggestedTemplate(booking);
  const fullAddress = [booking.address, booking.neighborhood, business.city].filter(Boolean).join(", ");

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6">
      <a href="/admin" className="flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-text-muted hover:text-text">
        <ArrowLeft aria-hidden className="size-4" />
        Agenda
      </a>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl text-text">{customer?.name ?? "Cliente"}</h1>
          <StatusBadge status={booking.status} />
        </div>
        <p className="text-text first-letter:uppercase">
          {formatDateLong(booking.eventDate)} · {localTime(booking.startAt, tz)} a {localTime(booking.endAt, tz)}
        </p>
        <p className="text-sm text-text-muted">
          <span className="font-mono">{booking.code}</span> · {booking.source === "manual" ? "registrada en el panel" : "agendada en línea"}
          {booking.capacityOverride && " · se forzó la capacidad"}
        </p>
      </header>

      {aviso && <Alert tone="warning" title={aviso} />}
      {booking.needsAttention && (
        <Alert tone="danger" title="Requiere atención">
          Llegó un pago pero el horario ya no estaba libre. Acepta forzando la capacidad, propón otra fecha o reembolsa.
        </Alert>
      )}
      {booking.status === "proposed" && booking.proposedEventDate && booking.proposedStartAt && (
        <Alert tone="info" title="Esperando respuesta del cliente">
          Propuesta: {formatDateLong(booking.proposedEventDate)} a las {localTime(booking.proposedStartAt, tz)}
          {booking.proposalExpiresAt && ` · vence ${formatStamp(booking.proposalExpiresAt, tz)}`}
        </Alert>
      )}
      {(booking.status === "requested" || booking.status === "awaiting_payment") && booking.holdExpiresAt && (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <AlertTriangle aria-hidden className="size-4 text-warning" />
          {booking.holdExpiresAt > new Date()
            ? `La fecha está apartada hasta ${formatStamp(booking.holdExpiresAt, tz)}.`
            : "El apartado ya venció: al aceptar se revisa si todavía hay lugar."}
        </p>
      )}

      <BookingActions
        id={booking.id}
        status={booking.status}
        needsAttention={booking.needsAttention}
        hasOnlineDeposit={payments.some((p) => p.kind === "deposit" && p.status === "approved" && p.provider !== "manual")}
        guests={booking.guests}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="evento" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <h2 id="evento" className="font-display text-lg text-text">
              Evento
            </h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-muted">Invitados y paquete</dt>
                <dd className="flex items-center gap-1.5 text-text">
                  <Users aria-hidden className="size-4" />
                  {booking.guests} · {pkg?.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Tipo de evento</dt>
                <dd className="text-text">{booking.eventType || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-text-muted">Dirección{zone ? ` · ${zone.name}` : ""}</dt>
                <dd className="text-text">
                  {booking.address}, {booking.neighborhood}
                  {booking.addressNotes && <span className="block text-text-muted">{booking.addressNotes}</span>}
                  <MapLink address={fullAddress} />
                </dd>
              </div>
              {booking.customerNotes && (
                <div className="sm:col-span-2">
                  <dt className="text-text-muted">Notas del cliente</dt>
                  <dd className="whitespace-pre-line text-text">{booking.customerNotes}</dd>
                </div>
              )}
            </dl>
          </section>

          <section aria-labelledby="dinero" className="flex flex-col gap-3">
            <h2 id="dinero" className="font-display text-lg text-text">
              Dinero
            </h2>
            <PriceSummary
              packageName={pkg?.name ?? "Paquete"}
              guests={booking.guests}
              pricePerGuestCents={booking.pricePerGuestCents}
              travelFeeCents={booking.travelFeeCents}
              addonsCents={booking.addonsCents}
              depositCents={booking.depositCents}
            />
            {payments.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 text-sm" aria-label="Pagos">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2">
                    <span className="text-text">
                      {PAY_KIND[p.kind]} · {PAY_METHOD[p.method]} · <span className="text-text-muted">{PAY_STATUS[p.status]}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-text">
                      {p.kind === "refund" ? "−" : ""}
                      {formatMXN(p.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-text">
              Pagado: <strong>{formatMXN(money.paidCents)}</strong> · Por cobrar: <strong>{formatMXN(money.dueCents)}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <PaymentForm id={booking.id} suggestedPesos={money.dueCents / 100} />
              {admin.role === "owner" && refundable > 0 && <RefundForm id={booking.id} maxCents={refundable} />}
            </div>
          </section>

          <NotesForm id={booking.id} initial={booking.internalNotes} />
        </div>

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="cliente" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <h2 id="cliente" className="font-display text-lg text-text">
              Cliente
            </h2>
            {customer?.whatsappE164 ? (
              <a href={`tel:${customer.whatsappE164}`} className="flex min-h-11 items-center gap-2 text-text hover:underline">
                <Phone aria-hidden className="size-4 text-text-muted" />
                {customer.whatsappE164.replace(/^\+52(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3")}
              </a>
            ) : (
              <p className="text-sm text-text-muted">Sin teléfono</p>
            )}
            {customer?.email && (
              <a href={`mailto:${customer.email}`} className="flex min-h-11 items-center gap-2 break-all text-text hover:underline">
                <Mail aria-hidden className="size-4 text-text-muted" />
                {customer.email}
              </a>
            )}
            {customer?.whatsappE164 && (
              <div className="flex flex-col gap-2">
                {suggested && (
                  <ButtonLink variant="whatsapp" external href={`/admin/t/${booking.id}/whatsapp?plantilla=${suggested}`}>
                    <MessageCircle aria-hidden className="size-5" />
                    {TEMPLATE_LABELS[suggested]}
                  </ButtonLink>
                )}
                <details className="text-sm">
                  <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent-text">Otros mensajes</summary>
                  <ul className="flex flex-col gap-1 pt-1">
                    {(["confirmed", "reminder", "payment_link", "review_request"] as const)
                      .filter((t) => t !== suggested)
                      .map((t) => (
                        <li key={t}>
                          <a
                            href={`/admin/t/${booking.id}/whatsapp?plantilla=${t}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-11 items-center gap-2 text-text hover:underline"
                          >
                            <MessageCircle aria-hidden className="size-4 text-text-muted" />
                            {TEMPLATE_LABELS[t]}
                          </a>
                        </li>
                      ))}
                  </ul>
                </details>
              </div>
            )}
          </section>

          <section aria-labelledby="historial" className="flex flex-col gap-3">
            <h2 id="historial" className="font-display text-lg text-text">
              Historial
            </h2>
            <Timeline
              items={events.map((e) => ({
                id: e.id,
                title:
                  e.type === "message" && e.data.channel === "email"
                    ? `Correo al cliente: ${EMAIL_LABELS[e.data.template as keyof typeof EMAIL_LABELS] ?? "aviso"}`
                    : EVENT[e.type] +
                      (e.type === "message" && typeof e.data.template === "string"
                        ? `: ${TEMPLATE_LABELS[e.data.template as keyof typeof TEMPLATE_LABELS] ?? ""}`
                        : ""),
                at: formatStamp(e.createdAt, tz),
                actor: ACTOR[e.actor],
              }))}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
