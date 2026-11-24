import type { ReactNode } from "react";
import { connection } from "next/server";
import { LogOut } from "lucide-react";
import { AdminNav } from "@/components/ui/AdminNav";
import { cerrarSesion } from "@/server/actions/admin";
import { requireAdminPage } from "@/server/auth";

export const metadata = { title: "Panel", robots: { index: false } };

export default async function PanelLayout({ children }: { children: ReactNode }) {
  await connection();
  const admin = await requireAdminPage();
  return (
    <div className="flex min-h-dvh">
      <AdminNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-header-mobile items-center justify-between gap-4 border-b border-border bg-surface px-4 md:h-header">
          <span className="font-display text-lg font-extrabold text-text md:hidden">D&apos; Garden Tacos</span>
          <span className="hidden text-sm text-text-muted md:block">{admin.email}</span>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-text-muted hover:bg-surface-muted hover:text-text"
            >
              <LogOut aria-hidden className="size-4" />
              Salir
            </button>
          </form>
        </header>
        <main id="contenido" className="flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
