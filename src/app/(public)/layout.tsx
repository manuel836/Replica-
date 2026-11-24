import type { ReactNode } from "react";
import { connection } from "next/server";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { store } from "@/server/data";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  await connection(); // los datos cambian con cada taquiza: nada de páginas pre-generadas
  const business = await store().getBusiness();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <footer className="bg-ink text-on-ink-muted">
        <div className="mx-auto flex max-w-content flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-display font-extrabold text-brand">{business.name}</span> · {business.city}
          </p>
          <nav aria-label="Pie de página" className="flex gap-4">
            <a href="/paquetes" className="min-h-11 content-center hover:text-on-ink focus-visible:outline-brand">
              Paquetes
            </a>
            <a href="/politicas" className="min-h-11 content-center hover:text-on-ink focus-visible:outline-brand">
              Políticas y preguntas
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
