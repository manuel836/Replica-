import { BellRing, CalendarX, MessageCircle } from "lucide-react";
import { BookingCard } from "@/components/ui/BookingCard";
import { ButtonLink } from "@/components/ui/Button";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";
import { formatDateLong, formatDateShort, localTime } from "@/server/domain/time";
import { agenda, type AgendaTab, type BookingRow } from "@/server/services/views";
import { ReviewQueue } from "./ReviewQueue";

export const metadata = { title: "Agenda" };

const TABS: { id: AgendaTab; label: string }[] = [
  { id: "pendientes", label: "Por responder" },
  { id: "proximas", label: "Próximas" },
  { id: "pasadas", label: "Pasadas" },
  { id: "canceladas", label: "Canceladas" },
];

const EMPTY: Record<AgendaTab, { title: string; text: string }> = {
  pendientes: { title: "Nada por responder", text: "Cuando alguien pida una taquiza, aparecerá aquí." },
  proximas: { title: "Sin taquizas confirmadas", text: "Las taquizas que confirmes aparecerán aquí por fecha." },
  pasadas: { title: "Todavía no hay historial", text: "Aquí verás las taquizas que ya pasaron." },
  canceladas: { title: "Nada cancelado", text: "Aquí verás las taquizas rechazadas, canceladas o vencidas." },
};

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ tab?: string; aviso?: string }> }) {
  const { tab: rawTab, aviso } = await searchParams;
  const tab: AgendaTab = TABS.some((t) => t.id === rawTab) ? (rawTab as AgendaTab) : "pendientes";
  const { business, today, rows, counts, tomorrow, unpublishedReviews } = await agenda(tab);
  const tz = business.timezone;

  const groups = new Map<string, BookingRow[]>();
  for (const r of rows) {
    const key = tab === "pendientes" ? "all" : r.booking.eventDate;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6">
      <h1 className="text-xl text-text">Agenda</h1>
      {aviso === "sin-permiso" && <Alert tone="warning" title="Esa sección es solo para el dueño" />}
      {!business.whatsappE164 && (
        <Alert tone="info" title="Falta el WhatsApp del negocio" action={<ButtonLink size="sm" variant="secondary" href="/admin/ajustes">Ir a Ajustes</ButtonLink>}>
          Sin él, tus clientes no ven el botón para escribirte.
        </Alert>
      )}

      {tomorrow.length > 0 && (
        <section aria-labelledby="manana" className="flex flex-col gap-3 rounded-lg border border-accent bg-accent-subtle p-4">
          <h2 id="manana" className="flex items-center gap-2 text-lg text-text">
            <BellRing aria-hidden className="size-5 text-accent-text" />
            Recordatorios de mañana
          </h2>
          <ul className="flex flex-col gap-2">
            {tomorrow.map(({ booking, customer }) => (
              <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface p-3">
                <span className="text-sm text-text">
                  <strong>{localTime(booking.startAt, tz)}</strong> · {customer?.name ?? "Cliente"} · {booking.guests} invitados
                </span>
                {customer?.whatsappE164 && (
                  <ButtonLink size="sm" variant="whatsapp" external href={`/admin/t/${booking.id}/whatsapp?plantilla=reminder`}>
                    <MessageCircle aria-hidden className="size-4" />
                    Recordar
                  </ButtonLink>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {unpublishedReviews.length > 0 && <ReviewQueue reviews={unpublishedReviews.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment }))} />}

      <nav aria-label="Filtrar taquizas" className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const active = t.id === tab;
          const count = t.id === "pendientes" || t.id === "proximas" ? counts[t.id] : null;
          return (
            <a
              key={t.id}
              href={`/admin?tab=${t.id}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold",
                active ? "border-accent-text text-text" : "border-transparent text-text-muted hover:text-text",
              )}
            >
              {t.label}
              {count !== null && count > 0 && (
                <span className={cn("rounded-pill px-2 py-0.5 text-xs", active ? "bg-accent text-on-accent" : "bg-surface-muted text-text-muted")}>
                  {count}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <EmptyState icon={CalendarX} title={EMPTY[tab].title} action={<ButtonLink size="sm" href="/admin/t/nueva">Registrar una taquiza</ButtonLink>}>
          {EMPTY[tab].text}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([key, items]) => (
            <section key={key} aria-label={key === "all" ? "Por responder" : formatDateLong(key)} className="flex flex-col gap-3">
              {key !== "all" && (
                <h2 className="text-sm font-semibold text-text-muted uppercase first-letter:uppercase">
                  {key === today ? "Hoy · " : ""}
                  {formatDateLong(key)}
                </h2>
              )}
              <div className="grid gap-3 lg:grid-cols-2">
                {items.map(({ booking, customer, pkg }) => (
                  <BookingCard
                    key={booking.id}
                    href={`/admin/t/${booking.id}`}
                    booking={{
                      id: booking.id,
                      code: booking.code,
                      customerName: customer?.name ?? "Cliente",
                      when: `${formatDateShort(booking.eventDate)} · ${localTime(booking.startAt, tz)}`,
                      guests: booking.guests,
                      packageName: pkg?.name ?? "",
                      neighborhood: booking.neighborhood,
                      status: booking.status,
                      needsAttention: booking.needsAttention,
                      past: booking.eventDate < today,
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
