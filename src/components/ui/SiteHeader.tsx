import { buttonClass } from "./Button";

/**
 * Encabezado público. El logo real de D' Garden Tacos va aquí cuando el dueño entregue el
 * archivo (SVG o PNG). Mientras tanto se usa el nombre escrito con la fuente de títulos.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 bg-ink text-on-ink">
      <div className="mx-auto flex h-header-mobile max-w-content items-center justify-between gap-4 px-4 md:h-header">
        <a href="/" className="flex items-center gap-2 rounded-md focus-visible:outline-brand">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-pill border-2 border-brand font-display text-sm font-extrabold text-brand"
          >
            DG
          </span>
          <span className="font-display text-base font-extrabold leading-none whitespace-nowrap sm:text-lg">
            <span className="text-brand">D&apos; Garden</span> Tacos
          </span>
        </a>
        <nav aria-label="Principal" className="flex items-center gap-2">
          <a
            href="/paquetes"
            className="hidden h-11 items-center rounded-md px-3 text-sm font-medium text-on-ink-muted hover:text-on-ink sm:flex focus-visible:outline-brand"
          >
            Paquetes
          </a>
          <a href="/agendar" className={buttonClass({ variant: "primary", size: "md" })}>
            Agendar<span className="max-sm:sr-only"> taquiza</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
