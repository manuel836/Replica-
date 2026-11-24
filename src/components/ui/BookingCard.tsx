import { AlertTriangle, CalendarDays, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { StatusBadge, type BookingStatus } from "./StatusBadge";

export interface BookingSummary {
  id: string;
  code: string;
  customerName: string;
  /** Ya formateada en la zona del negocio, ej. "sáb 14 dic · 14:00". */
  when: string;
  guests: number;
  packageName: string;
  neighborhood?: string;
  status: BookingStatus;
  needsAttention?: boolean;
  past?: boolean;
}

/** Tarjeta de la agenda (S11). Toda la tarjeta es un enlace al detalle (S12). */
export function BookingCard({ booking, href }: { booking: BookingSummary; href: string }) {
  const pending = booking.status === "requested" || booking.status === "awaiting_payment";
  return (
    <a
      href={href}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border p-4",
        "transition-colors duration-150 ease-brand hover:border-border-input",
        pending && "border-l-4 border-l-accent",
        booking.past ? "bg-surface-muted" : "bg-surface shadow-card",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-text">{booking.customerName}</span>
        <StatusBadge status={booking.status} />
      </div>
      <p className="flex items-center gap-1.5 text-sm text-text">
        <CalendarDays aria-hidden className="size-4 text-text-muted" />
        {booking.when}
      </p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
        <span className="flex items-center gap-1.5">
          <Users aria-hidden className="size-4" />
          {booking.guests} invitados · {booking.packageName}
        </span>
        {booking.neighborhood && (
          <span className="flex items-center gap-1.5">
            <MapPin aria-hidden className="size-4" />
            {booking.neighborhood}
          </span>
        )}
      </p>
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span className="font-mono">{booking.code}</span>
        {booking.needsAttention && (
          <span className="flex items-center gap-1 font-semibold text-danger">
            <AlertTriangle aria-hidden className="size-3.5" />
            Requiere atención
          </span>
        )}
      </div>
    </a>
  );
}
