import {
  Ban,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Hourglass,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

import type { BookingStatus } from "@/lib/types";

export type { BookingStatus };

type Tone = "warning" | "success" | "accent" | "danger" | "neutral";

const STATUS: Record<BookingStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  requested: { label: "Solicitada", tone: "warning", icon: Clock },
  awaiting_payment: { label: "Pendiente de pago", tone: "warning", icon: CreditCard },
  confirmed: { label: "Confirmada", tone: "success", icon: CheckCircle2 },
  proposed: { label: "Otra fecha propuesta", tone: "accent", icon: CalendarClock },
  declined: { label: "Rechazada", tone: "danger", icon: XCircle },
  cancelled_by_customer: { label: "Cancelada por el cliente", tone: "neutral", icon: Ban },
  cancelled_by_business: { label: "Cancelada por el negocio", tone: "neutral", icon: Ban },
  completed: { label: "Completada", tone: "neutral", icon: CheckCheck },
  no_show: { label: "No se realizó", tone: "danger", icon: UserX },
  expired: { label: "Vencida", tone: "neutral", icon: Hourglass },
};

const TONES: Record<Tone, string> = {
  warning: "bg-warning-subtle text-warning",
  success: "bg-success-subtle text-success",
  accent: "bg-accent-subtle text-accent-text",
  danger: "bg-danger-subtle text-danger",
  neutral: "bg-neutral-subtle text-text-muted",
};

export const statusLabel = (s: BookingStatus) => STATUS[s].label;

/** El color nunca va solo: cada estado lleva ícono y texto. */
export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const { label, tone, icon: Icon } = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
