"use client";

import { useId } from "react";
import { ImageIcon, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { mapsLink } from "@/lib/format";

/* ---------- Galería (S01) ---------- */

export interface Photo {
  src: string;
  alt: string;
}

const scroller = "flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-lg pb-2";

/** Carrusel con scroll nativo: se desliza con el dedo, el teclado y el lector de pantalla lo recorren como lista. */
export function Gallery({ photos, placeholderCount = 3 }: { photos: Photo[]; placeholderCount?: number }) {
  if (photos.length === 0) {
    return (
      <ul tabIndex={0} className={scroller} aria-label="Fotos del negocio">
        {Array.from({ length: placeholderCount }, (_, i) => (
          <li
            key={i}
            className="flex aspect-[4/3] w-4/5 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-lg bg-surface-muted text-sm text-text-muted sm:w-80"
          >
            <ImageIcon aria-hidden className="size-8" />
            Foto pendiente
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul tabIndex={0} className={scroller} aria-label="Fotos del negocio">
      {photos.map((p) => (
        <li key={p.src} className="aspect-[4/3] w-4/5 shrink-0 snap-start overflow-hidden rounded-lg sm:w-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.src} alt={p.alt} className="size-full object-cover" loading="lazy" />
        </li>
      ))}
    </ul>
  );
}

/* ---------- Enlace a mapa (S04, S12) ---------- */

export function MapLink({ address, label = "Ver en el mapa" }: { address: string; label?: string }) {
  return (
    <a
      href={mapsLink(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent-text underline underline-offset-4 hover:no-underline"
    >
      <MapPin aria-hidden className="size-4" />
      {label}
      <span className="sr-only"> (se abre Google Maps en otra pestaña)</span>
    </a>
  );
}

/* ---------- Estrellas (S01, S19) ---------- */

export function StarsDisplay({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${rating} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn("size-4", n <= Math.round(rating) ? "fill-accent text-accent-text" : "text-border-input")}
        />
      ))}
    </span>
  );
}

/** Radios nativos: las flechas cambian la calificación. */
export function StarsInput({
  value,
  onChange,
  legend = "Tu calificación",
}: {
  value: number;
  onChange: (n: number) => void;
  legend?: string;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-text">{legend}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <span className="sr-only">{n === 1 ? "1 estrella" : `${n} estrellas`}</span>
            <span className="flex size-11 items-center justify-center rounded-md peer-focus-visible:outline-2 peer-focus-visible:outline-focus">
              <Star
                aria-hidden
                className={cn("size-8 transition-colors", n <= value ? "fill-accent text-accent-text" : "text-border-input")}
              />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ---------- Línea de tiempo (S07, S12) ---------- */

export interface TimelineItem {
  id: string;
  title: string;
  /** Ya formateada, ej. "12 dic, 18:04". */
  at: string;
  actor?: "cliente" | "negocio" | "sistema";
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="flex flex-col" aria-label="Historial">
      {items.map((item, i) => (
        <li key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span aria-hidden className={cn("mt-1.5 size-2.5 rounded-pill", i === 0 ? "bg-accent-text" : "bg-border-input")} />
            {i < items.length - 1 && <span aria-hidden className="w-px flex-1 bg-border" />}
          </div>
          <div className="flex flex-col pb-4">
            <span className="text-sm font-medium text-text">{item.title}</span>
            <span className="text-xs text-text-muted">
              {item.at}
              {item.actor && ` · ${item.actor}`}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
