import { cn } from "@/lib/cn";
import { formatMXN } from "@/lib/format";

interface PriceSummaryProps {
  packageName: string;
  guests: number;
  pricePerGuestCents: number;
  travelFeeCents?: number;
  addonsCents?: number;
  depositCents?: number;
  /** "Total estimado" antes de confirmar, "Total" después. */
  estimated?: boolean;
  className?: string;
}

export function PriceSummary({
  packageName,
  guests,
  pricePerGuestCents,
  travelFeeCents = 0,
  addonsCents = 0,
  depositCents = 0,
  estimated = false,
  className,
}: PriceSummaryProps) {
  const subtotal = pricePerGuestCents * guests;
  const total = subtotal + travelFeeCents + addonsCents;
  const row = "flex items-baseline justify-between gap-4";

  return (
    <dl className={cn("flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-base", className)}>
      <div className={row}>
        <dt className="text-text-muted">
          {packageName} · {guests} × {formatMXN(pricePerGuestCents)}
        </dt>
        <dd className="tabular-nums text-text">{formatMXN(subtotal)}</dd>
      </div>
      {addonsCents > 0 && (
        <div className={row}>
          <dt className="text-text-muted">Complementos</dt>
          <dd className="tabular-nums text-text">{formatMXN(addonsCents)}</dd>
        </div>
      )}
      <div className={row}>
        <dt className="text-text-muted">Traslado</dt>
        <dd className="tabular-nums text-text">{travelFeeCents > 0 ? formatMXN(travelFeeCents) : "Sin costo"}</dd>
      </div>
      <div className={cn(row, "border-t border-border pt-2")}>
        <dt className="font-semibold text-text">{estimated ? "Total estimado" : "Total"}</dt>
        <dd className="text-lg font-bold tabular-nums text-text">{formatMXN(total)}</dd>
      </div>
      {depositCents > 0 && (
        <>
          <div className={cn(row, "rounded-md bg-accent-subtle px-3 py-2")}>
            <dt className="font-semibold text-text">Anticipo para apartar</dt>
            <dd className="font-bold tabular-nums text-text">{formatMXN(depositCents)}</dd>
          </div>
          <div className={row}>
            <dt className="text-sm text-text-muted">Restante el día del evento</dt>
            <dd className="text-sm tabular-nums text-text-muted">{formatMXN(total - depositCents)}</dd>
          </div>
        </>
      )}
    </dl>
  );
}
