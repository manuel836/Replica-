"use client";

import { Check, ImageIcon, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMXN } from "@/lib/format";

export interface PackageInfo {
  id: string;
  name: string;
  description?: string;
  pricePerGuestCents: number;
  minGuests: number;
  maxGuests?: number | null;
  includes?: string[];
  photoUrl?: string | null;
  isActive?: boolean;
}

interface PackageCardProps {
  pkg: PackageInfo;
  variant?: "compact" | "full";
  /** Si se pasa, la tarjeta es un radio para elegir paquete en el formulario. */
  selectable?: { name: string; checked: boolean; onChange: () => void };
  /** Nivel del título según la página (h2 si la tarjeta va directo bajo el h1). */
  headingLevel?: "h2" | "h3";
}

export function PackageCard({ pkg, variant = "full", selectable, headingLevel = "h3" }: PackageCardProps) {
  const Heading = headingLevel;
  const inactive = pkg.isActive === false;
  const guests = pkg.maxGuests ? `${pkg.minGuests} a ${pkg.maxGuests} invitados` : `Desde ${pkg.minGuests} invitados`;

  const body = (
    <>
      {variant === "full" && (
        <div className="flex aspect-[16/9] items-center justify-center overflow-hidden rounded-md bg-surface-muted">
          {pkg.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pkg.photoUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon aria-hidden className="size-8 text-text-muted" />
          )}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <Heading className="font-display text-lg text-text">{pkg.name}</Heading>
          {selectable && (
            <span
              aria-hidden
              className={cn(
                "mt-1 flex size-6 shrink-0 items-center justify-center rounded-pill border",
                selectable.checked ? "border-accent bg-accent text-on-accent" : "border-border-input bg-surface",
              )}
            >
              {selectable.checked && <Check className="size-4" />}
            </span>
          )}
        </div>
        <p className="text-base text-text">
          <span className="text-xl font-bold">{formatMXN(pkg.pricePerGuestCents)}</span>
          <span className="text-text-muted"> por persona</span>
        </p>
        <p className="flex items-center gap-1.5 text-sm text-text-muted">
          <Users aria-hidden className="size-4" />
          {guests}
        </p>
        {inactive && <p className="text-sm font-medium text-warning">No disponible por ahora</p>}
      </div>
      {variant === "full" && pkg.description && <p className="text-sm text-text-muted">{pkg.description}</p>}
      {variant === "full" && pkg.includes && pkg.includes.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm text-text" aria-label="Incluye">
          {pkg.includes.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const shell = "flex flex-col gap-3 rounded-lg border p-4";

  if (selectable) {
    const id = `${selectable.name}-${pkg.id}`;
    return (
      <div>
        <input
          type="radio"
          id={id}
          name={selectable.name}
          value={pkg.id}
          checked={selectable.checked}
          onChange={selectable.onChange}
          disabled={inactive}
          className="peer sr-only"
        />
        <label
          htmlFor={id}
          className={cn(
            shell,
            "cursor-pointer bg-surface shadow-card transition-colors duration-150 ease-brand hover:border-border-input",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
            "peer-disabled:cursor-not-allowed peer-disabled:bg-surface-muted",
            selectable.checked ? "border-accent ring-2 ring-accent" : "border-border",
          )}
        >
          {body}
        </label>
      </div>
    );
  }

  return <article className={cn(shell, "border-border", inactive ? "bg-surface-muted" : "bg-surface shadow-card")}>{body}</article>;
}
