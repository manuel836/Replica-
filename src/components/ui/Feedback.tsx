import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type AlertTone = "info" | "warning" | "danger" | "success";

const ALERT: Record<AlertTone, { cls: string; icon: LucideIcon }> = {
  info: { cls: "bg-accent-subtle text-text", icon: Info },
  warning: { cls: "bg-warning-subtle text-text", icon: AlertTriangle },
  danger: { cls: "bg-danger-subtle text-text", icon: AlertCircle },
  success: { cls: "bg-success-subtle text-text", icon: CheckCircle2 },
};

const ICON_COLOR: Record<AlertTone, string> = {
  info: "text-accent-text",
  warning: "text-warning",
  danger: "text-danger",
  success: "text-success",
};

/** Mensaje dentro de la página. Los de peligro se anuncian de inmediato (role="alert"). */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { cls, icon: Icon } = ALERT[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-md p-4 text-sm", cls, className)}>
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", ICON_COLOR[tone])} />
      <div className="flex flex-1 flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

/** Lo que se ve cuando una lista no tiene nada todavía. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  as: Heading = "h3",
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** Nivel del título. "h1" cuando el mensaje es toda la página. */
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-input bg-surface px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-pill bg-surface-muted">
        <Icon aria-hidden className="size-6 text-text-muted" />
      </span>
      <Heading className="font-display text-lg text-text">{title}</Heading>
      {children && <p className="max-w-sm text-sm text-text-muted">{children}</p>}
      {action}
    </div>
  );
}
